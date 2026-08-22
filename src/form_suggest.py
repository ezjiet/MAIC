"""Suggest values for ALL form fields in a single batched Gemini call."""
import json
import re
from src._gemini_client import call_gemini
from src.retrieve import retrieve

SUGGEST_MODEL = "gemini-flash-lite-latest"

BATCH_PROMPT = """You are a Malaysian government form-filling assistant.

For EACH of the following form fields, suggest a value based on the citizen's
facts and the applicable rule context. Return ONE valid JSON array with an entry
per field, in the SAME ORDER as the input fields.

Each entry format:
{
  "value": string_or_number_or_null,
  "confidence": "high" | "medium" | "low",
  "reasoning": "1 short sentence in Malay/English",
  "cap_note": "cap or limit (empty string if none)",
  "receipt_required": true|false|null
}

Rules:
- value: null if the citizen has not provided enough info for that field
- Do NOT invent facts. Use ONLY what's in FACTS.

Return ONLY the JSON array, no markdown, no explanation."""

def suggest_all(fields: list[dict], agency: str, facts: dict) -> list[dict]:
    if not fields:
        return []

    combined_query = " ".join(f.get("label", "") for f in fields[:20])
    chunks = retrieve(combined_query, agency, top_k=5) if agency in {"lhdn","kwsp","jpj"} else []

    ctx = ("\n\n".join(f"[{c['source']} p{c.get('page')}] {c['text'][:400]}" for c in chunks)
           if chunks else "(no matching rules — use general Malaysian public-service knowledge)")

    compact = [{"i": i, "code": f.get("field_code",""), "label": f.get("label",""),
                "type": f.get("type",""), "hint": f.get("instruction","")[:80]}
               for i, f in enumerate(fields)]

    prompt = (
        f"{BATCH_PROMPT}\n\n"
        f"FACTS:\n{json.dumps(facts, ensure_ascii=False)}\n\n"
        f"RULES:\n{ctx}\n\n"
        f"FIELDS ({len(compact)} total):\n{json.dumps(compact, ensure_ascii=False)}\n\n"
        f"Your JSON array of {len(compact)} suggestions:"
    )

    try:
        text = call_gemini(SUGGEST_MODEL, prompt).strip()
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
        start, end = text.find("["), text.rfind("]") + 1
        parsed = json.loads(text[start:end]) if start != -1 else []
    except Exception as e:
        print(f"[form_suggest] batch failed: {e}")
        parsed = []

    citation = None
    if chunks:
        c = chunks[0]
        citation = {"source": c["source"], "page": c.get("page"), "agency": agency}

    results = []
    for i, field in enumerate(fields):
        sug = parsed[i] if i < len(parsed) else {}
        results.append({
            "field": field,
            "value": sug.get("value"),
            "confidence": sug.get("confidence", "low"),
            "reasoning": sug.get("reasoning", ""),
            "cap_note": sug.get("cap_note", ""),
            "receipt_required": sug.get("receipt_required"),
            "citation": citation,
        })
    return results

def suggest_field(field: dict, agency: str, facts: dict) -> dict:
    return suggest_all([field], agency, facts)[0]
