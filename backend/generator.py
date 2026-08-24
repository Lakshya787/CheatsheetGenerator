"""
generator.py — STUB for the Groq LLM streaming call.

Pipeline Step [7]:
  This file is intentionally left as a stub for you to fill in your Groq API call.

HOW TO COMPLETE THIS:
  1. Set GROQ_API_KEY in your .env file (backend/.env)
  2. Replace the stub body below with your Groq streaming call.

Example implementation (using the groq SDK):

    from groq import AsyncGroq

    client = AsyncGroq(api_key=os.environ["GROQ_API_KEY"])

    async def generate_stream(prompt: str):
        stream = await client.chat.completions.create(
            model="llama-3.1-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            stream=True,
            max_tokens=8192,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
"""

from __future__ import annotations

import asyncio
from typing import AsyncIterator


# ---------------------------------------------------------------------------
# ↓↓↓  REPLACE THIS STUB WITH YOUR GROQ CALL  ↓↓↓
# ---------------------------------------------------------------------------

PLACEHOLDER_MARKDOWN = """\
# Stub Cheat Sheet

> **Note:** This is placeholder output from the generator stub.
> Implement `generate_stream()` in `backend/generator.py` with your Groq API call.

## Example Section

Short explanation of the concept.

```python
# Example code block
def hello():
    return "Hello, World!"
```

## Another Section

More content will appear here once the Groq integration is wired up.
"""


async def generate_stream(prompt: str) -> AsyncIterator[str]:
    """
    Async generator that yields Markdown tokens/chunks.

    Replace this with your actual Groq streaming API call.
    """
    # Simulate streaming by yielding the placeholder in small chunks
    chunk_size = 30
    for i in range(0, len(PLACEHOLDER_MARKDOWN), chunk_size):
        yield PLACEHOLDER_MARKDOWN[i : i + chunk_size]
        await asyncio.sleep(0.02)  # simulate network latency
