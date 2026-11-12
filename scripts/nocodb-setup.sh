#!/usr/bin/env bash
# Cria no NocoDB a base "BF Tickets" ligada ao schema app do Postgres (idempotente).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
NC="http://localhost:${NOCODB_PORT:-8096}"
json() { node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));$1"; }
TOKEN=$(curl -fsS -X POST "$NC/api/v1/auth/user/signin" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$NOCODB_ADMIN_EMAIL\",\"password\":\"$NOCODB_ADMIN_PASSWORD\"}" | json 'process.stdout.write(j.token)')
H=(-H "xc-auth: $TOKEN" -H 'Content-Type: application/json')
BASE=$(curl -fsS "${H[@]}" "$NC/api/v2/meta/bases" | json 'process.stdout.write((j.list.find(b=>b.title==="BF Tickets")||{}).id||"")')
if [ -z "$BASE" ]; then
  WS=$(curl -fsS "${H[@]}" "$NC/api/v2/meta/workspaces" 2>/dev/null | json 'process.stdout.write(j.list?.[0]?.id||"")' || true)
  BASE=$(curl -fsS -X POST "${H[@]}" "$NC/api/v2/meta/bases" -d "{\"title\":\"BF Tickets\"${WS:+,\"fk_workspace_id\":\"$WS\"}}" | json 'process.stdout.write(j.id)')
  echo "base criada ($BASE)"
fi
if curl -fsS "${H[@]}" "$NC/api/v2/meta/bases/$BASE/tables" | json 'process.exit(j.list.some(t=>t.title==="pedidos")?0:1)'; then
  echo "NocoDB já mostra as tabelas do schema app: $NC"
  exit 0
fi
SRC=$(node -e 'const e=process.env;process.stdout.write(JSON.stringify({type:"pg",alias:"app",config:{client:"pg",connection:{host:"postgres",port:5432,user:e.POSTGRES_USER,password:e.POSTGRES_PASSWORD,database:e.POSTGRES_DB},searchPath:["app"]},inflection_column:"none",inflection_table:"none"}))')
curl -fsS -X POST "${H[@]}" "$NC/api/v2/meta/bases/$BASE/sources" -d "$SRC" >/dev/null
for _ in $(seq 1 30); do
  sleep 2
  curl -fsS "${H[@]}" "$NC/api/v2/meta/bases/$BASE/tables" | json 'process.exit(j.list.some(t=>t.title==="pedidos")?0:1)' && { echo "ok: tabelas do schema app no NocoDB ($NC)"; exit 0; }
done
echo "a fonte foi pedida mas as tabelas ainda não apareceram; confira em $NC" >&2; exit 1
