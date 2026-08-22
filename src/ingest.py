"""Parse PDFs into text chunks with metadata."""
import json
from pathlib import Path
from pypdf import PdfReader

RAW_DIR = Path("data/raw")
OUT_DIR = Path("data/chunks")
OUT_DIR.mkdir(parents=True, exist_ok=True)

CHUNK_SIZE = 800       # chars per chunk
CHUNK_OVERLAP = 120    # chars overlapping between chunks

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

def process_pdf(pdf_path: Path, agency: str):
    """Extract text from PDF and produce chunk dicts."""
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
        for i, chunk in enumerate(chunk_text(page_text)):
            if len(chunk) < 50:
                continue
            out.append({
                "id": f"{agency}_{pdf_path.stem}_p{page_no}_c{i}",
                "agency": agency,
                "source": pdf_path.name,
                "page": page_no,
                "text": chunk,
                "effective_date": None,
            })
    return out

def main():
    for agency_dir in sorted(RAW_DIR.iterdir()):
        if not agency_dir.is_dir():
            continue
        agency = agency_dir.name
        all_chunks = []
        pdfs = sorted(agency_dir.glob("*.pdf"))
        print(f"[{agency}] {len(pdfs)} PDFs")
        for pdf in pdfs:
            print(f"  - {pdf.name}")
            all_chunks.extend(process_pdf(pdf, agency))
        out_file = OUT_DIR / f"{agency}.jsonl"
        with out_file.open("w", encoding="utf-8") as f:
            for c in all_chunks:
                f.write(json.dumps(c, ensure_ascii=False) + "\n")
        print(f"[{agency}] wrote {len(all_chunks)} chunks -> {out_file}\n")

if __name__ == "__main__":
    main()
