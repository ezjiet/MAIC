"""Diagnose why /chat isn't producing a response.

Run from MAIC root with the venv activated:
    source .venv/bin/activate
    python diagnose.py
"""
import os, sys, traceback
from pathlib import Path

os.chdir(Path(__file__).parent)
print("=" * 60)
print(f"CWD: {os.getcwd()}")
print("=" * 60)

# --- 1. env ---
from dotenv import load_dotenv
load_dotenv()
key = os.environ.get("GOOGLE_API_KEY", "")
hf  = os.environ.get("HF_HOME", "")
print(f"\n[1] GOOGLE_API_KEY: {'SET (' + str(len(key)) + ' chars, starts ' + key[:4] + ')' if key else 'MISSING'}")
if "," in key: print("    WARNING: comma in key — router.py/generate.py use it as-is (broken)")
print(f"    HF_HOME:        {hf!r}")

# --- 2. Qdrant reachable ---
try:
    from qdrant_client import QdrantClient
    q = QdrantClient(host="localhost", port=6333, timeout=3)
    cols = [c.name for c in q.get_collections().collections]
    print(f"\n[2] Qdrant OK — collections: {cols}")
    for name in cols:
        info = q.get_collection(name)
        print(f"    {name}: {info.points_count} points")
except Exception as e:
    print(f"\n[2] Qdrant FAIL: {type(e).__name__}: {e}")
    print("    -> Is 'docker start qdrant' running? Check ./start.sh output.")

# --- 3. Gemini plain call ---
try:
    from google import genai
    c = genai.Client(api_key=key)
    r = c.models.generate_content(model="gemini-flash-lite-latest",
                                  contents="Say the word PONG and nothing else.")
    txt = (r.text or "").strip()
    print(f"\n[3] Gemini OK — reply: {txt!r}")
except Exception as e:
    print(f"\n[3] Gemini FAIL: {type(e).__name__}: {e}")
    print("    -> Bad API key, quota, or network.")

# --- 4. Full pipeline: router + retrieve + answer ---
try:
    from src.router import route
    from src.retrieve import retrieve
    from src.generate import answer
    Q = "berapa road tax kereta 1500cc?"
    print(f"\n[4] Full pipeline with query: {Q!r}")
    label = route(Q); print(f"    router -> {label}")
    if label in {"LHDN","KWSP","JPJ"}:
        chunks = retrieve(Q, label)
        print(f"    retrieved {len(chunks)} chunks")
        if chunks:
            print(f"    first chunk source: {chunks[0].get('source')}")
        result = answer(Q, chunks, history=[])
    else:
        result = answer(Q, [], history=[])
    print(f"    refused = {result.get('refused')}")
    print(f"    answer  = {result.get('answer','')[:200]!r}")
    print(f"    citations: {len(result.get('citations',[]))}")
except Exception as e:
    print(f"\n[4] Pipeline FAIL: {type(e).__name__}: {e}")
    traceback.print_exc()

print("\n" + "=" * 60)
print("If [3] and [4] both show real text, the backend is fine — the bug is")
print("in the frontend or the request never reached the server. Open Chrome")
print("DevTools -> Network -> filter 'chat' and re-send a message.")
