# Subir o bot do zero (≈ 30 min)

## O que você precisa

- **Docker Desktop** (Mac/Windows) ou Docker Engine (Linux), aberto e rodando, com pelo menos **4 GB de memória**
  (Docker Desktop → Settings → Resources).
- **Node.js 20 ou mais novo**, para `make build` e `make simular`.
- Um **celular com um número só para o bot**, com WhatsApp (de preferência o Business) já ativado.
- Uma **chave de API da Anthropic** (https://platform.claude.com/settings/keys). Ela só é usada para entender mensagens ambíguas, com o modelo mais barato (Haiku 5.5): centavos por milhares de mensagens.
- O **número do dono (admin)**, que recebe os comprovantes e manda os comandos.

## 1. Configurar (2 min)

```bash
make env
```

O comando cria o `.env` com senhas aleatórias. Abra o arquivo e preencha:

| Variável | O que pôr |
|---|---|
| `ADMIN_NUMERO` | WhatsApp do dono com 55 + DDD, só números. Ex.: `5571999998888` |
| `LLM_API_KEY` | Sua chave da Anthropic |
| `LLM_MODEL` / `LLM_BASE_URL` | Já vêm prontos: `claude-haiku-5-5` e `https://api.anthropic.com` |
| `PAINEL_USUARIO` / `PAINEL_SENHA` | O login do painel (a senha já vem gerada; troque se quiser) |
| `MANYCHAT_*` | Só se for usar o Instagram (ver `manychat/SETUP.md`) |

## 2. Subir tudo (5–10 min na primeira vez)

```bash
make up
```

O comando baixa as imagens, cria o banco com os dados de exemplo e espera todos os containers ficarem **healthy**.

Depois, importe os fluxos no n8n:

```bash
make import
```

E conecte a planilha (NocoDB) às tabelas do bot:

```bash
make nocodb
```

## 3. Conectar o WhatsApp (3 min)

1. Abra o painel em **http://localhost:5195**. O login é `PAINEL_USUARIO` / `PAINEL_SENHA` do `.env`.
2. Vá em **WhatsApp → Conectar**. Aparece um QR Code.
3. No celular do bot, abra **WhatsApp → Aparelhos conectados → Conectar aparelho** e aponte a câmera para o QR.
4. Em alguns segundos o painel mostra **Conectado**, com o número e o nome do perfil.

Sem o painel, rode `make instancia`: ele salva o QR em `qr.png`.

## 4. Grupo, Pix e conteúdo (5 min)

1. Adicione o número do bot ao grupo de WhatsApp (de preferência como admin).
2. No painel, vá em **WhatsApp → Escolher grupo → Usar**. Pelo terminal: `make grupos`, depois `make grupo JID=...`.
3. Em **Ajustes**, confira a chave Pix, o titular, o banco e o número do admin.
4. Cadastre os eventos reais em **Eventos** e desative ou apague os de exemplo.
5. Ajuste os horários e textos em **Agenda do grupo** e as falas do bot em **Textos do bot**.

## 5. Testar (5 min)

- De **outro** celular, mande "oi" para o número do bot. Ele responde com o menu.
- Do celular do **admin**, mande `/ajuda` para o bot.
- Sem celular nenhum, rode a simulação. Ela usa uma Evolution falsa e percorre o Pix completo, o link, o admin, o Instagram e a agenda.
  Enquanto ela roda, o n8n inteiro fala com a Evolution falsa: **só rode com ninguém usando o bot e nunca na VPS**
  (o script se recusa se houve conversa real nos últimos 15 min):

```bash
make simular
```

## Endereços

| O quê | Onde | Login |
|---|---|---|
| Painel do bot | http://localhost:5195 | `PAINEL_USUARIO` / `PAINEL_SENHA` |
| n8n (fluxos) | http://localhost:5679 | crie a conta de dono no primeiro acesso |
| NocoDB (planilha) | http://localhost:8096 | `NOCODB_ADMIN_EMAIL` / `NOCODB_ADMIN_PASSWORD` |
| Evolution (API) | http://localhost:8095 | header `apikey` = `EVOLUTION_API_KEY` |

## Comandos do admin (pelo WhatsApp, para o número do bot)

`/pedidos` · `/aprovar 12` · `/recusar 12 valor diferente` · `/pausar 71999998888` · `/retomar 71999998888` · `/eventos` · `/ajuda`

## Dia a dia

```bash
make ps          # estado dos containers
make logs S=n8n  # logs de um serviço
make backup      # dump do banco em backups/
make test        # testes da lógica (node:test)
```

Para mudar a lógica (estados, textos padrão, comandos), edite os arquivos em `src/` e rode:

```bash
make test
```

```bash
make import
```

O `make import` regera os workflows e reimporta no n8n.

## Problemas comuns

- **O bot não responde:** veja se o painel mostra **WhatsApp conectado** e **Webhook ligado ao n8n**. Confira também se `make import` rodou e se o bot não está pausado para todos (Ajustes).
- **Responde "Não entendi" para tudo:** a `LLM_API_KEY` está errada ou sem crédito. Depois de corrigir, rode `make import`.
- **Parou de responder um cliente:** alguém respondeu pelo celular do bot e o chat ficou pausado (12 h por padrão). Devolva em **Conversas → Devolver ao bot** ou com `/retomar <tel>`.
- **Erros:** o admin recebe um alerta curto no WhatsApp. O detalhe fica em n8n → Executions.
