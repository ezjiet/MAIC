"""FastAPI backend for Clarify MY chat, form guidance and recommendations."""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Literal
from urllib.parse import quote

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from src import attachments as attachment_service
from src.generate import _detect_language, answer
from src.retrieve import (
    build_recommended_forms,
    clean_source_title,
    is_vague_form_request,
    normalize_form_metadata,
    retrieve,
    retrieve_exact_form,
)
from src.router import route

logger = logging.getLogger("clarify.api")
Agency = Literal["LHDN", "KWSP", "JPJ", "MULTI", "UNCLEAR"]

app = FastAPI(title="Clarify MY")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)

PDF_DIR = Path("data/raw").resolve()
if PDF_DIR.exists():
    app.mount("/pdfs", StaticFiles(directory=str(PDF_DIR)), name="pdfs")


class HistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=10_000)


class AttachmentRef(BaseModel):
    attachment_id: str = Field(min_length=5, max_length=80)


class AskRequest(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=5_000)
    history: list[HistoryTurn] = Field(default_factory=list, max_length=30)
    attachments: list[AttachmentRef] = Field(default_factory=list, max_length=3)


class LegacyChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=5_000)
    history: list[HistoryTurn] = Field(default_factory=list, max_length=30)


class AttachmentUploadResponse(BaseModel):
    attachment_id: str
    filename: str
    content_type: str
    document_type: str | None
    agency: Agency | None
    form_name: str | None
    form_code: str | None
    status: Literal["ready"] = "ready"


class CitationResponse(BaseModel):
    id: int
    document_title: str
    section: str | None = None
    effective_date: str | None = None
    source_url: str


class RecommendedFormResponse(BaseModel):
    form_id: str
    form_name: str
    form_code: str | None = None
    agency: Literal["LHDN", "KWSP", "JPJ"]
    reason: str | None = None
    source_url: str | None = None
    download_url: str


class AskResponse(BaseModel):
    answer: str
    agency: Agency
    status: Literal["answered", "refused"]
    citations: list[CitationResponse]
    recommended_forms: list[RecommendedFormResponse]
    suggested_follow_ups: list[str]


CANNED = {
    "GIBBERISH": {"malay": "Hmm, saya tak faham. Cuba tanya dengan ayat lengkap ya.",
                  "english": "Hmm, I couldn't understand that. Could you rephrase?",
                  "chinese": "抱歉，我看不懂您的问题。请用完整的句子重新提问。",
                  "manglish": "Hmm, saya tak faham. Cuba tanya semula in a full sentence ya."},
    "GREETING": {"malay": "Hai! Saya Clarify MY. Tanya apa-apa tentang LHDN, KWSP, atau JPJ.",
                 "english": "Hi! I'm Clarify MY. Ask me anything about LHDN, KWSP, or JPJ.",
                 "chinese": "你好！我是 Clarify MY。有关 LHDN、KWSP 或 JPJ 的问题都可以问我。",
                 "manglish": "Hai! I'm Clarify MY. Boleh tanya about LHDN, KWSP, or JPJ."},
    "LHDN_BARE": {"malay": "Boleh! Cuba tanya spesifik: 'bila deadline file cukai?'",
                   "english": "Sure! Try: 'when is the tax filing deadline?'",
                   "chinese": "可以！例如：'什么时候是报税截止日期？'",
                   "manglish": "Boleh! Try: 'when's the tax filing deadline?'"},
    "KWSP_BARE": {"malay": "Boleh! Cuba: 'macam mana withdraw Akaun 2?'",
                   "english": "Sure! Try: 'how do I withdraw Account 2?'",
                   "chinese": "可以！例如：'如何提取账户2？'",
                   "manglish": "Boleh! Try: 'macam mana withdraw Akaun 2?'"},
    "JPJ_BARE": {"malay": "Boleh! Cuba: 'berapa road tax kereta 1.5cc?'",
                  "english": "Sure! Try: 'how much road tax for a 1500cc car?'",
                  "chinese": "可以！例如：'1500cc 的路税多少钱？'",
                  "manglish": "Boleh! Try: 'berapa road tax kereta 1500cc?'"},
}


def _source_url(source: str, agency: str) -> str:
    return f"/pdfs/{agency.lower()}/{quote(source)}"


