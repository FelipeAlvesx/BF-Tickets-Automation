// Comandos do admin (/aprovar, /recusar, /pedidos, /pausar, /retomar, /eventos, /ajuda):
// parse -> SQL -> texto de resposta. O painel usa o mesmo caminho.

import { soDigitos, mascararCpf } from './cpf.js';
import { textoBot, formatarPreco, formatarData } from './templates.js';
import { lit } from './sql.js';
import { variantesNumero } from './canais.js';

export const AJUDA = [
  'Comandos:',
  '/pedidos — pedidos em aberto',
  '/aprovar <id> — aprova e avisa o cliente',
  '/recusar <id> [motivo] — recusa e avisa o cliente',
  '/pausar <tel> — pausa o bot nesse chat',
  '/retomar <tel> — devolve o chat ao bot',
  '/eventos — eventos ativos',
  '/ajuda — esta lista',
].join('\n');

// 71 99999-9999 -> 5571999999999; ids longos (Instagram) passam direto.
export function normalizarContato(s) {
  const d = soDigitos(s);
  if (d.length === 10 || d.length === 11) return '55' + d;
  return d.length >= 12 ? d : null;
}

export function parseComando(texto) {
  const m = String(texto ?? '').trim().match(/^\/(\w+)\s*([\s\S]*)$/);
  if (!m) return null;
  const cmd = m[1].toLowerCase();
  const resto = m[2].trim();
  switch (cmd) {
    case 'aprovar':
    case 'recusar': {
      const r = resto.match(/^#?(\d+)\s*([\s\S]*)$/);
      if (!r) return { erro: `Uso: /${cmd} <id>${cmd === 'recusar' ? ' [motivo]' : ''}` };
      return cmd === 'aprovar' ? { cmd, id: Number(r[1]) } : { cmd, id: Number(r[1]), motivo: r[2].trim() || null };
    }
    case 'pausar':
    case 'retomar': {
      const contato = normalizarContato(resto);
      return contato ? { cmd, contato } : { erro: `Uso: /${cmd} <telefone com DDD>` };
    }
    case 'pedidos':
    case 'eventos':
    case 'ajuda':
      return { cmd };
    default:
      return { erro: 'Comando desconhecido. Manda /ajuda.' };
  }
}

const TEXTOS = '(select coalesce(jsonb_object_agg(chave, texto), \'{}\') from app.mensagens) as textos';
const ABERTOS = "('aguardando_comprovante','coletando_dados','aguardando_validacao')";

// SQL que executa o comando (um statement; devolve linhas para formatarResposta).
export function sqlComando(c, { pausaHoras = 12 } = {}) {
  switch (c.cmd) {
    case 'aprovar':
    case 'recusar': {
      const status = c.cmd === 'aprovar' ? 'aprovado' : 'recusado';
      return `with p as (update app.pedidos set status=${lit(status)}, motivo_recusa=${lit(c.motivo ?? null)}, atualizado_em=now()
  where id=${Number(c.id)} and status in ${ABERTOS} returning *),
cv as (update app.conversas cv set estado='inicio', contexto='{}'::jsonb, atualizado_em=now()
  from p where cv.canal=p.canal and cv.contato_id=p.contato_id and cv.contexto->>'pedido_id'=p.id::text)
select p.id, p.canal, p.contato_id, p.quantidade, p.valor_total, p.status, p.motivo_recusa, e.nome as evento, ${TEXTOS}
from p left join app.eventos e on e.id=p.evento_id`;
    }
    case 'pedidos':
      return `select p.id, p.canal, p.contato_id, p.quantidade, p.valor_total, p.status, p.nome, p.cpf, e.nome as evento
from app.pedidos p left join app.eventos e on e.id=p.evento_id where p.status in ${ABERTOS} order by p.id limit 30`;
    case 'pausar':
      return `with u as (update app.conversas set estado='humano', pausado_ate=now()+make_interval(hours=>${Number(pausaHoras)}), atualizado_em=now()
  where contato_id = any(array[${variantesNumero(c.contato).map(lit).join(',')}]) returning canal),
i as (insert into app.conversas (canal, contato_id, estado, pausado_ate)
  select 'whatsapp', ${lit(c.contato)}, 'humano', now()+make_interval(hours=>${Number(pausaHoras)}) where not exists (select 1 from u) returning canal)
select canal from u union all select canal from i`;
    case 'retomar':
      return `update app.conversas set estado='inicio', contexto='{}'::jsonb, pausado_ate=null, atualizado_em=now()
where contato_id = any(array[${variantesNumero(c.contato).map(lit).join(',')}]) returning canal`;
    case 'eventos':
      return 'select id, nome, data_evento, local, preco from app.eventos where ativo order by data_evento';
    default:
      return 'select 1 where false';
  }
}

// rows = resultado do SQL. Devolve {admin: texto, cliente: {canal, contato_id, mensagens} | null}.
export function formatarResposta(c, rows = []) {
  rows = rows.filter((r) => r && Object.keys(r).length);
  if (c.erro) return { admin: c.erro, cliente: null };
  switch (c.cmd) {
    case 'ajuda':
      return { admin: AJUDA, cliente: null };
    case 'aprovar':
    case 'recusar': {
      const p = rows[0];
      if (!p) return { admin: `Pedido #${c.id} não encontrado ou já finalizado.`, cliente: null };
      const chave = c.cmd === 'aprovar' ? 'pedido_aprovado' : 'pedido_recusado';
      const txt = textoBot(p.textos, chave, { pedido_id: p.id, evento: p.evento ?? '', motivo: p.motivo_recusa ? ` Motivo: ${p.motivo_recusa}.` : '' });
      return {
        admin: `Pedido #${p.id} ${p.status} ✅ ${p.canal === 'instagram' ? 'Aviso ao cliente enviado pelo Instagram (se falhar, chega um alerta aqui).' : 'Cliente avisado (whatsapp).'}`,
        cliente: { canal: p.canal, contato_id: p.contato_id, mensagens: [{ tipo: 'texto', texto: txt }] },
      };
    }
    case 'pedidos':
      if (!rows.length) return { admin: 'Nenhum pedido em aberto 🎉', cliente: null };
      return {
        admin: rows.map((p) => `#${p.id} · ${p.status}\n${p.quantidade}x ${p.evento ?? '?'} = ${formatarPreco(p.valor_total)}\n${p.canal} ${p.contato_id}${p.nome ? ` · ${p.nome}` : ''}${p.cpf ? ` · ${mascararCpf(p.cpf)}` : ''}`).join('\n\n'),
        cliente: null,
      };
    case 'pausar':
      return { admin: rows.length ? `Bot pausado para ${c.contato} (${rows.map((r) => r.canal).join(', ')}).` : `Não achei ${c.contato}.`, cliente: null };
    case 'retomar':
      return { admin: rows.length ? `Bot de volta para ${c.contato} ✅` : `Não achei conversa com ${c.contato}.`, cliente: null };
    case 'eventos':
      if (!rows.length) return { admin: 'Nenhum evento ativo.', cliente: null };
      return { admin: rows.map((e) => `#${e.id} ${e.nome}\n${formatarData(e.data_evento)} · ${e.local ?? ''} · ${formatarPreco(e.preco)}`).join('\n\n'), cliente: null };
    default:
      return { admin: AJUDA, cliente: null };
  }
}
