// Percorre os fluxos do bot com payloads falsos da Evolution (ver scripts/simular.sh).
// Os fluxos de compra usam o primeiro evento ativo (funciona com 1 ou vários). Precisa de ao menos 1 evento ativo.
// Uso: node scripts/simular.mjs [pix|link|admin|instagram|agenda|falha|pula|tudo]
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const N8N = process.env.N8N ?? 'http://localhost:5679';
const MOCK = process.env.MOCK ?? 'http://localhost:8099';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = Date.now();
const criados = new Set(); // contatos de teste, apagados no fim

const sql = (q) => execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'sh', '-c', 'psql -tA -F"|" -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], { input: q }).toString().trim();
// O admin vale o que está no banco (o painel pode ter mudado em relação ao .env).
const ADMIN = sql("select valor from app.config where chave='admin_numero'");
const novoEvento = (ativo = true) => sql(`insert into app.eventos (nome, data_evento, link_compra, preco, ativo)
  values ('SIM Evento', now() + interval '10 days', 'https://bftickets.exemplo/sim', 150, ${ativo}) returning id`).split('\n')[0];
const log = async () => (await fetch(`${MOCK}/_log`)).json();

function payload(numero, message, { fromMe = false, id = `SIM${seq++}` } = {}) {
  if (numero !== ADMIN) criados.add(numero);
  const tipo = Object.keys(message)[0];
  return { event: 'messages.upsert', instance: 'sim', data: { key: { remoteJid: `${numero}@s.whatsapp.net`, fromMe, id }, pushName: 'Cliente Simulado', message, messageType: tipo, messageTimestamp: Math.floor(Date.now() / 1000) }, sender: 'bot@s.whatsapp.net' };
}
const post = (p) => fetch(`${N8N}/webhook/evolution`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });

