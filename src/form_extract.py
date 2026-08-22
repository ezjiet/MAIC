"""Extract fillable fields. AcroForm first (accurate names) + Vision enrichment (friendly labels)."""
import json
import re
import base64
from pathlib import Path
from src._gemini_client import call_gemini
from src.form_acroform import is_acroform, read_acroform_fields
from src.form_enrich import enrich_labels

VISION_MODEL = "gemini-flash-lite-latest"

EXTRACT_PROMPT = """You are a Malaysian government form parser.

Extract EVERY fillable field from this form. For each field:
- field_code: label/code as printed (e.g. "D3", "B12", "Nama Penuh")
- label: short human-readable description
- type: "text" | "number" | "date" | "checkbox" | "signature" | "amount"
- section: section heading (empty if none)
- instruction: nearby instruction (empty if none)

Return ONLY a valid JSON array. No markdown, no explanation."""

_MIME = {".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".png":"image/png",
         ".webp":"image/webp", ".pdf":"application/pdf"}

def extract_fields(file_path) -> dict:
    """Returns {'fields', 'is_fillable', 'method'}."""
    p = Path(file_path)

    # Path A: AcroForm — get accurate names, then enrich with Vision for friendly labels
    if p.suffix.lower() == ".pdf" and is_acroform(p):
        raw = read_acroform_fields(p)
        if raw:
            raw_names = [f["field_code"] for f in raw]
            enriched = enrich_labels(p, raw_names)
            enriched_by_raw = {e["raw"]: e for e in enriched}

            fields = []
            for f in raw:
                e = enriched_by_raw.get(f["field_code"], {})
                fields.append({
                    "field_code": f["field_code"],       # KEEP raw name for writing back
                    "field_name": f["field_code"],
                    "label": e.get("label") or f.get("label") or f["field_code"],
                    "type": f.get("type", "text"),
                    "options": f.get("options", []),
                    "section": e.get("section", ""),
                    "instruction": e.get("instruction", ""),
                    "example": e.get("example", ""),
                })
            return {"fields": fields, "is_fillable": True, "method": "acroform+vision"}

    # Path B: Static PDF/image — pure Vision extraction
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
        return {"fields": [], "is_fillable": False, "method": "vision"}
    try:
        fields = json.loads(text[start:end])
    except json.JSONDecodeError:
        fields = []
    return {"fields": fields, "is_fillable": False, "method": "vision"}