def _citations(raw: list[dict], chunks: list[dict], agency: str) -> list[CitationResponse]:
    output: list[CitationResponse] = []
    seen: set[str] = set()
    for index, item in enumerate(raw):
        source = str(item.get("source") or "").strip()
        if not source or source.lower() in seen:
            continue
        seen.add(source.lower())
        matched = next((chunk for chunk in chunks if chunk.get("source") == source), {})
        if not matched:
            continue
        page = item.get("page") or matched.get("page")
        output.append(CitationResponse(
            id=index + 1, document_title=str(matched.get("title") or clean_source_title(source)),
            section=f"Page {page}" if page else None,
            effective_date=item.get("effective_date") or matched.get("effective_date"),
            source_url=str(matched.get("source_url") or _source_url(source, agency)),
        ))
    return output


def _follow_ups(agency: str, has_attachment: bool) -> list[str]:
    if has_attachment:
        return ["What documents should I prepare?", "Can you explain another field on this form?"]
    return {
        "LHDN": ["Which documents should I keep?", "What is the submission deadline?"],
        "KWSP": ["Am I eligible?", "Which documents should I prepare?"],
        "JPJ": ["Can I do this online?", "Which documents should I bring?"],
    }.get(agency, [])


def _retrieve_for_agencies(query: str, agencies: list[str]) -> list[dict]:
    chunks: list[dict] = []
    seen: set[str] = set()
    for agency in agencies:
        for chunk in retrieve(query, agency, top_k=8):
            key = str(chunk.get("id") or f"{agency}:{chunk.get('source')}:{chunk.get('page')}")
            if key not in seen:
                seen.add(key)
                chunks.append(chunk)
    return chunks[:12]


def _attachment_grounding_chunks(chunks: list[dict], records: list[attachment_service.AttachmentRecord]) -> list[dict]:
    """Keep official evidence tied to an identified uploaded form code."""
    def base_code(value: str | None) -> str | None:
        match = re.match(r"\s*((?:KWSP|JPJ)\s+[A-Z]?\d+[A-Z]*)\b", value or "", flags=re.IGNORECASE)
        return re.sub(r"\s+", " ", match.group(1)).upper() if match else None

    form_codes = {base_code(record.form_code) for record in records if base_code(record.form_code)}
    if not form_codes:
        return chunks
    matched = []
    for chunk in chunks:
        metadata = normalize_form_metadata(chunk)
        if metadata and base_code(metadata.get("form_code")) in form_codes:
            matched.append(chunk)
    return matched


def _is_ambiguous_field_query(query: str) -> bool:
    lower = query.lower()
    if re.search(r"\b[A-Za-z]{1,4}\d{1,4}[A-Za-z]?\b", query):
        return False
    return any(marker in lower for marker in (
        "put here", "goes here", "this box", "this field", "this section",
        "isi apa", "letak apa", "ruangan ini", "bahagian ini",
    ))


