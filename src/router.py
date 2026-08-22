"""Classify a citizen query into LHDN / KWSP / JPJ / UNCLEAR / GIBBERISH / GREETING / OFFTOPIC."""
import os
import re
import time
from google import genai
from dotenv import load_dotenv

load_dotenv()
_client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])

ROUTER_MODELS = ["gemini-flash-lite-latest", "gemini-2.5-flash-lite"]

def _call_with_retry(models, contents, max_tries=3):
    last_err = None
    for m in (models if isinstance(models, list) else [models]):
        for attempt in range(max_tries):
            try:
                return _client.models.generate_content(model=m, contents=contents)
            except Exception as e:
                last_err = e
                msg = str(e)
                if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
                    break
                if "503" in msg or "UNAVAILABLE" in msg or "overloaded" in msg.lower():
                    time.sleep(2 ** attempt); continue
                raise
    raise last_err or RuntimeError("All Gemini models exhausted")

GREETINGS = {
    "hi", "hello", "hey", "hai", "helo", "yo", "sup",
    "apa khabar", "apa cerita", "thanks", "thank you", "terima kasih", "tq",
    "bye", "goodbye", "selamat pagi", "selamat petang", "selamat malam",
    "morning", "assalamualaikum", "salam",
}

ROUTER_PROMPT = """You are a router for a Malaysian government assistant.
Classify the user's message into ONE of these labels:

- LHDN: income tax, tax relief, Borang BE/B, e-Filing, PCB/MTD, CKHT/RPGT,
  cukai keuntungan harta tanah, stamp duty, tax audit, e-Invois, penalties,
  foreign income, jual rumah, jual tanah, tax clearance
- KWSP: EPF, i-Akaun, Akaun 1/2/Fleksibel, withdrawal, pengeluaran,
  contributions, caruman, retirement, nomination, penamaan
- JPJ: driving licence, lesen memandu, road tax, cukai jalan, summons, saman,
  vehicle registration, kenderaan, tukar milik, EEV, VTA
- GREETING: hello, hi, hai, apa khabar, thanks, terima kasih, goodbye, small talk
- GIBBERISH: random letters with no meaning (e.g. "fsfs", "asdfgh")
- OFFTOPIC: real question but not about LHDN/KWSP/JPJ (weather, sports, other agencies)
- UNCLEAR: real Malaysian government question but ambiguous - could be LHDN/KWSP/JPJ

Reply with ONE WORD only from that list."""

VALID = {"LHDN", "KWSP", "JPJ", "GREETING", "GIBBERISH", "OFFTOPIC", "UNCLEAR",
         "LHDN_BARE", "KWSP_BARE", "JPJ_BARE"}

def _looks_like_gibberish(q: str) -> bool:
    """Fast rule-based check for obvious keyboard mashing."""
    s = q.strip().lower()
    if not s:
        return True
    # single word, 4+ chars, no vowels, no numbers -> keyboard mash
    if " " not in s and len(s) >= 4 and not re.search(r"[aeiou]", s) and not re.search(r"\d", s):
        return True
    # repeated same char pattern (aaaa, bhbhb, nnnn)
    stripped = s.replace(" ", "")
    if len(stripped) >= 3 and len(set(stripped)) <= 2:
        return True
    return False

AGENCY_SHORTCODES = {
    "lhdn": "LHDN", "hasil": "LHDN", "cukai": "LHDN", "irb": "LHDN",
    "kwsp": "KWSP", "epf": "KWSP",
    "jpj": "JPJ", "road tax": "JPJ", "lesen": "JPJ",
}

def route(query: str) -> str:
    s = query.strip().lower()

    # Bare agency name / acronym -> ask a helpful clarifier for that agency
    if s in AGENCY_SHORTCODES:
        return AGENCY_SHORTCODES[s] + "_BARE"

    # Whitelist common greetings first
    if s in GREETINGS:
        return "GREETING"
    for g in GREETINGS:
        if s.startswith(g + " ") or s.startswith(g + ",") or s == g + "!":
            return "GREETING"

    if _looks_like_gibberish(query):
        return "GIBBERISH"

    resp = _call_with_retry(
        "gemini-flash-lite-latest",
        f"{ROUTER_PROMPT}\n\nMESSAGE: {query}"
    )
    label = (resp.text or "").strip().upper().split()[0] if resp.text else "UNCLEAR"
    return label if label in VALID else "UNCLEAR"

if __name__ == "__main__":
    tests = [
        "hi", "hello", "hai", "apa khabar",
        "fsfs", "asdfghjkl", "bhbhb", "nnnn", "aaa",
        "boleh claim tax relief for parents medical?",
        "Jual rumah kena CKHT ke?",
        "macam mana withdraw akaun 2?",
        "berapa road tax kereta 1.5cc?",
        "what's the weather today",
    ]
    for q in tests:
        print(f"{route(q):10s}  {q}")
