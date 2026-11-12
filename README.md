# BF Tickets — bot de atendimento (WhatsApp + Instagram)

Bot que vende ingressos pelo privado (link ou Pix com comprovante e validação manual), recebe ofertas
de quem quer vender, manda a agenda do grupo de WhatsApp, lembra o dono de postar story e passa para
humano quando precisa. Inclui um painel de gestão para o dono.

```
docker-compose
├── postgres     banco único (schemas evolution, n8n, app)
├── redis        cache da Evolution
├── evolution    WhatsApp (Baileys, QR)
├── n8n          fluxos: 01 agenda · 02 WhatsApp · 03 Instagram · 04 core · 05 admin · 06 enviar · 99 erros
├── nocodb       planilha sobre o schema app
├── painel       painel do dono (React + API Node): WhatsApp/instância, pedidos, conversas, agenda, eventos, textos
└── cloudflared  (perfil dev) túnel para o webhook do ManyChat
```

- Para subir do zero, siga **[docs/SETUP.md](docs/SETUP.md)**. Para colocar na VPS, **[docs/DEPLOY_VPS.md](docs/DEPLOY_VPS.md)**. O Instagram está em **[manychat/SETUP.md](manychat/SETUP.md)**.
- As decisões de projeto estão em [docs/DECISOES.md](docs/DECISOES.md).
- A lógica fica em `src/`, em JS puro testado com `node:test`. O `scripts/build-workflows.mjs` injeta esse código nos Code nodes de `n8n/workflows/`.

```bash
make up && make import && make nocodb   # sobe, importa os fluxos, liga a planilha
make test                               # lógica pura
make simular                            # conversa inteira contra o n8n, com uma Evolution falsa
```
