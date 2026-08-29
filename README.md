# Clarify MY

**Citation-first public-service guidance for Malaysians.**

Clarify MY is an AI assistant that helps people understand information from **KWSP**, **LHDN**, and **JPJ**. It uses Retrieval-Augmented Generation (RAG) over a curated official-source corpus to provide clear explanations, traceable citations, relevant form recommendations, and form-field guidance through the same chat experience.

At a glance:

- Ask public-service questions in English, Bahasa Melayu, or Manglish.
- See official source citations when the answer is supported by the indexed corpus.
- Get a relevant form card only when retrieved official metadata supports it.
- Attach a government form and ask what a visible field or section means.
- Keep chat history and bookmarked answers in the current browser.

Clarify MY is an independent MVP, not an official government service and not a submission portal.

## Features

### Citation-first chat

- Accepts natural-language questions about the supported agencies.
- Detects the likely agency and retrieves relevant official context.
- Returns a structured answer with citations and suggested follow-up questions.
- Links citations to the indexed official source or the locally served source document.

### Multilingual input

Clarify MY handles English, Bahasa Melayu, and mixed Bahasa Melayu/English (Manglish) input. Language detection is pragmatic rather than a guarantee of perfect translation or coverage.

### Evidence-based form recommendations

The backend may return a relevant official form when the user has a specific form-related intent and the retrieved documents contain reliable form metadata. Form names, codes, and URLs come from indexed source metadata; they are not hardcoded in the frontend.

If the evidence is insufficient, `recommended_forms` remains empty and the frontend does not render a recommendation card.

### Form guidance through chat

Users can attach a PDF, JPG/JPEG, or PNG form (up to 10 MB) and ask a question such as:

> What does section C1 mean?

Where possible, Clarify MY identifies the agency and form against the official corpus, uses the visible attachment text as temporary context, retrieves matching official guidance, and explains what the field requests. Follow-up questions can continue in the chat while the temporary attachment remains available.

Clarify MY does **not**:

- automatically enter personal information;
- generate a completed government application;
- submit forms to an agency; or
- permanently store uploaded citizen documents.

### Browser history and saved answers

Recent chat sessions and bookmarked answers are stored in the current browser using `localStorage`; there is no account sync. Uploaded bytes, extracted document text, filenames, and attachment IDs are not written to browser storage. A limited safe descriptor—such as agency, form name, or form code—may be retained with the chat so the UI can indicate that a temporary form was used.

### FAQ and About

The web app includes dedicated FAQ and About pages alongside the main chat, History view, and Saved Answers page.

## Supported agencies

| Agency | Current MVP coverage |
| --- | --- |
| **KWSP** | Selected EPF guidance, withdrawals, contributions, nominations, and indexed KWSP forms |
| **LHDN** | Selected individual tax relief and tax-related guidance/framework documents |
| **JPJ** | Selected driving-licence, vehicle, registration, and indexed JPJ form guidance |

Coverage is limited to a **curated MVP corpus** of official PDFs and normalized official-page snapshots under `data/raw/`. It is not full coverage of every service, policy, or form offered by these agencies.

Questions outside the available evidence may receive an uncited answer clearly labelled **“General guidance — verify current details”**. This distinguishes model guidance from answers grounded in retrieved official sources.

## Grounding and safety behaviour

Clarify MY treats retrieved official context as the factual boundary when relevant evidence is available. Citations are built from the same final context supplied to Gemini, while source and relevance filtering reduces unrelated citations.

Exact form names, codes, and URLs are evidence-bound. Recommendations are derived only from retrieved form documents, and ambiguous requests are allowed to return no form rather than guessing. Attachment-specific questions also refuse to infer an unclear field or unsupported form meaning.

This design reduces unsupported citations and hallucinated form recommendations, but it does not make the system error-free. Uncited guidance should be verified with the relevant agency.

## How it works

### Chat and retrieval architecture

```text
User
  |
  v
Next.js frontend
  |
  v
FastAPI /ask
  |
  v
Agency and intent routing + multilingual query expansion
  |
  v
Hybrid retrieval
  |-- BM25 lexical search
  |-- Qdrant vector search (BGE-M3 embeddings)
  |-- Reciprocal Rank Fusion (RRF)
  `-- Cross-encoder reranking + intent/source/form-metadata filtering
  |
  v
Retrieved official context
  |
  v
Gemini answer generation
  |
  v
Structured response: answer + citations + recommended forms + follow-ups
```

### Form attachment flow

```text
User attaches PDF/JPG/PNG
  |
  v
