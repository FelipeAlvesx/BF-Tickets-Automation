#!/usr/bin/env node
// Gera n8n/workflows/*.json com o código de src/ injetado nos Code nodes e db/mensagens.sql
// a partir de TEXTOS_PADRAO. Determinístico (ids fixos, sem datas): rodar 2x dá o mesmo arquivo.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TEXTOS_PADRAO } from '../src/templates.js';
import { lit } from '../src/sql.js';
import { sqlAgendaVencida } from '../src/agenda.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => readFileSync(join(RAIZ, p), 'utf8');

// ── código de src/ para os Code nodes ──────────────────────────────────
function modulo(nome) {
  const fonte = ler(`src/${nome}.js`);
  const deps = [...fonte.matchAll(/^import .* from '\.\/(\w+)\.js';$/gm)].map((m) => m[1]);
  const code = fonte.replace(/^import .*;$/gm, '').replace(/^export /gm, '').trim();
  return { deps, code };
}
function bundle(nomes) {
  const ordem = [];
  const visitar = (n) => {
    if (ordem.includes(n)) return;
    modulo(n).deps.forEach(visitar);
    ordem.push(n);
  };
  nomes.forEach(visitar);
  return ordem.map((n) => `// ── src/${n}.js ──\n${modulo(n).code}`).join('\n\n');
}
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
function jsCode(mods, glue) {
  const code = mods.length
    ? `// ==== GERADO por scripts/build-workflows.mjs a partir de src/ (${mods.join(', ')}). Edite em src/ e rode make build. ====\n${bundle(mods)}\n// ==== fim do código gerado ====\n\n${glue.trim()}\n`
    : `${glue.trim()}\n`;
  new AsyncFunction('$input', '$', '$env', code); // falha o build se não compilar
  return code;
}

// ── fábrica de nodes ───────────────────────────────────────────────────
const uuid = (s) => {
  const h = createHash('md5').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};
const CRED = {
  pg: { postgres: { id: 'bfPostgres000001', name: 'BF Postgres' } },
  evo: { httpHeaderAuth: { id: 'bfEvolution00001', name: 'BF Evolution apikey' } },
  llm: { httpHeaderAuth: { id: 'bfLLM00000000001', name: 'BF LLM (Anthropic)' } },
  manychat: { httpHeaderAuth: { id: 'bfManychat000001', name: 'BF ManyChat API' } },
  mcHook: { httpHeaderAuth: { id: 'bfManychatHook01', name: 'BF ManyChat webhook' } },
  painel: { httpHeaderAuth: { id: 'bfPainelToken001', name: 'BF Painel token' } },
};
export const W = {
  agenda: 'bf01agenda000001', whatsapp: 'bf02whatsapp0001', instagram: 'bf03instagram001',
  core: 'bf04core00000001', admin: 'bf05admin0000001', enviar: 'bf06enviar000001', erros: 'bf99erros0000001',
};

function workflow(id, name, nodes, ligacoes, { erro = true } = {}) {
  nodes.forEach((n, i) => {
    n.id = uuid(`${id}:${n.name}`);
    n.position ??= [220 * i, 300];
  });
  const connections = {};
  for (const [de, para, saida = 0] of ligacoes) {
    const c = (connections[de] ??= { main: [] });
    while (c.main.length <= saida) c.main.push([]);
    c.main[saida].push({ node: para, type: 'main', index: 0 });
  }
  const settings = { executionOrder: 'v1', timezone: 'America/Bahia', saveDataSuccessExecution: 'none', saveManualExecutions: true, callerPolicy: 'workflowsFromSameOwner' };
  if (erro) settings.errorWorkflow = W.erros;
  return { id, name, active: false, nodes, connections, settings, pinData: {}, meta: { templateCredsSetupCompleted: true }, tags: [] };
}

