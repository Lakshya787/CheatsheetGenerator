import json
import asyncio
import os
from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from .schemas import GenerateRequest
from .scraper import fetch_website_contents
from .llm import stream_cheatsheet
from .pdf import create_pdf

load_dotenv()

app = FastAPI()

allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
if allowed_origins_env:
    origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
else:
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://cheatsheet-generator-eight.vercel.app",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*cheatsheet-generator.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/")
def root():
    return {"message": "Cheatsheet Generator API"}


def sse(event: dict) -> str:
    """Format a dict as a Server-Sent Event line."""
    return f"data: {json.dumps(event)}\n\n"


@app.post("/api/generate")
async def generate(request: GenerateRequest):
    """
    Stream a cheatsheet as Server-Sent Events.

    Events emitted:
      {"type": "status",  "message": "..."}   – progress updates
      {"type": "token",   "token": "..."}      – LLM token chunks
      {"type": "done"}                         – stream complete
      {"type": "error",   "message": "..."}    – on failure
    """

    async def event_stream():
        try:
            # Step 1 – fetch the page
            yield sse({"type": "status", "message": "Fetching page…"})
            await asyncio.sleep(0)          # flush to client

            try:
                content = await asyncio.to_thread(
                    fetch_website_contents, str(request.url)
                )
            except Exception as e:
                yield sse({"type": "error", "message": f"Could not fetch page: {e}"})
                return

            # Step 2 – stream LLM tokens
            yield sse({"type": "status", "message": "Generating cheatsheet…"})
            await asyncio.sleep(0)

            try:
                async for token in stream_cheatsheet(content):
                    yield sse({"type": "token", "token": token})
            except (ValueError, RuntimeError) as e:
                yield sse({"type": "error", "message": str(e)})
                return

            # Step 3 – done
            yield sse({"type": "done"})

        except Exception as e:
            print(f"Unexpected stream error: {e}")
            yield sse({"type": "error", "message": "An unexpected error occurred."})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


class PDFRequest(BaseModel):
    markdown: str


@app.post("/api/download/pdf")
async def download_pdf(request: PDFRequest):
    """Generate a PDF from the provided markdown and return it as a download."""
    if not request.markdown.strip():
        return Response(content="No content provided", status_code=400)

    try:
        pdf_buffer = await asyncio.to_thread(create_pdf, request.markdown)
        return Response(
            content=pdf_buffer.read(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=cheatsheet.pdf",
            },
        )
    except Exception as e:
        print(f"PDF generation error: {e}")
        return Response(content="Failed to generate PDF", status_code=500)