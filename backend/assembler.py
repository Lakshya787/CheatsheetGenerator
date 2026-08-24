"""
assembler.py — Assembles cleaned page content into a single prompt-ready context string.

Pipeline Steps [5] + [6]:
  - Formats each page's title, headings, body text, and code blocks into text
  - Estimates token count (4 chars ≈ 1 token)
  - Truncates/prioritises by relevance_score to fit within token budget
  - Returns (assembled_context: str, prompt: str)
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Token budget
# ---------------------------------------------------------------------------

# Groq llama-3.1-70b supports ~128K context; we leave headroom for output
MAX_CONTEXT_TOKENS = 90_000
CHARS_PER_TOKEN = 4  # rough approximation


def _estimate_tokens(text: str) -> int:
    return len(text) // CHARS_PER_TOKEN


# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------

def _format_page(page: dict) -> str:
    parts = [f"=== {page['title']} ===", f"Source: {page['url']}"]

    if page.get("headings"):
        parts.append("Headings: " + " | ".join(page["headings"][:8]))

    if page.get("body_text"):
        # Trim very long body text per page to avoid one page dominating
        body = page["body_text"][:6000]
        parts.append(body)

    for block in page.get("code_blocks", [])[:5]:
        lang = block.get("language", "")
        fence = f"```{lang}" if lang else "```"
        parts.append(f"{fence}\n{block['code']}\n```")

    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def assemble(pages: list[dict]) -> tuple[str, str]:
    """
    Build a token-budgeted context string and a final prompt string.

    Returns:
        (context, prompt)  — both strings
    """
    # Pages are already sorted by relevance_score descending from the filter step
    budget = MAX_CONTEXT_TOKENS
    sections: list[str] = []

    for page in pages:
        formatted = _format_page(page)
        tokens = _estimate_tokens(formatted)
        if tokens > budget:
            # Truncate this page's contribution proportionally
            allowed_chars = budget * CHARS_PER_TOKEN
            formatted = formatted[:allowed_chars] + "\n[...truncated]"
            sections.append(formatted)
            break
        sections.append(formatted)
        budget -= tokens
        if budget <= 0:
            break

    context = "\n\n" + ("=" * 60) + "\n\n".join(sections)

    prompt = build_prompt(context)
    return context, prompt


PROMPT_TEMPLATE = """\
You are a senior technical writer creating a developer cheat sheet.

Below is the extracted content from a documentation website.
Your task is to produce ONE single, well-structured Markdown cheat sheet that captures the essential information a developer needs.

Rules:
- Use clear, concise language — this is a cheat sheet, not a tutorial
- Use ## for main sections and ### for subsections
- Include the most important code examples (use fenced code blocks with language tags)
- Do NOT include fluff, marketing text, or navigation content
- Do NOT add a table of contents
- Keep explanations short (1–3 sentences max per concept)
- Start directly with the title as # <Title> Cheat Sheet

Documentation content:
---
{context}
---

Now produce the complete cheat sheet in Markdown:
"""


def build_prompt(context: str) -> str:
    return PROMPT_TEMPLATE.format(context=context)
