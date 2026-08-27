#!/usr/bin/env bash
# Full stop — including Qdrant.
set -e
pkill -f "uvicorn src.api:app" 2>/dev/null && echo "backend stopped" || echo "backend was not running"
pkill -f "next dev"            2>/dev/null && echo "frontend stopped" || echo "frontend was not running"
docker stop qdrant             2>/dev/null && echo "qdrant stopped"  || echo "qdrant was not running"
