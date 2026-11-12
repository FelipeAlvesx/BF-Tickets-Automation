#!/usr/bin/env bash
# Importa credenciais e workflows no n8n (CLI), publica e reinicia. Idempotente: o import faz
# upsert pelo id fixo de cada workflow/credencial.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

node scripts/build-workflows.mjs

# Credenciais em texto puro só dentro do container; o n8n criptografa com N8N_ENCRYPTION_KEY.
node -e '
const e = process.env, h = (id, name, n, v) => ({ id, name, type: "httpHeaderAuth", data: { name: n, value: v } });
process.stdout.write(JSON.stringify([
  { id: "bfPostgres000001", name: "BF Postgres", type: "postgres", data: { host: "postgres", port: 5432, database: e.POSTGRES_DB, user: e.POSTGRES_USER, password: e.POSTGRES_PASSWORD, ssl: "disable" } },
  h("bfEvolution00001", "BF Evolution apikey", "apikey", e.EVOLUTION_API_KEY),
  h("bfLLM00000000001", "BF LLM", "Authorization", "Bearer " + (e.LLM_API_KEY || "sem-chave")),
  h("bfManychat000001", "BF ManyChat API", "Authorization", "Bearer " + (e.MANYCHAT_API_KEY || "sem-chave")),
  h("bfManychatHook01", "BF ManyChat webhook", "x-bf-token", e.MANYCHAT_WEBHOOK_TOKEN),
  h("bfPainelToken001", "BF Painel token", "x-painel-token", e.PAINEL_TOKEN),
]));' | docker compose exec -T n8n sh -c 'cat > /tmp/creds.json && n8n import:credentials --input=/tmp/creds.json; s=$?; rm -f /tmp/creds.json; exit $s'

docker compose exec -T n8n n8n import:workflow --separate --input=/import/workflows

# O import despublica; publica de novo (sub-workflows primeiro).
for id in bf99erros0000001 bf06enviar000001 bf04core00000001 bf05admin0000001 bf02whatsapp0001 bf03instagram001 bf01agenda000001; do
  docker compose exec -T n8n n8n publish:workflow --id="$id" >/dev/null 2>&1 && echo "publicado $id" || echo "aviso: $id não publicado (sub-workflow sem gatilho próprio é normal)"
done

docker compose restart n8n >/dev/null
echo "n8n reiniciado; aguardando ficar pronto..."
until docker compose exec -T n8n wget -qO- http://127.0.0.1:5678/healthz/readiness >/dev/null 2>&1; do sleep 2; done
echo "ok"
