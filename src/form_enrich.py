"""Enrich cryptic AcroForm field names with meaningful labels by looking at the printed form."""
import json
import re
import base64
from pathlib import Path
from src._gemini_client import call_gemini

ENRICH_MODEL = "gemini-flash-lite-latest"

ENRICH_PROMPT = """You are a Malaysian government form labeller.

I will give you:
1. An image/PDF of a form
2. A list of internal AcroForm field names extracted from the same form

For EACH internal field name, look at the printed form and identify what that
field is actually asking for. Return a JSON array in the SAME ORDER as the input,
with entries:

{
  "raw": "<internal name I gave you>",
  "label": "<clear human-readable label in Malay OR English>",
  "section": "<section heading it belongs to (e.g. 'A. Butiran Pemohon')>",
  "instruction": "<any nearby helper text, empty if none>",
  "example": "<one-word example value, e.g. 'Ahmad bin Ali', '900101-08-1234', 'RM 5000'>"
}

If an internal name is ambiguous (like 'Check Box6' or 'undefined'), infer from
context — use the nearby printed text on the form. If truly unknown, use the
raw name and set label to a best guess like 'Field 6' or 'Unnamed checkbox'.

Return ONLY the JSON array. No markdown, no explanation."""

_MIME = {".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".png":"image/png",
         ".webp":"image/webp", ".pdf":"application/pdf"}

def enrich_labels(pdf_path, raw_field_names: list[str], max_fields: int = 60) -> list[dict]:
    """Return list of enriched field dicts. Falls back gracefully if Gemini fails."""
    if not raw_field_names:
        return []

    # Trim to first N to avoid oversized prompts (forms rarely need more)
    names = raw_field_names[:max_fields]

    p = Path(pdf_path)
    mime = _MIME.get(p.suffix.lower(), "application/pdf")
    data_b64 = base64.b64encode(p.read_bytes()).decode("ascii")

    contents = [{
        "role": "user",
        "parts": [
            {"inline_data": {"mime_type": mime, "data": data_b64}},
            {"text": f"{ENRICH_PROMPT}\n\nInternal field names ({len(names)}):\n{json.dumps(names, ensure_ascii=False)}"},
        ],
    }]

    try:
        text = call_gemini(ENRICH_MODEL, contents).strip()
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
        start, end = text.find("["), text.rfind("]") + 1
        enriched = json.loads(text[start:end]) if start != -1 else []
    except Exception as e:
        print(f"[form_enrich] failed: {e}")
        enriched = []

    # Build a lookup by raw name → enriched entry
    by_raw = {e.get("raw"): e for e in enriched if isinstance(e, dict) and e.get("raw")}

    # Return one entry per raw_field_names, using enriched when available
    out = []
    for raw in raw_field_names:
        e = by_raw.get(raw, {})
        out.append({
            "raw": raw,
            "label": e.get("label") or raw.replace("_", " ").replace("[0]", "").strip() or "Unnamed field",
            "section": e.get("section", ""),
            "instruction": e.get("instruction", ""),
            "example": e.get("example", ""),
        })
    return out
