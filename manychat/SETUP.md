# Instagram via ManyChat — passo a passo

O ManyChat recebe a DM do Instagram, chama o n8n (External Request) e manda de volta o que o n8n
responde no formato **Dynamic Block v2**. A lógica é a mesma do WhatsApp (sub-workflow `core`).

Precisa de: **ManyChat Pro** com a conta do Instagram conectada, e uma URL pública do n8n
(na VPS: `https://n8n.seudominio.com.br`; testando no computador: `make tunel`).

## 1. Campos do contato

ManyChat → **Settings → Fields → + New User Field** (tipo **Text**), crie exatamente:

```
estado            (o bot grava aqui o passo da conversa)
comprovante_url   (o User Input de imagem grava aqui a foto do comprovante)
```

## 2. Fluxo principal

**Automation → + New Automation** → nome `Bot BF`.

```
[Trigger] Instagram › Default Reply   (toda DM que não cair em outra automação)
   │
   ▼
[Condition]  estado  is  aguardando_comprovante ?
   ├─ Sim ─▶ [Instagram › User Input]  tipo: Image
   │           Texto: "Manda a foto do comprovante aqui 👇"
   │           Salvar resposta em: comprovante_url
   │           │
   │           ▼
   └─ Não ──▶ [Action › External Request]  (o mesmo bloco nos dois caminhos)
```

## 3. External Request

Abra o bloco **External Request** e preencha:

```
Request type:  POST
URL:           https://SEU-N8N/webhook/manychat
Headers:
  x-bf-token    = (valor de MANYCHAT_WEBHOOK_TOKEN no .env)
  Content-Type  = application/json
Body (JSON):
{
  "contato_id": "{{user_id}}",
  "nome": "{{full_name}}",
  "texto": "{{last_input_text}}",
  "estado": "{{estado}}",
  "comprovante_url": "{{comprovante_url}}"
}
```

Insira as variáveis pelo botão **{ } / + Variable** do editor (User ID, Full Name, Last Text Input e
os dois campos criados). Se preferir, marque **Add Full Contact Data**: o n8n também entende esse formato.

Em **Response**, deixe sem mapeamento: o n8n devolve o JSON v2 e o ManyChat envia as mensagens.
Clique em **Test the request**. O teste deve devolver algo assim:

```json
{"version":"v2","content":{"type":"instagram","messages":[{"type":"text","text":"Oi, Bia! Aqui é da BF Tickets 🎟 ..."}],
 "actions":[{"action":"set_field_value","field_name":"estado","value":"inicio"},{"action":"unset_field_value","field_name":"comprovante_url"}],"quick_replies":[]}}
```

Se o seu plano não enviar as mensagens da resposta pelo External Request, troque o bloco por um
**Content block → + Dynamic** com a mesma URL, os mesmos headers e o mesmo corpo.

## 4. Avisos de /aprovar e /recusar no Instagram

Para o bot avisar o cliente quando você aprova o Pix, coloque a API key em `MANYCHAT_API_KEY`
(**Settings → API → Generate**) e rode `make import`. O Instagram só deixa mensagem automática
até **24 h** depois da última mensagem do cliente: aprove dentro desse prazo.

## 5. Testar sem VPS

```bash
make tunel
```

O comando imprime a URL `https://xxxx.trycloudflare.com/webhook/manychat`. Ela muda a cada execução,
então atualize o External Request. O painel (Ajustes → Instagram) também mostra a URL atual.

Teste local sem ManyChat (usa os fixtures de `tests/fixtures/manychat-*.json`):

```bash
scripts/simular.sh instagram
```

## Limites do formato v2 no Instagram

Até 10 mensagens, 5 actions e 11 quick replies por resposta. No Instagram só funcionam **texto** e
**imagem**; vídeo, áudio e arquivo não. O bot já respeita isso.
