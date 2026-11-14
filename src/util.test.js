import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarCpf, mascararCpf, mascararCpfsNoTexto, validarEmail, extrairDados } from './cpf.js';

test('extrairDados: tudo numa mensagem, em qualquer formato', () => {
  const esperado = { nome: 'Ana Maria Souza', cpf: '52998224725', email: 'ana@ex.com', telefone: '71999998888' };
  assert.deepEqual(extrairDados('Ana Maria Souza\n529.982.247-25\nana@ex.com\n(71) 99999-8888'), esperado);
  assert.deepEqual(extrairDados('Nome: Ana Maria Souza, CPF: 52998224725, Email: ANA@ex.com, Tel: +55 71 99999-8888'), esperado);
  assert.deepEqual(extrairDados('Ana Maria Souza 529.982.247-25 ana@ex.com 71 99999-8888'), esperado);
  // aos poucos e com erro
  assert.deepEqual(extrairDados('já paguei'), {});
  assert.deepEqual(extrairDados('meu cpf é 529.982.247-24'), { cpfInvalido: true });
  assert.deepEqual(extrairDados('52998224724', { telefone: false }), { cpfInvalido: true });
  assert.deepEqual(extrairDados('71999998888', { telefone: false }), { cpfInvalido: true });
  assert.deepEqual(extrairDados('ana@ex.com'), { email: 'ana@ex.com' });
});
import { render, formatarPreco, formatarData, textoBot } from './templates.js';
import { atalhos, extrairQuantidade, acharEvento, opcaoMenu } from './extrator.js';
import { parseComando, sqlComando, formatarResposta } from './comandos.js';
import { mensagensAgenda, jitterSegundos } from './agenda.js';

test('CPF', () => {
  assert.ok(validarCpf('529.982.247-25'));
  assert.ok(validarCpf('52998224725'));
  assert.ok(!validarCpf('529.982.247-24'));
  assert.ok(!validarCpf('111.111.111-11'));
  assert.ok(!validarCpf('123'));
  assert.equal(mascararCpf('529.982.247-25'), '***.982.247-**');
  assert.equal(mascararCpfsNoTexto('cpf 52998224725 ok'), 'cpf ***.982.247-** ok');
});

test('e-mail', () => {
  assert.ok(validarEmail('a.b+c@ex.com.br'));
  assert.ok(!validarEmail('a@b'));
  assert.ok(!validarEmail('a b@c.com'));
});

test('templates', () => {
  assert.equal(render('{nome} em {data}{x}', { nome: 'A', data: 'B' }), 'A em B');
  assert.equal(formatarPreco('150'), 'R$ 150,00');
  assert.equal(formatarData('2026-12-20T22:00:00-03:00'), 'dom, 20/12 às 22:00');
  assert.equal(textoBot({ cancelado: 'X {a}' }, 'cancelado', { a: 1 }), 'X 1');
  assert.match(textoBot({}, 'cancelado'), /cancelei/);
});

test('atalhos', () => {
  const ev = [{ id: 1, nome: 'Festival Verão Bahia' }, { id: 2, nome: 'Pagode do Rio Vermelho' }];
  assert.equal(extrairQuantidade('2'), 2);
  assert.equal(extrairQuantidade('quero dois ingressos'), 2);
  assert.equal(extrairQuantidade('tres'), 3);
  assert.equal(extrairQuantidade('festival 2026'), null);
  assert.equal(opcaoMenu('2)'), 2);
  assert.equal(acharEvento('vai ter o verao?', ev).id, 1);
  assert.equal(acharEvento('bahia ou rio', [{ id: 1, nome: 'Bahia Fest' }, { id: 2, nome: 'Bahia Rock' }]), null);
  assert.equal(atalhos('quero vender meu ingresso', ev).intencao, 'vender');
  assert.equal(atalhos('qual o local do pagode?', ev).intencao, 'duvida_evento');
  assert.equal(atalhos('quero falar com atendente', ev).intencao, 'humano');
  assert.equal(atalhos('bom dia!', ev).intencao, 'saudacao');
  assert.equal(atalhos('aquele role la', ev), null);
});

