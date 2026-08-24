"""
crawler.py — Discovers same-domain, same-path-prefix documentation pages.

Pipeline Step [1]:
  - Starts at the seed URL
  - BFS up to configurable depth (default 2)
  - Respects robots.txt
  - Adds polite delay between requests
  - Deduplicates URLs
  - Caps total pages fetched (default 30)
"""

from __future__ import annotations

import asyncio
import re
import urllib.robotparser
from collections import deque
from urllib.parse import urljoin, urlparse, urlunparse

import httpx
from bs4 import BeautifulSoup


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize_url(url: str) -> str:
    """Remove fragment and trailing slash; lower-case scheme+host."""
    parsed = urlparse(url)
    # Drop fragment
    clean = parsed._replace(fragment="")
    # Normalise path: collapse double slashes, keep trailing slash only at root
    path = re.sub(r"/+", "/", clean.path)
    clean = clean._replace(
        scheme=clean.scheme.lower(),
        netloc=clean.netloc.lower(),
        path=path,
    )
    return urlunparse(clean).rstrip("/") or "/"


def same_scope(seed: str, candidate: str) -> bool:
    """Return True if `candidate` lives under the same domain+path-prefix as `seed`."""
    s = urlparse(seed)
    c = urlparse(candidate)
    if s.scheme not in ("http", "https") or c.scheme not in ("http", "https"):
        return False
    if s.netloc != c.netloc:
        return False
    # candidate path must start with seed's directory prefix
    seed_prefix = s.path.rstrip("/")
    return c.path == seed_prefix or c.path.startswith(seed_prefix + "/")


def extract_links(html: str, base_url: str) -> list[str]:
    """Return all <a href> links from the page, resolved to absolute URLs."""
    soup = BeautifulSoup(html, "lxml")
    links: list[str] = []
    for tag in soup.find_all("a", href=True):
        href = tag["href"].strip()
        if href.startswith("javascript:") or href.startswith("mailto:"):
            continue
        abs_url = urljoin(base_url, href)
        links.append(abs_url)
    return links


# ---------------------------------------------------------------------------
# robots.txt cache
# ---------------------------------------------------------------------------

_robots_cache: dict[str, urllib.robotparser.RobotFileParser] = {}


async def _get_robots(client: httpx.AsyncClient, base_url: str) -> urllib.robotparser.RobotFileParser:
    parsed = urlparse(base_url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    if robots_url in _robots_cache:
        return _robots_cache[robots_url]

    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(robots_url)
    try:
        resp = await client.get(robots_url, timeout=5.0)
        rp.parse(resp.text.splitlines())
    except Exception:
        # If robots.txt is unreachable, assume allowed
        rp.parse([])
    _robots_cache[robots_url] = rp
    return rp


# ---------------------------------------------------------------------------
# Main crawler
# ---------------------------------------------------------------------------

async def crawl(
    seed_url: str,
    max_depth: int = 2,
    max_pages: int = 30,
    request_delay: float = 0.4,
    timeout: float = 10.0,
) -> list[dict]:
    """
    BFS crawl starting from `seed_url`.

    Returns a list of dicts:
        {url: str, html: str, depth: int}
    """
    seed_url = normalize_url(seed_url)
    visited: set[str] = set()
    results: list[dict] = []

    # queue items: (url, depth)
    queue: deque[tuple[str, int]] = deque([(seed_url, 0)])

    headers = {
        "User-Agent": "CheatsheetBot/1.0 (+https://github.com/Lakshya787/CheatsheetGenerator)",
        "Accept": "text/html,application/xhtml+xml",
    }

    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        robots = await _get_robots(client, seed_url)

        while queue and len(results) < max_pages:
            url, depth = queue.popleft()
            norm = normalize_url(url)

            if norm in visited:
                continue
            visited.add(norm)

            # robots.txt check
            if not robots.can_fetch("*", norm):
                continue

            try:
                resp = await client.get(norm, timeout=timeout)
                if resp.status_code != 200:
                    continue
                content_type = resp.headers.get("content-type", "")
                if "text/html" not in content_type:
                    continue
                html = resp.text
            except Exception:
                continue

            results.append({"url": norm, "html": html, "depth": depth})

            # Discover children only if not at max depth
            if depth < max_depth:
                links = extract_links(html, norm)
                for link in links:
                    norm_link = normalize_url(link)
                    if norm_link not in visited and same_scope(seed_url, norm_link):
                        queue.append((norm_link, depth + 1))

            await asyncio.sleep(request_delay)

    return results