const code = (name, mods, glue, extra = {}) => ({ name, type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: jsCode(mods, glue) }, ...extra });
const pg = (name, query = '={{ $json.sql }}', extra = {}) => ({ name, type: 'n8n-nodes-base.postgres', typeVersion: 2.5, parameters: { operation: 'executeQuery', query, options: {} }, credentials: CRED.pg, ...extra });
const gatilho = (name = 'Entrada') => ({ name, type: 'n8n-nodes-base.executeWorkflowTrigger', typeVersion: 1.1, parameters: { inputSource: 'passthrough' } });
const executar = (name, wfId, extra = {}) => ({
  name, type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2,
  parameters: { source: 'database', workflowId: { __rl: true, value: wfId, mode: 'id' }, mode: 'once', workflowInputs: { mappingMode: 'defineBelow', value: {}, matchingColumns: [], schema: [] }, options: { waitForSubWorkflow: true } },
  ...extra,
});
const webhook = (name, path, { auth, responseNode = false } = {}) => ({
  name, type: 'n8n-nodes-base.webhook', typeVersion: 2, webhookId: uuid(`webhook:${path}`),
  parameters: { httpMethod: 'POST', path, responseMode: responseNode ? 'responseNode' : 'onReceived', ...(auth ? { authentication: 'headerAuth' } : {}), options: {} },
  ...(auth ? { credentials: CRED[auth] } : {}),
});
const http = (name, url, body, cred, extra = {}, opcoes = {}, params = {}) => ({
  name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
  parameters: { method: 'POST', url, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendBody: true, specifyBody: 'json', jsonBody: body, options: opcoes, ...params },
  credentials: CRED[cred], ...extra,
});
const rota = (name, saidas) => ({ name, type: 'n8n-nodes-base.switch', typeVersion: 3.2, parameters: { mode: 'expression', numberOutputs: saidas, output: '={{ $json.saida }}' } });
const espera = (name, amount) => ({ name, type: 'n8n-nodes-base.wait', typeVersion: 1.1, webhookId: uuid(`wait:${name}`), parameters: { amount, unit: 'seconds' } });
const responder = (name, corpo) => ({ name, type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, parameters: { respondWith: 'json', responseBody: corpo, options: {} } });

// ── workflows ──────────────────────────────────────────────────────────
const PROMPT = JSON.stringify(ler('prompts/extrator.md').trim());

const enviar = workflow(W.enviar, '06 · Enviar WhatsApp', [
  gatilho(),
  code('Montar chamadas', ['canais'], `
const out = [];
for (const { json } of $input.all()) {
  if (!json.numero) continue;
  for (const c of chamadasEvolution(String(json.numero), json.mensagens)) out.push({ json: c });
}
return out;`),
  http('Evolution', '={{ $env.EVOLUTION_URL }}/message/{{ $json.endpoint }}/{{ $env.EVOLUTION_INSTANCE }}', '={{ JSON.stringify($json.body) }}', 'evo', {}, { batching: { batch: { batchSize: 1, batchInterval: 300 } }, timeout: 30000 }),
  code('Ids enviados', ['sql'], `
const ids = $input.all().map((i) => i.json?.key?.id).filter(Boolean);
if (!ids.length) return [];
return [{ json: { sql: \`insert into app.mensagens_enviadas (id) values \${ids.map((i) => \`(\${lit(i)})\`).join(', ')} on conflict do nothing\` } }];`),
  pg('Gravar ids'),
], [['Entrada', 'Montar chamadas'], ['Montar chamadas', 'Evolution'], ['Evolution', 'Ids enviados'], ['Ids enviados', 'Gravar ids']]);

