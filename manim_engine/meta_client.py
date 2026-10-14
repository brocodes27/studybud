"""Small Meta Model API client for the video generation scripts."""
import json
import os
from urllib.error import HTTPError
from urllib.request import Request, urlopen

MODEL = "muse-spark-1.3-contributor"


def generate_text(prompt, max_tokens=8192, json_output=False):
    api_key = os.getenv("MODEL_API_KEY")
    if not api_key:
        raise ValueError("MODEL_API_KEY not configured")
    body = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "reasoning_effort": "low",
        "max_completion_tokens": max_tokens,
    }
    if json_output:
        body["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": "animation", "schema": {"type": "object"}},
        }
    request = Request(
        "https://api.meta.ai/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=120) as response:
            data = json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"Meta API error {error.code}") from None
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("Meta returned no response")
    choice = choices[0]
    message = choice.get("message") or {}
    if choice.get("finish_reason") in ("length", "content_filter") or message.get("refusal"):
        raise RuntimeError("Meta could not complete the response")
    text = message.get("content")
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError("Meta returned no text")
    return text.strip()
