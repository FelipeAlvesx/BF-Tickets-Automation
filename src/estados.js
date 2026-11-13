// Máquina de estados do atendimento (canal-agnóstica, determinística).
// processar(ctx) -> {precisaLLM, llm} quando o texto livre é ambíguo;
// processar(ctx, respostaLLM) -> {mensagens, acoes, estado, contexto, pausado_ate, efeitos}.
// respostaLLM = objeto cru da API (ou {} se a chamada falhou).

import { textoBot, varsEvento, listaEventos, formatarPreco } from './templates.js';
import { atalhos, intencaoGlobal, opcaoMenu, extrairQuantidade, acharEvento, normalizar, pedidoLLM, lerRespostaLLM } from './extrator.js';
import { validarCpf, validarEmail, soDigitos, formatarCpf, mascararCpf } from './cpf.js';

export const MAX_QTD = 10;
const CONFIANCA_MIN = 0.6;
const EXPIRA_MS = 24 * 3600 * 1000;
const PRECISA_LLM = Symbol('precisa_llm');
const ESTADOS_COM_PEDIDO = ['aguardando_comprovante', 'coletando_nome', 'coletando_cpf', 'coletando_email'];

export function processar(ctx, respostaLLM) {
  try {
    return executar(ctx, respostaLLM);
  } catch (e) {
    if (e !== PRECISA_LLM) throw e;
    const conv = ctx.conversa ?? {};
    return { precisaLLM: true, llm: pedidoLLM({ prompt: ctx.prompt ?? '', modelo: ctx.modelo, texto: ctx.texto, estado: conv.estado ?? 'inicio', eventos: ctx.eventos ?? [] }) };
  }
}

