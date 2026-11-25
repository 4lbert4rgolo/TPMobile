import test from 'node:test';
import assert from 'node:assert/strict';
import { PAPEIS_LINK, papelDoConvite, agruparUsuarios, contasDeEmailDo } from '../public/js/acessos.js';

test('perfil do link: votante, servo ou admin; link antigo (sem campo) vale como votante', () => {
  assert.deepEqual(PAPEIS_LINK, ['votante', 'servo', 'admin']);
  assert.equal(papelDoConvite({}), 'votante');
  assert.equal(papelDoConvite(null), 'votante');
  assert.equal(papelDoConvite({ papel: 'servo' }), 'servo');
  assert.equal(papelDoConvite({ papel: 'admin' }), 'admin');
  assert.equal(papelDoConvite({ papel: 'anciao' }), 'admin');
  assert.equal(papelDoConvite({ papel: 'pendente' }), 'votante'); // valor estranho nunca vira organizador
});

test('agrupar: aparelhos do mesmo link viram uma pessoa só; contas de e-mail ficam separadas', () => {
  const usuarios = [
    { id: 'a1', nome: 'Ana', papel: 'votante', publicadorId: 'p1', conviteId: 'L1' },
    { id: 'a2', nome: 'Ana', papel: 'votante', publicadorId: 'p1', conviteId: 'L1', privacidadeAceitaEm: '2026-11-21T10:00:00Z' },
    { id: 'a3', nome: 'Ana', papel: 'votante', publicadorId: 'p1', conviteId: 'L1', privacidadeAceitaEm: '2026-11-20T10:00:00Z' },
    { id: 'b1', nome: 'Bruno', papel: 'servo', publicadorId: 'p2', email: 'b@x.com' },
    { id: 'c1', nome: 'Carla', papel: 'admin', publicadorId: 'p3', email: 'c@x.com' },
  ];
  const g = agruparUsuarios(usuarios);
  assert.equal(g.length, 3);
  const ana = g.find((x) => x.nome === 'Ana');
  assert.deepEqual(ana.uids, ['a1', 'a2', 'a3']);
  assert.equal(ana.aparelhos, 3);
  assert.equal(ana.id, 'a1');
  assert.equal(ana.misturado, false);
  assert.equal(ana.privacidadeAceitaEm, '2026-11-20T10:00:00Z'); // o primeiro aceite
  assert.equal(g.find((x) => x.nome === 'Bruno').aparelhos, 1);
});

test('agrupar: aparelhos com perfis diferentes mostram o maior e avisam', () => {
  const g = agruparUsuarios([
    { id: 'a1', nome: 'Davi', papel: 'servo', conviteId: 'L2' },
    { id: 'a2', nome: 'Davi', papel: 'votante', conviteId: 'L2' },
  ]);
  assert.equal(g.length, 1);
  assert.equal(g[0].papel, 'servo');
  assert.equal(g[0].misturado, true);
});

test('contas de e-mail do publicador: ignora link pessoal e acesso removido', () => {
  const usuarios = [
    { id: 'e1', papel: 'servo', publicadorId: 'p1', email: 'x@x.com' },
    { id: 'e2', papel: 'removido', publicadorId: 'p1', email: 'y@x.com' },
    { id: 'l1', papel: 'votante', publicadorId: 'p1', conviteId: 'L1' },
  ];
  assert.deepEqual(contasDeEmailDo('p1', usuarios).map((u) => u.id), ['e1']);
  assert.deepEqual(contasDeEmailDo('p2', usuarios), []);
  assert.deepEqual(contasDeEmailDo(null, usuarios), []);
});
