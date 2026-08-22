"""FastAPI backend for Clarify MY — chat + smart form assistant."""
import shutil, uuid
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from src.router import route
from src.retrieve import retrieve
from src.generate import answer, _detect_language
from src.form_extract import extract_fields
from src.form_facts import extract_facts
from src.form_prepare import prepare_form_guide
from src.form_suggest import suggest_all
from src.form_pdf import generate_filled_summary
from src.form_acroform import fill_acroform_pdf

app = FastAPI(title="Clarify MY")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

PDF_DIR = Path("data/raw").resolve()
FORMS_DIR = Path("data/forms").resolve();   FORMS_DIR.mkdir(parents=True, exist_ok=True)
DRAFTS_DIR = Path("data/drafts").resolve(); DRAFTS_DIR.mkdir(parents=True, exist_ok=True)

if PDF_DIR.exists():
    app.mount("/pdfs", StaticFiles(directory=str(PDF_DIR)), name="pdfs")
app.mount("/drafts", StaticFiles(directory=str(DRAFTS_DIR)), name="drafts")

# In-memory: form_id -> uploaded path (so we can fill the original PDF at finalise step)
_UPLOADED: dict[str, Path] = {}

# ------------------ Chat ------------------

class HistoryTurn(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    history: list[HistoryTurn] = []

CANNED = {
    "GIBBERISH": {"malay":"Hmm, saya tak faham. Cuba tanya dengan ayat lengkap ya.",
                  "english":"Hmm, I couldn't understand that. Could you rephrase?",
                  "chinese":"抱歉，我看不懂您的问题。请用完整的句子重新提问。",
                  "manglish":"Hmm, saya tak faham. Cuba tanya semula in a full sentence ya."},
    "GREETING":  {"malay":"Hai! Saya Clarify MY. Tanya apa-apa tentang LHDN, KWSP, atau JPJ.",
                  "english":"Hi! I'm Clarify MY. Ask me anything about LHDN, KWSP, or JPJ.",
                  "chinese":"你好！我是 Clarify MY。有关 LHDN、KWSP 或 JPJ 的问题都可以问我。",
                  "manglish":"Hai! I'm Clarify MY. Boleh tanya about LHDN, KWSP, or JPJ."},
    "LHDN_BARE": {"malay":"Boleh! Cuba tanya spesifik: 'bila deadline file cukai?'",
                  "english":"Sure! Try: 'when is the tax filing deadline?'",
                  "chinese":"可以！例如：'什么时候是报税截止日期？'",
                  "manglish":"Boleh! Try: 'when's the tax filing deadline?'"},
    "KWSP_BARE": {"malay":"Boleh! Cuba: 'macam mana withdraw Akaun 2?'",
                  "english":"Sure! Try: 'how do I withdraw Account 2?'",
                  "chinese":"可以！例如：'如何提取账户2？'",
                  "manglish":"Boleh! Try: 'macam mana withdraw Akaun 2?'"},
    "JPJ_BARE":  {"malay":"Boleh! Cuba: 'berapa road tax kereta 1.5cc?'",
                  "english":"Sure! Try: 'how much road tax for a 1500cc car?'",
                  "chinese":"可以！例如：'1500cc 的路税多少钱？'",
                  "manglish":"Boleh! Try: 'berapa road tax kereta 1500cc?'"},
}

@app.get("/")
def root():
    return {"service": "Clarify MY", "status": "ok"}

@app.post("/chat")
def chat(req: ChatRequest):
    label = route(req.query)
    lang = _detect_language(req.query)

    if label in CANNED:
        return {"agency":"UNCLEAR","answer":CANNED[label].get(lang, CANNED[label]["english"]),
                "citations":[],"refused":False}

    history = [{"role":h.role,"content":h.content} for h in req.history]

    if label in {"UNCLEAR", "OFFTOPIC"}:
        result = answer(req.query, chunks=[], history=history)
        result["agency"] = "UNCLEAR"
        return result

    chunks = retrieve(req.query, label)
    result = answer(req.query, chunks, history=history)
    for c in result.get("citations", []):
        c["agency"] = label.lower()
    result["agency"] = label
    return result

# ------------------ Form Assistant ------------------

@app.post("/form/extract")
async def form_extract(file: UploadFile = File(...)):
    """Upload form -> get fields + whether the original supports direct fill."""
    if not file.filename:
        raise HTTPException(400, "No filename")
    form_id = uuid.uuid4().hex[:12]
    dest = FORMS_DIR / f"{form_id}_{file.filename}"
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    _UPLOADED[form_id] = dest

    try:
        result = extract_fields(dest)
    except Exception as e:
        raise HTTPException(500, f"Form extraction failed: {e}")

    return {
        "form_id": form_id,
        "form_name": file.filename,
        "fields": result["fields"],
        "field_count": len(result["fields"]),
        "is_fillable": result["is_fillable"],
        "method": result["method"],
    }

class PrepareRequest(BaseModel):
    form_name: str
    agency: str
    fields: list[dict]

@app.post("/form/prepare")
def form_prepare(req: PrepareRequest):
    return prepare_form_guide(req.form_name, req.agency, req.fields)

class SuggestRequest(BaseModel):
    form_id: str
    form_name: str
    agency: str
    fields: list[dict]
    facts_text: str

@app.post("/form/suggest")
def form_suggest(req: SuggestRequest):
    facts = extract_facts(req.facts_text)
    suggestions = suggest_all(req.fields, req.agency, facts)
    return {"form_id": req.form_id, "form_name": req.form_name, "agency": req.agency,
            "facts": facts, "suggestions": suggestions}

class FinaliseRequest(BaseModel):
    form_id: str
    form_name: str
    agency: str
    facts: dict
    suggestions: list[dict]
    is_fillable: bool = False

@app.post("/form/finalise")
def form_finalise(req: FinaliseRequest):
    """If is_fillable=True and we still have the uploaded PDF, fill the original AcroForm.
    Otherwise generate a review-summary PDF."""
    if req.is_fillable and req.form_id in _UPLOADED:
        try:
            source_pdf = _UPLOADED[req.form_id]
            values = {}
            for s in req.suggestions:
                fld = s.get("field") or {}
                name = fld.get("field_code") or fld.get("field_name")
                if name and s.get("value") not in (None, ""):
                    values[name] = s["value"]
            out = DRAFTS_DIR / f"{req.form_id}_filled.pdf"
            fill_acroform_pdf(source_pdf, values, out)
            return {"download_url": f"/drafts/{out.name}", "form_id": req.form_id,
                    "mode": "official_filled", "filename": out.name}
        except Exception as e:
            print(f"[finalise] AcroForm fill failed, falling back to summary: {e}")

    # Fallback: summary PDF
    out = DRAFTS_DIR / f"{req.form_id}_summary.pdf"
    generate_filled_summary(out, req.form_name, req.agency, req.facts, req.suggestions)
    return {"download_url": f"/drafts/{out.name}", "form_id": req.form_id,
            "mode": "summary", "filename": out.name}