POST /attachments
  |
  v
Temporary text extraction and official-corpus identification
  |
  v
Opaque attachment ID
  |
  v
POST /ask with attachment reference
  |
  v
Exact-form/official-source retrieval
  |
  v
Grounded field guidance in chat
```

Upload bytes are discarded after extraction. Extracted text and attachment records remain only in backend process memory and are cleared when the server restarts. Citizen uploads are **not** inserted into the shared Qdrant corpus.

## Tech stack

| Area | Technologies |
| --- | --- |
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Lucide React |
| **Backend** | Python, FastAPI, Pydantic, Uvicorn, pypdf |
| **AI and retrieval** | Google Gemini, BGE-M3 embeddings, BGE reranker, Qdrant, BM25, RRF, RAG |
| **Development** | Docker Desktop, npm, Python virtual environment, Git |

## Project structure

```text
.
|-- data/
|   |-- raw/{jpj,kwsp,lhdn}/     # curated official PDFs and text snapshots
|   |-- source_metadata.yaml     # curated titles, provenance, dates, form metadata
|   |-- dictionaries/            # agency-specific multilingual query expansion
|   |-- chunks/                  # generated document chunks
|   `-- bm25/                    # generated lexical indexes
|-- src/
|   |-- api.py                   # FastAPI routes and response contract
|   |-- attachments.py           # temporary upload validation and extraction
|   |-- ingest.py                # corpus parsing and chunk generation
|   |-- index.py                 # Qdrant and BM25 index construction
|   |-- retrieve.py              # hybrid retrieval and form metadata logic
|   |-- router.py                # agency/intent routing
|   `-- generate.py              # grounded Gemini answer generation
|-- tests/                       # backend regression tests
|-- web/
|   |-- src/app/                 # Next.js routes
|   |-- src/components/          # chat, history, saved, FAQ, and About UI
|   `-- src/lib/                 # API client and browser persistence
|-- .env.example
|-- requirements.txt
|-- requirements-loose.txt
|-- start.sh
`-- stop.sh
```

## Local setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker Desktop with the Docker daemon running
- A Google Gemini API key
- Several gigabytes of free disk space for the embedding and reranking models

The first indexing or backend run downloads the BGE-M3 embedding model and BGE reranker. Later runs use the local model cache.

### 1. Clone the repository

```bash
git clone <repository-url>
cd MAIC
```

Replace `<repository-url>` with this repository's Git URL.

### 2. Create the backend environment

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

On Windows PowerShell, activate the environment with `.venv\Scripts\Activate.ps1`.

### 3. Configure the backend secret

```bash
cp .env.example .env
```

Edit `.env` and replace the example value:

```dotenv
GOOGLE_API_KEY=your_gemini_api_key_here
```

Keep `.env` private. The Gemini key is read only by the Python backend.

### 4. Start Qdrant

The repository's startup script uses a local Docker container named `qdrant`. For a fresh setup, create it with the same configuration:

```bash
docker run -d --name qdrant -p 6333:6333 \
  -v "$PWD/qdrant_storage:/qdrant/storage" \
  qdrant/qdrant
```

If that container already exists but is stopped, run `docker start qdrant`. The runtime directory `qdrant_storage/` is local generated state and should not be committed.

### 5. Ingest and index the official corpus

Run these commands from the repository root with Qdrant running:

```bash
.venv/bin/python -m src.ingest
.venv/bin/python -m src.index
```

Ingestion generates the chunk files. Indexing rebuilds each agency's local Qdrant collection and BM25 index.

### 6. Start the backend

```bash
source .venv/bin/activate
uvicorn src.api:app --reload --port 8000
```

The API documentation is available at `http://localhost:8000/docs`.

### 7. Configure and start the frontend

In a second terminal:

```bash
cd web
cp .env.local.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

After the first-time ingest/index setup, `./start.sh` is the canonical one-command launcher for Qdrant, FastAPI, and Next.js. It does not rebuild the corpus indexes. Press `Ctrl+C` to stop the web app and backend; use `./stop.sh` to also stop Qdrant.

## Environment variables

| File | Variable | Purpose |
| --- | --- | --- |
| Root `.env` | `GOOGLE_API_KEY` | Backend-only Gemini API credential |
| `web/.env.local` | `NEXT_PUBLIC_API_BASE_URL` | Browser-visible FastAPI base URL; defaults to `http://localhost:8000` |

