#!/usr/bin/env bash
# Simula conversas no WhatsApp contra o n8n real, com uma Evolution falsa no lugar da real.
# Uso: scripts/simular.sh [pix|link|admin|instagram|agenda|tudo]. No fim, o n8n volta a apontar para a Evolution real.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
# Durante a simulação o n8n inteiro aponta para a Evolution falsa: quem falar com o bot de verdade nesse
# intervalo fica sem resposta no WhatsApp e os avisos ao admin se perdem. Nunca rode em produção.
recentes=$(docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c \
  "select count(*) from app.conversas where atualizado_em > now() - interval '15 minutes'")
if [ "${recentes:-0}" != "0" ] && [ "${FORCAR:-}" != "1" ]; then
  echo "✋ $recentes conversa(s) real(is) nos últimos 15 min: alguém está usando o bot."
  echo "   A simulação desviaria as respostas do WhatsApp e os avisos ao admin. Espere ou rode com FORCAR=1."
  exit 1
fi
SIM=(-f docker-compose.yml -f tests/simular.compose.yml)
docker compose "${SIM[@]}" up -d --wait mock-evolution n8n >/dev/null
restaura() { docker compose up -d --wait n8n >/dev/null 2>&1; docker compose "${SIM[@]}" rm -sf mock-evolution >/dev/null 2>&1; }
trap restaura EXIT
node scripts/simular.mjs "${1:-tudo}"
