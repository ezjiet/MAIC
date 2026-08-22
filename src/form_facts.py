"""Convert citizen's free-text description into structured facts."""
import json
import re
from src._gemini_client import call_gemini

FACTS_MODEL = "gemini-flash-lite-latest"  # switched from flash-latest to save RPM

FACTS_PROMPT = """You are an assistant that turns a Malaysian citizen's free-text
description of their situation into structured JSON. Extract ONLY what is stated.
Return ONLY valid JSON matching this schema (any field may be null if unstated):

{
  "full_name": string|null,
  "ic_number": string|null,
  "employment_status": "employed"|"self-employed"|"unemployed"|"retired"|"student"|null,
  "annual_income": number|null,
  "monthly_income": number|null,
  "marital_status": "single"|"married"|"divorced"|"widowed"|null,
  "spouse_working": boolean|null,
  "dependants": integer|null,
  "children_studying": integer|null,
  "medical_expenses_self": number|null,
  "medical_expenses_parents": number|null,
  "life_insurance": number|null,
  "epf_contribution": number|null,
  "education_fees": number|null,
  "lifestyle_purchases": number|null,
  "housing_purchase_price": number|null,
  "vehicle_engine_cc": number|null,
  "vehicle_type": "saloon"|"non-saloon"|"motorcycle"|null,
  "vehicle_region": "west_malaysia"|"east_malaysia"|null,
  "current_licence_class": string|null,
  "licence_expired_months": integer|null,
  "notes": string
}

Return ONLY the JSON object, no explanation or markdown."""

def extract_facts(description: str) -> dict:
    text = call_gemini(FACTS_MODEL, f"{FACTS_PROMPT}\n\nCITIZEN:\n{description}").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
    start, end = text.find("{"), text.rfind("}") + 1
    if start == -1 or end <= start:
        return {"notes": description[:200]}
    try:
        return json.loads(text[start:end])
    except json.JSONDecodeError:
        return {"notes": description[:200]}
