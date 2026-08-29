"""Parse official source documents into text chunks with metadata."""
import json
import re
from pathlib import Path
from pypdf import PdfReader
import yaml

RAW_DIR = Path("data/raw")
OUT_DIR = Path("data/chunks")
METADATA_FILE = Path("data/source_metadata.yaml")
OUT_DIR.mkdir(parents=True, exist_ok=True)

CHUNK_SIZE = 800       # chars per chunk
CHUNK_OVERLAP = 120    # chars overlapping between chunks


def load_source_metadata(path: Path = METADATA_FILE) -> dict:
    """Load curated provenance for official corpus files."""
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ValueError(f"Source metadata must be a mapping: {path}")
    return data


def _clean_title(source: str) -> str:
    title = re.sub(r"(?:\.pdf)+$|\.txt$", "", source, flags=re.IGNORECASE)
    return re.sub(r"[_\s]+", " ", title).strip()


def _looks_like_form(source: str) -> bool:
    normalized = source.lower().replace("-", "_")
    return bool(
        re.search(r"(?:^|_)(borang|form)(?:_|$)", normalized)
        or re.search(r"^kwsp_(?:kwsp_)?\d+[a-z]*", normalized)
        or re.search(r"jpj[_]?[kl]\d", normalized)
        or re.search(r"jpjk\d", normalized)
    )


def metadata_for_source(source_path: Path, agency: str, manifest: dict | None = None) -> dict:
    """Return default metadata enriched by an exact filename manifest entry."""
    manifest = manifest if manifest is not None else load_source_metadata()
    metadata = {
        "agency": agency.upper(),
        "title": _clean_title(source_path.name),
        "document_type": "form" if _looks_like_form(source_path.name) else "guidance",
        "source_url": None,
        "effective_date": None,
    }
    agency_entries = manifest.get(agency.lower(), {})
    if not isinstance(agency_entries, dict):
        raise ValueError(f"Source metadata for {agency} must be a mapping")
    entry = agency_entries.get(source_path.name, {})
    if not isinstance(entry, dict):
        raise ValueError(f"Source metadata for {source_path.name} must be a mapping")
    metadata.update(entry)
    return metadata

def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP):
    """Split long text into overlapping chunks."""
    text = " ".join(text.split())  # normalise whitespace
    if len(text) <= size:
        return [text] if text else []
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append(text[start:end])
        start += size - overlap
    return chunks

def _chunk_payloads(source_path: Path, page_no: int, page_text: str, metadata: dict) -> list[dict]:
    out = []
    for i, chunk in enumerate(chunk_text(page_text)):
        if len(chunk) < 50:
            continue
        payload = {
            "id": f"{metadata['agency'].lower()}_{source_path.stem}_p{page_no}_c{i}",
            "source": source_path.name,
            "page": page_no,
            "text": chunk,
        }
        payload.update(metadata)
        out.append(payload)
    return out


def process_pdf(pdf_path: Path, agency: str, metadata: dict | None = None):
    """Extract text from PDF and produce chunk dicts."""
    metadata = metadata or metadata_for_source(pdf_path, agency)
    try:
        reader = PdfReader(str(pdf_path))
    except Exception as e:
        print(f"  ! failed to open {pdf_path.name}: {e}")
        return []
    out = []
    for page_no, page in enumerate(reader.pages, start=1):
        try:
            page_text = page.extract_text() or ""
        except Exception:
            continue
        out.extend(_chunk_payloads(pdf_path, page_no, page_text, metadata))
    return out


def process_text(text_path: Path, agency: str, metadata: dict | None = None):
    """Chunk a normalized text snapshot of an official public source page."""
    metadata = metadata or metadata_for_source(text_path, agency)
    return _chunk_payloads(text_path, 1, text_path.read_text(encoding="utf-8"), metadata)

def main():
    manifest = load_source_metadata()
    for agency_dir in sorted(RAW_DIR.iterdir()):
        if not agency_dir.is_dir():
            continue
        agency = agency_dir.name
        all_chunks = []
        documents = sorted(
            path for path in agency_dir.iterdir()
            if path.is_file() and path.suffix.lower() in {".pdf", ".txt"}
        )
        print(f"[{agency}] {len(documents)} source documents")
        for document in documents:
            print(f"  - {document.name}")
            metadata = metadata_for_source(document, agency, manifest)
            if document.suffix.lower() == ".pdf":
                all_chunks.extend(process_pdf(document, agency, metadata))
            else:
                all_chunks.extend(process_text(document, agency, metadata))
        out_file = OUT_DIR / f"{agency}.jsonl"
        with out_file.open("w", encoding="utf-8") as f:
            for c in all_chunks:
                f.write(json.dumps(c, ensure_ascii=False) + "\n")
        print(f"[{agency}] wrote {len(all_chunks)} chunks -> {out_file}\n")

if __name__ == "__main__":
    main()