const core = workflow(W.core, '04 · Core (atendimento)', [
  gatilho(),
  code('SQL carregar', ['sql'], `
const e = $input.first().json;
return [{ json: { sql: sqlCarregar(e.canal, e.contato_id) } }];`),
  pg('Carregar'),
  code('Processar', ['estados'], `
const PROMPT = ${PROMPT};
const e = $('Entrada').first().json;
const d = $input.first().json;
const ctx = { canal: e.canal, contato_id: e.contato_id, nome: e.nome, texto: e.texto, midia: e.midia ?? null,
  conversa: d.conversa, eventos: d.eventos, textos: d.textos, config: d.config, agora: d.agora, prompt: PROMPT, modelo: $env.LLM_MODEL };
const r = processar(ctx);
return [{ json: { ctx, r, precisaLLM: !!r.precisaLLM, llm: r.llm ?? null } }];`),
  { name: 'Precisa LLM?', type: 'n8n-nodes-base.if', typeVersion: 2.2, parameters: {
    conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 }, combinator: 'and',
      conditions: [{ id: uuid('cond-llm'), leftValue: '={{ $json.precisaLLM }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }] },
    options: {} } },
  http('LLM', '={{ $env.LLM_BASE_URL }}/v1/messages', '={{ JSON.stringify($json.llm) }}', 'llm', { onError: 'continueRegularOutput' }, { timeout: 8000 },
    { sendHeaders: true, specifyHeaders: 'keypair', headerParameters: { parameters: [{ name: 'anthropic-version', value: '2026-10-21' }] } }),
  code('Decidir', ['estados', 'sql'], `
const p = $('Processar').first().json;
let r = p.r;
if (p.precisaLLM) {
  const resp = $input.first().json;
  r = processar(p.ctx, resp && resp.content ? resp : {}); // LLM fora do ar = baixa confiança
}
return [{ json: { r, sql: sqlGravar(p.ctx, r) } }];`),
  pg('Gravar'),
  code('Avisos admin', [], `
const { r } = $('Decidir').first().json;
const admin = $('Processar').first().json.ctx.config?.admin_numero;
const mensagens = (r.acoes ?? []).filter((a) => a.tipo === 'avisar_admin').flatMap((a) => a.mensagens);
return [{ json: { numero: admin && mensagens.length ? admin : null, mensagens } }];`),
  executar('Avisar admin', W.enviar, { alwaysOutputData: true }),
  code('Retorno', [], `
const { r } = $('Decidir').first().json;
return [{ json: { mensagens: r.mensagens, estado: r.estado } }];`),
], [
  ['Entrada', 'SQL carregar'], ['SQL carregar', 'Carregar'], ['Carregar', 'Processar'], ['Processar', 'Precisa LLM?'],
  ['Precisa LLM?', 'LLM', 0], ['Precisa LLM?', 'Decidir', 1], ['LLM', 'Decidir'], ['Decidir', 'Gravar'],
  ['Gravar', 'Avisos admin'], ['Avisos admin', 'Avisar admin'], ['Avisar admin', 'Retorno'],
]);

const whatsapp = workflow(W.whatsapp, '02 · Entrada WhatsApp', [
  webhook('Evolution', 'evolution'),
  code('Normalizar', ['canais', 'sql'], `
const m = normalizarEvolution($input.first().json.body);
if (!m) return [];
const c = lit(m.contato_id);
const deb = m.fromMe ? '' : \`,
d as (insert into app.debounce (canal, contato_id, nome, texto, midia)
  select 'whatsapp', \${c}, \${lit(m.nome)}, \${lit(m.texto)}, \${lit(m.midia)} from novo, cfg
  where not (cfg.admin in (\${variantesNumero(m.contato_id).map(lit).join(',')}) and \${lit(m.texto)} like '/%') returning id)\`;
const sql = \`with novo as (insert into app.mensagens_processadas (id) values (\${lit(m.id)}) on conflict do nothing returning id),
cfg as (select coalesce((select valor from app.config where chave='admin_numero'), '') as admin,
  coalesce((select valor from app.config where chave='pausa_humano_horas'), '12') as horas)\${deb}
select exists(select 1 from novo) as novo, cfg.admin, cfg.horas\${m.fromMe ? '' : ', (select id from d) as debounce_id'} from cfg\`;
return [{ json: { ...m, sql } }];`),
  pg('Registrar'),
  code('Rotear', ['sql', 'canais'], `
const m = $('Normalizar').first().json;
const d = $input.first().json;
if (!d.novo) return []; // webhook repetido
const c = lit(m.contato_id);
if (m.fromMe) {
  // Alguém respondeu pelo celular do bot: pausa o chat (handoff).
  const sql = \`with h as (insert into app.historico (canal, contato_id, direcao, texto) values ('whatsapp', \${c}, 'humano', \${lit(m.texto || '[mídia]')}))
insert into app.conversas (canal, contato_id, estado, pausado_ate)
select 'whatsapp', \${c}, 'humano', now() + make_interval(hours => \${Number(d.horas) || 12})
where not exists (select 1 from app.mensagens_enviadas where id = \${lit(m.id)})
on conflict (canal, contato_id) do update set estado = 'humano', pausado_ate = excluded.pausado_ate, atualizado_em = now()\`;
  return [{ json: { saida: 1, sql } }];
}
if (d.admin && variantesNumero(m.contato_id).includes(d.admin) && m.texto.startsWith('/')) return [{ json: { saida: 0, texto: m.texto, admin: m.contato_id } }]; // responde no número de onde veio
if (!d.debounce_id) return [];
const sql_juntar = \`with del as (delete from app.debounce where canal = 'whatsapp' and contato_id = \${c}
  and (select max(id) from app.debounce where canal = 'whatsapp' and contato_id = \${c}) = \${Number(d.debounce_id)} returning *)
select count(*)::int as n, string_agg(nullif(texto, ''), E'\\\\n' order by id) as texto,
  (array_agg(midia order by id desc) filter (where midia is not null))[1] as midia, max(nome) as nome from del\`;
return [{ json: { saida: 2, contato_id: m.contato_id, sql_juntar } }];`),
  rota('Rota', 3),
  executar('Admin', W.admin),
  pg('Pausar chat'),
  espera('Debounce', '={{ Math.max(1, Number($env.DEBOUNCE_SEGUNDOS || 6)) }}'),
  pg('Juntar', '={{ $json.sql_juntar }}'),
  code('Para o core', [], `
const j = $input.first().json;
if (!j.n) return []; // chegou mensagem mais nova: aquela execução responde
return [{ json: { canal: 'whatsapp', contato_id: $('Rotear').first().json.contato_id, nome: j.nome, texto: j.texto ?? '', midia: j.midia ?? null } }];`),
  executar('Core', W.core),
  code('Para enviar', [], `
const r = $input.first().json;
return [{ json: { numero: $('Para o core').first().json.contato_id, mensagens: r.mensagens ?? [] } }];`),
  executar('Enviar', W.enviar),
], [
  ['Evolution', 'Normalizar'], ['Normalizar', 'Registrar'], ['Registrar', 'Rotear'], ['Rotear', 'Rota'],
  ['Rota', 'Admin', 0], ['Rota', 'Pausar chat', 1], ['Rota', 'Debounce', 2],
  ['Debounce', 'Juntar'], ['Juntar', 'Para o core'], ['Para o core', 'Core'], ['Core', 'Para enviar'], ['Para enviar', 'Enviar'],
]);

const instagram = workflow(W.instagram, '03 · Entrada Instagram (ManyChat)', [
  webhook('ManyChat', 'manychat', { auth: 'mcHook', responseNode: true }),
  code('Normalizar', ['canais'], `
const m = normalizarManychat($input.first().json.body);
if (!m) throw new Error('ManyChat sem contato_id: confira o corpo do External Request (manychat/SETUP.md)');
return [{ json: { canal: 'instagram', ...m } }];`),
  executar('Core', W.core),
  code('Resposta v2', ['canais'], `
const r = $input.first().json;
return [{ json: respostaManychat(r.mensagens, r.estado) }];`),
  responder('Responder', '={{ JSON.stringify($json) }}'),
], [['ManyChat', 'Normalizar'], ['Normalizar', 'Core'], ['Core', 'Resposta v2'], ['Resposta v2', 'Responder']]);

const admin = workflow(W.admin, '05 · Comandos do admin', [
  gatilho('Do WhatsApp'),
  webhook('Do painel', 'painel-admin', { auth: 'painel', responseNode: true }),
  code('Interpretar', ['comandos'], `
const j = $input.first().json;
const painel = !!j.body;
const texto = painel ? j.body.texto : j.texto;
const c = parseComando(texto) ?? { erro: 'Manda /ajuda pra ver os comandos.' };
return [{ json: { c, origem: painel ? 'painel' : 'whatsapp', admin: j.admin ?? null, sql: sqlComando(c, { pausaHoras: Number($env.PAUSA_HUMANO_HORAS) || 12 }) } }];`),
  pg('Executar', '={{ $json.sql }}', { alwaysOutputData: true }),
  code('Responder', ['comandos', 'canais'], `
const p = $('Interpretar').first().json;
const rows = $input.all().map((i) => i.json);
const res = formatarResposta(p.c, rows);
const out = [];
if (res.cliente?.canal === 'whatsapp') out.push({ json: { saida: 0, numero: res.cliente.contato_id, mensagens: res.cliente.mensagens } });
if (res.cliente?.canal === 'instagram') out.push({ json: { saida: 1, body: sendContentManychat(res.cliente.contato_id, res.cliente.mensagens) } });
if (p.origem === 'whatsapp') out.push({ json: { saida: 0, numero: p.admin, mensagens: [{ tipo: 'texto', texto: res.admin }] } });
else out.push({ json: { saida: 2, resposta: { ok: !p.c.erro, texto: res.admin } } });
return out;`),
  rota('Destino', 3),
  executar('Enviar', W.enviar),
  http('ManyChat sendContent', 'https://api.manychat.com/fb/sending/sendContent', '={{ JSON.stringify($json.body) }}', 'manychat', { onError: 'continueRegularOutput' }),
  responder('Resposta ao painel', '={{ JSON.stringify($json.resposta) }}'),
], [
  ['Do WhatsApp', 'Interpretar'], ['Do painel', 'Interpretar'], ['Interpretar', 'Executar'], ['Executar', 'Responder'], ['Responder', 'Destino'],
  ['Destino', 'Enviar', 0], ['Destino', 'ManyChat sendContent', 1], ['Destino', 'Resposta ao painel', 2],
]);

const agenda = workflow(W.agenda, '01 · Agenda do grupo + lembrete de story', [
  { name: 'A cada minuto', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] } } },
  pg('Vencidas', sqlAgendaVencida()),
  code('Montar', ['agenda'], `
const jitter = Math.max(1, jitterSegundos());
const out = [];
for (const { json: l } of $input.all()) {
  const { grupo, story } = mensagensAgenda(l, l.textos);
  if (grupo && l.config?.grupo_jid) out.push({ json: { numero: l.config.grupo_jid, mensagens: grupo, jitter } });
  if (story && l.config?.admin_numero) out.push({ json: { numero: l.config.admin_numero, mensagens: story, jitter } });
}
return out;`),
  espera('Jitter', '={{ $json.jitter }}'),
  executar('Enviar', W.enviar),
], [['A cada minuto', 'Vencidas'], ['Vencidas', 'Montar'], ['Montar', 'Jitter'], ['Jitter', 'Enviar']]);

