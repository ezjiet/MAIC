"""Generate helpful, expert-level answers using retrieved chunks + Gemini's knowledge."""
import os
import re
import time
from google import genai
from dotenv import load_dotenv

load_dotenv()
_client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])

# Model fallback chain: try smart first, fall back if quota hit.
ANSWER_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash-lite"]

def _call_with_retry(models: list[str], contents, max_tries_per_model: int = 2):
    """Try each model in order. On 503/overload, retry same model. On 429/quota, fall back."""
    last_err = None
    for model in models:
        for attempt in range(max_tries_per_model):
            try:
                return _client.models.generate_content(model=model, contents=contents), model
            except Exception as e:
                last_err = e
                msg = str(e)
                if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
                    print(f"  [{model} quota exhausted, falling back...]")
                    break  # fall through to next model
                if "503" in msg or "UNAVAILABLE" in msg or "overloaded" in msg.lower():
                    print(f"  [{model} busy, retrying in {2**attempt}s...]")
                    time.sleep(min(2 ** attempt, 1)); continue
                raise  # unknown error, propagate
    raise last_err or RuntimeError("All Gemini models exhausted")

def _score_language(text: str) -> tuple[str | None, str, str]:
    """Return (explicit_override, malay_hits_flag, english_hits_flag).
    explicit_override is 'english' | 'malay' | 'chinese' | 'manglish' | None."""
    lower = text.lower()
    # explicit user directive wins
    override = None
    if any(p in lower for p in ["use english","in english","reply in english","english please","switch to english","balas english","balas dalam english"]):
        override = "english"
    elif any(p in lower for p in ["use malay","in malay","use bahasa","in bahasa","gunakan bahasa","balas bahasa","balas melayu","use bm"]):
        override = "malay"
    elif any(p in lower for p in ["use chinese","in chinese","reply in chinese","中文回复","请用中文","用中文"]):
        override = "chinese"
    elif any(p in lower for p in ["use manglish","in manglish","reply manglish"]):
        override = "manglish"
    malay_markers = ["saya","awak","kamu","boleh","macam mana","nak ","tak ","ke tak",
                     "berapa","bila","kenapa","apa ","yang ","untuk ","kena ","dengan ",
                     "adalah","sudah","belum","sini","situ","mana ","camne","eh "," lah",
                     " la ","tolong","tanya","sikit","cukai","lesen","kereta"]
    english_markers = [
        # question words
        "what ","how ","when ","why ","where ","who ",
        # aux verbs & function words (safe — not used as Malaysian borrowings)
        "the ","is ","are ","was ","were ","will ","would ","should ","could ","have ","has ",
        "do i","do you","does ","did ","can i","can you",
        # pronouns
        "i ","my ","me ","mine ","you ","your ","we ","our ","us ",
        # common English verbs unlikely in Malay/Manglish
        "tell ","explain ","show ","need ","want ",
        # politeness
        "please","thanks","hi ","hello",
    ]
    return (override,
            "y" if any(m in lower for m in malay_markers) else "",
            "y" if any(m in lower for m in english_markers) else "")

def _detect_language(text: str, history: list[dict] | None = None) -> str:
    # Chinese script always wins on the current message
    if re.search(r"[一-鿿]", text): return "chinese"

    # 1. Explicit directive in CURRENT message
    override, has_malay_now, has_english_now = _score_language(text)
    if override: return override

    # 2. Explicit directive from any past user message (sticky)
    if history:
        for turn in reversed(history):
            if turn.get("role") != "user": continue
            past_over, _, _ = _score_language(str(turn.get("content","")))
            if past_over: return past_over

    # 3. Current message alone — clear signal wins
    if has_malay_now and has_english_now: return "manglish"
    if has_malay_now: return "malay"
    if has_english_now: return "english"

    # 4. Fall back to language of most recent user message in history
    if history:
        for turn in reversed(history):
            if turn.get("role") != "user": continue
            content = str(turn.get("content",""))
            if re.search(r"[一-鿿]", content): return "chinese"
            _, hm, he = _score_language(content)
            if hm and he: return "manglish"
            if hm: return "malay"
            if he: return "english"

    # 5. Ultimate default: English (was Malay — most users are typing English)
    return "english"

LANG_INSTRUCTION = {
    "chinese": "CRITICAL: Reply ENTIRELY in Chinese (中文). Not English, not Malay.",
    "malay":   "CRITICAL: Reply ENTIRELY in Bahasa Malaysia (casual is fine). Not English.",
    "english": "CRITICAL: Reply ENTIRELY in English. Not Malay.",
    "manglish":"CRITICAL: Reply in Manglish — mix Malay and English naturally like a KL local.",
}

