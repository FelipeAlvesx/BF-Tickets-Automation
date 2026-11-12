import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processar, lerValor } from './estados.js';
import { sqlGravar, lit } from './sql.js';

const EVENTOS = [
  { id: 1, nome: 'Festival Verão Bahia', data_evento: '2026-12-20T22:00:00-03:00', local: 'Arena Fonte Nova', link_compra: 'https://bf.example/verao', preco: '150.00' },
  { id: 2, nome: 'Pagode do Rio Vermelho', data_evento: '2026-12-05T20:00:00-03:00', local: 'Largo da Mariquita', link_compra: 'https://bf.example/pagode', preco: '60' },
];
const CONFIG = { pix_chave: 'pix@bf.example', pix_titular: 'BF Tickets', pix_banco: 'Nubank', pausa_humano_horas: '12', bot_ligado: 'true' };
const AGORA = '2026-11-12T12:00:00.000Z';

// Simula uma conversa: aplica cada mensagem no estado devolvido pela anterior.
function conversa(entradas, { eventos = EVENTOS, llm } = {}) {
  let conv = null;
  const saidas = [];
  for (const e of entradas) {
    const ctx = { canal: 'whatsapp', contato_id: '5571999990000', nome: 'Ana Souza', agora: AGORA, eventos, config: CONFIG, textos: {}, conversa: conv, ...(typeof e === 'string' ? { texto: e } : e) };
    let r = processar(ctx);
    if (r.precisaLLM) r = processar(ctx, llm ? llm(ctx) : {});
    saidas.push(r);
    conv = { estado: r.estado, contexto: { ...r.contexto, ...(r.efeitos.novoPedido ? { pedido_id: 42 } : {}) }, pausado_ate: r.pausado_ate, atualizado_em: AGORA };
  }
  return saidas;
}
const textos = (r) => r.mensagens.map((m) => m.texto).join('\n');
const respostaLLM = (json) => ({ choices: [{ message: { content: JSON.stringify(json) } }] });

