"""
extractor.py — Strips boilerplate and extracts clean structured content from HTML.

Pipeline Step [3]:
  - Removes nav, header, footer, sidebar, ads, script/style elements
  - Extracts: title, headings, body text, and code blocks (with language hints)
  - Returns a normalised dict per page
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

from bs4 import BeautifulSoup, NavigableString, Tag


# ---------------------------------------------------------------------------
# Tags to strip wholesale (boilerplate containers)
# ---------------------------------------------------------------------------

STRIP_TAGS = {
    "nav", "header", "footer", "aside", "script", "style", "noscript",
    "iframe", "form", "button", "svg", "figure",
}

# CSS class/id fragments that indicate navigation/boilerplate
BOILERPLATE_PATTERNS = re.compile(
    r"(nav|navigation|sidebar|toc|table[-_]?of[-_]?contents|breadcrumb"
    r"|menu|footer|header|banner|advertisement|ad[-_]?container|cookie"
    r"|newsletter|social|share|search[-_]?bar|skip[-_]?link)",
    re.IGNORECASE,
)


def _is_boilerplate(tag: Tag) -> bool:
    classes = " ".join(tag.get("class", []))
    tag_id = tag.get("id", "")
    combined = f"{classes} {tag_id}"
    return bool(BOILERPLATE_PATTERNS.search(combined))


# ---------------------------------------------------------------------------
# Content extraction helpers
# ---------------------------------------------------------------------------

def _get_title(soup: BeautifulSoup, url: str) -> str:
    h1 = soup.find("h1")
    if h1:
        return h1.get_text(" ", strip=True)
    title_tag = soup.find("title")
    if title_tag:
        return title_tag.get_text(" ", strip=True).split("|")[0].strip()
    return urlparse(url).path.strip("/").split("/")[-1].replace("-", " ").title()


def _get_headings(soup: BeautifulSoup) -> list[str]:
    return [
        tag.get_text(" ", strip=True)
        for tag in soup.find_all(["h1", "h2", "h3", "h4"])
        if tag.get_text(strip=True)
    ]


def _get_code_blocks(soup: BeautifulSoup) -> list[dict]:
    blocks = []
    for pre in soup.find_all("pre"):
        code = pre.find("code")
        if code:
            # Try to get language from class="language-xxx" or class="lang-xxx"
            lang = ""
            for cls in code.get("class", []):
                m = re.match(r"(?:language|lang)-(.+)", cls)
                if m:
                    lang = m.group(1)
                    break
            text = code.get_text()
        else:
            lang = ""
            text = pre.get_text()

        text = text.strip()
        if text and len(text) > 5:
            blocks.append({"language": lang, "code": text})
    return blocks


def _get_body_text(soup: BeautifulSoup) -> str:
    """Extract visible prose text, excluding code blocks."""
    lines = []
    for el in soup.descendants:
        if not isinstance(el, NavigableString):
            continue
        parent = el.parent
        if not parent:
            continue
        if parent.name in ("pre", "code", "script", "style"):
            continue
        text = str(el).strip()
        if text:
            lines.append(text)
    raw = " ".join(lines)
    # Collapse whitespace
    return re.sub(r"\s+", " ", raw).strip()


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def extract(page: dict) -> dict | None:
    """
    Extract structured content from a crawled page dict.

    Input:  {url, html, depth, relevance_score?, ...}
    Output: {url, title, headings, body_text, code_blocks, relevance_score}
            or None if the page produced no meaningful content.
    """
    html = page.get("html", "")
    url = page.get("url", "")

    soup = BeautifulSoup(html, "lxml")

    # Remove boilerplate tags
    for tag in soup.find_all(STRIP_TAGS):
        tag.decompose()

    # Remove elements whose class/id looks like boilerplate
    for tag in soup.find_all(True):
        if isinstance(tag, Tag) and _is_boilerplate(tag):
            tag.decompose()

    title = _get_title(soup, url)
    headings = _get_headings(soup)
    code_blocks = _get_code_blocks(soup)
    body_text = _get_body_text(soup)

    # Drop pages with essentially no content
    if len(body_text) < 100 and not code_blocks:
        return None

    return {
        "url": url,
        "title": title,
        "headings": headings,
        "body_text": body_text,
        "code_blocks": code_blocks,
        "relevance_score": page.get("relevance_score", 0.0),
    }


def extract_all(pages: list[dict]) -> list[dict]:
    """Extract content from all filtered pages, dropping empty ones."""
    results = []
    for page in pages:
        extracted = extract(page)
        if extracted:
            results.append(extracted)
    return results
