import test from 'node:test';
import assert from 'node:assert/strict';
import { dataLimiteRetencao, enquetesAntigas, MESES_DE_RETENCAO } from '../public/js/retencao.js';

const hoje = new Date(2026, 10, 18); // 18/11/2026

test('a retenção padrão é de 3 meses', () => {
  assert.equal(MESES_DE_RETENCAO, 3);
});

test('data limite volta 3 meses', () => {
  assert.equal(dataLimiteRetencao(hoje), '2026-08-18');
});

test('fim de mês não estoura (31/05 menos 3 meses = 28/02)', () => {
  assert.equal(dataLimiteRetencao(new Date(2026, 4, 31)), '2026-02-28');
  assert.equal(dataLimiteRetencao(new Date(2028, 4, 31)), '2028-02-29'); // ano bissexto
});

test('virada de ano', () => {
  assert.equal(dataLimiteRetencao(new Date(2027, 1, 10)), '2026-11-10');
});

test('só entram enquetes que terminaram antes do limite', () => {
  const lista = [
    { id: 'velha', status: 'publicada', inicio: '2026-06-01', fim: '2026-06-06' },
    { id: 'limite', status: 'publicada', inicio: '2026-08-18', fim: '2026-08-18' },
    { id: 'recente', status: 'publicada', inicio: '2026-11-09', fim: '2026-11-14' },
    { id: 'so-inicio', status: 'fechada', inicio: '2026-01-05' },
    { id: 'sem-data', status: 'rascunho' },
  ];
  assert.deepEqual(enquetesAntigas(lista, hoje).map((e) => e.id), ['velha', 'so-inicio']);
});

test('enquete com votação aberta nunca é considerada antiga', () => {
  const lista = [{ id: 'esquecida', status: 'aberta', inicio: '2026-01-05', fim: '2026-01-10' }];
  assert.deepEqual(enquetesAntigas(lista, hoje), []);
});
