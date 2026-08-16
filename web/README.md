# Clarify MY frontend

Next.js frontend-only prototype for the Clarify MY civic-tech assistant.

```bash
npm install
npm run dev
```

Mock mode is currently always enabled. `src/lib/api.ts` is the frontend API
client and will later call the Python backend using `NEXT_PUBLIC_API_BASE_URL`.
Do not place AI, Gemini, or Qdrant credentials in the frontend.

## Backend integration flow

Current: User → Frontend Chat → `src/lib/api.ts` → mock response → UI

Future: User → Frontend Chat → `src/lib/api.ts` → `POST /ask` → Python FastAPI
backend → AI/RAG → Qdrant and official documents → answer with citations → UI

The real HTTP API belongs under `backend/`; do not create Next.js API routes.
