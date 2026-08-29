"""Hybrid retrieval plus conservative form metadata normalization."""
import hashlib
import pickle
import re
import yaml
from pathlib import Path
from urllib.parse import quote
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer, CrossEncoder

DICT_DIR = Path("data/dictionaries")
BM25_DIR = Path("data/bm25")

print("Loading embedder and reranker (first run downloads reranker ~1GB)...")
_embedder = SentenceTransformer("BAAI/bge-m3")
_reranker = CrossEncoder("BAAI/bge-reranker-v2-m3")
_qdrant = QdrantClient(host="localhost", port=6333)

_bm25_cache = {}
_dict_cache = {}

FORM_ACTION_WORDS = {
    "apply", "application", "cancel", "change", "complaint", "daftar", "kemaskini",
    "form", "borang", "memohon", "permohonan", "register", "renew", "transfer", "tukar", "update",
    "withdraw", "withdrawal", "pengeluaran", "penamaan", "refund",
}
GENERIC_RECOMMENDATION_WORDS = {
    "about", "account", "akaun", "borang", "could", "form", "help", "need",
    "official", "please", "should", "what", "when", "where", "which", "would",
}
AGENCY_RECOMMENDATION_WORDS = {
    "employees", "epf", "fund", "hasil", "jabat", "jalan", "jpj", "kumpulan", "kwsp",
    "lhdn", "lembaga", "negeri", "pekerja", "pengangkutan", "provident", "simpanan",
}

def _load_bm25(agency: str):
    if agency not in _bm25_cache:
        with (BM25_DIR / f"{agency}.pkl").open("rb") as f:
            _bm25_cache[agency] = pickle.load(f)
    return _bm25_cache[agency]

def _load_dict(agency: str):
    if agency not in _dict_cache:
        path = DICT_DIR / f"{agency}.yaml"
        _dict_cache[agency] = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return _dict_cache[agency]

def expand_query(query: str, agency: str) -> str:
    """Add formal Bahasa + English equivalents from the dictionary."""
    d = _load_dict(agency)
    additions = []
    lower = query.lower()
    for key, entry in d.items():
        if str(key).lower() in lower:
            if isinstance(entry, dict):
                for v in (entry.get("formal"), entry.get("english")):
                    if v: additions.append(str(v))
            elif isinstance(entry, list):
                additions.extend(str(x) for x in entry)
            elif entry:
                additions.append(str(entry))
    return query + " " + " ".join(additions)


TITLE_STOPWORDS = {
    "borang", "epf", "form", "hasil", "jpj", "kwsp", "lhdn", "malaysia", "official",
}


def _title_terms(value: str) -> set[str]:
    terms = set()
    for token in re.findall(r"[a-z0-9]+", value.lower()):
        if token in TITLE_STOPWORDS:
            continue
        terms.add(token[:-1] if len(token) > 4 and token.endswith("s") else token)
    return terms


def title_ranked_candidates(
    chunks: list[dict], query: str, lexical_scores, limit: int = 8
) -> list[dict]:
    """Offer strong curated-title matches to the existing semantic reranker."""
    query_terms = _title_terms(query)
    by_source: dict[str, tuple[int, float, float, dict]] = {}
    for index, chunk in enumerate(chunks):
        source_key = str(chunk.get("source") or "").lower()
        title = str(chunk.get("title") or clean_source_title(str(chunk.get("source") or "")))
        title_terms = _title_terms(title)
        overlap = len(query_terms.intersection(title_terms))
        if not source_key or overlap == 0:
            continue
        specificity = overlap / max(1, len(title_terms))
        lexical_score = float(lexical_scores[index])
        candidate = (overlap, specificity, lexical_score, chunk)
        if source_key not in by_source or candidate[:3] > by_source[source_key][:3]:
            by_source[source_key] = candidate
    ranked = sorted(by_source.values(), key=lambda item: item[:3], reverse=True)
    return [item[3] for item in ranked[:limit]]


def rerank_document_text(chunk: dict) -> str:
    """Use curated titles during semantic reranking, with filename fallback."""
    title = str(chunk.get("title") or clean_source_title(str(chunk.get("source") or "")))
    return f"{title}. {chunk.get('text') or ''}"


