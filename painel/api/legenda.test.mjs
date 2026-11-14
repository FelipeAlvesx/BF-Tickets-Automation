import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pedidoLegenda, lerLegenda } from './legenda.mjs';

const eventos = [{ id: 3, nome: 'Pagode', data_evento: '2026-12-05T20:00:00-03:00' }];
const resp = (texto, extra = {}) => ({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: texto }], ...extra });

test('legenda: pedido com a imagem, os eventos e o JSON fechado nos ids', () => {
  const p = pedidoLegenda({ modelo: 'm', imagem: { type: 'url', url: 'https://x/a.jpg' }, eventos, eventoId: 3 });
  assert.equal(p.messages[0].content[0].type, 'image');
  assert.match(p.messages[0].content[1].text, /3: Pagode \(05\/12\/2026\)[\s\S]*já escolhido: 3/);
  assert.deepEqual(p.output_config.format.schema.properties.evento_id.enum, [0, 3]);
  assert.doesNotMatch(pedidoLegenda({ modelo: 'm', imagem: {}, eventos, eventoId: 9 }).messages[0].content[1].text, /escolhido/);
});

test('legenda: lê o texto, descarta id fora da lista e recusa vira erro', () => {
  assert.deepEqual(lerLegenda(resp('{"evento_id":3,"texto":" Bora! {link} "}'), eventos), { texto: 'Bora! {link}', evento_id: 3 });
  assert.equal(lerLegenda(resp('{"evento_id":0,"texto":"oi"}'), eventos).evento_id, null);
  assert.throws(() => lerLegenda(resp('{"evento_id":0,'), eventos), /incompleta/);
  assert.throws(() => lerLegenda(resp('', { stop_reason: 'refusal' }), eventos), /não quis/);
});
