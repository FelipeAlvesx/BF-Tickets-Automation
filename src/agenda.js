// Agenda do grupo + lembrete de story ao admin.

import { render, varsEvento, textoBot } from './templates.js';

// Linhas da agenda vencidas agora e ainda não enviadas hoje. Linha ligada a evento desligado ou que
// já passou não sai (senão o grupo recebe anúncio de evento que o dono já tirou do ar). A trava real é o
// UNIQUE(agenda_id, data) de envios_agenda: o INSERT reivindica antes de enviar.
// Janela de 15 min: se o n8n ficou fora do ar, não despeja a manhã inteira de uma vez.
export function sqlAgendaVencida(tz = 'America/Bahia') {
  return `with agora as (select (now() at time zone '${tz}') as t),
vencidas as (
  select a.id from app.agenda a left join app.eventos e on e.id = a.evento_id, agora
  where a.ativo and (a.evento_id is null or (e.ativo and e.data_evento > now())) and extract(dow from agora.t)::int = any(a.dias_semana)
    and a.horario <= agora.t::time and a.horario > (agora.t - interval '15 minutes')::time
),
reivindicadas as (
  insert into app.envios_agenda (agenda_id, data)
  select v.id, (select t::date from agora) from vencidas v
  on conflict (agenda_id, data) do nothing returning agenda_id
)
select a.*, to_jsonb(e) as evento,
  (select coalesce(jsonb_object_agg(chave, valor), '{}') from app.config) as config,
  (select coalesce(jsonb_object_agg(chave, texto), '{}') from app.mensagens) as textos
from reivindicadas r join app.agenda a on a.id=r.agenda_id left join app.eventos e on e.id=a.evento_id`;
}

// Imagem enviada pelo painel fica em /img/<id>.jpg; a Evolution busca pela rede interna do compose.
const PAINEL_INTERNO = 'http://painel:8080';

// Monta as mensagens de uma linha: {grupo: [...] | null, story: [...] | null}.
export function mensagensAgenda(linha, textos = {}) {
  const e = linha.evento ?? null;
  const legenda = render(linha.texto ?? '', varsEvento(e));
  const url = linha.imagem_url || e?.imagem_url || null;
  const imagem = url?.startsWith('/img/') ? PAINEL_INTERNO + url : url;
  const grupo = linha.enviar_grupo ? [imagem ? { tipo: 'imagem', url: imagem, texto: legenda } : { tipo: 'texto', texto: legenda }] : null;
  let story = null;
  if (linha.lembrete_story) {
    const aviso = textoBot(textos, 'admin_story');
    story = [imagem ? { tipo: 'imagem', url: imagem, texto: aviso } : { tipo: 'texto', texto: aviso }, { tipo: 'texto', texto: legenda }];
    if (e?.link_compra) story.push({ tipo: 'texto', texto: e.link_compra });
  }
  return { grupo, story };
}

// Jitter de 0–60 s nos envios do grupo (anti-ban).
export function jitterSegundos(aleatorio = Math.random) {
  return Math.floor(aleatorio() * 61);
}
