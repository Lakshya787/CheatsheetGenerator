# Product Requirements Document (PRD)

## AI Documentation → Cheat Sheet Engine

| | |
|---|---|
| **Document Owner** | Lakshya |
| **Status** | Draft v2.0 |
| **Last Updated** | August 17, 2026 |
| **Category** | AI-Powered Developer Tool |

---

## 1. Overview

### 1.1 Pitch
> Paste a documentation link, get a downloadable cheat sheet.

### 1.2 Summary
The AI Documentation → Cheat Sheet Engine is a single-page tool. The user pastes a documentation URL (e.g. `go.dev/doc/`), clicks Generate, and watches a structured cheat sheet stream in. They can then download it. That's the whole product surface.

Behind that one screen is a real pipeline, not a "paste text into an LLM" wrapper: a crawler discovers relevant documentation pages, a content extractor cleans the HTML, the assembled context is sent to Groq in a single structured prompt, and the response streams back and renders live. The engineering depth is in the pipeline (crawl → filter → extract → assemble → generate → stream) and in producing a clean download, not in UI surface area.

### 1.3 Problem Statement
Developers frequently need to learn or refresh their knowledge of a language, framework, or library quickly. Official documentation is thorough but slow to consume — it's long, unstructured for skimming, and not built to be scanned in five minutes. Generic "AI summarizer" tools produce a wall of prose that isn't meaningfully better than reading the docs. This tool turns a doc site into one clean, structured, downloadable page.

### 1.4 Goal
One page. One input. One action. Paste a link, get a cheat sheet, download it. No accounts, no navigation, nothing else to configure.

### 1.5 Explicit Scope Boundaries
Intentionally excluded — not deferred as "later," just not part of what this tool is:
- **No authentication / user accounts.** Nothing to sign in to.
- **No database.** Nothing is saved beyond the current browser session/tab.
- **No multiple pages or routes.** One screen, start to finish.
- **No mode selection, no sidebar, no settings.** One input, one output.
- **No vector database / embeddings / RAG.** Context is assembled directly from crawled pages for a single one-shot generation.
- **No LangChain, agents, or multi-step autonomous tool-calling.** The pipeline is a fixed, hand-built sequence of deterministic steps plus one LLM call.
- **No chat / follow-up questions.** The output is a generated document, not a conversation.

### 1.6 Non-Goals (v1)
- Not a general-purpose web scraper for arbitrary/non-documentation sites.
- Not a multi-user SaaS product with billing.
- Not a tool for editing or collaborating on the generated cheat sheet.

---

## 2. Target Users

| Persona | Need |
|---|---|
| **Developer learning something new** | Wants a fast, structured overview of a language/framework/library without reading the full docs. |
| **Developer prepping for an interview or a task** | Wants a compact reference they can skim in a few minutes and keep open while working. |
| **Builder (you)** | Wants a small, complete, portfolio-worthy example of an LLM pipeline built from raw APIs — crawling, extraction, streaming, and export — without unnecessary infrastructure. |

---

## 3. Product Pipeline (Core Architecture)

```
Documentation URL (pasted by user)
   ↓
[1] Crawler            → discovers linked pages within the doc domain/path
   ↓
[2] Page Filter        → filters out navigation/irrelevant pages, prioritizes true doc pages
   ↓
[3] Content Extractor  → strips nav/ads/boilerplate, extracts clean text + code blocks
   ↓
[4] Deduplication      → removes near-identical/repeated content blocks across pages
   ↓
[5] Context Assembler  → chunks and budgets content into a token-safe context (if needed)
   ↓
[6] Prompt Builder     → constructs a single one-shot structured prompt
   ↓
[7] Groq LLM Call      → streamed completion, structured Markdown output
   ↓
[8] Stream Parser      → incrementally parses streamed chunks into renderable content
   ↓
[9] Page Renderer      → renders the cheat sheet inline on the same page as it streams
   ↓
[10] Download          → Download PDF or Download Markdown
```

