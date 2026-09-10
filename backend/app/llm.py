import os
from pathlib import Path
from typing import AsyncGenerator

from dotenv import load_dotenv
from openai import OpenAI, APIError, APIConnectionError, RateLimitError


# Find backend/.env
BASE_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BASE_DIR / ".env"

load_dotenv(ENV_FILE)

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    raise RuntimeError("GROQ_API_KEY is not configured")


client = OpenAI(
    api_key=api_key,
    base_url="https://api.groq.com/openai/v1",
)

SYSTEM_PROMPT = "You create concise and accurate technical cheatsheets."

USER_PROMPT_TEMPLATE = """You are an expert technical documentation writer.

Create a concise, useful developer cheatsheet from the documentation below.

Include:
- Important concepts
- Important syntax or APIs
- Short explanations
- Useful code examples
- Common tips or pitfalls

Keep the cheatsheet well-structured and easy to scan.

Documentation:
{content}
"""


async def stream_cheatsheet(content: str) -> AsyncGenerator[str, None]:
    """Async generator that yields markdown tokens streamed from the LLM."""
    if not content.strip():
        raise ValueError("No documentation content was provided")

    try:
        stream = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT_TEMPLATE.format(content=content)},
            ],
            temperature=0.3,
            stream=True,
        )

        for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                yield token

    except RateLimitError as e:
        print(f"Groq rate limit error: {e}")
        raise RuntimeError("The AI service is temporarily rate-limited")

    except APIConnectionError as e:
        print(f"Groq connection error: {e}")
        raise RuntimeError("Could not connect to the AI service")

    except APIError as e:
        print(f"Groq API error: {e}")
        raise RuntimeError("The AI service returned an error")

    except Exception as e:
        print(f"Unexpected LLM error: {e}")
        raise RuntimeError("Failed to generate the cheatsheet")