def _is_agency_definition_query(query: str, agency: str) -> bool:
    """Recognize a general agency overview without naming any agency-specific page."""
    tokens = set(re.findall(r"[a-z0-9]+", query.lower()))
    agency_terms = {
        "kwsp": {"kwsp", "epf", "kumpulan", "wang", "simpanan", "pekerja"},
        "jpj": {"jpj", "jabatan", "pengangkutan", "jalan"},
        "lhdn": {"lhdn", "hasil", "lembaga", "dalam", "negeri"},
    }.get(agency.lower(), {agency.lower()})
    definition_fillers = {
        "about", "and", "apa", "do", "does", "explain", "function", "functions",
        "i", "is", "it", "itu", "me", "my", "purpose", "role", "stand", "tell",
        "the", "what",
    }
    return bool(tokens.intersection(agency_terms)) and not (
        tokens - agency_terms - definition_fillers
    )

def retrieve(query: str, agency: str, top_k: int = 8) -> list[dict]:
    agency = agency.lower()
    expanded = expand_query(query, agency)

    # Dense search via Qdrant
    vec = _embedder.encode(expanded, normalize_embeddings=True).tolist()
    dense_resp = _qdrant.query_points(collection_name=agency, query=vec, limit=20)
    dense_ranked = [(hit.payload, i) for i, hit in enumerate(dense_resp.points)]

    # Lexical search via BM25
    store = _load_bm25(agency)
    scores = store["bm25"].get_scores(expanded.lower().split())
    top_ids = sorted(range(len(scores)), key=lambda i: -scores[i])[:20]
    lex_ranked = [(store["chunks"][i], rank) for rank, i in enumerate(top_ids)]
    title_ranked = [
        (chunk, rank)
        for rank, chunk in enumerate(title_ranked_candidates(store["chunks"], expanded, scores))
    ]

    # Reciprocal Rank Fusion (RRF)
    rrf = {}
    for chunk, rank in dense_ranked + lex_ranked + title_ranked:
        key = chunk["id"]
        if key not in rrf:
            rrf[key] = {"chunk": chunk, "score": 0.0}
        rrf[key]["score"] += 1.0 / (60 + rank)
    fused = sorted(rrf.values(), key=lambda x: -x["score"])[:15]

    # For a genuine agency-definition question, transaction forms are not valid
    # overview evidence. Remove them before reranking so a relevant guidance
    # document is not crowded out by frequently repeated agency/form wording.
    if _is_agency_definition_query(query, agency):
        guidance_fused = [item for item in fused if not _is_form_source(item["chunk"])]
        if guidance_fused:
            fused = guidance_fused

    # Rerank the actual text plus its source title. Including the title is especially
    # useful for form-intent queries where the official code lives in source metadata.
    pairs = [
        (expanded, rerank_document_text(x["chunk"]))
        for x in fused
    ]
    rerank_scores = _reranker.predict(pairs)
    selected = select_reranked_chunks(fused, rerank_scores, top_k=top_k, query=expanded)
    return filter_context_for_intent(query, agency, selected)


def select_reranked_chunks(
    fused: list[dict], rerank_scores, top_k: int = 8, max_chunks_per_source: int = 3,
    query: str | None = None,
) -> list[dict]:
    """Keep a compact, high-confidence evidence set after cross-encoder reranking."""
    ranked = sorted(zip(fused, rerank_scores), key=lambda item: -float(item[1]))
    if not ranked:
        return []

    top_score = max(0.0, float(ranked[0][1]))
    # Cross-encoder scores below this point are too weak to present as official
    # grounding. Returning no citation is safer than attaching a merely
    # agency-matching form to a general question.
    relevance_floor = max(0.08, top_score * 0.50)
    selected: list[dict] = []
    per_source: dict[str, int] = {}
    for item, raw_score in ranked:
        score = float(raw_score)
        if score < relevance_floor:
            continue
        chunk = dict(item["chunk"])
        source_key = str(chunk.get("source") or "").lower()
        if per_source.get(source_key, 0) >= max_chunks_per_source:
            continue
        chunk["_retrieval_score"] = score
        chunk["_rrf_score"] = float(item.get("score") or 0.0)
        selected.append(chunk)
        per_source[source_key] = per_source.get(source_key, 0) + 1
        if len(selected) >= top_k:
            break

    # A weaker source can contain the same generic words (for example "claim"
    # and "relief") while discussing a different programme. Keep all useful
    # chunks from strong sources, but require each source's best chunk to be
    # close to the best source overall before presenting it as evidence.
    best_by_source: dict[str, float] = {}
    for chunk in selected:
        source_key = str(chunk.get("source") or "").lower()
        best_by_source[source_key] = max(
            best_by_source.get(source_key, 0.0), float(chunk.get("_retrieval_score") or 0.0)
        )
    source_floor = top_score * 0.90
    title_overlap_by_source: dict[str, int] = {}
    if query:
        query_terms = _title_terms(query)
        for chunk in selected:
            source_key = str(chunk.get("source") or "").lower()
            title = str(chunk.get("title") or clean_source_title(str(chunk.get("source") or "")))
            title_overlap_by_source[source_key] = len(query_terms.intersection(_title_terms(title)))
    best_title_overlap = max(title_overlap_by_source.values(), default=0)
    title_floor = (best_title_overlap * 2 + 2) // 3 if best_title_overlap >= 2 else 0
    return [
        chunk for chunk in selected
        if best_by_source.get(str(chunk.get("source") or "").lower(), 0.0) >= source_floor
        and title_overlap_by_source.get(str(chunk.get("source") or "").lower(), title_floor) >= title_floor
    ]