const erros = workflow(W.erros, '99 · Alerta de erro', [
  { name: 'Erro', type: 'n8n-nodes-base.errorTrigger', typeVersion: 1, parameters: {} },
  code('Mensagem', ['cpf'], `
const e = $input.first().json;
const msg = mascararCpfsNoTexto(e.execution?.error?.message ?? e.trigger?.error?.message ?? 'erro desconhecido');
return [{ json: { texto: \`⚠️ Erro no bot\\n\${e.workflow?.name ?? '?'} → \${e.execution?.lastNodeExecuted ?? '?'}\\n\${msg}\`.slice(0, 600) } }];`),
  pg('Admin', "select valor as admin from app.config where chave = 'admin_numero'"),
  code('Para o admin', [], `
const admin = $input.first().json.admin;
return admin ? [{ json: { numero: admin, mensagens: [{ tipo: 'texto', texto: $('Mensagem').first().json.texto }] } }] : [];`),
  executar('Enviar', W.enviar),
], [['Erro', 'Mensagem'], ['Mensagem', 'Admin'], ['Admin', 'Para o admin'], ['Para o admin', 'Enviar']], { erro: false });

// ── saída ──────────────────────────────────────────────────────────────
const arquivos = {
  '01-agenda.json': agenda, '02-entrada-whatsapp.json': whatsapp, '03-entrada-instagram.json': instagram,
  '04-core.json': core, '05-admin.json': admin, '06-enviar.json': enviar, '99-erros.json': erros,
};
mkdirSync(join(RAIZ, 'n8n/workflows'), { recursive: true });
for (const [nome, wf] of Object.entries(arquivos)) writeFileSync(join(RAIZ, 'n8n/workflows', nome), JSON.stringify(wf, null, 2) + '\n');

const seed = Object.entries(TEXTOS_PADRAO).map(([k, v]) => `  (${lit(k)}, ${lit(v)})`).join(',\n');
writeFileSync(join(RAIZ, 'db/mensagens.sql'), `-- GERADO por scripts/build-workflows.mjs a partir de src/templates.js (TEXTOS_PADRAO).\n-- Depois da primeira subida, edite os textos no NocoDB ou no painel.\ninsert into app.mensagens (chave, texto) values\n${seed}\non conflict (chave) do nothing;\n`);

console.log(`ok: ${Object.keys(arquivos).length} workflows em n8n/workflows, ${Object.keys(TEXTOS_PADRAO).length} textos em db/mensagens.sql`);