The UI is deliberately thin. Steps 1–5, 8, and 10 are where the actual engineering work is.

---

## 4. Functional Requirements

### 4.1 Input
| ID | Requirement |
|---|---|
| FR-1 | The page shows exactly one input field (paste a documentation URL) and one button (Generate). |
| FR-2 | System validates the URL is reachable and returns HTML before starting the pipeline; if not, show a plain inline error and let the user try again. |

### 4.2 Crawling
| ID | Requirement |
|---|---|
| FR-3 | Crawler starts at the input URL and discovers same-domain, same-path-prefix links up to a configurable depth (default depth = 2). |
| FR-4 | Crawler respects `robots.txt` and includes a reasonable request delay/concurrency cap to avoid hammering target sites. |
| FR-5 | Crawler deduplicates URLs (normalizing trailing slashes, fragments, query params). |
| FR-6 | Crawler caps total pages fetched per run (default 30, configurable) to bound cost/time. |
| FR-7 | Discovered pages are filtered for relevance using URL/heading heuristics (e.g. skip changelogs, blog, download pages) before being sent to the extractor. |

### 4.3 Content Extraction
| ID | Requirement |
|---|---|
| FR-8 | Extractor removes navigation, headers, footers, ads, and script/style content, isolating main article content (via BeautifulSoup + readability heuristics). |
| FR-9 | Code blocks are extracted with language hints preserved where available (e.g. `<pre><code class="language-go">`). |
| FR-10 | Extracted content per page is normalized into a common schema: `{url, title, headings[], body_text, code_blocks[]}`. |
| FR-11 | System deduplicates near-identical content blocks across pages (e.g. repeated boilerplate snippets). |

### 4.4 Context Assembly & Prompting
| ID | Requirement |
|---|---|
| FR-12 | Assembled context is trimmed/chunked to fit within the model's context window with a safety margin. |
| FR-13 | If content exceeds budget, the system prioritizes pages/sections by relevance score before truncating. |
| FR-14 | A single fixed prompt template instructs the model to return the full doc set as one structured, well-organized cheat sheet (headings, short explanations, code examples) in Markdown. |

### 4.5 Generation & Streaming
| ID | Requirement |
|---|---|
| FR-15 | Backend calls the Groq API with streaming enabled and forwards tokens to the frontend via Server-Sent Events (SSE). |
| FR-16 | The page renders content progressively as it streams in, rather than waiting for the full response. |
| FR-17 | On stream error/timeout, the user sees a plain inline error with a retry option; partial output is preserved, not discarded. |

### 4.6 Rendering
| ID | Requirement |
|---|---|
| FR-18 | Generated Markdown renders on the same page: headings, paragraphs, and syntax-highlighted code blocks. |
| FR-19 | Code blocks have a copy-to-clipboard button. |
| FR-20 | No sidebar, no tabs, no additional navigation — the cheat sheet is a single continuous scroll on the same page as the input.

### 4.7 Download
| ID | Requirement |
|---|---|
| FR-21 | Once generation finishes, a **Download PDF** button and a **Download Markdown** button appear on the same page. |
| FR-22 | PDF export is generated from the same rendered content (headings, code blocks preserved and readable), not a raw screenshot. |
| FR-23 | Markdown export is the raw structured Markdown the model produced, saved directly as a `.md` file. |

---

## 5. Structured Output Contract

The model returns a single well-formed Markdown document — standard headings, paragraphs, and fenced code blocks. No JSON schema, no per-section metadata, no source-attribution tagging. Simplicity here keeps both the prompt and the renderer easy to build and easy to reason about:

```
# Go Cheat Sheet

## Variables
Short explanation...

```go
name := "Lakshya"
```

## Functions
Short explanation...

```go
func add(a, b int) int {
    return a + b
}
```
```

This is intentionally the *only* format supported. Tables, callout types, and structured metadata are not part of v1 (see Section 8, Future Enhancements).

---

## 6. Tech Stack

