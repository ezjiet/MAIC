"""Extract fillable fields from a form using Gemini Vision."""
import json
import re
import base64
from pathlib import Path
from src._gemini_client import call_gemini

VISION_MODEL = "gemini-flash-lite-latest"  # switched from flash-latest to save RPM

EXTRACT_PROMPT = """You are a Malaysian government form parser.

Extract EVERY fillable field from this form. For each field, return:
- field_code: label / code as printed (e.g. "D3", "B12", "Nama Penuh")
- label: short human-readable description of what to fill in
- type: "text" | "number" | "date" | "checkbox" | "signature" | "amount"
- section: section heading (empty if none)
- instruction: any nearby instruction (empty if none)

Return ONLY a valid JSON array. No markdown, no code fence, no explanation."""

_MIME = {".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".png":"image/png",
         ".webp":"image/webp", ".pdf":"application/pdf"}

def extract_fields(file_path) -> list[dict]:
    p = Path(file_path)
    mime = _MIME.get(p.suffix.lower(), "application/octet-stream")
    data_b64 = base64.b64encode(p.read_bytes()).decode("ascii")

    contents = [{
        "role": "user",
        "parts": [
            {"inline_data": {"mime_type": mime, "data": data_b64}},
            {"text": EXTRACT_PROMPT},
        ],
    }]

    text = call_gemini(VISION_MODEL, contents).strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
    start, end = text.find("["), text.rfind("]") + 1
    if start == -1 or end <= start:
        return []
    try:
        return json.loads(text[start:end])
    except json.JSONDecodeError:
        return []
