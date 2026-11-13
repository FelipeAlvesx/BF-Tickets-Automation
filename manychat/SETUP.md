# Instagram via ManyChat — passo a passo

O ManyChat recebe a DM do Instagram, chama o n8n (bloco **Dynamic**) e manda de volta o que o n8n
responde no formato **Dynamic Block v2**. A lógica é a mesma do WhatsApp (sub-workflow `core`).

Precisa de: **ManyChat Pro** (ou o teste de 14 dias) com a conta do Instagram conectada, e uma URL pública do n8n
(na VPS: `https://n8n.seudominio.com.br`; testando no computador: `make tunel`).

Conta do dono: ele convida você em **Settings → Team Members → Invite new member → Generate a link**.
O plano Free só tem 1 vaga de equipe; o convite precisa do Pro ou do teste.

## 1. Campos do contato

**Settings → Automation → Fields → + New User Field** (tipo **Text**), crie exatamente:

```
estado            (o bot grava aqui o passo da conversa)
comprovante_url   (a coleta de imagem grava aqui a foto do comprovante)
```

## 2. Fluxo principal

**Automation → My Automations → Instagram Default Reply** (já existe, parada) → **Edit Automation**.
Deixe **STOPPED** até o fim dos testes (Go Live ativa para clientes reais).
Clique no gatilho **Default Reply** e marque **every time** (o padrão "once per 24 hours" só
repassa a primeira DM do dia de cada contato, e a conversa trava no segundo passo).

```
[Trigger] User sends a Direct Message (Default Reply)
   │
   ▼
[Condition]  estado  is  aguardando_comprovante
   ├─ Sim ─▶ [Send Message #1]  texto "Manda a foto do comprovante aqui"
   │            + Data Collection: Reply Type = Image, salvar em comprovante_url
   │            │  (Next Step)
   │            ▼
   └─ Não ──▶ [Send Message]  com um bloco Dynamic (o mesmo passo nos dois caminhos)
```

No passo **Send Message** apague o texto vazio (X ao lado do campo), clique em **More → Dynamic**.
Não use *Actions → External Request*: ele só guarda a resposta em campos, não envia as mensagens.

## 3. Bloco Dynamic

Abra o bloco **Get Dynamic Content** e preencha:

```
Request Type:  POST
URL:           https://SEU-N8N/webhook/manychat
Headers:
  x-bf-token    = (valor de MANYCHAT_WEBHOOK_TOKEN no .env)
  Content-Type  = application/json
Body:          + Add Full Contact Data
```

O n8n entende o "Full Contact Data" (traz `id`, nome, `last_input_text` e os campos `estado` e
`comprovante_url`). Escolha um **Contact for testing** (busca pelo nome de exibição) e clique em **Test Request**:
deve dar `200 OK — Your response is valid` e o corpo `{"version":"v2","content":{"type":"instagram","messages":[...]...}}`.

## 4. Avisos de /aprovar e /recusar no Instagram

Para o bot avisar o cliente quando você aprova o Pix, coloque a API key em `MANYCHAT_API_KEY`
(**Settings → API → Generate**, só admin) e rode `make import`. O Instagram só deixa mensagem automática
até **24 h** depois da última mensagem do cliente: aprove dentro desse prazo.

## 5. Testar sem VPS

```bash
make tunel
```

O comando imprime a URL `https://xxxx.trycloudflare.com/webhook/manychat`. Ela muda a cada execução,
então atualize a URL do bloco Dynamic. O painel (Ajustes → Instagram) também mostra a URL atual.
Desligue depois: `docker compose --profile dev stop cloudflared`.

Teste local sem ManyChat (usa os fixtures de `tests/fixtures/manychat-*.json`):

```bash
scripts/simular.sh instagram
```

## Limites do formato v2 no Instagram

Até 10 mensagens, 5 actions e 11 quick replies por resposta. No Instagram só funcionam **texto** e
**imagem**; vídeo, áudio e arquivo não. O bot já respeita isso.
