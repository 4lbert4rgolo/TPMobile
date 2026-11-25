import test from 'node:test';
import assert from 'node:assert/strict';
import { novidadesVisiveis, naoLidas, validarNovidade, avisoNovidade, MAX_NO_MURAL } from '../public/js/novidades.js';

const n = (id, criadoISO, ate = null) => ({ id, titulo: id, criadoISO, ate });

test('mural: esconde vencidas, mais novas primeiro, no máximo 5', () => {
  const lista = [n('a', '2026-11-20T10:00:00Z'), n('b', '2026-11-24T10:00:00Z', '2026-11-24'), n('c', '2026-11-22T10:00:00Z', '2026-11-30'), n('d', '2026-11-23T10:00:00Z')];
  assert.deepEqual(novidadesVisiveis(lista, '2026-11-25').map((x) => x.id), ['d', 'c', 'a']);
  assert.deepEqual(novidadesVisiveis(lista, '2026-11-24').map((x) => x.id), ['b', 'd', 'c', 'a'], 'válida até hoje ainda aparece');
  const muitas = Array.from({ length: 8 }, (_, i) => n(`x${i}`, `2026-11-1${i}T00:00:00Z`));
  assert.equal(novidadesVisiveis(muitas, '2026-11-25').length, MAX_NO_MURAL);
});

test('mural: não lidas desde a última visita', () => {
  const v = [n('a', '2026-11-24T10:00:00Z'), n('b', '2026-11-20T10:00:00Z')];
  assert.equal(naoLidas(v, null), 2);
  assert.equal(naoLidas(v, '2026-11-22T00:00:00Z'), 1);
  assert.equal(naoLidas(v, '2026-11-25T00:00:00Z'), 0);
});

test('mural: validação do formulário e aviso no celular', () => {
  assert.equal(validarNovidade({ titulo: ' ', texto: '' }, '2026-11-25'), 'Escreva um título.');
  assert.match(validarNovidade({ titulo: 'x'.repeat(81) }, '2026-11-25'), /até 80/);
  assert.match(validarNovidade({ titulo: 'Ok', texto: 'y'.repeat(601) }, '2026-11-25'), /até 600/);
  assert.match(validarNovidade({ titulo: 'Ok', ate: '2026-11-24' }, '2026-11-25'), /já passou/);
  assert.equal(validarNovidade({ titulo: 'Ok', texto: 'Texto', ate: '2026-11-25' }, '2026-11-25'), '');
  const a = avisoNovidade({ titulo: 'Carrinho suspenso no sábado', texto: 'Por causa da chuva.' });
  assert.deepEqual(a.para, { todos: true });
  assert.equal(a.titulo, '📢 Carrinho suspenso no sábado');
  assert.equal(a.url, '?aba=inicio');
  assert.ok(avisoNovidade({ titulo: 'x'.repeat(100) }).titulo.length <= 80);
});