Only these environment variables are used by the current application setup. Because `NEXT_PUBLIC_*` values are included in browser code, never place secrets in them. Qdrant is currently addressed locally at `localhost:6333` by the backend/indexing code.

## API overview

FastAPI exposes interactive OpenAPI documentation at `http://localhost:8000/docs`.

### `GET /`

Basic service health response:

```json
{
  "service": "Clarify MY",
  "status": "ok"
}
```

### `POST /attachments`

Uploads one form as multipart field `file`. Accepted content types are PDF, JPEG, and PNG, with a 10 MB limit. The response contains an opaque runtime ID and safe identification metadata:

```json
{
  "attachment_id": "att_...",
  "filename": "kwsp-form.pdf",
  "content_type": "application/pdf",
  "document_type": "government_form",
  "agency": "KWSP",
  "form_name": "Borang Permohonan Pengeluaran Membeli / Membina Rumah",
  "form_code": "KWSP 9C (AHL) (D5)",
  "status": "ready"
}
```

Identification fields may be `null` when the backend cannot establish them reliably.

### `POST /ask`

Request:

```json
{
  "conversation_id": "chat_123",
  "message": "Which form do I need to use my KWSP savings to purchase a house?",
  "history": [
    {
      "role": "user",
      "content": "I need help with a KWSP withdrawal."
    }
  ],
  "attachments": []
}
```

`history` and `attachments` may both be empty arrays for a normal first question. For attachment guidance, pass the temporary upload reference as `"attachments": [{"attachment_id": "att_..."}]`. The API accepts up to 30 history turns and three attachment references.

Response shape:

```json
{
  "answer": "The retrieved official guidance points to the home purchase or construction withdrawal form.",
  "agency": "KWSP",
  "status": "answered",
  "citations": [
    {
      "id": 1,
      "document_title": "KWSP 9C (AHL) (D5) — Buy or Build Home Withdrawal",
      "section": "Page 1",
      "effective_date": "2026-07-01",
      "source_url": "https://www.kwsp.gov.my/documents/d/guest/kwsp_9c_ahl_d5-1"
    }
  ],
  "recommended_forms": [
    {
      "form_id": "form_...",
      "form_name": "Borang Permohonan Pengeluaran Membeli / Membina Rumah",
      "form_code": "KWSP 9C (AHL) (D5)",
      "agency": "KWSP",
      "reason": null,
      "source_url": "https://www.kwsp.gov.my/documents/d/guest/kwsp_9c_ahl_d5-1",
      "download_url": "/pdfs/kwsp/KWSP_9C_AHL_D5.pdf"
    }
  ],
  "suggested_follow_ups": [
    "Am I eligible?",
    "Which documents should I prepare?"
  ]
}
```

Recommended-form metadata comes from retrieved/indexed official documents. If the evidence does not identify a suitable form reliably, `recommended_forms` is `[]`; the frontend renders a form card only when the array contains data. The example above illustrates one supported result, not a universal recommendation.

## Testing

The current validated baseline is **45/45 backend tests passing**, plus a successful frontend lint and production build.

With the embedding and reranking models already cached, run:

```bash
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 .venv/bin/python -m unittest discover -s tests -v
```

Frontend checks:

```bash
cd web
npm run lint
npm run build
```

The regression suite covers ingestion metadata, hybrid-retrieval grounding, citation relevance, form recommendations, upload validation, official-form identification, field guidance, attachment follow-ups, ambiguous queries, and no-source fallback behaviour.

## Try asking

- “What is KWSP?”
- “Which form do I need to use my KWSP savings to purchase a house?”
- “What tax relief can an individual claim from LHDN?”
- “How do I renew my Malaysian driving licence?”
- “Saya nak guna KWSP untuk beli rumah. Borang apa saya perlu?”

Or upload a supported form and ask: “What does section C1 mean?”

## Limitations

- The curated MVP corpus does not cover every LHDN, KWSP, or JPJ service, document, policy update, or form.
- Sources are indexed snapshots, not a real-time feed from agency systems.
- Unsupported or weakly grounded topics may receive clearly labelled general guidance without citations.
- Attachment context is temporary, limited to supported readable files, and lost when the backend restarts.
- Browser history and saved answers remain on the current device/browser and are not synchronized.
- Clarify MY explains information and form fields; it does not fill, complete, or submit applications.

## Disclaimer

Clarify MY is an independent project and is not an official LHDN, KWSP, or JPJ service. Verify important or time-sensitive information against the linked official sources or directly with the relevant agency.
