# Cheat Sheet Generator

> Paste a documentation URL and get a clean, structured, downloadable cheat sheet.

An AI-powered developer tool that crawls a documentation site, extracts the useful content, sends the assembled context to Groq, and streams a structured Markdown cheat sheet back to the browser.

## What It Does

1. Paste a documentation URL.
2. The backend crawls relevant pages within the documentation site.
3. Navigation, ads, boilerplate, and irrelevant pages are filtered out.
4. Useful text and code blocks are extracted.
5. Content is deduplicated and kept within the model's context budget.
6. A single structured prompt is sent to Groq.
7. The generated cheat sheet streams to the frontend through SSE.
8. The result is rendered on the same page.
9. Download it as **PDF** or **Markdown**.

The UI is intentionally simple. The main engineering work is the pipeline:

```text
Documentation URL
       ↓
    Crawler
       ↓
   Page Filter
       ↓
Content Extractor
       ↓
 Deduplication
       ↓
Context Assembler
       ↓
  Prompt Builder
       ↓
   Groq LLM
       ↓
  Stream Parser
       ↓
 Page Renderer
       ↓
 PDF / Markdown
```

## Features

- Crawl documentation pages from a starting URL
- Stay within the same domain and documentation path
- Respect `robots.txt`
- Limit crawl depth and total pages
- Filter irrelevant documentation pages
- Extract clean page content and code blocks
- Preserve code-language hints when available
- Deduplicate repeated content
- Budget context before the LLM call
- Generate a structured Markdown cheat sheet
- Stream generation progressively using SSE
- Render syntax-highlighted code
- Copy code blocks to the clipboard
- Export the generated cheat sheet as PDF
- Export the raw generated Markdown

## Example

Input:

```text
https://go.dev/doc/
```

Output:

```markdown
# Go Cheat Sheet

## Variables

Short explanation of Go variables.

```go
name := "Lakshya"
```

## Functions

Functions define reusable blocks of code.

```go
func add(a, b int) int {
    return a + b
}
```
```

## Architecture

### Backend Pipeline

The backend is a fixed sequence of deterministic processing steps followed by one LLM generation step.

| Step | Responsibility |
|---|---|
| Crawler | Discover documentation links |
| Page Filter | Remove irrelevant pages |
| Content Extractor | Extract useful text and code |
| Deduplication | Remove repeated content |
| Context Assembler | Build a token-safe context |
| Prompt Builder | Create the generation prompt |
| Groq API | Generate the cheat sheet |
| Stream Parser | Process streamed output |
| Export | Produce PDF/Markdown |

### Frontend

The frontend is a single-page experience:

- Documentation URL input
- Generate button
- Generation status
- Streaming cheat sheet output
- Copy buttons for code blocks
- PDF download
- Markdown download

No sidebar, dashboard, authentication flow, or multi-page navigation is required.

## Tech Stack

### Backend

- **Python**
- **FastAPI**
- **Requests / HTTPX**
- **BeautifulSoup**
- **Groq API**
- **Server-Sent Events (SSE)**

### Frontend

- **Next.js**
- **TypeScript**
- **Tailwind CSS**
- **react-markdown**
- **Shiki / Prism**

### PDF Export

- **WeasyPrint** or a headless-browser print step
- PDF is generated from rendered HTML rather than a screenshot

### Persistence

None.

The generated cheat sheet exists only in the current page/session. There is no database, authentication, account system, or saved history in v1.

## Product Scope

### Included in v1

- One documentation URL
- One-page UI
- Documentation crawling
- Content extraction
- Relevance filtering
- Deduplication
- Context budgeting
- One-shot Groq generation
- Streaming output
- Markdown rendering
- Code highlighting
- Code copying
- PDF export
- Markdown export

### Explicitly Not Included

- Authentication or user accounts
- Database persistence
- Multiple pages/routes
- Sidebar or settings
- Vector database / embeddings / RAG
- LangChain or agent frameworks
- Multi-step autonomous tool calling
- Chat or follow-up questions
- Billing or SaaS features
- Collaborative editing
- General-purpose scraping of arbitrary websites

