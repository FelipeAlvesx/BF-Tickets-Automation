SHELL := /bin/bash
DC := docker compose
PSQL := $(DC) exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

.PHONY: env up down logs build import test backup restore psql instancia grupos grupo simular tunel ps nocodb

env: ## cria o .env com senhas aleatórias (não sobrescreve)
	@test -f .env && echo ".env já existe" || (node -e 'const c=require("crypto"),fs=require("fs");fs.writeFileSync(".env",fs.readFileSync(".env.example","utf8").replace(/troque-me/g,()=>c.randomBytes(18).toString("base64url")))' && echo ".env criado: preencha ADMIN_NUMERO e LLM_API_KEY")

up: ## sobe tudo e espera os healthchecks
	@test -f .env || $(MAKE) env
	node scripts/build-workflows.mjs
	$(DC) up -d --build --wait
	@$(DC) ps --format 'table {{.Service}}\t{{.Status}}'

down:
	$(DC) down

logs:
	$(DC) logs -f --tail=100 $(S)

ps:
	@$(DC) ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}'

build: ## src/ -> n8n/workflows/*.json + db/mensagens.sql
	node scripts/build-workflows.mjs

import: ## credenciais + workflows no n8n (idempotente)
	scripts/import-workflows.sh

test:
	npm test

instancia: ## cria a instância do WhatsApp e salva o QR em qr.png
	scripts/instancia.sh

grupos: ## lista os grupos do número conectado (F=trecho do nome)
	scripts/listar-grupos.sh "$(F)"

grupo: ## make grupo JID=1203...@g.us
	@test -n "$(JID)" || (echo "uso: make grupo JID=<id>@g.us" && exit 1)
	@echo "update app.config set valor='$(JID)' where chave='grupo_jid';" | $(PSQL)

nocodb: ## conecta o schema app no NocoDB (base "BF Tickets")
	scripts/nocodb-setup.sh

simular: ## percorre os fluxos com payloads falsos (F=pix|link|admin|tudo)
	scripts/simular.sh $(or $(F),tudo)

tunel: ## túnel público (dev) para o webhook do ManyChat
	$(DC) --profile dev up -d cloudflared
	@sleep 6; $(DC) --profile dev logs cloudflared 2>&1 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1 | sed 's#$$#/webhook/manychat  <- URL do External Request#'

psql:
	$(DC) exec postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

backup: ## dump do banco inteiro em backups/
	@mkdir -p backups
	$(DC) exec -T postgres sh -c 'pg_dump -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -Fc' > backups/bf-$$(date +%Y%m%d-%H%M).dump
	@ls -1t backups | head -1

restore: ## make restore F=backups/arquivo.dump
	@test -n "$(F)" || (echo "uso: make restore F=backups/arquivo.dump" && exit 1)
	$(DC) exec -T postgres sh -c 'pg_restore -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" --clean --if-exists' < $(F)
