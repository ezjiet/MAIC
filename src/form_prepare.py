"""Analyze extracted form fields and generate a friendly 'what this form needs' guide."""
import json
import re
from src._gemini_client import call_gemini

PREP_MODEL = "gemini-flash-lite-latest"

PREP_PROMPT = """You are a Malaysian government form guide.

Given a list of fields extracted from a form, analyze them and produce a friendly
guide for the citizen. Group similar fields, identify what information the citizen
needs to provide, and give a concrete example description.

Return ONLY valid JSON matching this schema:
{
  "form_summary": "1-sentence description of what this form is used for",
  "sections": ["list", "of", "form", "sections"],
  "required_info": [
    {"label": "Full name (as per IC)", "field_type": "text", "example": "Ahmad bin Ali"},
    {"label": "IC number", "field_type": "text", "example": "900101-08-1234"},
    {"label": "Monthly income (RM)", "field_type": "number", "example": "5000"}
  ],
  "example_description": "A ~3-sentence example description the user can adapt with their real details"
}

Group similar fields into single required_info entries (e.g. all address parts -> one 'Address' entry).
Keep required_info to 5-12 items max — the most important things to ask about.
The example should be casual Malaysian style, mixing Malay and English."""

def prepare_form_guide(form_name: str, agency: str, fields: list[dict]) -> dict:
    if not fields:
        return {
            "form_summary": f"{form_name}",
            "sections": [],
            "required_info": [],
            "example_description": "Please describe your situation here.",
        }

    compact = [{"code": f.get("field_code",""), "label": f.get("label",""),
                "type": f.get("type",""), "section": f.get("section","")}
               for f in fields[:60]]

    prompt = (
        f"{PREP_PROMPT}\n\n"
        f"FORM NAME: {form_name}\n"
        f"AGENCY: {agency.upper()}\n"
        f"EXTRACTED FIELDS ({len(compact)}):\n{json.dumps(compact, ensure_ascii=False)}\n\n"
        f"Your JSON guide:"
    )

    try:
        text = call_gemini(PREP_MODEL, prompt).strip()
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
        start, end = text.find("{"), text.rfind("}") + 1
        return json.loads(text[start:end]) if start != -1 else {}
    except Exception as e:
        print(f"[form_prepare] failed: {e}")
        return {
            "form_summary": form_name,
            "sections": [],
            "required_info": [],
            "example_description": "Please describe your situation.",
        }