def clean_source_title(source: str) -> str:
    title = re.sub(r"(?:\.pdf)+$", "", source, flags=re.IGNORECASE)
    return re.sub(r"[_\s]+", " ", title).strip()


def is_vague_form_request(query: str, agency: str) -> bool:
    tokens = set(re.findall(r"[a-z0-9]+", query.lower()))
    if not tokens.intersection({"borang", "form"}):
        return False
    agency_terms = {
        "kwsp": {"kwsp", "epf", "kumpulan", "wang", "simpanan", "pekerja"},
        "jpj": {"jpj", "jabatan", "pengangkutan", "jalan"},
        "lhdn": {"lhdn", "hasil", "lembaga", "dalam", "negeri"},
    }.get(agency.lower(), {agency.lower()})
    fillers = {
        "about", "apa", "borang", "could", "do", "does", "explain", "form", "i", "is", "itu",
        "me", "my", "need", "please", "should", "stand", "tell", "what", "which", "would",
    }
    return not (tokens - agency_terms - fillers)


def filter_context_for_intent(query: str, agency: str, chunks: list[dict]) -> list[dict]:
    """Avoid treating transaction forms as evidence for a bare agency definition."""
    tokens = set(re.findall(r"[a-z0-9]+", query.lower()))
    is_definition_only = _is_agency_definition_query(query, agency)
    if is_definition_only:
        return [chunk for chunk in chunks if not _is_form_source(chunk)]
    if not tokens.intersection({"borang", "form"}) and chunks and not _is_form_source(chunks[0]):
        # When direct guidance wins a process question, a nearby application form
        # is not additional evidence for that process and should not be cited.
        return [chunk for chunk in chunks if not _is_form_source(chunk)]
    if tokens.intersection({"borang", "form"}) and chunks:
        if is_vague_form_request(query, agency):
            return []
        top_source = str(chunks[0].get("source") or "").lower()
        top_score = float(chunks[0].get("_retrieval_score") or 0.0)
        return [
            chunk for chunk in chunks
            if str(chunk.get("source") or "").lower() == top_source
            or float(chunk.get("_retrieval_score") or 0.0) >= top_score * 0.97
        ]
    return chunks


def _is_form_source(payload: dict) -> bool:
    document_type = str(payload.get("document_type") or "").lower()
    if document_type in {"form", "government_form"}:
        return True
    source = str(payload.get("source") or "")
    normalized = source.lower().replace("-", "_")
    return bool(
        re.search(r"(?:^|_)(borang|form)(?:_|$)", normalized)
        or re.search(r"^kwsp_(?:kwsp_)?\d+[a-z]*", normalized)
        or re.search(r"jpj[_]?[kl]\d", normalized)
        or re.search(r"jpjk\d", normalized)
    )


def _form_code_from_payload(payload: dict, agency: str) -> str | None:
    source = clean_source_title(str(payload.get("source") or ""))
    text = re.sub(r"\s+", " ", str(payload.get("text") or ""))[:2_000]
    normalized = f"{text} {source}".upper()
    if agency == "KWSP":
        match = re.search(
            r"\bKWSP\s+(?:FORM\s+)?(?:KWSP\s+)?([A-Z]?\d+[A-Z]*)"
            r"(?:\s*\(?(AHL)\)?)?(?:\s*\(?(D\d+[A-Z]?)\)?)?",
            normalized,
        )
        if match:
            code = match.group(1)
            if match.group(2):
                code += " (AHL)"
            if match.group(3):
                code += f" ({match.group(3)})"
            return f"KWSP {code}"
    if agency == "JPJ":
        for candidate in (source.upper(), text.upper()):
            match = re.search(r"\bJPJ\s*([A-Z]{1,3}\d+[A-Z]?|\d+[A-Z]?)\b", candidate)
            if match:
                return f"JPJ {match.group(1)}"
    return None


