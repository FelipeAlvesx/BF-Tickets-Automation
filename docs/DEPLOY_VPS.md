# Levar para a VPS

O `docker-compose.yml` é o mesmo do computador. Os serviços escutam só em `127.0.0.1`, e o **Caddy** fica na frente com HTTPS automático.

## 1. Servidor e domínio

- VPS Ubuntu 24.04 com **2 vCPU e 4 GB de RAM** (2 GB funciona com swap) e 40 GB de disco.
- No DNS do domínio, crie 3 registros **A** apontando para o IP da VPS:
  `painel.seudominio.com.br`, `n8n.seudominio.com.br` e `nocodb.seudominio.com.br`.
- Sem domínio, use `painel.<ip-com-hífens>.sslip.io` (e o mesmo para `n8n.` e `nocodb.`): já aponta para o IP e o HTTPS funciona. Trocar depois é só mudar `.env`, Caddyfile e a URL do ManyChat.
- StayCloud: não use a aba **Apps** do painel (ela reinstala o sistema e apaga o disco). O firewall do painel pode ficar desligado, porque o `ufw` cuida disso.

## 2. Preparar o servidor

```bash
curl -fsSL https://get.docker.com | sh
```

```bash
sudo apt install -y make nodejs caddy ufw
```

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable
```

Só as portas 22, 80 e 443 ficam abertas. Postgres, Evolution e NocoDB nunca ficam expostos.

## 3. Projeto e .env

```bash
git clone <repo> bf-tickets && cd bf-tickets && make env
```

No `.env`, além do que está em `docs/SETUP.md`, ajuste:

```
N8N_HOST=n8n.seudominio.com.br
N8N_PROTOCOL=https
N8N_SECURE_COOKIE=true
WEBHOOK_URL=https://n8n.seudominio.com.br/
LINK_N8N=https://n8n.seudominio.com.br
LINK_NOCODB=https://nocodb.seudominio.com.br
```

Para levar os dados do bot (pedidos, eventos, conversas, config), desconecte o WhatsApp do computador (painel → WhatsApp → Desconectar), pare `n8n` e `evolution` lá, rode `make backup` e restaure só o schema `app` aqui:

```bash
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" -n app --clean --if-exists --no-owner' < backups/ARQUIVO.dump
```

Depois pareie o WhatsApp de novo pelo painel. Nunca deixe os dois ligados no mesmo número: o cliente recebe resposta em dobro.

## 4. Caddy (HTTPS)

Crie `/etc/caddy/Caddyfile`:

```
painel.seudominio.com.br {
  reverse_proxy 127.0.0.1:5195
}
n8n.seudominio.com.br {
  reverse_proxy 127.0.0.1:5679
}
nocodb.seudominio.com.br {
  reverse_proxy 127.0.0.1:8096
}
```

```bash
sudo systemctl reload caddy
```

O painel tem Basic Auth, o n8n tem login de dono e o NocoDB tem login de admin. Use senhas fortes (o `make env` já gera).

## 5. Subir

```bash
make up && make import && make nocodb
```

Logo em seguida abra `https://n8n.seudominio.com.br` e crie a conta de dono: até isso ser feito, qualquer um que abrir o endereço pode criá-la.

Depois conecte o WhatsApp pelo painel (`https://painel.seudominio.com.br` → WhatsApp) e troque a URL do ManyChat para `https://n8n.seudominio.com.br/webhook/manychat`.

## 6. Backup diário do Postgres

```bash
crontab -e
```

Adicione as linhas abaixo: backup às 03:00 e limpeza dos dumps com mais de 14 dias.

```
0 3 * * * cd /root/bf-tickets && make backup >> backups/cron.log 2>&1
30 3 * * * find /root/bf-tickets/backups -name '*.dump' -mtime +14 -delete
```

O dump inclui a sessão do WhatsApp (schema `evolution`), os fluxos (schema `n8n`) e os dados do bot (schema `app`). Copie para fora da VPS (ex.: `rclone copy backups remoto:bf-backups`). Para restaurar:

```bash
make restore F=backups/bf-AAAAMMDD-HHMM.dump
```

## 7. Atualizar

```bash
git pull && make up && make import
```

Para trocar a versão de uma imagem, edite a tag no `docker-compose.yml` (nunca use `latest`), confira as notas de versão e rode `make up`.
