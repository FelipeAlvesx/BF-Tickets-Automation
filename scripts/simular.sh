#!/usr/bin/env bash
# Simula conversas no WhatsApp contra o n8n real, com uma Evolution falsa no lugar da real.
# Uso: scripts/simular.sh [pix|link|admin|instagram|agenda|tudo]. No fim, o n8n volta a apontar para a Evolution real.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
SIM=(-f docker-compose.yml -f tests/simular.compose.yml)
docker compose "${SIM[@]}" up -d --wait mock-evolution n8n >/dev/null
restaura() { docker compose up -d --wait n8n >/dev/null 2>&1; docker compose "${SIM[@]}" rm -sf mock-evolution >/dev/null 2>&1; }
trap restaura EXIT
node scripts/simular.mjs "${1:-tudo}"
