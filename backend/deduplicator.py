"""
deduplicator.py — Removes near-identical content blocks across extracted pages.

Pipeline Step [4]:
  - Hashes body_text chunks to detect exact duplicates
  - Uses a simple shingle-based similarity check for near-duplicates
  - Also deduplicates code_blocks across all pages
"""

from __future__ import annotations

import hashlib
import re


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fingerprint(text: str, n: int = 5) -> set[str]:
    """Return a set of n-word shingles for similarity estimation."""
    words = re.split(r"\s+", text.lower().strip())
    if len(words) < n:
        return {" ".join(words)}
    return {" ".join(words[i : i + n]) for i in range(len(words) - n + 1)}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _hash_text(text: str) -> str:
    return hashlib.md5(text.strip().lower().encode()).hexdigest()


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def deduplicate(pages: list[dict], similarity_threshold: float = 0.85) -> list[dict]:
    """
    Remove near-duplicate pages and code blocks.

    Input/Output: list of extracted page dicts
    """
    if not pages:
        return pages

    # --- Deduplicate full pages by body_text similarity ---
    kept: list[dict] = []
    fingerprints: list[set[str]] = []

    for page in pages:
        body = page.get("body_text", "")
        fp = _fingerprint(body)

        is_dupe = False
        for existing_fp in fingerprints:
            if _jaccard(fp, existing_fp) >= similarity_threshold:
                is_dupe = True
                break

        if not is_dupe:
            kept.append(page)
            fingerprints.append(fp)

    # --- Deduplicate code blocks globally ---
    seen_code_hashes: set[str] = set()
    for page in kept:
        unique_blocks = []
        for block in page.get("code_blocks", []):
            h = _hash_text(block["code"])
            if h not in seen_code_hashes:
                seen_code_hashes.add(h)
                unique_blocks.append(block)
        page["code_blocks"] = unique_blocks

    return kept
