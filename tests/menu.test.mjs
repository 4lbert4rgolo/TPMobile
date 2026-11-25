import test from 'node:test';
import assert from 'node:assert/strict';
import { gruposDoMenu, itensBarra, textoContador, calcularContadores, ICONES } from '../public/js/menu.js';

const votante = [['inicio', 'Início'], ['votar', 'Votar'], ['escala', 'Escala'], ['minha', 'Minha escala']];
const admin = [...votante, ['enquetes', 'Enquetes'], ['votos', 'Votos'], ['publicadores', 'Publicadores'], ['pontos', 'Pontos'], ['usuarios', 'Usuários'], ['links', 'Links de acesso'], ['auditoria', 'Auditoria']];

test('menu: grupos na ordem, só com o que a pessoa pode ver', () => {
  assert.deepEqual(gruposDoMenu(votante), [['Para mim', [['inicio', 'Início'], ['votar', 'Votar'], ['minha', 'Minha escala'], ['escala', 'Escala']]]]);
  assert.deepEqual(gruposDoMenu(admin).map(([t, i]) => [t, i.length]), [['Para mim', 4], ['Organizar a semana', 2], ['Cadastros', 2], ['Administração', 3]]);
  for (const [id] of admin) assert.ok(ICONES[id], `ícone de ${id}`);
});

test('barra de baixo: atalhos de cada perfil', () => {
  assert.deepEqual(itensBarra(votante, false).map(([id]) => id), ['inicio', 'votar', 'minha', 'escala']);
  assert.deepEqual(itensBarra(admin, true).map(([id]) => id), ['inicio', 'enquetes', 'votos', 'escala']);
  assert.deepEqual(itensBarra([['inicio', 'Início'], ['votar', 'Votar'], ['escala', 'Escala']], false).map(([id]) => id), ['inicio', 'votar', 'escala'], 'sem publicador ligado: sem Minha escala');
});

test('contadores: textos e cálculo', () => {
  assert.equal(textoContador('votos', 4), 'faltam 4');
  assert.equal(textoContador('escala', 1), '1 troca');
  assert.equal(textoContador('escala', 2), '2 trocas');
  assert.equal(textoContador('usuarios', 1), '1 aguardando');
  assert.equal(textoContador('votos', 0), '');
  const c = calcularContadores({
    pubs: [{ id: 'a' }, { id: 'b' }, { id: 'c', ativo: false }],
    votosAberta: [{ publicadorId: 'a' }],
    trocasPublicada: [{ status: 'aberta' }, { status: 'resolvida' }],
    usuarios: [{ papel: 'pendente' }, { papel: 'votante' }],
  });
  assert.deepEqual(c, { votos: 1, escala: 1, usuarios: 1 });
  assert.deepEqual(calcularContadores({ pubs: [{ id: 'a' }] }), { votos: 0, escala: 0, usuarios: 0 }, 'sem enquete aberta: sem contador');
});