### Backend
- **Language/Framework:** Python + FastAPI
- **Crawling/Parsing:** `requests`/`httpx` + BeautifulSoup
- **LLM Provider:** Groq API (streaming completions)
- **Streaming Transport:** Server-Sent Events (SSE)
- **Explicitly avoided:** LangChain or similar orchestration frameworks — the pipeline is hand-built for learning and control.

### Frontend
- **Framework:** Next.js + TypeScript (a single page/route — no router complexity needed)
- **Styling:** Tailwind CSS
- **Rendering:** Markdown renderer with syntax highlighting (e.g. `react-markdown` + Shiki/Prism)

### Export
- **PDF generation:** Server-side HTML-to-PDF rendering (e.g. WeasyPrint or a headless-browser print step) off the same rendered Markdown.
- **Markdown export:** The raw model output, saved as-is.

### Persistence
- **None required.** The cheat sheet exists in page/component state for the current session. Refreshing the page starts over. No local storage, no database, no accounts.

---

## 7. User Flow

1. User lands on the page. There is one field: paste a documentation URL.
2. User clicks **Generate**.
3. The page shows a simple status indicator (e.g. "Fetching docs… Generating…").
4. The cheat sheet streams in and renders directly below, on the same page.
5. Once complete, **Download PDF** and **Download Markdown** buttons appear.
6. User downloads the file, or copies individual code blocks. Done.

---

## 8. Success Metrics

| Metric | Target (v1) |
|---|---|
| Time from Generate click to first streamed content | < 5s |
| Successful generation rate (no pipeline failure) | > 90% on well-formed doc sites |
| Time to complete the whole flow (paste → download) | Under 60s for a typical doc site |

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Target sites block crawlers or rate-limit | Respect `robots.txt`, add delays, cap request volume, surface a clear error if crawling fails outright. |
| Irrelevant pages pollute context (e.g. blog posts, download pages) | URL/heading heuristics filter pages before extraction. |
| Context exceeds token budget for large doc sets | Prioritized truncation by relevance score (Section 4.4) rather than naive cutoff. |
| Docs sites vary wildly in HTML structure | Use general-purpose readability-style extraction rather than site-specific scrapers; accept imperfect extraction as a known v1 limitation. |
| PDF export looks broken (bad page breaks around code) | Generate PDF from the same rendered Markdown/HTML used on-page, and specifically test page-break behavior around code blocks. |

---

## 10. Milestones & Effort Targets

### Target: MVP in 4–6 hours
| Milestone | Scope |
|---|---|
| **M1 — Pipeline Spike** (~1–1.5 hr) | Crawl + extract one site (go.dev), single fixed prompt, confirm streaming end-to-end via Groq + SSE. |
| **M2 — Core Pipeline** (~1.5–2 hr) | Generalize crawler/extractor, add page filtering and basic deduplication, context budgeting. |
| **M3 — Single Page UI** (~1.5–2 hr) | One input, one button, streamed Markdown rendering with code highlighting on the same page. This is a complete, working MVP. |

### Target: Polished portfolio version in 1–2 days
| Milestone | Scope |
|---|---|
| **M4 — Download** | PDF export (styled off the rendered content, not a screenshot) and Markdown export. |
| **M5 — Polish** | Error/retry handling for crawl and streaming failures, loading states, copy-to-clipboard for code blocks, responsive layout. |

No further milestones are planned for v1 — the polished version above **is** the finished product.

---

## 11. Future Enhancements (Explicitly Out of Scope for v1)
Deferred, not required to hit the pitch in Section 1.1:
- Multiple cheat-sheet modes (Interview Prep, Quick Revision, Beginner, etc.) with a mode selector.
- Sidebar navigation / table of contents for longer cheat sheets.
- Callouts (tips/warnings), tables, collapsible sections, per-section source references.
- Saved history of past generations (would require local storage or a database).
- Accounts, auth, multi-device sync.
- Topic-scoped generation, non-HTML sources, follow-up chat.#   C h e a t s h e e t G e n e r a t o r  
 