import test from 'node:test';
import assert from 'node:assert/strict';
import { PAPEIS_LINK, papelDoConvite, agruparUsuarios, contasDeEmailDo, planoDeUnificacao } from '../public/js/acessos.js';

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

test('unificar: iguala os aparelhos ao maior perfil e grava o perfil no link', () => {
  const usuarios = [
    { id: 'a1', nome: 'Davi', papel: 'servo', conviteId: 'L1', publicadorId: 'p1' },
    { id: 'a2', nome: 'Davi', papel: 'votante', conviteId: 'L1', publicadorId: 'p1' },
    { id: 'a3', nome: 'Davi', papel: 'removido', conviteId: 'L1', publicadorId: 'p1' },
    { id: 'b1', nome: 'Eva', papel: 'servo', conviteId: 'L2', publicadorId: 'p2' }, // promovida, link antigo sem perfil
    { id: 'c1', nome: 'Fábio', papel: 'votante', conviteId: 'L3', publicadorId: 'p3' }, // tudo certo
    { id: 'e1', nome: 'Gil', papel: 'admin', email: 'g@x.com', publicadorId: 'p4' }, // conta de e-mail: não mexe
  ];
  const convites = [
    { id: 'L1', nome: 'Davi', ativo: true },
    { id: 'L2', nome: 'Eva', ativo: true },
    { id: 'L3', nome: 'Fábio', ativo: true },
  ];
  const plano = planoDeUnificacao(usuarios, convites);
  assert.deepEqual(plano.usuarios.map((u) => [u.id, u.papel]), [['a2', 'servo']]); // o removido fica removido
  assert.deepEqual(plano.convites.map((c) => [c.id, c.papel]), [['L1', 'servo'], ['L2', 'servo']]);
  // Depois de aplicar, não sobra nada a fazer.
  const depois = usuarios.map((u) => (u.id === 'a2' ? { ...u, papel: 'servo' } : u));
  const convitesDepois = convites.map((c) => (['L1', 'L2'].includes(c.id) ? { ...c, papel: 'servo' } : c));
  assert.deepEqual(planoDeUnificacao(depois, convitesDepois), { usuarios: [], convites: [] });
});

test('unificar: link desativado ou todos removidos não mudam nada', () => {
  const plano = planoDeUnificacao(
    [{ id: 'a1', papel: 'removido', conviteId: 'L1' }, { id: 'b1', papel: 'servo', conviteId: 'L2' }],
    [{ id: 'L1', ativo: false }, { id: 'L2', ativo: false }],
  );
  assert.deepEqual(plano, { usuarios: [], convites: [] });
});
