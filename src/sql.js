// Monta o SQL que grava o resultado do core num único statement (CTEs).
// Literais escapados aqui (standard_conforming_strings=on, padrão do Postgres).

import { mascararCpfsNoTexto } from './cpf.js';

export function lit(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return `${lit(JSON.stringify(v))}::jsonb`;
  const s = String(v).replace(/\0/g, '').replace(/'/g, "''");
  // O node Postgres do n8n formata a query com pg-promise: "$1" num texto de cliente viraria
  // placeholder. Texto com $ vai como U&'' com o $ em \0024.
  if (!s.includes('$')) return `'${s}'`;
  return `U&'${s.replace(/\\/g, '\\\\').replace(/\$/g, '\\0024')}'`;
}

const COLUNAS_PEDIDO = ['comprovante_url', 'nome', 'cpf', 'email', 'telefone', 'status'];

// ctx = entrada do core; r = resultado de processar(). Devolve 1 linha: {pedido_id}.
export function sqlGravar(ctx, r) {
  const ctes = [];
  const { novoPedido, atualizarPedido, novaOferta } = r.efeitos ?? {};
  const canal = lit(ctx.canal);
  const contato = lit(ctx.contato_id);

  if (novoPedido) {
    const p = novoPedido;
    ctes.push(`np as (insert into app.pedidos (canal, contato_id, evento_id, quantidade, valor_total, forma, status)
  values (${canal}, ${contato}, ${lit(p.evento_id)}, ${lit(p.quantidade)}, ${lit(p.valor_total)}, ${lit(p.forma)}, ${lit(p.status)}) returning id)`);
  }
  if (atualizarPedido?.id) {
    const sets = COLUNAS_PEDIDO.filter((k) => k in atualizarPedido).map((k) => `${k}=${lit(atualizarPedido[k])}`);
    ctes.push(`up as (update app.pedidos set ${sets.join(', ')}, atualizado_em=now()
  where id=${Number(atualizarPedido.id)} and canal=${canal} and contato_id=${contato} and status not in ('aprovado','recusado','cancelado'))`);
  }
  if (novaOferta) {
    const o = novaOferta;
    ctes.push(`nov as (insert into app.ofertas_venda (canal, contato_id, evento_texto, quantidade, setor, valor_pedido)
  values (${canal}, ${contato}, ${lit(o.evento_texto)}, ${lit(o.quantidade)}, ${lit(o.setor)}, ${lit(o.valor_pedido)}))`);
  }
  const hist = [];
  const entrada = [ctx.midia ? `[${ctx.midia.tipo}]` : '', ctx.texto ?? ''].filter(Boolean).join(' ');
  if (entrada) hist.push(['in', entrada]);
  for (const m of r.mensagens ?? []) hist.push(['out', m.texto ?? m.url ?? '']);
  if (hist.length) {
    ctes.push(`h as (insert into app.historico (canal, contato_id, direcao, texto) values
  ${hist.map(([d, t]) => `(${canal}, ${contato}, ${lit(d)}, ${lit(mascararCpfsNoTexto(t))})`).join(',\n  ')})`);
  }
  const ctxJson = lit(r.contexto ?? {});
  const ctxFinal = novoPedido ? `${ctxJson} || jsonb_build_object('pedido_id', (select id from np))` : ctxJson;
  ctes.push(`cv as (insert into app.conversas (canal, contato_id, nome, estado, contexto, pausado_ate, atualizado_em)
  values (${canal}, ${contato}, ${lit(ctx.nome || null)}, ${lit(r.estado)}, ${ctxFinal}, ${lit(r.pausado_ate)}, now())
  on conflict (canal, contato_id) do update set nome=coalesce(excluded.nome, app.conversas.nome), estado=excluded.estado,
  contexto=excluded.contexto, pausado_ate=excluded.pausado_ate, atualizado_em=now())`);
  return `with ${ctes.join(',\n')}\nselect ${novoPedido ? '(select id from np)' : 'null::int'} as pedido_id`;
}

// Tudo que o core precisa numa ida ao banco: conversa, eventos ativos, textos e config.
export function sqlCarregar(canal, contatoId) {
  return `select
  (select to_jsonb(c) from app.conversas c where c.canal=${lit(canal)} and c.contato_id=${lit(contatoId)}) as conversa,
  (select coalesce(jsonb_agg(to_jsonb(e) order by e.data_evento), '[]') from app.eventos e where e.ativo) as eventos,
  (select coalesce(jsonb_object_agg(chave, texto), '{}') from app.mensagens) as textos,
  (select coalesce(jsonb_object_agg(chave, valor), '{}') from app.config) as config,
  now() as agora`;
}
