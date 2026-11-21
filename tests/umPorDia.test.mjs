import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarDias, gerarEscala, validarEscala, chave, umaVezPorDia } from '../public/js/escala.js';
import { substitutos } from '../public/js/trocas.js';

const T = ['06:00 às 08:00', '08:00 às 10:00', '10:00 às 12:00'];
const D = '2026-11-23';
const pubs = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, nome: id.toUpperCase(), genero: 'M' }));
const base = { pontos: ['P', 'Q'], turnos: T, dias: gerarDias(D, D), bloqueios: [] };
// Todos marcaram todos os horários dos dois pontos.
const votos = pubs.map((p) => ({
  publicadorId: p.id,
  disponibilidade: { P: T.map((t) => chave(D, t)), Q: T.map((t) => chave(D, t)) },
}));

function vezesNoDia(matriz) {
  const n = new Map();
  for (const ponto of Object.keys(matriz)) {
    for (const c of Object.values(matriz[ponto][D])) {
      if (c.tipo === 'equipe') c.pessoas.forEach((p) => n.set(p.id, (n.get(p.id) || 0) + 1));
    }
  }
  return n;
}

test('uma vez por dia: ligada por padrão; a enquete pode desligar', () => {
  assert.equal(umaVezPorDia({}), true);
  assert.equal(umaVezPorDia(undefined), true);
  assert.equal(umaVezPorDia({ umPorDia: false }), false);
});

test('uma vez por dia: o gerador não coloca a mesma pessoa em dois horários do mesmo dia', () => {
  const { matriz } = gerarEscala({ enquete: { ...base, regras: { maxIrmaos: null } }, publicadores: pubs, votos });
  const n = vezesNoDia(matriz);
  for (const [id, vezes] of n) assert.equal(vezes, 1, `${id} saiu ${vezes} vezes no dia`);
  // 6 pessoas → no máximo 3 duplas no dia; o resto fica vazio.
  assert.equal([...n.values()].length, 6);
});

test('uma vez por dia: desligada, a mesma pessoa pode sair em mais de um horário', () => {
  const { matriz } = gerarEscala({ enquete: { ...base, regras: { umPorDia: false } }, publicadores: pubs, votos });
  assert.ok([...vezesNoDia(matriz).values()].some((v) => v > 1));
});

test('uma vez por dia: a validação acusa quem foi colocado duas vezes no mesmo dia', () => {
  const eq = (...ids) => ({ tipo: 'equipe', pessoas: ids.map((id) => ({ id, nome: id.toUpperCase() })) });
  const matriz = { P: { [D]: { [T[0]]: eq('a', 'b'), [T[2]]: eq('a', 'c') } } };
  const erros = (regras) => validarEscala({ enquete: { ...base, regras }, publicadores: pubs, votos, matriz })
    .filter((x) => /mais de uma vez/.test(x.msg));
  assert.equal(erros({}).length, 1);
  assert.match(erros({})[0].msg, /^A está mais de uma vez em segunda/);
  assert.equal(erros({ umPorDia: false }).length, 0);
});

test('uma vez por dia: substituto não pode ser quem já está escalado em outro horário do dia', () => {
  const eq = (...ids) => ({ tipo: 'equipe', pessoas: ids.map((id) => ({ id, nome: id.toUpperCase() })) });
  const matriz = { P: { [D]: { [T[0]]: eq('a', 'b'), [T[1]]: eq('c', 'd') } } };
  const troca = { publicadorId: 'a', ponto: 'P', data: D, turno: T[0] };
  const ids = (regras) => substitutos({ enquete: { ...base, regras }, matriz, votos, publicadores: pubs, troca }).map((s) => s.id).sort();
  assert.deepEqual(ids({}), ['e', 'f']);
  assert.deepEqual(ids({ umPorDia: false }), ['c', 'd', 'e', 'f']);
});
