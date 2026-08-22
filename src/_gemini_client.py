"""Shared Gemini client factory with key caching + rotation on 429."""
import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

_KEYS = [k.strip() for k in os.environ.get("GOOGLE_API_KEY", "").split(",") if k.strip()]
if not _KEYS:
    raise RuntimeError("GOOGLE_API_KEY not set in .env")

_clients: dict[int, genai.Client] = {}
_current = 0

def get_client() -> tuple[genai.Client, int]:
    """Return (client, key_index). Reuses cached client for the current key."""
    global _current
    if _current not in _clients:
        _clients[_current] = genai.Client(api_key=_KEYS[_current])
    return _clients[_current], _current

def rotate_key():
    """Advance to next API key. Called when current one hits 429."""
    global _current
    _current = (_current + 1) % len(_KEYS)
    print(f"  [rotating to Gemini key {_current+1}/{len(_KEYS)}]")

def call_gemini(model: str, contents) -> str:
    """Call Gemini with automatic key rotation on 429. Returns response text."""
    last_err = None
    for _ in range(len(_KEYS)):
        client, idx = get_client()
        try:
            resp = client.models.generate_content(model=model, contents=contents)
            return resp.text or ""
        except Exception as e:
            last_err = e
            msg = str(e)
            if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
                rotate_key()
                continue
            raise
    raise last_err or RuntimeError("All Gemini keys exhausted")