test('fluxo Pix completo', () => {
  const s = conversa(['oi', '1', '1', '2', 'pix', { midia: { tipo: 'imagem', mimetype: 'image/jpeg', ref: 'wa:ABC' } }, 'Ana Maria Souza', '529.982.247-25', 'ana@exemplo.com', 'e aí?']);
  assert.equal(s[0].estado, 'inicio');
  assert.match(textos(s[0]), /Oi, Ana!/);
  assert.equal(s[1].estado, 'escolhendo_evento');
  assert.equal(s[2].estado, 'escolhendo_qtd');
  assert.match(textos(s[2]), /Festival Verão Bahia — R\$ 150,00/);
  assert.equal(s[3].estado, 'escolhendo_pagamento');
  assert.match(textos(s[3]), /2x Festival Verão Bahia = R\$ 300,00/);
  // Pix: resumo, chave isolada, instrução
  assert.equal(s[4].estado, 'aguardando_comprovante');
  assert.deepEqual(s[4].efeitos.novoPedido, { evento_id: 1, quantidade: 2, valor_total: 300, forma: 'pix', status: 'aguardando_comprovante' });
  assert.equal(s[4].mensagens.length, 3);
  assert.equal(s[4].mensagens[1].texto, 'pix@bf.example');
  // comprovante -> admin com mídia + resumo
  assert.equal(s[5].estado, 'coletando_nome');
  assert.equal(s[5].efeitos.atualizarPedido.status, 'coletando_dados');
  assert.equal(s[5].efeitos.atualizarPedido.comprovante_url, 'wa:ABC');
  const adm = s[5].acoes[0].mensagens[0];
  assert.equal(adm.tipo, 'imagem');
  assert.match(adm.texto, /pedido #42/);
  assert.equal(s[6].estado, 'coletando_cpf');
  assert.equal(s[7].estado, 'coletando_email');
  assert.equal(s[7].efeitos.atualizarPedido.cpf, '529.982.247-25');
  assert.ok(!JSON.stringify(s[7].contexto).includes('529.982.247-25'), 'CPF inteiro não fica no contexto');
  assert.equal(s[8].estado, 'aguardando_validacao');
  assert.equal(s[8].efeitos.atualizarPedido.status, 'aguardando_validacao');
  const validar = s[8].acoes[0].mensagens[0].texto;
  assert.match(validar, /\/aprovar 42/);
  assert.match(validar, /\*\*\*\.982\.247-\*\*/);
  assert.match(textos(s[9]), /#42 ainda está em validação/);
});

test('fluxo link termina e volta ao início', () => {
  const s = conversa(['quero 3 ingressos pro pagode', 'link']);
  assert.equal(s[0].estado, 'escolhendo_pagamento');
  assert.match(textos(s[0]), /3x Pagode do Rio Vermelho = R\$ 180,00/);
  assert.equal(s[1].estado, 'inicio');
  assert.equal(s[1].mensagens[1].texto, 'https://bf.example/pagode');
  assert.deepEqual(s[1].contexto, {});
});

test('evento único pula escolhendo_evento', () => {
  const s = conversa(['quero comprar ingresso'], { eventos: [EVENTOS[0]] });
  assert.equal(s[0].estado, 'escolhendo_qtd');
});

test('quantidade inválida e CPF/e-mail inválidos não avançam', () => {
  const s = conversa(['1', '1', '50', 'dois', 'pix', { midia: { tipo: 'documento', mimetype: 'application/pdf', ref: 'wa:X' } }, 'Ana', 'Ana Souza', '111.111.111-11', '123.456.789-00', '52998224725', 'ana@', 'ana@ex.com']);
  assert.equal(s[2].estado, 'escolhendo_qtd');
  assert.match(textos(s[2]), /de 1 a 10/);
  assert.equal(s[3].estado, 'escolhendo_pagamento');
  assert.equal(s[6].estado, 'coletando_nome', 'nome sem sobrenome');
  assert.equal(s[8].estado, 'coletando_cpf', 'CPF repetido');
  assert.equal(s[9].estado, 'coletando_cpf', 'dígito errado');
  assert.equal(s[10].estado, 'coletando_email');
  assert.equal(s[11].estado, 'coletando_email');
  assert.equal(s[12].estado, 'aguardando_validacao');
});

test('texto sem comprovante só lembra; áudio não suportado', () => {
  const s = conversa(['1', '1', '1', 'pix', 'já paguei', { midia: { tipo: 'audio' } }]);
  assert.equal(s[4].estado, 'aguardando_comprovante');
  assert.match(textos(s[4]), /aguardando o comprovante/);
  assert.equal(s[5].estado, 'aguardando_comprovante');
  assert.match(textos(s[5]), /só consigo ler texto/);
});

test('intenções globais: cancelar cancela o pedido aberto', () => {
  const s = conversa(['1', '1', '1', 'pix', 'cancelar']);
  assert.equal(s[4].estado, 'inicio');
  assert.deepEqual(s[4].efeitos.atualizarPedido, { id: 42, status: 'cancelado' });
});

test('intenções globais: atendente pausa e avisa admin', () => {
  const s = conversa(['1', 'quero falar com atendente', 'oi?']);
  assert.equal(s[1].estado, 'humano');
  assert.equal(s[1].pausado_ate, '2026-11-13T00:00:00.000Z');
  assert.match(s[1].acoes[0].mensagens[0].texto, /pediu atendente/);
  assert.equal(s[2].mensagens.length, 0, 'pausado não responde');
});

test('intenções globais: listar eventos no meio do fluxo repergunta', () => {
  const s = conversa(['1', '1', 'eventos']);
  assert.equal(s[2].estado, 'escolhendo_qtd');
  assert.match(textos(s[2]), /Eventos com ingresso/);
  assert.match(textos(s[2]), /Quantos ingressos/);
});

test('dúvida responde só com dados do banco; sem eventos passa para humano', () => {
  const s = conversa(['onde vai ser o festival verão?']);
  assert.match(textos(s[0]), /Arena Fonte Nova/);
  assert.match(textos(s[0]), /https:\/\/bf\.example\/verao/);
  const v = conversa(['qual o preço?'], { eventos: [] });
  assert.equal(v[0].estado, 'humano');
  assert.match(textos(v[0]), /não temos eventos/);
});

test('quero vender: coleta e registra oferta', () => {
  const s = conversa(['quero vender meu ingresso do pagode', '2', 'pista', 'R$ 80,00']);
  assert.equal(s[0].estado, 'venda_coletando');
  assert.match(textos(s[0]), /Quantos/);
  assert.equal(s[3].estado, 'inicio');
  assert.deepEqual(s[3].efeitos.novaOferta, { evento_texto: 'Pagode do Rio Vermelho', quantidade: 2, setor: 'pista', valor_pedido: 80 });
  assert.match(s[3].acoes[0].mensagens[0].texto, /Oferta de venda/);
});

test('texto ambíguo pede LLM; baixa confiança 2x passa para humano', () => {
  const ctx = { canal: 'instagram', contato_id: '99', texto: 'blz e aquele role la', agora: AGORA, eventos: EVENTOS, config: CONFIG, textos: {}, prompt: 'P', modelo: 'm' };
  const r = processar(ctx);
  assert.equal(r.precisaLLM, true);
  assert.equal(r.llm.temperature, 0);
  assert.equal(r.llm.model, 'm');
  const baixa = () => respostaLLM({ intencao: 'outro', confianca: 0.2 });
  const s = conversa(['hmm aquele role', 'sei la mano'], { llm: baixa });
  assert.equal(s[0].estado, 'inicio');
  assert.match(textos(s[0]), /Não entendi/);
  assert.equal(s[1].estado, 'humano');
});

test('LLM extrai evento e quantidade; valores fora do contrato são ignorados', () => {
  const s = conversa(['bora naquele role da fonte nova eu e minha mina'], { llm: () => respostaLLM({ intencao: 'comprar', evento_id: 1, quantidade: 2, confianca: 0.9 }) });
  assert.equal(s[0].estado, 'escolhendo_pagamento');
  const lixo = conversa(['xpto blah'], { llm: () => respostaLLM({ intencao: 'hackear', evento_id: 999, confianca: 5 }) });
  assert.equal(lixo[0].estado, 'inicio');
  const falhou = conversa(['xpto blah'], { llm: () => ({}) });
  assert.match(textos(falhou[0]), /Não entendi/);
});

test('bot desligado, pausa vigente e contexto expirado', () => {
  const base = { canal: 'whatsapp', contato_id: '1', texto: '2', agora: AGORA, eventos: EVENTOS, textos: {} };
  assert.equal(processar({ ...base, config: { ...CONFIG, bot_ligado: 'false' } }).mensagens.length, 0);
  const pausado = processar({ ...base, config: CONFIG, conversa: { estado: 'humano', contexto: {}, pausado_ate: '2026-11-12T13:00:00Z' } });
  assert.equal(pausado.mensagens.length, 0);
  assert.equal(pausado.estado, 'humano');
  const voltou = processar({ ...base, texto: 'oi', config: CONFIG, conversa: { estado: 'humano', contexto: {}, pausado_ate: '2026-11-12T11:00:00Z' } });
  assert.equal(voltou.estado, 'inicio');
  assert.equal(voltou.pausado_ate, null);
  const velho = processar({ ...base, config: CONFIG, conversa: { estado: 'escolhendo_qtd', contexto: { evento_id: 1 }, atualizado_em: '2026-11-10T00:00:00Z' } });
  assert.equal(velho.estado, 'venda_coletando', '"2" no início = vender');
});

test('mídia fora de hora vai para humano', () => {
  const s = conversa([{ midia: { tipo: 'imagem', url: 'https://x/y.jpg' } }]);
  assert.equal(s[0].estado, 'humano');
  assert.equal(s[0].acoes[0].mensagens[0].url, 'https://x/y.jpg');
});

test('lerValor', () => {
  assert.equal(lerValor('R$ 1.250,50'), 1250.5);
  assert.equal(lerValor('200 reais'), 200);
  assert.equal(lerValor('1,250.00'), 1250);
  assert.equal(lerValor('sei lá'), null);
});

test('sqlGravar: escapa texto, mascara CPF no histórico e liga pedido novo ao contexto', () => {
  const ctx = { canal: 'whatsapp', contato_id: "55'71", nome: "D'Ávila", texto: 'meu cpf 529.982.247-25' };
  const sql = sqlGravar(ctx, { estado: 'aguardando_comprovante', contexto: { a: 1 }, mensagens: [{ tipo: 'texto', texto: 'ok' }], efeitos: { novoPedido: { evento_id: 1, quantidade: 2, valor_total: 300, forma: 'pix', status: 'aguardando_comprovante' } } });
  assert.match(sql, /'55''71'/);
  assert.match(sql, /'D''Ávila'/);
  assert.match(sql, /\*\*\*\.982\.247-\*\*/);
  assert.ok(!sql.includes('529.982.247-25'));
  assert.match(sql, /jsonb_build_object\('pedido_id', \(select id from np\)\)/);
});

test('lit: $ nunca chega cru na query (pg-promise do n8n)', () => {
  assert.equal(lit('R$1 \\ ok'), "U&'R\\00241 \\\\ ok'");
  assert.equal(lit({ a: '$' }), "U&'{\"a\":\"\\0024\"}'::jsonb");
  assert.equal(lit("it's"), "'it''s'");
});