function executar(ctx, respostaLLM) {
  const agora = new Date(ctx.agora ?? Date.now());
  const cfg = ctx.config ?? {};
  const eventos = ctx.eventos ?? [];
  const textos = ctx.textos ?? {};
  const conv = ctx.conversa ?? {};
  const t = String(ctx.texto ?? '').trim();
  const midia = ctx.midia ?? null;

  let estado = conv.estado || 'inicio';
  let c = { ...(conv.contexto ?? {}) };
  let pausado_ate = conv.pausado_ate ?? null;
  const mensagens = [];
  const admin = [];
  const efeitos = {};
  const msg = (chave, vars = {}) => mensagens.push({ tipo: 'texto', texto: textoBot(textos, chave, vars) });
  const fim = () => ({ mensagens, acoes: admin.length ? [{ tipo: 'avisar_admin', mensagens: admin }] : [], estado, contexto: c, pausado_ate, efeitos });

  // Bot desligado ou chat pausado: só registra.
  if (String(cfg.bot_ligado) === 'false') return fim();
  if (pausado_ate && new Date(pausado_ate) > agora) return fim();
  pausado_ate = null;
  if (estado === 'humano' || (conv.atualizado_em && agora - new Date(conv.atualizado_em) > EXPIRA_MS)) {
    estado = 'inicio';
    c = {};
  }

  const evento = (id) => eventos.find((e) => Number(e.id) === Number(id)) ?? null;
  const unico = () => (eventos.length === 1 ? eventos[0] : null);
  const contato = ctx.contato_id;
  const primeiroNome = (ctx.nome ?? '').trim().split(/\s+/)[0];
  const vPedido = () => {
    const e = evento(c.evento_id);
    return { pedido_id: c.pedido_id, evento: e?.nome ?? c.evento_nome ?? '', quantidade: c.quantidade, total: formatarPreco(c.total) };
  };

  // ── ações reutilizáveis ──
  const humano = () => {
    estado = 'humano';
    const horas = Number(cfg.pausa_humano_horas) || 12;
    pausado_ate = new Date(agora.getTime() + horas * 3600 * 1000).toISOString();
    c.falhas = 0;
    msg('chamando_humano');
    admin.push({ tipo: 'texto', texto: textoBot(textos, 'admin_humano', { canal: ctx.canal, contato, nome: ctx.nome ?? '' }) });
  };
  const boasVindas = () => msg('boas_vindas', { nome_cliente: primeiroNome ? `, ${primeiroNome}` : '' });
  const cancelar = () => {
    if (c.pedido_id && ESTADOS_COM_PEDIDO.includes(estado)) efeitos.atualizarPedido = { id: c.pedido_id, status: 'cancelado' };
    estado = 'inicio';
    c = {};
    msg('cancelado');
  };
  const listar = () => {
    if (!eventos.length) return humanoSemEventos();
    msg('lista_eventos', { lista_eventos: listaEventos(eventos) });
  };
  // Não sabe responder: passa para humano, com o texto de "sem eventos" no lugar de "chamando_humano".
  const humanoSemEventos = () => {
    humano();
    mensagens[mensagens.length - 1] = { tipo: 'texto', texto: textoBot(textos, 'sem_eventos') };
  };
  const duvida = (id) => {
    const e = evento(id) ?? evento(c.evento_id) ?? unico();
    if (e) return msg('info_evento', varsEvento(e));
    if (eventos.length) return listar();
    humanoSemEventos();
  };
  const reperguntar = () => {
    const e = evento(c.evento_id);
    if (estado === 'escolhendo_evento') msg('escolher_evento', { lista_eventos: listaEventos(eventos) });
    else if (estado === 'escolhendo_qtd') msg('pedir_qtd', { evento: e?.nome, preco: formatarPreco(e?.preco) });
    else if (estado === 'escolhendo_pagamento') msg('escolher_pagamento', vPedido());
    else if (estado === 'aguardando_comprovante') msg('lembrar_comprovante');
    else if (estado === 'inicio') boasVindas();
  };
  const falha = () => {
    c.falhas = (c.falhas ?? 0) + 1;
    if (c.falhas >= 2) return humano();
    msg('nao_entendi');
    reperguntar();
  };
  const extrair = () => {
    const a = atalhos(t, eventos);
    if (a) return a;
    if (respostaLLM === undefined) throw PRECISA_LLM;
    return lerRespostaLLM(respostaLLM, eventos);
  };
  // Intenções que valem nos estados de texto livre. true = tratou.
  const tratarIntencao = (e) => {
    switch (e.intencao) {
      case 'cancelar': cancelar(); return true;
      case 'humano': case 'duvida_outra': humano(); return true;
      case 'listar_eventos': listar(); if (estado !== 'inicio') reperguntar(); return true;
      case 'duvida_evento': duvida(e.evento_id); if (estado !== 'inicio') reperguntar(); return true;
      case 'vender': iniciarVenda(e.evento_id); return true;
      default: return false;
    }
  };
  const iniciarCompra = (eventoId, qtd) => {
    if (!eventos.length) return humanoSemEventos();
    const e = evento(eventoId) ?? evento(c.evento_id) ?? unico();
    if (qtd) c.quantidade_pedida = qtd;
    if (!e) {
      estado = 'escolhendo_evento';
      return msg('escolher_evento', { lista_eventos: listaEventos(eventos) });
    }
    c.evento_id = e.id;
    c.evento_nome = e.nome;
    const q = qtd ?? c.quantidade_pedida;
    if (q >= 1 && q <= MAX_QTD) return irParaPagamento(e, q);
    estado = 'escolhendo_qtd';
    msg('pedir_qtd', { evento: e.nome, preco: formatarPreco(e.preco) });
  };
  const irParaPagamento = (e, q) => {
    c.quantidade = q;
    c.total = Math.round(Number(e.preco) * q * 100) / 100;
    delete c.quantidade_pedida;
    estado = 'escolhendo_pagamento';
    msg('escolher_pagamento', vPedido());
  };
  const iniciarVenda = (eventoId) => {
    estado = 'venda_coletando';
    c = { falhas: 0, venda: {} };
    const e = evento(eventoId);
    if (e) {
      c.venda.evento_texto = e.nome;
      c.venda.etapa = 'quantidade';
      return msg('venda_qtd');
    }
    c.venda.etapa = 'evento';
    msg('venda_evento');
  };

  // ── mídia ──
  if (midia) {
    const comprovante = midia.tipo === 'imagem' || (midia.tipo === 'documento' && /pdf/i.test(midia.mimetype ?? 'pdf'));
    if (!comprovante) {
      msg('midia_nao_suportada');
      return fim();
    }
    if (estado === 'aguardando_comprovante') {
      efeitos.atualizarPedido = { id: c.pedido_id, comprovante_url: midia.url ?? midia.ref ?? null, status: 'coletando_dados' };
      admin.push({ ...midia, texto: textoBot(textos, 'admin_comprovante', { ...vPedido(), canal: ctx.canal, contato }) });
      estado = 'coletando_nome';
      msg('comprovante_recebido');
      return fim();
    }
    // Mídia fora de hora (outro comprovante, print...): repassa para um humano.
    admin.push({ ...midia, texto: `📎 Anexo de ${ctx.canal} · ${contato} (${ctx.nome ?? ''}) no estado ${estado}` });
    humano();
    return fim();
  }
  if (!t) return fim();

  // ── intenções globais (keywords, valem em qualquer estado) ──
  const g = intencaoGlobal(t);
  if (g === 'cancelar') { cancelar(); return fim(); }
  if (g === 'humano') { humano(); return fim(); }
  if (g === 'listar_eventos') { listar(); if (estado !== 'inicio') reperguntar(); return fim(); }

  switch (estado) {
    case 'inicio': {
      const op = opcaoMenu(t);
      if (op === 1) iniciarCompra();
      else if (op === 2) iniciarVenda();
      else if (op === 3) listar();
      else if (op === 4) humano();
      else {
        const e = extrair();
        if (e.intencao === 'comprar') { c.falhas = 0; iniciarCompra(e.evento_id, e.quantidade); }
        else if (tratarIntencao(e)) { /* tratado */ }
        else if (e.intencao === 'saudacao' || e.confianca >= CONFIANCA_MIN) boasVindas();
        else falha();
      }
      break;
    }
    case 'escolhendo_evento': {
      const op = opcaoMenu(t);
      let e = op ? eventos[op - 1] : acharEvento(t, eventos);
      if (!e) {
        const x = extrair();
        e = evento(x.evento_id);
        if (!e && tratarIntencao(x)) break;
      }
      if (e) { c.falhas = 0; iniciarCompra(e.id); } else falha();
      break;
    }
    case 'escolhendo_qtd': {
      let q = extrairQuantidade(t);
      if (q === null) {
        const x = extrair();
        if (x.quantidade) q = x.quantidade;
        else if (tratarIntencao(x)) break;
      }
      if (q === null) falha();
      else if (q < 1 || q > MAX_QTD) msg('qtd_invalida', { max: MAX_QTD });
      else { c.falhas = 0; irParaPagamento(evento(c.evento_id), q); }
      break;
    }
    case 'escolhendo_pagamento': {
      const n = normalizar(t);
      const op = opcaoMenu(t);
      const e = evento(c.evento_id);
      if (op === 2 || /\bpix\b/.test(n)) {
        efeitos.novoPedido = { evento_id: e.id, quantidade: c.quantidade, valor_total: c.total, forma: 'pix', status: 'aguardando_comprovante' };
        estado = 'aguardando_comprovante';
        c.falhas = 0;
        msg('resumo_pix', vPedido());
        mensagens.push({ tipo: 'texto', texto: String(cfg.pix_chave ?? '') });
        // No Instagram quem pede o comprovante é a coleta de imagem do ManyChat, aberta logo depois
        // desta resposta: assim a primeira foto do cliente já é capturada (sem mandar duas vezes).
        msg(ctx.canal === 'instagram' ? 'pix_titular' : 'pix_instrucao', { pix_titular: cfg.pix_titular ?? '', pix_banco: cfg.pix_banco ?? '' });
      } else if (op === 1 || /\b(link|cartao|credito|site)\b/.test(n)) {
        msg('enviar_link');
        mensagens.push({ tipo: 'texto', texto: e.link_compra });
        msg('link_fim');
        estado = 'inicio';
        c = {};
      } else {
        const x = extrair();
        if (!tratarIntencao(x)) falha();
      }
      break;
    }
    case 'aguardando_comprovante': {
      const a = atalhos(t, eventos);
      if (!(a && ['duvida_evento', 'vender'].includes(a.intencao) && tratarIntencao(a))) msg('lembrar_comprovante');
      break;
    }
    case 'coletando_nome': {
      const nome = t.replace(/^(meu nome (e|é)|me chamo|sou o|sou a)\s+/i, '').replace(/\s+/g, ' ').trim();
      if (/^[\p{L}'’.-]+(\s[\p{L}'’.-]+)+$/u.test(nome) && nome.length <= 100) {
        c.nome_completo = nome;
        efeitos.atualizarPedido = { id: c.pedido_id, nome };
        estado = 'coletando_cpf';
        msg('pedir_cpf');
      } else msg('nome_invalido');
      break;
    }
    case 'coletando_cpf': {
      const m = t.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
      const cpf = m ? soDigitos(m[0]) : soDigitos(t);
      if (validarCpf(cpf)) {
        c.cpf_mascarado = mascararCpf(cpf); // CPF inteiro só em pedidos
        efeitos.atualizarPedido = { id: c.pedido_id, cpf: formatarCpf(cpf) };
        estado = 'coletando_email';
        msg('pedir_email');
      } else msg('cpf_invalido');
      break;
    }
    case 'coletando_email': {
      const email = (t.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i) ?? [''])[0].toLowerCase();
      if (validarEmail(email)) {
        efeitos.atualizarPedido = { id: c.pedido_id, email, status: 'aguardando_validacao' };
        estado = 'aguardando_validacao';
        msg('aguardando_validacao', vPedido());
        admin.push({ tipo: 'texto', texto: textoBot(textos, 'admin_validar', { ...vPedido(), nome_cliente_completo: c.nome_completo, cpf_mascarado: c.cpf_mascarado, email }) });
      } else msg('email_invalido');
      break;
    }
    case 'aguardando_validacao':
      msg('ainda_validando', vPedido());
      break;
    case 'venda_coletando': {
      const v = (c.venda ??= { etapa: 'evento' });
      if (v.etapa === 'evento') {
        v.evento_texto = acharEvento(t, eventos)?.nome ?? t;
        v.etapa = 'quantidade';
        msg('venda_qtd');
      } else if (v.etapa === 'quantidade') {
        const q = extrairQuantidade(t);
        if (q >= 1) { v.quantidade = q; v.etapa = 'setor'; msg('venda_setor'); } else msg('venda_qtd');
      } else if (v.etapa === 'setor') {
        v.setor = t;
        v.etapa = 'valor';
        msg('venda_valor');
      } else {
        const valor = lerValor(t);
        if (valor === null) { msg('venda_valor'); break; }
        efeitos.novaOferta = { evento_texto: v.evento_texto, quantidade: v.quantidade, setor: v.setor, valor_pedido: valor };
        admin.push({ tipo: 'texto', texto: textoBot(textos, 'admin_venda', { canal: ctx.canal, contato, nome: ctx.nome ?? '', evento_texto: v.evento_texto, quantidade: v.quantidade, setor: v.setor, valor: formatarPreco(valor) }) });
        msg('venda_registrada');
        estado = 'inicio';
        c = {};
      }
      break;
    }
    default:
      estado = 'inicio';
      c = {};
      boasVindas();
  }
  return fim();
}

// "R$ 1.250,50", "250", "200 reais" -> número
export function lerValor(texto) {
  const m = String(texto).match(/\d[\d.,]*/);
  if (!m) return null;
  let s = m[0];
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}