SYSTEM = """You are Clarify MY — an expert Malaysian public-services assistant.
You know LHDN (income tax), KWSP (EPF), and JPJ (licence, road tax, vehicles)
as if you'd worked at all three agencies for 15 years. You explain things
clearly to ordinary citizens without jargon.

===== HOW TO BE GENUINELY HELPFUL =====

1. ANSWER THE ACTUAL QUESTION, DIRECTLY.
   - Don't dodge. Don't say "check the official site" as your whole answer.
   - If the user asks "how much is road tax for 1500cc?" — give them the number
     using the standard formula, then note it may vary slightly by vehicle
     class (saloon/non-saloon, private/company).
   - If they ask a process ("how do I withdraw KWSP Akaun 2?") — walk them
     through the steps.

2. USE ALL YOUR KNOWLEDGE.
   - The CONTEXT is retrieved from official PDFs — use it when it's relevant.
   - Your OWN training knowledge of Malaysian public services is also valuable.
     Use it freely for well-known things like:
       * JPJ road tax formulas by cc range (saloon vs non-saloon, WM/EM rates)
       * LHDN income tax brackets, standard reliefs (self, spouse, child, PCB)
       * KWSP contribution rates (11% employee / 12-13% employer), Akaun structure
       * Standard procedures citizens can follow
   - Combine both. Cite context when specific, use general knowledge otherwise.

3. DO CALCULATIONS. SHOW THE MATH.
   - "For a 1500cc saloon private car in West Malaysia: RM (base) + RM (cc rate × extra cc) = RM X per year"
   - "If your annual chargeable income is RM 50,000, the tax after standard reliefs is roughly RM Y"
   - Use plain numbers. Round sensibly.

4. BE PROACTIVE.
   - Anticipate the next question. "Kalau nak renew online, boleh via MyEG/JPJ portal."
   - Mention common gotchas ("Akaun Fleksibel withdrawals are subject to a 4% dividend forfeit if withdrawn within 12 months")
   - Suggest what to prepare (documents, IC, receipts).

5. FORMAT FOR READABILITY.
   - Use short paragraphs (2-3 sentences each) or a small bullet list for steps.
   - Bold key numbers or names when it aids scanning: **RM 90/year**, **Form KWSP 9C**.
   - Keep it under ~200 words unless the question needs more.

6. WHEN YOU'RE UNSURE ABOUT AN EXACT NUMBER OR RULE:
   - Give your best estimate based on the standard rate.
   - Add a short caveat: "For the latest exact figure, MyJPJ/HASiL/i-Akaun."
   - Never invent specific section numbers, clause references, or dates.

7. NEVER REFUSE ROUTINE QUESTIONS.
   - The only questions to decline are truly off-topic ones (weather, unrelated
     agencies, personal life). Everything about LHDN/KWSP/JPJ — answer it.

===== TONE =====
Warm, direct, competent. Like a knowledgeable friend who works at the agency,
not a corporate chatbot. Use "you", "awak", or "kamu"."""

def _format_history(history: list[dict]) -> str:
    if not history: return ""
    lines = ["\nCONVERSATION SO FAR:"]
    for turn in history[-10:]:
        role = "USER" if turn.get("role") == "user" else "YOU"
        content = str(turn.get("content", "")).strip()
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines) + "\n"

def answer(query: str, chunks: list[dict], history: list[dict] | None = None) -> dict:
    history = history or []
    lang = _detect_language(query, history)

    if chunks:
        context = "\n\n---\n\n".join(
            f"[SOURCE: {c['source']} | page {c.get('page')}]\n{c['text']}"
            for c in chunks
        )
    else:
        context = "(no matching PDF chunks — rely on your Malaysian public-services knowledge)"

    prompt = (
        f"{SYSTEM}\n\n"
        f"{LANG_INSTRUCTION[lang]}\n"
        f"{_format_history(history)}"
        f"\nRETRIEVED CONTEXT (official Malaysian PDFs — may or may not be relevant):\n{context}\n"
        f"\nUSER'S NEW MESSAGE: {query}\n\n"
        f"Give your best, most useful answer. Remember: {LANG_INSTRUCTION[lang]}"
    )

    try:
        resp, used_model = _call_with_retry(ANSWER_MODELS, prompt)
        text = (resp.text or "").strip()
        if used_model != ANSWER_MODELS[0]:
            print(f"  [answered via fallback model: {used_model}]")
    except Exception as e:
        msg = str(e)
        if "429" in msg or "quota" in msg.lower():
            friendly = ("Maaf, kuota AI harian saya dah habis untuk hari ni. "
                        "Cuba lagi esok, atau upgrade Gemini API key untuk kuota lebih tinggi. "
                        "(Free tier reset setiap 24 jam)")
        elif "503" in msg or "UNAVAILABLE" in msg:
            friendly = "AI servis sibuk sekejap. Cuba lagi dalam 10-20 saat ya."
        else:
            friendly = f"Ada masalah teknikal sekejap. Cuba lagi ya."
        return {"answer": friendly, "citations": [], "refused": True}

    if not text:
        return {"answer": "Cuba tanya semula ya.", "citations": [], "refused": True}

    # Only show citations that actually relate to the query/answer,
    # and DEDUPE by source filename so we never show the same PDF twice.
    q_and_a_lower = (query + " " + text).lower()
    seen_sources: set[str] = set()
    kept = []
    STOP = {"pdf","form","kwsp","lhdn","jpj","borang","tahun","pind","the","and","for","of"}
    # Iterate over all chunks (not just top 5) so we surface distinct docs when
    # the top matches all come from one PDF.
    for c in (chunks if chunks else []):
        source = c["source"]
        source_key = source.lower()
        if source_key in seen_sources:
            continue
        keywords = [w for w in re.split(r"[_\.\s]+", source_key)
                    if len(w) > 3 and w not in STOP]
        if any(kw in q_and_a_lower for kw in keywords):
            seen_sources.add(source_key)
            kept.append(c)
        if len(kept) >= 3:  # cap to 3 distinct sources
            break

    return {
        "answer": text,
        "citations": [
            {"source": c["source"], "page": c.get("page"),
             "effective_date": c.get("effective_date")}
            for c in kept
        ],
        "refused": False,
    }
