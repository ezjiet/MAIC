# Setup Guide for Markers

**Project:** Clarify MY — AI assistant for Malaysian public-service information (KWSP, LHDN, JPJ)

This document has everything you need to run the project from a clean machine. It should take **20–40 minutes** end-to-end, most of which is downloading Python/Node packages the first time.

---

## 1. What you need before you start

| Requirement | Why | Where to get it |
|---|---|---|
| **macOS or Linux** | The bundled start script uses bash | — |
| **Python 3.11** (specifically) | Some ML dependencies do not have wheels for 3.12+ | https://www.python.org/downloads/release/python-3119/ |
| **Node.js 20+** (LTS) | For the Next.js frontend | https://nodejs.org/en/download |
| **Docker Desktop** (running) | Hosts the Qdrant vector database | https://www.docker.com/products/docker-desktop |
| **A Google Gemini API key** (free tier is fine) | The AI model provider | https://aistudio.google.com/apikey |
| **~10 GB free disk space** | For Python packages, npm packages, and cached ML models | — |

Verify each install in a terminal:

```bash
python3.11 --version    # should print Python 3.11.x
node --version          # should print v20.x or higher
docker --version        # should print Docker version 24.x or higher
docker info             # should NOT error; if it errors, open Docker Desktop and wait for whale icon
```

---

## 2. Get the code

If you already have this folder, skip this step.

```bash
git clone https://github.com/ezjiet/MAIC
cd MAIC
```

---

## 3. Configure the API key

Copy the example environment file and paste your Gemini API key:

```bash
cp .env.example .env
```

Then open `.env` in any text editor and replace `your_gemini_api_key_here` with the real key. It should look like:

```
GOOGLE_API_KEY=AQ.Ab8RN6LeClPnVbbsLp4phnmeuvQIAhP4AtzBmU4jsNZ70eLQhA
```

**Do not commit this file.** `.gitignore` already excludes it.

---

## 4. Install dependencies

Two separate installs — one for the Python backend, one for the JavaScript frontend.

### 4a. Backend (Python)

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

This takes **5–15 minutes** the first time because it downloads PyTorch, sentence-transformers, spaCy, and their dependencies (~2 GB total).

### 4b. Frontend (Node.js)

```bash
cd web
npm install
cd ..
```

This takes **1–3 minutes**.

---

## 5. Run the whole app with one command

Make sure **Docker Desktop is open** (whale icon in the menu bar), then:

```bash
./start.sh
```

`start.sh` boots the three pieces in order:

1. **Qdrant** (vector database) — Docker container on port `6333`
2. **FastAPI backend** — port `8000`
3. **Next.js frontend** — port `3000`

Wait until you see this in the terminal:

```
[ ok ] All up.
  • App:      http://localhost:3000
  • Backend:  http://localhost:8000/docs
  • Qdrant:   http://localhost:6333/dashboard
```

The **first run** takes an extra 5–10 minutes because the backend has to download two Hugging Face models (~1 GB total) into `models/`. Subsequent runs skip this.

---

## 6. Open the app in your browser

Go to **http://localhost:3000**

You should see the Clarify MY chat interface with a "Hi there! 👋" greeting.

---

## 7. Quick verification (3 things to try)

### 7a. Ask a real question

Type into the chat box:

> berapa road tax kereta 1500cc?

Expected result: within 5–15 seconds, a formatted reply in Bahasa Malaysia with the RM 90/year calculation and (usually) a citation card pointing to an official JPJ PDF.

### 7b. Ask in English

> How do I withdraw KWSP for a house down payment?

Expected result: a formatted English reply with steps.

### 7c. Upload a form

Click the paperclip icon in the chat input, attach any small PDF/JPG/PNG (there are sample forms in `data/raw/`). Then ask:

> What does section D5 mean on this form?

Expected result: the file uploads (chip appears above the input), and the reply references the visible field text.

---

## 8. Stopping the app

Press **Ctrl+C** in the terminal running `./start.sh`. That stops the backend and frontend but leaves Qdrant running in Docker (fast to restart next time).

To stop everything including Qdrant:

```bash
./stop.sh
```

---

## Project structure at a glance

```
MAIC/
├── src/                # Python backend (FastAPI)
│   ├── api.py          #   HTTP routes
│   ├── router.py       #   agency classifier (LHDN/KWSP/JPJ/…)
│   ├── retrieve.py     #   hybrid dense + BM25 + reranker
│   ├── generate.py     #   Gemini call + language detection
│   └── attachments.py  #   file upload → text extraction
├── web/                # Frontend (Next.js 16 + React 19)
│   ├── src/app/        #   pages (/, /faq, /about, /saved)
│   └── src/components/ #   UI components
├── data/
│   ├── raw/            #   source PDFs (KWSP, LHDN, JPJ)
│   ├── chunks/         #   parsed text chunks
│   ├── bm25/           #   keyword indexes
│   └── dictionaries/   #   term expansion tables
├── qdrant_storage/     # vector DB on-disk data
├── models/             # cached Hugging Face models
├── tests/              # pytest suite
├── start.sh / stop.sh  # one-command lifecycle
├── README.md           # full project documentation
└── SETUP.md            # this file
```

---

## Contact

If you cannot get the app running after following this document, contact the submission author with:

- The exact command you ran
- The full error output (or a screenshot)
- Your `python --version`, `node --version`, and `docker --version`

Thank you