// Manda e espera as respostas para `numero` pararem de chegar.
async function manda(numero, message, opts) {
  const antes = (await log()).length;
  await post(payload(numero, message, opts));
  let ultimo = antes;
  let parado = 0;
  for (let i = 0; i < 60 && parado < 3; i++) {
    await espera(700);
    const n = (await log()).length;
    parado = n > antes && n === ultimo ? parado + 1 : 0;
    ultimo = n;
  }
  const novas = (await log()).slice(antes);
  const fmt = (t) => t.replace(/\n/g, ' ⏎ ').slice(0, 110);
  console.log(`  → ${message.conversation ?? Object.keys(message)[0]}`);
  for (const m of novas) console.log(`    ${m.number === numero ? '🤖' : `📣 ${m.number}:`} ${fmt(m.text || `[${m.tipo}]`)}`);
  return novas;
}
const txt = (conversation) => ({ conversation });
const doCliente = (ms, numero) => ms.filter((m) => m.number === numero).map((m) => m.text).join('\n');
const comprovante = { imageMessage: { mimetype: 'image/jpeg', caption: '' }, base64: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==' };

async function fluxoPix() {
  const c = `55719${String(seq).slice(-8)}`;
  console.log(`\n▶ Fluxo Pix completo (${c})`);
  let r = await manda(c, txt('oi'));
  assert.match(doCliente(r, c), /Como posso ajudar/);
  r = await manda(c, txt('1'));
  // Com 1 evento ativo o bot pula a escolha do evento; com vários, escolhe o primeiro.
  if (/Pra qual evento/.test(doCliente(r, c))) r = await manda(c, txt('1'));
  assert.match(doCliente(r, c), /Quantos ingressos/);
  r = await manda(c, txt('2'));
  assert.match(doCliente(r, c), /Como prefere pagar/);
  r = await manda(c, txt('pix'));
  assert.equal(r.filter((m) => m.number === c).length, 3, 'resumo + chave isolada + instrução');
  assert.equal(r[1].text, sql("select valor from app.config where chave='pix_chave'"));
  r = await manda(c, comprovante);
  assert.ok(r.some((m) => m.number === ADMIN && m.tipo === 'sendMedia'), 'comprovante encaminhado ao admin');
  assert.match(doCliente(r, c), /numa mensagem só/);
  r = await manda(c, txt('Maria Simulada Souza\n529.982.247-25\nmaria@exemplo.com'));
  const id = sql(`select id from app.pedidos where contato_id='${c}' order by id desc limit 1`);
  assert.equal(sql(`select status from app.pedidos where id=${id}`), 'aguardando_validacao');
  assert.ok(r.some((m) => m.number === ADMIN && m.text.includes(`/aprovar ${id}`) && m.text.includes('***.982.247-**')), 'admin recebe CPF mascarado');
  assert.equal(sql(`select count(*) from app.historico where contato_id='${c}' and texto like '%529.982.247-25%'`), '0', 'histórico sem CPF');
  return { c, id };
}

async function fluxoLink() {
  const c = `55719${String(seq).slice(-8)}`;
  console.log(`\n▶ Fluxo link (${c})`);
  let r = await manda(c, txt('quero 3 ingressos'));
  if (/Pra qual evento/.test(doCliente(r, c))) r = await manda(c, txt('1'));
  assert.match(doCliente(r, c), /3x /);
  const l = await manda(c, txt('link'));
  assert.ok(l.some((m) => /^https:\/\//.test(m.text)), 'link isolado');
  assert.equal(sql(`select estado from app.conversas where contato_id='${c}'`), 'inicio');
}

async function admin(id, c) {
  console.log(`\n▶ Admin: /pedidos e /aprovar ${id}`);
  let r = await manda(ADMIN, txt('/pedidos'));
  assert.match(r.map((m) => m.text).join(), new RegExp(`#${id}`));
  r = await manda(ADMIN, txt(`/aprovar ${id}`));
  assert.equal(sql(`select status from app.pedidos where id=${id}`), 'aprovado');
  assert.match(doCliente(r, c), /aprovado/);
  assert.doesNotMatch(doCliente(r, c), new RegExp(`#${id}`), 'número do pedido só para o admin');
  assert.equal(sql(`select estado from app.conversas where contato_id='${c}'`), 'inicio');
}

async function idempotencia() {
  const c = `55719${String(seq).slice(-8)}`;
  console.log(`\n▶ Dedupe, debounce e pausa por humano (${c})`);
  const p = payload(c, txt('oi'));
  await post(p);
  await post(p); // mesmo id: só uma resposta
  await espera(5000);
  assert.equal((await log()).filter((m) => m.number === c).length, 1, 'webhook repetido não responde duas vezes');
  const antes = (await log()).length;
  const evento = sql('select nome from app.eventos where ativo and data_evento > now() order by data_evento limit 1');
  await post(payload(c, txt('quero comprar')));
  await post(payload(c, txt(`o ${evento.toLowerCase()}`)));
  await espera(6000);
  const juntas = (await log()).slice(antes).filter((m) => m.number === c);
  assert.equal(juntas.length, 1, 'debounce junta as duas');
  assert.ok(juntas[0].text.includes(evento), `responde sobre ${evento}`);
  await manda(c, txt('oi, aqui é o atendente'), { fromMe: true });
  assert.equal(sql(`select estado from app.conversas where contato_id='${c}'`), 'humano');
  const r = await manda(c, txt('alô?'));
  assert.equal(r.length, 0, 'chat pausado: bot não responde');
  await manda(ADMIN, txt(`/retomar ${c}`));
  assert.equal(sql(`select estado from app.conversas where contato_id='${c}'`), 'inicio');
}

// Linha da agenda para daqui a 1 min: envia 1 vez ao grupo + story ao admin, com jitter, sem duplicar.
async function agenda() {
  console.log('\n▶ Agenda: linha para agora + 1 min (grupo + lembrete de story)');
  const GRUPO = '120363000000000000@g.us';
  const ev = novoEvento();
  const grupoAntes = sql("select valor from app.config where chave='grupo_jid'");
  sql(`update app.config set valor='${GRUPO}' where chave='grupo_jid'`);
  const id = sql(`insert into app.agenda (horario, texto, evento_id, enviar_grupo, lembrete_story)
    values (date_trunc('minute', now() at time zone 'America/Bahia' + interval '1 minute')::time, 'SIMULACAO {nome} {preco} {link}', ${ev}, true, true) returning id`).split('\n')[0];
  try {
    let grupo = [];
    for (let i = 0; i < 40 && !grupo.length; i++) { await espera(5000); grupo = (await log()).filter((m) => m.number === GRUPO && m.text.includes('SIMULACAO')); }
    assert.equal(grupo.length, 1, 'mensagem no grupo');
    assert.match(grupo[0].text, /SIMULACAO SIM Evento R\$ 150,00 https:/);
    await espera(8000);
    const story = (await log()).filter((m) => m.number === ADMIN && /story|SIMULACAO|bftickets\.exemplo\/sim$/.test(m.text));
    assert.ok(story.length >= 3, 'arte + legenda + link isolado ao admin');
    assert.ok(story.some((m) => m.text === 'https://bftickets.exemplo/sim'), 'link sozinho');
    console.log(`    🤖 grupo: ${grupo[0].text}\n    📣 story: ${story.length} mensagens ao admin`);
    console.log('    aguardando 70 s para garantir que não duplica...');
    await espera(70000);
    assert.equal((await log()).filter((m) => m.number === GRUPO && m.text.includes('SIMULACAO')).length, 1, 'não duplicou');
    assert.equal(sql(`select count(*) from app.envios_agenda where agenda_id=${id}`), '1');
    const atraso = sql(`select extract(epoch from (enviado_em - date_trunc('minute', enviado_em)))::int from app.envios_agenda where agenda_id=${id}`);
    console.log(`    reivindicada ${atraso}s depois do minuto; o envio sai após o jitter de 1–60 s`);
  } finally {
    sql(`delete from app.agenda where id=${id}; delete from app.eventos where id=${ev}; update app.config set valor='${grupoAntes}' where chave='grupo_jid'`);
  }
}

// Instagram: o ManyChat chama o webhook e usa o JSON v2 devolvido como resposta.
async function instagram() {
  console.log('\n▶ Instagram (ManyChat External Request -> Dynamic Block v2)');
  const ig = String(seq++).slice(-9);
  criados.add(ig);
  const chama = async (corpo, token = process.env.MANYCHAT_WEBHOOK_TOKEN) => {
    const r = await fetch(`${N8N}/webhook/manychat`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bf-token': token }, body: JSON.stringify({ contato_id: ig, nome: 'Bia IG', estado: '', comprovante_url: '', texto: '', ...corpo }) });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  assert.equal((await chama({ texto: 'oi' }, 'token-errado')).status, 403, 'sem o token certo o webhook recusa');
  const passo = async (corpo) => {
    const { status, json } = await chama(corpo);
    assert.equal(status, 200);
    assert.equal(json.version, 'v2');
    assert.equal(json.content.type, 'instagram');
    assert.ok(json.content.messages.length <= 10);
    const estado = json.content.actions.find((a) => a.field_name === 'estado')?.value;
    console.log(`  → ${corpo.texto || corpo.comprovante_url}\n    🤖 ${json.content.messages.map((m) => m.text ?? `[${m.type}]`).join(' | ').replace(/\n/g, ' ⏎ ').slice(0, 160)}\n    estado = ${estado}`);
    return { json, estado };
  };
  let r = await passo({ texto: 'quero 2 ingressos pro pagode' });
  assert.equal(r.estado, 'escolhendo_pagamento');
  r = await passo({ texto: 'pix' });
  assert.equal(r.estado, 'aguardando_comprovante');
  assert.equal(r.json.content.messages.length, 3, 'resumo + chave isolada + instrução');
  r = await passo({ comprovante_url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1&signature=abc' });
  assert.equal(r.estado, 'coletando_dados');
  assert.match(sql(`select comprovante_url from app.pedidos where canal='instagram' and contato_id='${ig}'`), /lookaside/);
  const id = sql(`select id from app.pedidos where canal='instagram' and contato_id='${ig}'`);
  // Aprovar pelo painel antes dos dados é recusado (não encerra a conversa no meio).
  const aprovar = async () => (await (await fetch(`${N8N}/webhook/painel-admin`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-painel-token': process.env.PAINEL_TOKEN }, body: JSON.stringify({ texto: `/aprovar ${id}` }) })).json()).texto;
  assert.match(await aprovar(), /não está pronto/);
  r = await passo({ texto: 'Bia Teste Silva, 111.444.777-35, bia@exemplo.com' });
  assert.equal(r.estado, 'coletando_dados', 'no Instagram falta o telefone');
  r = await passo({ texto: '(71) 98888-7777' });
  assert.equal(r.estado, 'aguardando_validacao');
  assert.equal(sql(`select telefone from app.pedidos where id=${id}`), '71988887777');
  const texto = await aprovar();
  console.log(`  → /aprovar ${id} pelo painel\n    🧑‍💼 ${texto}`);
  assert.match(texto, /aprovado/);
  assert.equal(sql(`select status from app.pedidos where id=${id}`), 'aprovado');
  assert.equal(sql(`select estado from app.conversas where canal='instagram' and contato_id='${ig}'`), 'inicio');
}

// Imagem fora do ar: a legenda e o link do story ainda chegam, e o admin recebe o alerta.
async function agendaImagemFalha() {
  console.log('\n▶ Agenda com imagem que falha (story só com legenda + link, mais alerta)');
  const ev = novoEvento();
  const id = sql(`insert into app.agenda (horario, texto, evento_id, imagem_url, enviar_grupo, lembrete_story)
    values (date_trunc('minute', now() at time zone 'America/Bahia' + interval '1 minute')::time, 'SIMFALHA {nome} {link}', ${ev}, 'https://exemplo.invalid/falha.jpg', false, true) returning id`).split('\n')[0];
  try {
    let msgs = [];
    for (let i = 0; i < 40; i++) { await espera(5000); msgs = (await log()).filter((m) => m.number === ADMIN && /SIMFALHA|falharam|^https:\/\/bftickets/.test(m.text)); if (msgs.length >= 3) break; }
    const txt = msgs.map((m) => m.text).join('\n');
    assert.match(txt, /SIMFALHA SIM Evento/, 'legenda chegou');
    assert.ok(msgs.some((m) => m.text === 'https://bftickets.exemplo/sim'), 'link isolado chegou');
    assert.match(txt, /falharam/, 'admin recebeu o alerta');
    console.log(`    📣 ${msgs.length} mensagens ao admin: legenda, link e alerta de falha`);
  } finally {
    sql(`delete from app.agenda where id=${id}; delete from app.eventos where id=${ev}`);
  }
}

// Linha vencida ligada a evento desligado ou já encerrado NÃO pode ser reivindicada; a do evento ativo, sim.
// Roda numa transação com rollback: nada fica gravado e o relógio do n8n não vê as linhas.
async function agendaPula() {
  console.log('\n▶ Agenda não anuncia evento desligado nem encerrado');
  const { sqlAgendaVencida } = await import('../src/agenda.js');
  const out = sql(`begin;
    insert into app.eventos (nome, data_evento, ativo) values ('SIM on', now() + interval '5 days', true), ('SIM off', now() + interval '5 days', false), ('SIM velho', now() - interval '1 day', true);
    insert into app.agenda (horario, texto, evento_id)
      select (now() at time zone 'America/Bahia' - interval '1 minute')::time, 'SIM ' || nome, id from app.eventos where nome like 'SIM %';
    ${sqlAgendaVencida().replace(/;\s*$/, '')};
    rollback;`);
  const enviados = out.split('\n').filter((l) => l.includes('SIM '));
  assert.equal(enviados.length, 1, `só 1 linha (evento ativo) deve sair, saíram: ${enviados.length}`);
  assert.ok(enviados[0].includes('SIM SIM on'), 'a do evento ativo');
  console.log('    ok: evento ativo sai; desligado e encerrado ficam de fora');
}

const alvo = process.argv[2] ?? 'tudo';
assert.ok(ADMIN, 'admin_numero vazio em app.config');
await fetch(`${MOCK}/_log`, { method: 'DELETE' });
process.on('exit', () => {
  if (!criados.size) return;
  const ids = [...criados].map((c) => `'${c}'`).join(',');
  sql(`delete from app.pedidos where contato_id in (${ids}); delete from app.conversas where contato_id in (${ids});
    delete from app.historico where contato_id in (${ids}); delete from app.debounce where contato_id in (${ids});`);
});
if (alvo === 'link' || alvo === 'tudo') await fluxoLink();
if (alvo === 'pix' || alvo === 'admin' || alvo === 'tudo') {
  const { c, id } = await fluxoPix();
  if (alvo !== 'pix') await admin(id, c);
}
if (alvo === 'tudo') await idempotencia();
if (alvo === 'instagram' || alvo === 'tudo') await instagram();
if (alvo === 'agenda' || alvo === 'tudo') await agenda();
if (alvo === 'falha' || alvo === 'tudo') await agendaImagemFalha();
if (alvo === 'pula' || alvo === 'tudo') await agendaPula();
console.log('\n✅ simulação ok');
