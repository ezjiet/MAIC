# Clarify MY web

The Next.js client uses `NEXT_PUBLIC_API_BASE_URL` from `.env.local` to call the FastAPI `POST /ask` and `POST /attachments` endpoints. No Gemini, Qdrant, or other secret belongs in the frontend environment.

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

See the repository [README](../README.md) for the complete local setup and API contracts.