def _process_ask(req: AskRequest) -> AskResponse:
    history = [{"role": turn.role, "content": turn.content} for turn in req.history]
    records = []
    for ref in req.attachments:
        record = attachment_service.get_attachment(ref.attachment_id)
        if not record:
            raise HTTPException(410, "This attachment is no longer available. Please upload the form again.")
        records.append(record)

    # Privacy: log only opaque IDs and lengths, never message or extracted form content.
    logger.info("ask conversation=%s message_chars=%d attachments=%s", req.conversation_id,
                len(req.message), [record.attachment_id for record in records])

    if not records:
        label = route(req.message)
        lang = _detect_language(req.message, history)
        if label in CANNED:
            return AskResponse(answer=CANNED[label].get(lang, CANNED[label]["english"]),
                               agency="UNCLEAR", status="answered", citations=[],
                               recommended_forms=[], suggested_follow_ups=[])
        if label in {"LHDN", "KWSP", "JPJ"} and is_vague_form_request(req.message, label):
            return AskResponse(
                answer=(f"Please tell me what you want to do with {label}—such as the specific application, "
                        "withdrawal, registration, or account change. I won't choose a form without that detail."),
                agency=label, status="refused", citations=[], recommended_forms=[], suggested_follow_ups=[],
            )
        agencies = [label] if label in {"LHDN", "KWSP", "JPJ"} else []
        chunks = _retrieve_for_agencies(req.message, agencies) if agencies else []
        result = answer(req.message, chunks, history=history)
        agency: Agency = label if label in {"LHDN", "KWSP", "JPJ"} else "UNCLEAR"
        status = "refused" if result.get("refused") else "answered"
        return AskResponse(
            answer=result["answer"], agency=agency, status=status,
            citations=_citations(result.get("citations", []), chunks, agency),
            recommended_forms=build_recommended_forms(chunks, req.message),
            suggested_follow_ups=_follow_ups(agency, False),
        )

    identified = sorted({record.agency for record in records if record.agency})
    if not identified:
        return AskResponse(
            answer=("I couldn't reliably identify this as an LHDN, KWSP, or JPJ form. "
                    "Please upload a clearer full page showing the agency and form title."),
            agency="UNCLEAR", status="refused", citations=[],
            recommended_forms=[], suggested_follow_ups=[],
        )

    agency: Agency = identified[0] if len(identified) == 1 else "MULTI"
    if _is_ambiguous_field_query(req.message):
        return AskResponse(
            answer=("Please tell me the field name, label, section, or code shown on the form "
                    "(for example, C1). I can't tell which blank you mean, so I won't guess."),
            agency=agency, status="refused", citations=[], recommended_forms=[], suggested_follow_ups=[],
        )
    requested_codes = {code.upper() for code in re.findall(r"\b[A-Za-z]{1,4}\d{1,4}[A-Za-z]?\b", req.message)}
    visible_text = "\n".join(record.extracted_text for record in records).upper()
    missing_codes = sorted(code for code in requested_codes if code not in visible_text)
    if missing_codes:
        return AskResponse(
            answer=(f"I couldn't find field {', '.join(missing_codes)} in the attached form, so I won't guess what it means. "
                    "Check the field code or upload the page where it appears."),
            agency=agency, status="refused", citations=[], recommended_forms=[],
            suggested_follow_ups=[],
        )
    contexts = [attachment_service.attachment_context(record, req.message) for record in records]
    identity_terms = " ".join(
        part for record in records for part in (record.form_name, record.form_code) if part
    )
    retrieval_query = f"{req.message} {identity_terms} {' '.join(contexts)}"[:12_000]
    chunks = _retrieve_for_agencies(retrieval_query, identified)
    chunks = _attachment_grounding_chunks(chunks, records)
    if not chunks:
        exact_chunks: list[dict] = []
        for record in records:
            if record.agency and record.form_code:
                exact_chunks.extend(
                    retrieve_exact_form(retrieval_query, record.agency, record.form_code, top_k=8)
                )
        chunks = exact_chunks[:12]
    if not chunks:
        return AskResponse(
            answer=("I couldn't find enough official information to explain this field reliably. "
                    "Try specifying the field label or check the official agency source."),
            agency=agency, status="refused", citations=[], recommended_forms=[],
            suggested_follow_ups=[],
        )
    result = answer(req.message, chunks, history=history, attachment_context="\n\n".join(contexts))
    return AskResponse(
        answer=result["answer"], agency=agency,
        status="refused" if result.get("refused") else "answered",
        citations=_citations(result.get("citations", []), chunks, identified[0]),
        recommended_forms=[], suggested_follow_ups=_follow_ups(agency, True),
    )


@app.get("/")
def root():
    return {"service": "Clarify MY", "status": "ok"}


@app.post("/attachments", response_model=AttachmentUploadResponse, status_code=201)
async def upload_attachment(file: UploadFile = File(...)):
    data = await file.read(attachment_service.MAX_ATTACHMENT_BYTES + 1)
    try:
        record = attachment_service.create_attachment(file.filename, file.content_type, data)
    except attachment_service.AttachmentProcessingError as exc:
        raise HTTPException(exc.status_code, exc.detail) from exc
    return AttachmentUploadResponse(
        attachment_id=record.attachment_id, filename=record.filename,
        content_type=record.content_type, document_type=record.document_type,
        agency=record.agency, form_name=record.form_name, form_code=record.form_code, status="ready",
    )


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    try:
        return _process_ask(req)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("ask failed without logging request content")
        raise HTTPException(503, "Clarify MY is temporarily unavailable. Please try again.") from exc


@app.post("/chat", response_model=AskResponse, include_in_schema=False)
def legacy_chat(req: LegacyChatRequest):
    """Temporary compatibility route for clients that have not moved to /ask."""
    return ask(AskRequest(conversation_id="legacy", message=req.query, history=req.history))