## Functional Requirements

### Input

- Accept a documentation URL.
- Validate that the URL is reachable and returns HTML.
- Show an inline error when validation fails.

### Crawling

- Start from the supplied documentation URL.
- Discover same-domain, same-path links.
- Default crawl depth: `2`.
- Default page limit: `30`.
- Normalize URLs to avoid duplicates.
- Respect `robots.txt`.
- Use reasonable request delays/concurrency limits.
- Filter irrelevant pages before extraction.

### Content Extraction

- Remove navigation, headers, footers, ads, scripts, and styles.
- Extract the main documentation content.
- Preserve code blocks.
- Preserve language hints where available.
- Normalize extracted pages into:

```text
{
  url,
  title,
  headings[],
  body_text,
  code_blocks[]
}
```

- Deduplicate repeated content.

### Generation

- Keep assembled context within the model's context window.
- Prioritize relevant pages when content exceeds the budget.
- Use one fixed prompt template.
- Generate one structured Markdown document.
- Stream the response from the backend to the frontend through SSE.

### Rendering

- Render the Markdown on the same page.
- Support headings and paragraphs.
- Support syntax-highlighted code blocks.
- Provide copy-to-clipboard controls.
- Keep the output as one continuous document.

### Downloads

After generation:

- **Download PDF** — export the rendered content while preserving readable headings and code blocks.
- **Download Markdown** — save the raw generated Markdown as a `.md` file.

## Structured Output

The model returns one Markdown document.

No JSON schema or per-section metadata is required in v1.

```markdown
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

## User Flow

```text
Open application
      ↓
Paste documentation URL
      ↓
Click Generate
      ↓
Fetching documentation...
      ↓
Generating...
      ↓
Cheat sheet streams onto the page
      ↓
Generation complete
      ↓
Download PDF / Download Markdown
```

## Success Metrics

| Metric | Target |
|---|---:|
| Time to first streamed content | `< 5s` |
| Successful generation rate | `> 90%` on well-formed documentation sites |
| Typical paste-to-download flow | `< 60s` |

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Target site blocks or rate-limits crawlers | Respect `robots.txt`, add delays, cap requests, and show a clear error |
| Irrelevant pages enter the context | Use URL and heading relevance heuristics |
| Context exceeds the model budget | Prioritize relevant content before truncation |
| Documentation HTML varies | Use general-purpose readability-style extraction |
| PDF page breaks look poor | Generate from rendered HTML and test code-block page breaks |

## Development Plan

### MVP — 4–6 Hours

| Milestone | Scope |
|---|---|
| **M1 — Pipeline Spike** | Crawl one documentation site, extract content, test Groq generation and SSE end-to-end |
| **M2 — Core Pipeline** | Generalize crawling/extraction, filtering, deduplication, and context budgeting |
| **M3 — Single Page UI** | URL input, generation button, streaming Markdown, syntax highlighting |

### Polished Portfolio Version — 1–2 Days

| Milestone | Scope |
|---|---|
| **M4 — Download** | PDF and Markdown export |
| **M5 — Polish** | Error/retry handling, loading states, code copying, responsive layout |

The polished version above is the intended v1 product.

## Future Enhancements

These are deliberately outside v1:

- Multiple cheat-sheet modes
- Interview Prep / Quick Revision / Beginner modes
- Sidebar navigation or table of contents
- Callouts, tables, and collapsible sections
- Per-section source references
- Saved generation history
- Accounts and authentication
- Multi-device synchronization
- Topic-scoped generation
- Non-HTML sources
- Follow-up chat

## Why This Project

This project is intentionally small in surface area but technically meaningful.

It demonstrates how to build an LLM-powered developer tool without hiding the important engineering behind an orchestration framework:

- Web crawling
- HTML parsing
- Content extraction
- Relevance filtering
- Deduplication
- Context management
- Prompt engineering
- Streaming LLM responses
- Server-Sent Events
- Markdown rendering
- PDF generation

The goal is a complete, understandable pipeline rather than a large application with unnecessary infrastructure.

---

**Status:** v1 in development
