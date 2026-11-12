// API + arquivos do painel (uma porta, Node puro + pg). Tudo atrás de Basic Auth, menos /saude.
// Lê o Postgres direto; aprovar/recusar passa pelo n8n (05-admin) para avisar o cliente com o mesmo texto do bot.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import pg from 'pg';
import { tabela, sqlInserir, sqlAtualizar, sqlApagar, autorizado } from './crud.mjs';

const E = process.env;
const INST = E.EVOLUTION_INSTANCE;
const DIST = join(import.meta.dirname, '..', 'dist');
const db = new pg.Pool({ connectionString: E.DATABASE_URL, max: 5 });
const q = async (text, values) => (await db.query(text, values)).rows;
const HOJE = "(date_trunc('day', now() at time zone 'America/Bahia') at time zone 'America/Bahia')";
const ABERTOS = "('aguardando_comprovante','coletando_dados','aguardando_validacao')";

const erro = (status, message) => Object.assign(new Error(message), { status });

// ── Evolution ──
async function evo(method, path, body) {
  let r;
  try {
    r = await fetch(`${E.EVOLUTION_URL}${path}`, {
      method, headers: { apikey: E.EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw erro(503, 'A Evolution (WhatsApp) não respondeu. Confira se o container está de pé.');
  }
  const data = await r.json().catch(() => null);
  if (!r.ok) throw erro(r.status === 404 ? 404 : 502, data?.response?.message?.toString?.() || data?.message || `Evolution respondeu ${r.status}`);
  return data;
}
const WEBHOOK = { enabled: true, url: E.EVOLUTION_WEBHOOK, byEvents: false, base64: true, events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'] };

async function whatsapp() {
  const grupo = (await q("select valor from app.config where chave='grupo_jid'"))[0]?.valor || '';
  let inst;
  try {
    inst = (await evo('GET', `/instance/fetchInstances?instanceName=${INST}`))?.[0];
  } catch (e) {
    if (e.status === 503) return { estado: 'offline', instancia: INST, grupo_jid: grupo };
    if (e.status !== 404) throw e;
  }
  if (!inst) return { estado: 'missing', instancia: INST, grupo_jid: grupo };
  const [st, wh] = await Promise.all([
    evo('GET', `/instance/connectionState/${INST}`).catch(() => null),
    evo('GET', `/webhook/find/${INST}`).catch(() => null),
  ]);
  return {
    estado: st?.instance?.state ?? inst.connectionStatus ?? 'close',
    instancia: INST,
    numero: inst.ownerJid ? String(inst.ownerJid).split('@')[0] : null,
    nome: inst.profileName ?? null,
    foto: inst.profilePicUrl ?? null,
    webhook: { url: wh?.url ?? null, ok: !!wh?.enabled && wh?.url === E.EVOLUTION_WEBHOOK },
    grupo_jid: grupo,
  };
}

async function conectar() {
  const atual = await whatsapp();
  if (atual.estado === 'offline') throw erro(503, 'A Evolution não está de pé.');
  if (atual.estado === 'missing') {
    const r = await evo('POST', '/instance/create', { instanceName: INST, integration: 'WHATSAPP-BAILEYS', qrcode: true, webhook: WEBHOOK });
    return { ...(await whatsapp()), qr: r?.qrcode?.base64 ?? null };
  }
  await evo('POST', `/webhook/set/${INST}`, { webhook: WEBHOOK });
  const r = await evo('GET', `/instance/connect/${INST}`);
  return { ...(await whatsapp()), qr: r?.base64 ?? null };
}

// ── mensagens manuais (atendente) ──
async function enviarManual(canal, contato, texto) {
  if (canal === 'whatsapp') await evo('POST', `/message/sendText/${INST}`, { number: contato, text: texto });
  else {
    if (!E.MANYCHAT_API_KEY) throw erro(400, 'Falta MANYCHAT_API_KEY no .env para responder no Instagram.');
    const r = await fetch('https://api.manychat.com/fb/sending/sendContent', {
      method: 'POST', headers: { Authorization: `Bearer ${E.MANYCHAT_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriber_id: Number(contato), data: { version: 'v2', content: { type: 'instagram', messages: [{ type: 'text', text: texto }] } } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.status === 'error') throw erro(502, j.message || 'O ManyChat recusou (fora da janela de 24 h?).');
  }
  // A Evolution não devolve o que a API envia como fromMe: o painel mesmo registra e pausa o bot.
  await q(`with h as (insert into app.historico (canal, contato_id, direcao, texto) values ($1, $2, 'humano', $3))
    insert into app.conversas (canal, contato_id, estado, pausado_ate) values ($1, $2, 'humano', now() + make_interval(hours => $4))
    on conflict (canal, contato_id) do update set estado = 'humano', pausado_ate = excluded.pausado_ate, atualizado_em = now()`,
  [canal, contato, texto, await horasPausa()]);
}
const horasPausa = async () => Number((await q("select valor from app.config where chave='pausa_humano_horas'"))[0]?.valor) || 12;

async function comandoAdmin(texto) {
  let r;
  try {
    r = await fetch(`${E.N8N_URL}/webhook/painel-admin`, {
      method: 'POST', headers: { 'x-painel-token': E.PAINEL_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }), signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw erro(503, 'O n8n não respondeu. Os workflows estão importados e publicados (make import)?');
  }
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) throw erro(502, `O n8n respondeu ${r.status}. Rode make import.`);
  if (!j.ok) throw erro(400, j.texto);
  return j;
}

async function saude(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return r.ok;
  } catch { return false; }
}

// ── rotas ──
const rotas = [
  ['GET', '/api/estado', async () => (await q(`select
    (select valor from app.config where chave='bot_ligado') <> 'false' as bot_ligado,
    (select count(*) from app.pedidos where status='aguardando_validacao')::int as validar,
    (select count(*) from app.pedidos where status in ('aguardando_comprovante','coletando_dados'))::int as em_andamento,
    (select count(*) from app.ofertas_venda where status='nova')::int as ofertas_novas,
    (select count(*) from app.conversas where pausado_ate > now())::int as pausadas,
    (select count(distinct (canal, contato_id)) from app.historico where criado_em >= ${HOJE})::int as contatos_hoje,
    (select count(*) from app.historico where direcao='in' and criado_em >= ${HOJE})::int as mensagens_hoje,
    (select count(*) from app.pedidos where status='aprovado' and atualizado_em >= ${HOJE})::int as aprovados_hoje,
    (select coalesce(sum(valor_total),0) from app.pedidos where status='aprovado' and atualizado_em >= ${HOJE})::float as receita_hoje,
    (select count(*) from app.envios_agenda where data = (now() at time zone 'America/Bahia')::date)::int as agenda_enviadas,
    (select count(*) from app.agenda a left join app.eventos e on e.id = a.evento_id where a.ativo and (a.evento_id is null or (e.ativo and e.data_evento > now())) and extract(dow from now() at time zone 'America/Bahia')::int = any(a.dias_semana))::int as agenda_hoje,
    now() as agora`))[0]],

  ['GET', '/api/whatsapp', whatsapp],
  ['POST', '/api/whatsapp/conectar', conectar],
  ['POST', '/api/whatsapp/desconectar', async () => { await evo('DELETE', `/instance/logout/${INST}`); return whatsapp(); }],
  ['POST', '/api/whatsapp/reiniciar', async () => { await evo('POST', `/instance/restart/${INST}`); return whatsapp(); }],
  ['POST', '/api/whatsapp/webhook', async () => { await evo('POST', `/webhook/set/${INST}`, { webhook: WEBHOOK }); return whatsapp(); }],
  ['GET', '/api/whatsapp/grupos', async () => (await evo('GET', `/group/fetchAllGroups/${INST}?getParticipants=false`))
    .map((g) => ({ jid: g.id, nome: g.subject, tamanho: g.size ?? null })).sort((a, b) => String(a.nome).localeCompare(b.nome))],
  ['PUT', '/api/whatsapp/grupo', async (_, b) => {
    if (b.jid && !/@g\.us$/.test(b.jid)) throw erro(400, 'Isso não é o id de um grupo (termina em @g.us).');
    await q("update app.config set valor=$1 where chave='grupo_jid'", [b.jid ?? '']);
    return whatsapp();
  }],

  ['GET', '/api/conversas', async () => q(`select c.canal, c.contato_id, c.nome, c.estado, c.pausado_ate, c.atualizado_em,
      coalesce(c.pausado_ate > now(), false) as pausado, h.texto as ultima, h.direcao as ultima_direcao, h.criado_em as ultima_em,
      (select count(*) from app.pedidos p where p.canal=c.canal and p.contato_id=c.contato_id and p.status in ${ABERTOS})::int as pedidos_abertos
    from app.conversas c left join lateral (select texto, direcao, criado_em from app.historico h
      where h.canal=c.canal and h.contato_id=c.contato_id order by id desc limit 1) h on true
    order by coalesce(c.pausado_ate > now(), false) desc, coalesce(h.criado_em, c.atualizado_em) desc limit 200`)],
  ['GET', /^\/api\/conversas\/(whatsapp|instagram)\/([^/]+)$/, async ([canal, id]) => {
    const [conversa] = await q('select *, coalesce(pausado_ate > now(), false) as pausado from app.conversas where canal=$1 and contato_id=$2', [canal, id]);
    if (!conversa) throw erro(404, 'Conversa não encontrada.');
    const historico = (await q('select direcao, texto, criado_em from app.historico where canal=$1 and contato_id=$2 order by id desc limit 150', [canal, id])).reverse();
    const pedidos = await q('select p.*, e.nome as evento from app.pedidos p left join app.eventos e on e.id=p.evento_id where p.canal=$1 and p.contato_id=$2 order by p.id desc', [canal, id]);
    return { conversa, historico, pedidos };
  }],
  ['POST', /^\/api\/conversas\/(whatsapp|instagram)\/([^/]+)\/pausa$/, async ([canal, id], b) => {
    if (b.pausar) await q(`insert into app.conversas (canal, contato_id, estado, pausado_ate) values ($1, $2, 'humano', now() + make_interval(hours => $3))
      on conflict (canal, contato_id) do update set estado='humano', pausado_ate=excluded.pausado_ate, atualizado_em=now()`, [canal, id, await horasPausa()]);
    else await q("update app.conversas set estado='inicio', contexto='{}', pausado_ate=null, atualizado_em=now() where canal=$1 and contato_id=$2", [canal, id]);
    return { ok: true };
  }],
  ['POST', /^\/api\/conversas\/(whatsapp|instagram)\/([^/]+)\/mensagem$/, async ([canal, id], b) => {
    const texto = String(b.texto ?? '').trim();
    if (!texto) throw erro(400, 'Escreva a mensagem.');
    await enviarManual(canal, id, texto);
    return { ok: true };
  }],

  ['GET', '/api/pedidos', async (_, __, url) => {
    const s = url.searchParams.get('status') || 'abertos';
    const filtro = s === 'abertos' ? `p.status in ${ABERTOS}` : s === 'todos' ? 'true' : 'p.status = $1';
    return q(`select p.*, e.nome as evento, c.nome as nome_contato from app.pedidos p left join app.eventos e on e.id=p.evento_id
      left join app.conversas c on c.canal=p.canal and c.contato_id=p.contato_id where ${filtro} order by p.id desc limit 300`,
    s === 'abertos' || s === 'todos' ? [] : [s]);
  }],
  ['POST', /^\/api\/pedidos\/(\d+)\/(aprovar|recusar)$/, async ([id, acao], b) =>
    comandoAdmin(`/${acao} ${id}${acao === 'recusar' && b.motivo ? ` ${String(b.motivo).replace(/\s+/g, ' ')}` : ''}`)],
  ['GET', /^\/api\/pedidos\/(\d+)\/comprovante$/, async ([id], _, __, res) => {
    const [p] = await q('select comprovante_url from app.pedidos where id=$1', [id]);
    const u = p?.comprovante_url;
    if (!u) throw erro(404, 'Esse pedido não tem comprovante.');
    if (/^https?:\/\//.test(u)) { res.writeHead(302, { Location: u }); return res.end(); }
    const m = await evo('POST', `/chat/getBase64FromMediaMessage/${INST}`, { message: { key: { id: u.replace(/^wa:/, '') } }, convertToMp4: false });
    res.writeHead(200, { 'Content-Type': m.mimetype || 'application/octet-stream', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(Buffer.from(m.base64, 'base64'));
  }],

  ['GET', /^\/api\/t\/(\w+)$/, async ([t]) => q(tabela(t).listar)],
  ['POST', /^\/api\/t\/(\w+)$/, async ([t], b) => { const s = sqlInserir(t, b); return (await q(s.text, s.values))[0]; }],
  ['PUT', /^\/api\/t\/(\w+)\/([^/]+)$/, async ([t, pk], b) => {
    const s = sqlAtualizar(t, decodeURIComponent(pk), b);
    const [linha] = await q(s.text, s.values);
    if (!linha) throw erro(404, 'Não achei esse registro.');
    return linha;
  }],
  ['DELETE', /^\/api\/t\/(\w+)\/([^/]+)$/, async ([t, pk]) => { const s = sqlApagar(t, decodeURIComponent(pk)); await q(s.text, s.values); return { ok: true }; }],

  ['GET', '/api/sistema', async () => {
    const [banco, evolution, n8n, nocodb, tunel] = await Promise.all([
      q('select 1').then(() => true, () => false),
      fetch(`${E.EVOLUTION_URL}/instance/fetchInstances`, { headers: { apikey: E.EVOLUTION_API_KEY }, signal: AbortSignal.timeout(4000) }).then((r) => r.ok, () => false),
      saude(`${E.N8N_URL}/healthz`),
      saude('http://nocodb:8080/api/v1/health'),
      fetch('http://cloudflared:2000/quicktunnel', { signal: AbortSignal.timeout(1500) }).then((r) => r.json()).then((j) => j.hostname || null, () => null),
    ]);
    const base = (E.WEBHOOK_URL || '').replace(/\/?$/, '/');
    return {
      servicos: { banco, evolution, n8n, nocodb },
      links: { n8n: E.LINK_N8N, nocodb: E.LINK_NOCODB },
      webhook_manychat: tunel ? `https://${tunel}/webhook/manychat` : `${base}webhook/manychat`,
      tunel: !!tunel,
    };
  }],
];

// ── servidor ──
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

async function estatico(path, res) {
  const arq = normalize(join(DIST, path));
  const seguro = arq.startsWith(DIST) && extname(arq);
  try {
    const dado = await readFile(seguro ? arq : join(DIST, 'index.html'));
    const tipo = seguro ? TIPOS[extname(arq)] ?? 'application/octet-stream' : TIPOS['.html'];
    res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
    res.end(dado);
  } catch {
    if (seguro) { res.writeHead(404); return res.end(); }
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Painel sem build (npm run build).');
  }
}

async function lerCorpo(req) {
  let s = '';
  for await (const c of req) { s += c; if (s.length > 1e6) throw erro(413, 'Corpo grande demais.'); }
  if (!s) return {};
  try { return JSON.parse(s); } catch { throw erro(400, 'JSON inválido.'); }
}

export const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/saude') return res.writeHead(200).end('ok');
  if (!autorizado(req.headers.authorization, E.PAINEL_USUARIO, E.PAINEL_SENHA)) {
    return res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="BF Tickets", charset="UTF-8"' }).end('Login necessário');
  }
  if (!url.pathname.startsWith('/api/')) return estatico(url.pathname, res);
  try {
    for (const [m, p, fn] of rotas) {
      if (m !== req.method) continue;
      const args = typeof p === 'string' ? (p === url.pathname ? [] : null) : url.pathname.match(p)?.slice(1).map(decodeURIComponent);
      if (!args) continue;
      const corpo = ['POST', 'PUT'].includes(req.method) ? await lerCorpo(req) : {};
      const r = await fn(args, corpo, url, res);
      if (!res.headersSent) res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(r ?? { ok: true }));
      return;
    }
    throw erro(404, 'Rota não existe.');
  } catch (e) {
    const status = e.status ?? (e.code?.startsWith?.('22') || e.code?.startsWith?.('23') ? 400 : 500);
    if (status === 500) console.error(req.method, url.pathname, e);
    const msg = status === 400 && e.code ? `Valor inválido: ${e.message}` : e.message;
    if (!res.headersSent) res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ error: msg }));
  }
});

if (!E.PAINEL_SENHA) { console.error('PAINEL_SENHA vazia: o painel não sobe sem senha.'); process.exit(1); }
servidor.listen(8080, () => console.log('painel em :8080'));
