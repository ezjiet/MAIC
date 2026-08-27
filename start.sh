#!/usr/bin/env bash
# Clarify MY — one-command startup.
# Boots Qdrant (Docker), the FastAPI backend, and the Next.js frontend.
# Ctrl+C shuts down the backend + frontend; Qdrant keeps running (state on disk).

set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"
LOG_DIR="$ROOT/.logs"
mkdir -p "$LOG_DIR"

BLUE='\033[1;34m'; GREEN='\033[1;32m'; YELLOW='\033[1;33m'; RED='\033[1;31m'; NC='\033[0m'
say() { printf "${BLUE}[start]${NC} %s\n" "$*"; }
ok()  { printf "${GREEN}[ ok ]${NC} %s\n" "$*"; }
warn(){ printf "${YELLOW}[warn]${NC} %s\n" "$*"; }
die() { printf "${RED}[fail]${NC} %s\n" "$*"; exit 1; }

# ---- prereqs ----
[ -d ".venv" ]         || die "No .venv/ — run: python3.11 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
[ -f ".env" ]          || warn "No .env — backend may crash without GOOGLE_API_KEY."
[ -d "web/node_modules" ] || die "No web/node_modules — run: (cd web && npm install)"
command -v docker >/dev/null || die "Docker not installed. Install Docker Desktop."
docker info >/dev/null 2>&1 || die "Docker daemon not running. Open Docker Desktop."

# ---- 1. Qdrant ----
say "Qdrant…"
if docker ps --format '{{.Names}}' | grep -q '^qdrant$'; then
  ok "Qdrant already running."
elif docker ps -a --format '{{.Names}}' | grep -q '^qdrant$'; then
  docker start qdrant >/dev/null && ok "Qdrant started (existing container)."
else
  docker run -d --name qdrant -p 6333:6333 \
    -v "$ROOT/qdrant_storage:/qdrant/storage" qdrant/qdrant >/dev/null
  ok "Qdrant created + started."
fi

# wait until Qdrant answers
for i in {1..20}; do
  curl -sf http://localhost:6333/collections >/dev/null && break
  sleep 0.5
  [ "$i" = "20" ] && die "Qdrant didn't respond on :6333 after 10s."
done
ok "Qdrant healthy at http://localhost:6333"

# ---- 2. Backend ----
say "Backend (uvicorn) → :8000"
# shellcheck disable=SC1091
source .venv/bin/activate
uvicorn src.api:app --reload --port 8000 > "$LOG_DIR/backend.log" 2>&1 &
BACK_PID=$!

# ---- 3. Frontend ----
say "Frontend (next dev) → :3000"
( cd web && npm run dev > "$LOG_DIR/frontend.log" 2>&1 ) &
FRONT_PID=$!

cleanup() {
  echo
  say "Shutting down…"
  kill "$BACK_PID"  2>/dev/null || true
  kill "$FRONT_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  ok "Backend + frontend stopped. Qdrant left running (use ./stop.sh to stop it too)."
}
trap cleanup INT TERM

# wait for both to say "ready"
for i in {1..40}; do
  grep -q "Uvicorn running" "$LOG_DIR/backend.log" 2>/dev/null && break
  sleep 0.25
done
for i in {1..80}; do
  grep -q "Local:.*http" "$LOG_DIR/frontend.log" 2>/dev/null && break
  sleep 0.25
done

echo
ok "All up."
echo "  • App:      http://localhost:3000"
echo "  • Backend:  http://localhost:8000/docs"
echo "  • Qdrant:   http://localhost:6333/dashboard"
echo "  • Logs:     $LOG_DIR/backend.log   $LOG_DIR/frontend.log"
echo
say "Ctrl+C to stop backend + frontend. Streaming combined logs:"
echo
tail -n 0 -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log"