test('comandos: parse', () => {
  assert.deepEqual(parseComando('/aprovar 12'), { cmd: 'aprovar', id: 12 });
  assert.deepEqual(parseComando('/recusar #12 valor errado'), { cmd: 'recusar', id: 12, motivo: 'valor errado' });
  assert.deepEqual(parseComando('/pausar (71) 99999-0000'), { cmd: 'pausar', contato: '5571999990000' });
  assert.deepEqual(parseComando('/PEDIDOS'), { cmd: 'pedidos' });
  assert.match(parseComando('/aprovar').erro, /Uso/);
  assert.match(parseComando('/xyz').erro, /desconhecido/);
  assert.equal(parseComando('oi'), null);
});

test('comandos: SQL e respostas', () => {
  assert.match(sqlComando({ cmd: 'recusar', id: 3, motivo: "it's" }), /motivo_recusa='it''s'/);
  assert.match(sqlComando({ cmd: 'pausar', contato: '5571' }, { pausaHoras: 12 }), /hours=>12/);
  const r = formatarResposta({ cmd: 'aprovar', id: 7 }, [{ id: 7, canal: 'instagram', contato_id: '99', status: 'aprovado', evento: 'Pagode', textos: {} }]);
  assert.match(r.admin, /#7 aprovado/);
  assert.deepEqual([r.cliente.canal, r.cliente.contato_id], ['instagram', '99']);
  assert.match(r.cliente.mensagens[0].texto, /Pagode foi aprovado/);
  assert.doesNotMatch(r.cliente.mensagens[0].texto, /#7/);
  assert.match(r.cliente.mensagens[0].texto, /enviado pela ticketeira oficial do evento[\s\S]*Obrigado pela preferência de escolher a BF Tickets/);
  const rec = formatarResposta({ cmd: 'recusar', id: 7 }, [{ id: 7, canal: 'whatsapp', contato_id: '1', status: 'recusado', motivo_recusa: 'valor', textos: {} }]);
  assert.match(rec.cliente.mensagens[0].texto, /Motivo: valor/);
  assert.match(formatarResposta({ cmd: 'aprovar', id: 9 }, [{}]).admin, /não está pronto pra aprovar/);
  assert.match(formatarResposta({ cmd: 'recusar', id: 9 }, [{}]).admin, /não encontrado/);
  // Aprovar só com nome/CPF/e-mail completos; recusar em qualquer etapa aberta.
  assert.match(sqlComando({ cmd: 'aprovar', id: 3 }), /status in \('aguardando_validacao'\)/);
  assert.match(sqlComando({ cmd: 'recusar', id: 3 }), /'coletando_dados'/);
  assert.match(formatarResposta({ cmd: 'pedidos' }, [{ id: 1, status: 'aguardando_validacao', quantidade: 2, evento: 'X', valor_total: 10, canal: 'whatsapp', contato_id: '1', cpf: '529.982.247-25' }]).admin, /\*\*\*\.982/);
  assert.match(formatarResposta({ cmd: 'ajuda' }).admin, /\/aprovar/);
});

test('agenda: grupo com imagem e lembrete de story com link isolado', () => {
  const linha = { texto: 'Bora pro {nome}! {preco} — {link}', enviar_grupo: true, lembrete_story: true, imagem_url: 'https://img/1.jpg', evento: { nome: 'Pagode', preco: 60, link_compra: 'https://l', data_evento: '2026-12-05T20:00:00-03:00' } };
  const { grupo, story } = mensagensAgenda(linha);
  assert.deepEqual(grupo, [{ tipo: 'imagem', url: 'https://img/1.jpg', texto: 'Bora pro Pagode! R$ 60,00 — https://l' }]);
  assert.equal(story.length, 3);
  assert.equal(story[2].texto, 'https://l');
  const so = mensagensAgenda({ texto: 'oi', enviar_grupo: false, lembrete_story: false });
  assert.deepEqual(so, { grupo: null, story: null });
  assert.equal(mensagensAgenda({ texto: 'oi', enviar_grupo: true, imagem_url: '/img/a.jpg' }).grupo[0].url, 'http://painel:8080/img/a.jpg');
  assert.equal(jitterSegundos(() => 0.999), 60);
});
