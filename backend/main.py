"""
main.py — FastAPI application entry point.

Endpoints:
  GET  /api/health          — Health check
  POST /api/generate        — SSE stream: crawl → filter → extract → dedupe → assemble → generate
  GET  /api/download/markdown — Download the last generated cheat sheet as .md
"""

from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, HttpUrl
from sse_starlette.sse import EventSourceResponse

from assembler import assemble
from crawler import crawl
from deduplicator import deduplicate
from extractor import extract_all
from generator import generate_stream
from page_filter import filter_and_score

load_dotenv()

# ---------------------------------------------------------------------------
# App state (in-memory, session-scoped per the PRD)
# ---------------------------------------------------------------------------

app_state: dict = {
    "last_markdown": "",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Cheatsheet Generator API", version="1.0.0", lifespan=lifespan)

# Allow the Next.js dev server and any production origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    url: str


# ---------------------------------------------------------------------------
# Helper: validate URL is reachable HTML (FR-2)
# ---------------------------------------------------------------------------

async def validate_url(url: str) -> None:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            resp = await client.head(url)
            if resp.status_code >= 400:
                # Try GET as some servers reject HEAD
                resp = await client.get(url, timeout=10.0)
            content_type = resp.headers.get("content-type", "")
            if resp.status_code >= 400:
                raise HTTPException(status_code=422, detail=f"URL returned HTTP {resp.status_code}")
            if "text/html" not in content_type and "application/xhtml" not in content_type:
                raise HTTPException(status_code=422, detail="URL does not return an HTML page")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"URL is not reachable: {e}")


# ---------------------------------------------------------------------------
# SSE event helpers
# ---------------------------------------------------------------------------

def status_event(message: str) -> str:
    return json.dumps({"type": "status", "message": message})


def token_event(token: str) -> str:
    return json.dumps({"type": "token", "token": token})


def done_event() -> str:
    return json.dumps({"type": "done"})


def error_event(message: str) -> str:
    return json.dumps({"type": "error", "message": message})


# ---------------------------------------------------------------------------
# Main pipeline SSE endpoint
# ---------------------------------------------------------------------------

async def pipeline_stream(url: str):
    """
    Full pipeline as an async generator of SSE-formatted JSON strings.
    """
    markdown_buffer: list[str] = []

    try:
        # Step 0: validate
        yield status_event("Validating URL…")
        await validate_url(url)

        # Step 1: Crawl
        yield status_event("Fetching docs… (crawling up to 30 pages)")
        pages = await crawl(url, max_depth=2, max_pages=30, request_delay=0.3)
        if not pages:
            yield error_event("Could not fetch any pages from this URL. Check the URL and try again.")
            return
        yield status_event(f"Crawled {len(pages)} pages. Filtering…")

        # Step 2: Filter
        filtered = filter_and_score(pages)
        if not filtered:
            yield error_event("No relevant documentation pages found at this URL.")
            return
        yield status_event(f"Found {len(filtered)} relevant pages. Extracting content…")

        # Step 3: Extract
        extracted = extract_all(filtered)
        if not extracted:
            yield error_event("Could not extract readable content from the documentation pages.")
            return
        yield status_event(f"Extracted content from {len(extracted)} pages. Deduplicating…")

        # Step 4: Deduplicate
        deduped = deduplicate(extracted)
        yield status_event(f"{len(deduped)} unique pages after deduplication. Assembling context…")

        # Step 5+6: Assemble + build prompt
        _context, prompt = assemble(deduped)
        yield status_event("Generating cheat sheet…")

        # Step 7: Generate (stream tokens)
        async for token in generate_stream(prompt):
            markdown_buffer.append(token)
            yield token_event(token)

        # Store for download
        app_state["last_markdown"] = "".join(markdown_buffer)

        yield done_event()

    except HTTPException as e:
        yield error_event(e.detail)
    except Exception as e:
        yield error_event(f"Unexpected error: {str(e)}")


@app.post("/api/generate")
async def generate_endpoint(request: Request, body: GenerateRequest):
    async def event_generator():
        async for event_data in pipeline_stream(body.url):
            # Check for client disconnect
            if await request.is_disconnected():
                break
            yield {"data": event_data}

    return EventSourceResponse(event_generator())


# ---------------------------------------------------------------------------
# Download endpoints
# ---------------------------------------------------------------------------

@app.get("/api/download/markdown")
async def download_markdown():
    md = app_state.get("last_markdown", "")
    if not md:
        raise HTTPException(status_code=404, detail="No cheat sheet has been generated yet.")
    return Response(
        content=md.encode("utf-8"),
        media_type="text/markdown",
        headers={"Content-Disposition": 'attachment; filename="cheatsheet.md"'},
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"status": "ok"}
