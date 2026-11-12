-- Banco único: schemas evolution, n8n e app. NocoDB guarda o meta dele num database à parte.
-- Roda só na primeira subida do volume (docker-entrypoint-initdb.d).
create schema if not exists evolution;
create schema if not exists n8n;
create schema if not exists app;
create database nocodb;

set search_path = app;

create table config (
  chave text primary key,
  valor text not null default ''
);

create table eventos (
  id serial primary key,
  nome text not null,
  data_evento timestamptz not null,
  local text,
  link_compra text,
  preco numeric(10,2) not null default 0,
  imagem_url text,
  ativo boolean not null default true
);

create table agenda (
  id serial primary key,
  horario time not null,
  dias_semana int[] not null default '{0,1,2,3,4,5,6}', -- 0 = domingo
  texto text not null,
  imagem_url text,
  evento_id int references eventos(id) on delete set null,
  enviar_grupo boolean not null default true,
  lembrete_story boolean not null default false,
  ativo boolean not null default true
);

create table conversas (
  canal text not null check (canal in ('whatsapp','instagram')),
  contato_id text not null,
  nome text,
  estado text not null default 'inicio',
  contexto jsonb not null default '{}',
  pausado_ate timestamptz,
  atualizado_em timestamptz not null default now(),
  primary key (canal, contato_id)
);

create table pedidos (
  id serial primary key,
  canal text not null,
  contato_id text not null,
  evento_id int references eventos(id),
  quantidade int not null check (quantidade > 0),
  valor_total numeric(10,2) not null,
  forma text not null default 'pix',
  status text not null default 'aguardando_comprovante' check (status in
    ('aguardando_comprovante','coletando_dados','aguardando_validacao','aprovado','recusado','cancelado')),
  comprovante_url text,       -- Instagram: URL; WhatsApp: wa:<id da mensagem> (o painel busca na Evolution)
  nome text,
  cpf text,                   -- LGPD: CPF só aqui
  email text,
  motivo_recusa text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on pedidos (status);

create table ofertas_venda (
  id serial primary key,
  canal text not null,
  contato_id text not null,
  evento_texto text,
  quantidade int,
  setor text,
  valor_pedido numeric(10,2),
  status text not null default 'nova' check (status in ('nova','em_negociacao','comprada','descartada')),
  criado_em timestamptz not null default now()
);

create table mensagens (
  chave text primary key,
  texto text not null
);

-- Idempotência
create table mensagens_processadas (id text primary key, criado_em timestamptz not null default now());
create table mensagens_enviadas (id text primary key, criado_em timestamptz not null default now());
create table envios_agenda (
  agenda_id int not null references agenda(id) on delete cascade,
  data date not null,
  enviado_em timestamptz not null default now(),
  unique (agenda_id, data)
);

-- Debounce: mensagens em sequência do mesmo contato esperam aqui DEBOUNCE_SEGUNDOS.
create table debounce (
  id bigserial primary key,
  canal text not null,
  contato_id text not null,
  nome text,
  texto text,
  midia jsonb,
  criado_em timestamptz not null default now()
);
create index on debounce (canal, contato_id);

-- Histórico curto para o painel (CPF mascarado antes de gravar).
create table historico (
  id bigserial primary key,
  canal text not null,
  contato_id text not null,
  direcao text not null check (direcao in ('in','out','humano')),
  texto text,
  criado_em timestamptz not null default now()
);
create index on historico (canal, contato_id, id desc);

-- ── Seed ─────────────────────────────────────────────────────────────
insert into config (chave, valor) values
  ('pix_chave', 'pix@bftickets.exemplo'),
  ('pix_titular', 'BF Tickets LTDA'),
  ('pix_banco', 'Banco Exemplo'),
  ('admin_numero', ''),            -- preenchido pelo zz-config.sh a partir do .env
  ('grupo_jid', ''),               -- scripts/listar-grupos.sh ou painel > WhatsApp
  ('pausa_humano_horas', '12'),
  ('bot_ligado', 'true');

insert into eventos (nome, data_evento, local, link_compra, preco, imagem_url) values
  ('Festival Verão Bahia', (current_date + 30 + time '22:00') at time zone 'America/Bahia', 'Arena Fonte Nova, Salvador', 'https://bftickets.exemplo/verao', 150.00, 'https://picsum.photos/seed/verao/1080/1350'),
  ('Pagode do Rio Vermelho', (current_date + 12 + time '20:00') at time zone 'America/Bahia', 'Largo da Mariquita, Salvador', 'https://bftickets.exemplo/pagode', 60.00, 'https://picsum.photos/seed/pagode/1080/1350');

insert into agenda (horario, texto, evento_id, enviar_grupo, lembrete_story) values
  ('09:00', 'Bom dia, galera! ☀️ {nome} tá chegando: {data}. Garanta o seu: {link}', 1, true, true),
  ('10:30', '🎟 {nome} — {preco}. Link oficial: {link}', 2, true, false),
  ('12:00', 'Almoço com plano pro fim de semana? {nome} em {data}. {link}', 2, true, false),
  ('13:30', 'Últimos lotes do {nome}! {preco} — {link}', 1, true, true),
  ('15:00', 'Dúvidas sobre o {nome}? Chama no privado que a gente responde 😉', 1, true, false),
  ('16:30', '{nome} • {data} • {local}. Ingresso: {link}', 2, true, false),
  ('18:00', 'Sextou antecipado? 🎶 {nome}: {link}', 2, true, true),
  ('19:30', 'Quer vender seu ingresso? Chama no privado que a gente compra.', null, true, false),
  ('21:00', 'Boa noite! {nome} tá logo aí. {preco} — {link}', 1, true, false),
  ('22:30', 'Último aviso do dia: {nome} em {data}. {link}', 1, true, false);
