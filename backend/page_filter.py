"""
page_filter.py — Filters and scores crawled pages for documentation relevance.

Pipeline Step [2]:
  - Skips pages that are clearly not documentation (changelogs, blog, downloads…)
  - Scores each remaining page by URL + heading signals
  - Returns pages sorted by relevance score (descending)
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

from bs4 import BeautifulSoup


# ---------------------------------------------------------------------------
# Block-list patterns (case-insensitive path segments)
# ---------------------------------------------------------------------------

BLOCKLIST_PATTERNS = re.compile(
    r"/(blog|news|changelog|release[-_]?notes?|releases?|download|install"
    r"|community|forum|contribute|contributing|sponsor|donate|about|contact"
    r"|pricing|jobs|careers|legal|privacy|terms|license|faq|support|status"
    r"|tweet|twitter|github\.com|youtube|slack)/",
    re.IGNORECASE,
)

BLOCKLIST_ENDINGS = re.compile(
    r"\.(pdf|png|jpg|jpeg|gif|svg|zip|tar|gz|exe|dmg|woff2?|ttf|eot|ico)$",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Allowlist patterns — paths that look like documentation
# ---------------------------------------------------------------------------

ALLOWLIST_PATTERNS = re.compile(
    r"/(doc|docs|documentation|guide|guides|tutorial|tutorials|reference|ref"
    r"|learn|manual|handbook|spec|specifications?|api|getting[-_]?started"
    r"|concepts?|overview|introduction|quickstart|examples?)/",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def _url_score(url: str) -> float:
    path = urlparse(url).path.lower()
    score = 0.0

    # Positive: looks like a doc path
    if ALLOWLIST_PATTERNS.search("/" + path + "/"):
        score += 2.0

    # Negative: looks like non-doc content
    if BLOCKLIST_PATTERNS.search("/" + path + "/"):
        score -= 5.0

    # Shorter paths often = higher-level overview pages (slightly preferred)
    depth = path.strip("/").count("/")
    score -= depth * 0.05

    return score


def _heading_score(html: str) -> float:
    """Reward pages whose headings contain programming/doc keywords."""
    soup = BeautifulSoup(html, "lxml")
    headings = " ".join(
        tag.get_text(" ", strip=True)
        for tag in soup.find_all(["h1", "h2", "h3"])
    ).lower()

    keywords = [
        "overview", "introduction", "getting started", "installation",
        "syntax", "usage", "example", "function", "method", "type",
        "variable", "class", "module", "package", "interface", "struct",
        "tutorial", "reference", "guide", "api",
    ]
    return sum(1.0 for kw in keywords if kw in headings)


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def filter_and_score(pages: list[dict]) -> list[dict]:
    """
    Filter out irrelevant pages and return the rest sorted by relevance.

    Input:  list of {url, html, depth, ...}
    Output: filtered + scored list of {url, html, depth, relevance_score}
    """
    scored: list[dict] = []

    for page in pages:
        url = page["url"]

        # Hard blocks
        if BLOCKLIST_ENDINGS.search(url):
            continue
        url_s = _url_score(url)
        if url_s < -1.0:
            continue

        heading_s = _heading_score(page.get("html", ""))
        total = url_s + heading_s

        # Drop pages with very low combined score (likely not doc content)
        if total < -0.5:
            continue

        scored.append({**page, "relevance_score": total})

    # Sort best first
    scored.sort(key=lambda p: p["relevance_score"], reverse=True)
    return scored