def _form_name_from_text(payload: dict) -> str | None:
    text = re.sub(r"\s+", " ", str(payload.get("text") or ""))[:3_000]
    match = re.search(
        r"\b(Borang\s+Permohonan\s+.{5,180}?)(?=,\s*KWSP\b|\s+KWSP\s+\d)",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        return re.sub(r"\s+", " ", match.group(1)).strip()
    checklist = re.search(
        r"\bSENARAI\s+SEMAKAN\s+DOKUMEN\s+PERMOHONAN\s+(.{5,150}?)"
        r"(?=\s+(?:V\d{8}|\d+/\d+|KWSP\s+\d))",
        text,
        flags=re.IGNORECASE,
    )
    if checklist:
        purpose = re.sub(r"\s+", " ", checklist.group(1)).strip().title()
        return f"Borang Permohonan {purpose}"
    return None


def normalize_form_metadata(payload: dict) -> dict | None:
    """Normalize only metadata supported by an actually retrieved form source."""
    if not _is_form_source(payload):
        return None
    source = str(payload.get("source") or "").strip()
    agency = str(payload.get("agency") or "").upper()
    if not source or agency not in {"KWSP", "LHDN", "JPJ"}:
        return None

    # TODO: Enrich form-document metadata during ingestion for reliable recommendations.
    form_name = str(payload.get("form_name") or _form_name_from_text(payload) or clean_source_title(source)).strip()
    form_code = payload.get("form_code") or _form_code_from_payload(payload, agency)
    form_id = str(payload.get("form_id") or f"form_{hashlib.sha256(f'{agency}:{source}'.encode()).hexdigest()[:16]}")
    source_url = payload.get("source_url")
    download_url = f"/pdfs/{agency.lower()}/{quote(source)}"
    return {
        "form_id": form_id,
        "form_name": form_name,
        "form_code": form_code,
        "agency": agency,
        "reason": None,
        "source_url": source_url,
        "download_url": download_url,
    }


def build_recommended_forms(chunks: list[dict], query: str, limit: int = 3) -> list[dict]:
    original_query_tokens = {
        token for token in re.findall(r"[a-z0-9]+", query.lower()) if len(token) > 3
    }
    recommendation_query = query
    agencies = {str(chunk.get("agency") or "").lower() for chunk in chunks if chunk.get("agency")}
    if len(agencies) == 1:
        recommendation_query = expand_query(query, agencies.pop())
    query_tokens = {
        token for token in re.findall(r"[a-z0-9]+", recommendation_query.lower()) if len(token) > 3
    }
    if not query_tokens.intersection(FORM_ACTION_WORDS):
        return []
    required_actions = original_query_tokens.intersection(
        FORM_ACTION_WORDS - {"application", "apply", "borang", "form", "memohon", "permohonan"}
    )
    specific_tokens = (
        query_tokens - FORM_ACTION_WORDS - GENERIC_RECOMMENDATION_WORDS - AGENCY_RECOMMENDATION_WORDS
    )
    if not specific_tokens and not required_actions:
        return []

    # A form can contribute several final-context chunks. Combine those chunks so
    # metadata found on its title page is not lost merely because another page
    # ranked first for the user's specific detail.
    grouped: dict[str, tuple[int, dict]] = {}
    for rank, chunk in enumerate(chunks):
        source = str(chunk.get("source") or "")
        source_key = source.lower()
        if not source_key:
            continue
        if source_key not in grouped:
            grouped[source_key] = (rank, dict(chunk))
        else:
            first_rank, combined = grouped[source_key]
            combined["text"] = f"{combined.get('text', '')} {chunk.get('text', '')}".strip()
            grouped[source_key] = (first_rank, combined)

    candidates: list[tuple[int, int, dict]] = []
    for _, (rank, chunk) in grouped.items():
        source = str(chunk.get("source") or "")
        metadata = normalize_form_metadata(chunk)
        if not metadata:
            continue
        source_lower = source.lower()
        text_lower = str(chunk.get("text") or "").lower()
        if required_actions and not any(
            action in f"{source_lower} {text_lower}" for action in required_actions
        ):
            continue
        specific_score = 3 * sum(token in source_lower for token in specific_tokens)
        specific_score += sum(token in text_lower for token in specific_tokens)
        if specific_tokens and specific_score == 0:
            continue
        candidates.append((specific_score, -rank, metadata))

    if not candidates:
        return []
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    if not specific_tokens:
        return [candidates[0][2]]
    best_score = candidates[0][0]
    # Prefer form titles/codes that directly contain the user's distinguishing term.
    cutoff = max(2, best_score - 1)
    return [metadata for score, _, metadata in candidates if score >= cutoff][:limit]


def retrieve_exact_form(query: str, agency: str, form_code: str, top_k: int = 8) -> list[dict]:
    """Rerank chunks only within an already identified official form code."""
    normalized_code = re.sub(r"\s+", " ", form_code).strip().upper()
    try:
        corpus_chunks = _load_bm25(agency.lower())["chunks"]
    except Exception:
        return []
    candidates = []
    for chunk in corpus_chunks:
        metadata = normalize_form_metadata(chunk)
        candidate_code = re.sub(r"\s+", " ", str((metadata or {}).get("form_code") or "")).strip().upper()
        if candidate_code == normalized_code:
            candidates.append(chunk)
    if not candidates:
        return []
    scores = _reranker.predict([(query, rerank_document_text(chunk)) for chunk in candidates])
    fused = [
        {"chunk": chunk, "score": 1.0 / (60 + rank)}
        for rank, chunk in enumerate(candidates)
    ]
    return select_reranked_chunks(
        fused, scores, top_k=top_k, max_chunks_per_source=top_k, query=query
    )


def _agency_candidates(text: str) -> list[str]:
    lower = text.lower()
    candidates = []
    markers = {
        "LHDN": ("lhdn", "lembaga hasil", "hasil dalam negeri", "borang be"),
        "KWSP": ("kwsp", "kumpulan wang simpanan pekerja", "employees provident fund", "epf"),
        "JPJ": ("jpj", "jabatan pengangkutan jalan", "lesen memandu"),
    }
    for agency, values in markers.items():
        if any(marker in lower for marker in values):
            candidates.append(agency)
    return candidates or ["LHDN", "KWSP", "JPJ"]


def identify_official_form(extracted_text: str) -> dict:
    """Match extracted form text against existing official Qdrant/BM25 results."""
    query = re.sub(r"\s+", " ", extracted_text).strip()[:5_000]
    upload_tokens = {token for token in re.findall(r"[a-z0-9]+", query.lower()) if len(token) > 3}
    best: tuple[int, dict] | None = None
    known_agencies = _agency_candidates(query)

    for agency in known_agencies:
        visible_code = _form_code_from_payload({"text": query}, agency)
        if visible_code:
            exact_matches: list[tuple[int, dict]] = []
            try:
                corpus_chunks = _load_bm25(agency.lower())["chunks"]
            except Exception:
                corpus_chunks = []
            for chunk in corpus_chunks:
                metadata = normalize_form_metadata(chunk)
                if not metadata or metadata.get("form_code") != visible_code:
                    continue
                official_tokens = {
                    token for token in re.findall(
                        r"[a-z0-9]+", f"{chunk.get('source', '')} {chunk.get('text', '')}".lower()
                    ) if len(token) > 3
                }
                exact_matches.append((len(upload_tokens.intersection(official_tokens)), metadata))
            if exact_matches:
                _, metadata = max(exact_matches, key=lambda item: item[0])
                return {
                    "document_type": "government_form",
                    "agency": metadata["agency"],
                    "form_name": metadata["form_name"],
                    "form_code": metadata["form_code"],
                }
        try:
            chunks = retrieve(query, agency, top_k=8)
        except Exception:
            continue
        for chunk in chunks:
            metadata = normalize_form_metadata(chunk)
            if not metadata:
                continue
            official_tokens = {
                token for token in re.findall(
                    r"[a-z0-9]+", f"{chunk.get('source', '')} {chunk.get('text', '')}".lower()
                ) if len(token) > 3
            }
            score = len(upload_tokens.intersection(official_tokens))
            if best is None or score > best[0]:
                best = (score, metadata)

    agency = known_agencies[0] if len(known_agencies) == 1 else None
    if not best or best[0] < 4:
        return {"document_type": None, "agency": agency, "form_name": None, "form_code": None}
    metadata = best[1]
    return {
        "document_type": "government_form",
        "agency": metadata["agency"],
        "form_name": metadata["form_name"],
        "form_code": metadata["form_code"],
    }
