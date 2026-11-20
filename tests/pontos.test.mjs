import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pontosAtivos, itensDaConfig, validarPontos, planoDeMudancas,
  pontosVotoAtualizados, costumeAtualizado, rascunhoAtualizado, afetadosPelaRemocao,
} from '../public/js/pontos.js';

const config = { pontos: ['Bairro Novo', 'Atacadão', 'Morada'], pontosPausados: ['Morada'] };

test('pontos em uso: os pausados não vêm marcados na enquete nova', () => {
  assert.deepEqual(pontosAtivos(config), ['Bairro Novo', 'Atacadão']);
  assert.deepEqual(pontosAtivos({ pontos: ['A', 'B'] }), ['A', 'B']); // config antiga, sem pausados
});

test('validação: nome vazio, repetido (sem acento/maiúscula) e nenhum em uso', () => {
  const itens = itensDaConfig(config);
  assert.equal(validarPontos(itens), null);
  assert.match(validarPontos([...itens, { nome: '  ', original: null, ativo: true }]), /sem nome/);
  assert.match(validarPontos([...itens, { nome: 'bairro novo', original: null, ativo: true }]), /duas vezes/);
  assert.match(validarPontos(itens.map((i) => ({ ...i, ativo: false }))), /Em uso/);
  assert.match(validarPontos([]), /pelo menos um/);
});

test('plano: renomear, remover, reordenar, pausar e adicionar', () => {
  const itens = [
    { nome: 'Atacadão Novo Mix ', original: 'Atacadão', ativo: true },
    { nome: 'Bairro Novo', original: 'Bairro Novo', ativo: false },
    { nome: 'Praça Central', original: null, ativo: true },
  ];
  const plano = planoDeMudancas(config.pontos, itens);
  assert.deepEqual(plano.renomeados, [['Atacadão', 'Atacadão Novo Mix']]);
  assert.deepEqual(plano.removidos, ['Morada']);
  assert.deepEqual(plano.config.pontos, ['Atacadão Novo Mix', 'Bairro Novo', 'Praça Central']);
  assert.deepEqual(plano.config.pontosPausados, ['Bairro Novo']);
});

const plano = { renomeados: [['Atacadão', 'Atacadão Novo Mix']], removidos: ['Morada'] };

test('publicador: "Onde vota" acompanha o novo nome e perde o ponto removido', () => {
  assert.deepEqual(pontosVotoAtualizados(['Atacadão', 'Morada'], plano), ['Atacadão Novo Mix']);
  assert.deepEqual(pontosVotoAtualizados(['Morada'], plano), []); // passa a votar em todos
  assert.equal(pontosVotoAtualizados(['Bairro Novo'], plano), null); // nada muda
  assert.equal(pontosVotoAtualizados([], plano), null); // já votava em todos
});

test('horários de costume: troca a chave do ponto e apaga o removido', () => {
  const padrao = { Atacadão: ['1|06:00 às 08:00'], Morada: ['2|08:00 às 10:00'], 'Bairro Novo': ['3|10:00 às 12:00'] };
  assert.deepEqual(costumeAtualizado(padrao, plano), {
    'Atacadão Novo Mix': ['1|06:00 às 08:00'],
    'Bairro Novo': ['3|10:00 às 12:00'],
  });
  assert.equal(costumeAtualizado({ 'Bairro Novo': ['1|x'] }, plano), null);
  assert.equal(costumeAtualizado(null, plano), null);
});

test('enquetes: só o rascunho muda; abertas e passadas ficam como estão', () => {
  const rascunho = {
    status: 'rascunho', pontos: ['Atacadão', 'Morada', 'Bairro Novo'],
    bloqueios: [{ data: 'd', turno: '*', ponto: 'Morada' }, { data: 'd', turno: 't', ponto: 'Atacadão' }, { data: 'd', turno: 't' }],
  };
  const nova = rascunhoAtualizado(rascunho, plano);
  assert.deepEqual(nova.pontos, ['Atacadão Novo Mix', 'Bairro Novo']);
  assert.deepEqual(nova.bloqueios, [{ data: 'd', turno: 't', ponto: 'Atacadão Novo Mix' }, { data: 'd', turno: 't' }]);
  assert.equal(rascunhoAtualizado({ ...rascunho, status: 'aberta' }, plano), null);
  assert.equal(rascunhoAtualizado({ status: 'rascunho', pontos: ['Bairro Novo'], bloqueios: [] }, plano), null);
});

test('aviso: quem votava só nos pontos removidos', () => {
  const pubs = [
    { nome: 'Ana', pontosVoto: ['Morada'] },
    { nome: 'Bia', pontosVoto: ['Morada', 'Atacadão'] },
    { nome: 'Caio', pontosVoto: [] },
  ];
  assert.deepEqual(afetadosPelaRemocao(pubs, plano).map((p) => p.nome), ['Ana']);
  assert.deepEqual(afetadosPelaRemocao(pubs, { renomeados: [], removidos: [] }), []);
});
