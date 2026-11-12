#!/bin/sh
# Roda depois do init.sql (ordem alfabética): grava no app.config o que vem do .env.
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v admin="$ADMIN_NUMERO" -v pausa="${PAUSA_HUMANO_HORAS:-12}" <<'SQL'
update app.config set valor = :'admin' where chave = 'admin_numero';
update app.config set valor = :'pausa' where chave = 'pausa_humano_horas';
SQL
