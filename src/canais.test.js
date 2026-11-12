import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizarEvolution, chamadasEvolution, normalizarManychat, respostaManychat, sendContentManychat } from './canais.js';

const fx = (n) => JSON.parse(readFileSync(new URL(`../tests/fixtures/${n}.json`, import.meta.url)));

test('Evolution: texto, imagem, pdf, fromMe, grupo, @lid', () => {
  assert.deepEqual(normalizarEvolution(fx('evolution-texto')), { id: 'TXT001', contato_id: '5571999990001', nome: 'Ana Souza', texto: 'oi', midia: null, fromMe: false });
  const img = normalizarEvolution(fx('evolution-imagem'));
  assert.equal(img.midia.tipo, 'imagem');
  assert.equal(img.midia.ref, 'wa:IMG001');
  assert.ok(img.midia.base64.startsWith('/9j/'));
  const pdf = normalizarEvolution(fx('evolution-pdf'));
  assert.deepEqual([pdf.midia.tipo, pdf.midia.mimetype, pdf.midia.fileName], ['documento', 'application/pdf', 'comprovante.pdf']);
  assert.equal(normalizarEvolution(fx('evolution-fromme')).fromMe, true);
  assert.equal(normalizarEvolution(fx('evolution-grupo')), null);
  assert.equal(normalizarEvolution(fx('evolution-lid')).contato_id, '5571999990002');
  assert.equal(normalizarEvolution({ event: 'connection.update' }), null);
  assert.equal(normalizarEvolution({ event: 'messages.upsert', data: { key: { remoteJid: '1@s.whatsapp.net', id: 'R' }, message: { reactionMessage: {} } } }), null);
});

test('Evolution: chamadas com digitando proporcional', () => {
  const [t, i, d] = chamadasEvolution('5571', [{ tipo: 'texto', texto: 'oi' }, { tipo: 'imagem', url: 'https://x/a.jpg', texto: 'arte' }, { tipo: 'documento', base64: 'JVB', mimetype: 'application/pdf', texto: 'pdf' }]);
  assert.deepEqual(t, { endpoint: 'sendText', body: { number: '5571', text: 'oi', delay: 1050 } });
  assert.equal(i.body.mediatype, 'image');
  assert.equal(i.body.media, 'https://x/a.jpg');
  assert.equal(d.body.fileName, 'comprovante.pdf');
  assert.equal(chamadasEvolution('1', [{ tipo: 'texto', texto: 'x'.repeat(999) }])[0].body.delay, 4000);
});

test('ManyChat: entrada, comprovante e resposta v2', () => {
  assert.deepEqual(normalizarManychat(fx('manychat-texto')), { contato_id: '987654321', nome: 'Bia Lima', texto: 'quero 2 ingressos pro pagode', midia: null });
  const c = normalizarManychat(fx('manychat-comprovante'));
  assert.equal(c.midia.tipo, 'imagem');
  assert.match(c.midia.url, /lookaside/);
  assert.equal(normalizarManychat({}), null);
  const r = respostaManychat([{ tipo: 'texto', texto: 'a' }, { tipo: 'imagem', url: 'https://i', texto: 'b' }], 'aguardando_comprovante');
  assert.equal(r.version, 'v2');
  assert.equal(r.content.type, 'instagram');
  assert.deepEqual(r.content.messages, [{ type: 'text', text: 'a' }, { type: 'image', url: 'https://i' }, { type: 'text', text: 'b' }]);
  assert.deepEqual(r.content.actions, [{ action: 'set_field_value', field_name: 'estado', value: 'aguardando_comprovante' }, { action: 'unset_field_value', field_name: 'comprovante_url' }]);
  const full = normalizarManychat({ id: '77', name: 'Bia', last_input_text: 'oi', custom_fields: { comprovante_url: 'https://lookaside.fbsbx.com/x.jpg' } });
  assert.deepEqual([full.contato_id, full.nome, full.texto, full.midia.tipo], ['77', 'Bia', 'oi', 'imagem']);
  assert.equal(respostaManychat(Array(15).fill({ tipo: 'texto', texto: 'x' })).content.messages.length, 10);
  assert.deepEqual(sendContentManychat('42', [{ tipo: 'texto', texto: 'ok' }]), { subscriber_id: 42, data: { version: 'v2', content: { type: 'instagram', messages: [{ type: 'text', text: 'ok' }] } } });
});
