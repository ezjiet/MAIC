"""Hybrid dense + BM25 retrieval with reciprocal rank fusion and reranking."""
import pickle
import yaml
from pathlib import Path
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
    lex_ranked = [(store["chunks"][i], r) for r, i in enumerate(top_ids)]

    # Reciprocal Rank Fusion (RRF)
    rrf = {}
    for chunk, rank in dense_ranked + lex_ranked:
        key = chunk["id"]
        if key not in rrf:
            rrf[key] = {"chunk": chunk, "score": 0.0}
        rrf[key]["score"] += 1.0 / (60 + rank)
    fused = sorted(rrf.values(), key=lambda x: -x["score"])[:15]

    # Rerank with cross-encoder
    pairs = [(query, x["chunk"]["text"]) for x in fused]
    rerank_scores = _reranker.predict(pairs)
    reranked = sorted(zip(fused, rerank_scores), key=lambda x: -x[1])[:top_k]
    return [x[0]["chunk"] for x in reranked]

if __name__ == "__main__":
    query = "boleh claim relief medical parents ke?"
    results = retrieve(query, "lhdn")
    print(f"\nQuery: {query}\n")
    for i, r in enumerate(results, 1):
        print(f"[{i}] {r['source']} p{r['page']}")
        print(f"    {r['text'][:200]}...")
        print()
