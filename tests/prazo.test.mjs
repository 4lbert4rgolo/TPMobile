import test from 'node:test';
import assert from 'node:assert/strict';
import { paraCampo, doCampo, prazoSugerido, prazoPassou, votacaoAberta, textoPrazo } from '../public/js/prazo.js';
import { avisoEnqueteAberta, avisoMudancaCelula, avisoTrocaResolvida } from '../public/js/notificacoes.js';
import { gerarDias } from '../public/js/escala.js';

test('prazo: campo do formulário ↔ ISO, ida e volta (no fuso do aparelho)', () => {
  assert.equal(paraCampo(doCampo('2026-11-29T20:00')), '2026-11-29T20:00');
  assert.equal(doCampo(''), null);
  assert.equal(paraCampo(null), '');
  assert.equal(paraCampo('lixo'), '');
});

test('prazo: sugerido é a véspera do primeiro dia, às 20h', () => {
  const d = new Date(prazoSugerido('2026-11-30'));
  assert.equal(d.getDate(), 29);
  assert.equal(d.getHours(), 20);
  assert.equal(d.getMinutes(), 0);
});

test('prazo: passou / votação aberta', () => {
  const agora = new Date(doCampo('2026-11-29T20:00'));
  const antes = new Date(agora.getTime() - 60e3);
  const e = { status: 'aberta', prazo: agora.toISOString() };
  assert.equal(prazoPassou(e, antes), false);
  assert.equal(prazoPassou(e, agora), true);
  assert.equal(votacaoAberta(e, antes), true);
  assert.equal(votacaoAberta(e, agora), false);
  assert.equal(votacaoAberta({ status: 'aberta' }, agora), true, 'sem prazo, só fecha à mão');
  assert.equal(votacaoAberta({ status: 'fechada' }, antes), false);
});

test('prazo: texto "domingo, 29/11 às 20h" e com minutos', () => {
  assert.equal(textoPrazo(doCampo('2026-11-29T20:00')), 'domingo, 29/11 às 20h');
  assert.equal(textoPrazo(doCampo('2026-11-27T19:30')), 'sexta, 27/11 às 19h30');
});

test('aviso de enquete aberta cita o prazo', () => {
  const e = { titulo: 'Semana de 30/11', inicio: '2026-11-30', fim: '2026-12-05', dias: gerarDias('2026-11-30', '2026-12-05'), prazo: doCampo('2026-11-29T20:00') };
  assert.match(avisoEnqueteAberta(e).corpo, /Vote até domingo, 29\/11 às 20h\./);
  assert.doesNotMatch(avisoEnqueteAberta({ ...e, prazo: null }).corpo, /Vote até/);
});

test('mudança na escala publicada: quem entrou e quem saiu recebem o próprio texto', () => {
  const T = '08:00 às 10:00';
  const eq = (...ps) => ({ tipo: 'equipe', pessoas: ps.map(([id, nome]) => ({ id, nome })) });
  const a = avisoMudancaCelula({ ponto: 'Bairro Novo', data: '2026-11-24', turno: T }, eq(['a', 'Ana'], ['b', 'Bia']), eq(['a', 'Ana'], ['c', 'Cida']));
  assert.equal(a.tipo, 'escala-mudou');
  assert.deepEqual(a.para.publicadores.sort(), ['b', 'c']);
  assert.equal(a.porPublicador.c, 'Você entrou na escala: terça 24/11, 08:00 às 10:00 – Bairro Novo, com Ana.');
  assert.equal(a.porPublicador.b, 'Você não está mais na escala em terça 24/11, 08:00 às 10:00 – Bairro Novo.');
  assert.equal('a' in a.porPublicador, false, 'quem continua não é avisado');
  assert.equal(avisoMudancaCelula({ ponto: 'P', data: '2026-11-24', turno: T }, eq(['a', 'Ana']), eq(['a', 'Ana'])), null);
  const vazio = avisoMudancaCelula({ ponto: 'P', data: '2026-11-24', turno: T }, eq(['a', 'Ana'], ['b', 'Bia']), { tipo: 'vazio' });
  assert.deepEqual(Object.keys(vazio.porPublicador).sort(), ['a', 'b']);
});

test('troca resolvida avisa quem pediu', () => {
  const t = { publicadorId: 'b', nome: 'Bruno', data: '2026-11-26', turno: '06:00 às 08:00', ponto: 'Bairro Novo' };
  const a = avisoTrocaResolvida(t, { id: 'g', nome: 'Gil' });
  assert.deepEqual(a.para, { publicadores: ['b'] });
  assert.equal(a.corpo, 'Gil entra no seu lugar: quinta 26/11, 06:00 às 08:00 – Bairro Novo.');
});
