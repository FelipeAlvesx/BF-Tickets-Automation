import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlInserir, sqlAtualizar, sqlApagar, autorizado } from './crud.mjs';

test('CRUD só aceita colunas da lista e usa parâmetros', () => {
  assert.deepEqual(sqlAtualizar('eventos', 3, { nome: "x'; drop", id: 9, hack: 1 }), {
    text: 'update app.eventos set nome = $1 where id = $2 returning *', values: ["x'; drop", 3],
  });
  assert.deepEqual(sqlInserir('agenda', { horario: '09:00', texto: 'oi' }).values, ['09:00', 'oi']);
  assert.throws(() => sqlInserir('pedidos', { nome: 'x' }), /não existe/);
  assert.throws(() => sqlAtualizar('config', 'pix_chave', { chave: 'x' }), /Nada para salvar/);
  assert.throws(() => sqlApagar('config', 'pix_chave'), /não deixa apagar/);
});

test('Basic auth', () => {
  const h = (u, p) => 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');
  assert.ok(autorizado(h('admin', 's3nh@:x'), 'admin', 's3nh@:x'));
  assert.ok(!autorizado(h('admin', 'errada'), 'admin', 's3nh@:x'));
  assert.ok(!autorizado(undefined, 'admin', 'x'));
  assert.ok(!autorizado(h('admin', ''), 'admin', ''), 'senha vazia nunca entra');
});
