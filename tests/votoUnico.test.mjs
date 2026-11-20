import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarMestre, bloqueadoEmTodos, iniciarUnico } from '../public/js/votoUnico.js';

const enquete = {
  pontos: ['A', 'B', 'C'],
  turnos: ['06:00 às 08:00', '08:00 às 10:00'],
  dias: [{ data: '2026-11-23' }, { data: '2026-11-24', ativo: false }],
  bloqueios: [],
};
const K1 = '2026-11-23|06:00 às 08:00';
const K2 = '2026-11-23|08:00 às 10:00';
const vazio = () => ({ A: new Set(), B: new Set(), C: new Set() });

test('aplicarMestre copia posso e reserva só para os pontos escolhidos', () => {
  const m = { disp: new Set([K1]), reserva: new Set([K2]) };
  const r = aplicarMestre(enquete, m, new Set(['A', 'C']), ['A', 'B', 'C']);
  assert.deepEqual([...r.disp.A], [K1]);
  assert.deepEqual([...r.reserva.C], [K2]);
  assert.equal(r.disp.B.size + r.reserva.B.size, 0);
});

test('aplicarMestre não grava ponto fora das permissões do cadastro', () => {
  const m = { disp: new Set([K1]), reserva: new Set() };
  const r = aplicarMestre(enquete, m, new Set(['A', 'B']), ['A']);
  assert.equal(r.disp.B.size, 0);
});

test('aplicarMestre pula horário bloqueado só naquele ponto', () => {
  const e = { ...enquete, bloqueios: [{ data: '2026-11-23', turno: '06:00 às 08:00', ponto: 'B', motivo: 'x' }] };
  const m = { disp: new Set([K1]), reserva: new Set() };
  const r = aplicarMestre(e, m, new Set(['A', 'B']), ['A', 'B']);
  assert.ok(r.disp.A.has(K1));
  assert.equal(r.disp.B.size, 0);
  assert.equal(bloqueadoEmTodos(e, '2026-11-23', '06:00 às 08:00', new Set(['A', 'B'])), false);
  assert.equal(bloqueadoEmTodos(e, '2026-11-23', '06:00 às 08:00', new Set(['B'])), true);
});

test('iniciarUnico: voto novo começa unificado com todos os pontos marcados', () => {
  const u = iniciarUnico(vazio(), vazio(), ['A', 'B', 'C'], true);
  assert.equal(u.unificado, true);
  assert.deepEqual([...u.escolhidos].sort(), ['A', 'B', 'C']);
});

test('iniciarUnico: pontos com horários diferentes ficam ponto a ponto (sem perder dados)', () => {
  const d = vazio(); d.A.add(K1); d.B.add(K2);
  const u = iniciarUnico(d, vazio(), ['A', 'B', 'C'], true);
  assert.equal(u.unificado, false);
});

test('iniciarUnico: pontos iguais viram grade única e só os marcados ficam escolhidos', () => {
  const d = vazio(); d.A.add(K1); d.C.add(K1);
  const u = iniciarUnico(d, vazio(), ['A', 'B', 'C'], true);
  assert.equal(u.unificado, true);
  assert.deepEqual([...u.escolhidos].sort(), ['A', 'C']);
});
