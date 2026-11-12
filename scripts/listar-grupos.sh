#!/usr/bin/env bash
# Lista os grupos do número conectado (para achar o grupo_jid). Uso: scripts/listar-grupos.sh [trecho-do-nome]
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
curl -fsS -H "apikey: $EVOLUTION_API_KEY" "http://localhost:${EVOLUTION_PORT:-8095}/group/fetchAllGroups/$EVOLUTION_INSTANCE?getParticipants=false" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const f=(process.argv[1]||"").toLowerCase();for(const g of JSON.parse(s)){if(!f||String(g.subject).toLowerCase().includes(f))console.log(g.id+"\t"+g.subject+"\t("+(g.size??"?")+" pessoas)")}})' "${1:-}"
echo
echo "Para usar: make grupo JID=<id acima>  (ou pelo painel > WhatsApp)"
