"""Build dense (Qdrant) and lexical (BM25) indexes per agency."""
import json
import pickle
from pathlib import Path
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi

CHUNKS_DIR = Path("data/chunks")
BM25_DIR = Path("data/bm25")
BM25_DIR.mkdir(exist_ok=True)

print("Loading BGE-M3 embedding model (first run downloads ~2GB)...")
model = SentenceTransformer("BAAI/bge-m3")
client = QdrantClient(host="localhost", port=6333)

def build_agency(agency: str):
    chunks_file = CHUNKS_DIR / f"{agency}.jsonl"
    chunks = [json.loads(l) for l in chunks_file.open(encoding="utf-8")]
    if not chunks:
        print(f"[{agency}] no chunks, skipping")
        return
    # Candidate generation must see curated document titles as well as body text.
    # This is especially important for short official guidance whose body may be
    # in a different language from the user's query.
    texts = [
        f"{c.get('title')}. {c['text']}" if c.get("title") else c["text"]
        for c in chunks
    ]

    print(f"[{agency}] embedding {len(texts)} chunks...")
    vectors = model.encode(texts, show_progress_bar=True, normalize_embeddings=True, batch_size=8)

    if client.collection_exists(agency):
        client.delete_collection(agency)
    client.create_collection(
        collection_name=agency,
        vectors_config=VectorParams(size=vectors.shape[1], distance=Distance.COSINE),
    )
    BATCH = 128
    for i in range(0, len(chunks), BATCH):
        batch_chunks = chunks[i:i+BATCH]
        batch_vecs = vectors[i:i+BATCH]
        client.upsert(
            collection_name=agency,
            points=[
                PointStruct(id=i+j, vector=vec.tolist(), payload=chunk)
                for j, (vec, chunk) in enumerate(zip(batch_vecs, batch_chunks))
            ],
        )
    print(f"[{agency}] uploaded {len(chunks)} vectors to Qdrant.")

    print(f"[{agency}] building BM25 index...")
    tokenized = [t.lower().split() for t in texts]
    bm25 = BM25Okapi(tokenized)
    with (BM25_DIR / f"{agency}.pkl").open("wb") as f:
        pickle.dump({"bm25": bm25, "chunks": chunks}, f)
    print(f"[{agency}] done.\n")

if __name__ == "__main__":
    for agency in ["lhdn", "kwsp", "jpj"]:
        if (CHUNKS_DIR / f"{agency}.jsonl").exists():
            build_agency(agency)
        else:
            print(f"[{agency}] no chunks file, skipping")
