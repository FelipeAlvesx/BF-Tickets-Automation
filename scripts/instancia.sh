#!/usr/bin/env bash
# Cria a instância na Evolution (se não existir) com o webhook do n8n e salva o QR em qr.png.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
EVO="http://localhost:${EVOLUTION_PORT:-8095}"
H=(-H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json")
WEBHOOK='{"url":"http://n8n:5678/webhook/evolution","byEvents":false,"base64":true,"events":["MESSAGES_UPSERT"]}'
if ! curl -fsS "${H[@]}" "$EVO/instance/fetchInstances?instanceName=$EVOLUTION_INSTANCE" 2>/dev/null | grep -q "\"name\":\"$EVOLUTION_INSTANCE\""; then
  curl -fsS "${H[@]}" -X POST "$EVO/instance/create" \
    -d "{\"instanceName\":\"$EVOLUTION_INSTANCE\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":true,\"webhook\":$WEBHOOK}" >/dev/null
  echo "instância $EVOLUTION_INSTANCE criada"
else
  curl -fsS "${H[@]}" -X POST "$EVO/webhook/set/$EVOLUTION_INSTANCE" -d "{\"webhook\":$(echo "$WEBHOOK" | sed 's/^{/{"enabled":true,/')}" >/dev/null
  echo "webhook da instância $EVOLUTION_INSTANCE atualizado"
fi
curl -fsS "${H[@]}" "$EVO/instance/connect/$EVOLUTION_INSTANCE" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);
if(j.base64){require("fs").writeFileSync("qr.png",Buffer.from(j.base64.split(",").pop(),"base64"));console.log("QR salvo em qr.png (WhatsApp > Aparelhos conectados > Conectar)")}
else console.log("estado:",JSON.stringify(j.instance??j))})'
