import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarDias, gerarEscala, historicoDeParticipacoes, contarParticipacoes,
  trocarCelula, exigirVersao, mesmaCelula, ConflitoEscala, chave,
} from '../public/js/escala.js';
import { meusHorarios, horarioDoTurno, gerarICS, linkGoogleAgenda } from '../public/js/agenda.js';
import { normalizarBusca, textoBusca, combina } from '../public/js/busca.js';
import { normalizarPapel, PAPEIS, ORGANIZADORES } from '../public/js/data.js';

/* ------------------------------------------------------------ perfis */

test('perfis: só Votante, Servo Ministerial e Administrador; ancião antigo vale como administrador', () => {
  assert.equal(PAPEIS.anciao, undefined);
  assert.equal(PAPEIS.servo, 'Servo Ministerial');
  assert.deepEqual(ORGANIZADORES, ['servo', 'admin']);
  assert.equal(normalizarPapel('anciao'), 'admin');
  assert.equal(normalizarPapel('servo'), 'servo');
  assert.equal(normalizarPapel('votante'), 'votante');
});

/* ------------------------------------------------------------ dois organizadores */

const equipe = (...ids) => ({ tipo: 'equipe', pessoas: ids.map((id) => ({ id, nome: id.toUpperCase() })) });

test('conflito: trocar um horário mantém a mudança que outro organizador fez em outro horário', () => {
  const naTela = { versao: 1, matriz: { P: { '2026-11-23': { T1: equipe('a', 'b'), T2: equipe('c', 'd') } } } };
  // Outro organizador mudou o T2 enquanto eu editava o T1:
  const noBanco = { versao: 2, ajustadoPor: 'Paulo', matriz: { P: { '2026-11-23': { T1: equipe('a', 'b'), T2: equipe('e', 'f') } } } };
  const novo = trocarCelula(noBanco, {
    ponto: 'P', data: '2026-11-23', turno: 'T1',
    antes: naTela.matriz.P['2026-11-23'].T1, depois: equipe('g', 'h'), matrizLocal: naTela.matriz,
  });
  assert.ok(mesmaCelula(novo.matriz.P['2026-11-23'].T1, equipe('g', 'h')));
  assert.ok(mesmaCelula(novo.matriz.P['2026-11-23'].T2, equipe('e', 'f')), 'a mudança do outro organizador continua lá');
  assert.ok(mesmaCelula(noBanco.matriz.P['2026-11-23'].T1, equipe('a', 'b')), 'não altera o objeto original');
});

test('conflito: se o outro mudou o MESMO horário, avisa em vez de apagar', () => {
  const noBanco = { versao: 2, ajustadoPor: 'Paulo', matriz: { P: { D: { T1: equipe('x', 'y') } } } };
  assert.throws(
    () => trocarCelula(noBanco, { ponto: 'P', data: 'D', turno: 'T1', antes: equipe('a', 'b'), depois: equipe('g', 'h') }),
    (e) => e instanceof ConflitoEscala && e.tipo === 'celula' && e.atual.ajustadoPor === 'Paulo'
  );
});

test('conflito: a ordem das pessoas não conta como mudança', () => {
  assert.ok(mesmaCelula(equipe('a', 'b'), equipe('b', 'a')));
  assert.ok(mesmaCelula(undefined, { tipo: 'vazio' }));
  assert.ok(!mesmaCelula(equipe('a', 'b'), equipe('a', 'c')));
});

test('conflito: gerar/publicar só grava se a versão no banco é a da tela', () => {
  assert.doesNotThrow(() => exigirVersao({ versao: 3 }, 3));
  assert.doesNotThrow(() => exigirVersao(null, undefined)); // escala ainda não existe
  assert.doesNotThrow(() => exigirVersao({ matriz: {} }, undefined)); // escala antiga, sem versão
  assert.throws(() => exigirVersao({ versao: 4 }, 3), ConflitoEscala);
});

/* ------------------------------------------------------------ equilíbrio entre semanas */

test('histórico: média de participações por escala', () => {
  const m1 = { P: { D: { T1: equipe('a', 'b'), T2: equipe('a', 'c') } } };
  const m2 = { P: { D: { T1: equipe('b', 'c') } } };
  const h = historicoDeParticipacoes([m1, m2, null]);
  assert.equal(h.get('a'), 1); // 2 + 0, em 2 escalas
  assert.equal(h.get('b'), 1);
  assert.equal(h.get('c'), 1);
  assert.equal(historicoDeParticipacoes([]).size, 0);
});

const TURNOS = ['06:00 às 08:00'];
const pubs = [
  { id: 'a', nome: 'Ana', genero: 'F' },
  { id: 'b', nome: 'Bia', genero: 'F' },
  { id: 'c', nome: 'Caio', genero: 'M' },
  { id: 'd', nome: 'Davi', genero: 'M' },
];
const enq = (regras = {}) => ({ pontos: ['P'], turnos: TURNOS, dias: gerarDias('2026-11-23', '2026-11-23'), bloqueios: [], regras });
const votosTodos = pubs.map((p) => ({ publicadorId: p.id, disponibilidade: { P: [chave('2026-11-23', TURNOS[0])] } }));
const escalados = (matriz) => matriz.P['2026-11-23'][TURNOS[0]].pessoas.map((p) => p.id).sort();

test('equilíbrio: sem histórico, desempata pelo nome (Ana e Bia)', () => {
  const { matriz } = gerarEscala({ enquete: enq(), publicadores: pubs, votos: votosTodos });
  assert.deepEqual(escalados(matriz), ['a', 'b']);
});

test('equilíbrio: quem participou menos nas semanas anteriores tem a vez (Caio e Davi)', () => {
  const historico = new Map([['a', 2], ['b', 2], ['c', 0], ['d', 0]]);
  const { matriz } = gerarEscala({ enquete: enq(), publicadores: pubs, votos: votosTodos, historico });
  assert.deepEqual(escalados(matriz), ['c', 'd']);
});

test('equilíbrio: desligado na enquete, o histórico é ignorado', () => {
  const historico = new Map([['a', 2], ['b', 2]]);
  const { matriz } = gerarEscala({ enquete: enq({ equilibrarSemanas: false }), publicadores: pubs, votos: votosTodos, historico });
  assert.deepEqual(escalados(matriz), ['a', 'b']);
});

test('equilíbrio: o histórico não fura o limite das irmãs', () => {
  const turnos = ['T1', 'T2', 'T3', 'T4'];
  const e = { pontos: ['P'], turnos, dias: gerarDias('2026-11-23', '2026-11-23'), bloqueios: [], regras: { maxIrmas: 1 } };
  const votos = pubs.map((p) => ({ publicadorId: p.id, disponibilidade: { P: turnos.map((t) => chave('2026-11-23', t)) } }));
  const { matriz } = gerarEscala({ enquete: e, publicadores: pubs, votos, historico: new Map([['c', 3], ['d', 3]]) });
  assert.ok(contarParticipacoes(matriz).get('a').total <= 1);
  assert.ok(contarParticipacoes(matriz).get('b').total <= 1);
});

/* ------------------------------------------------------------ minha escala */

const enquetesPub = [
  { id: 'e2', titulo: 'Semana 2', turnos: ['08:00 às 10:00', '06:00 às 08:00'] },
  { id: 'e1', titulo: 'Semana 1', turnos: ['06:00 às 08:00'] },
];
const escalasPub = new Map([
  ['e1', { publicada: true, matriz: { 'Bairro Novo': { '2026-11-23': { '06:00 às 08:00': equipe('a', 'b') } } } }],
  ['e2', { publicada: true, matriz: {
    'Bairro Novo': { '2026-11-30': { '08:00 às 10:00': equipe('c', 'a'), '06:00 às 08:00': equipe('a', 'd') } },
    'Atacadão': { '2026-11-30': { '06:00 às 08:00': equipe('b', 'c') } },
  } }],
]);

test('minha escala: lista só os horários da pessoa, em ordem de data e horário', () => {
  const itens = meusHorarios(enquetesPub, escalasPub, 'a');
  assert.deepEqual(itens.map((i) => `${i.data} ${i.turno} ${i.ponto}`), [
    '2026-11-23 06:00 às 08:00 Bairro Novo',
    '2026-11-30 08:00 às 10:00 Bairro Novo', // a ordem segue a lista de turnos da enquete
    '2026-11-30 06:00 às 08:00 Bairro Novo',
  ]);
  assert.deepEqual(itens[0].companheiros, ['B']);
});

test('minha escala: escala não publicada não aparece', () => {
  const escalas = new Map([['e1', { publicada: false, matriz: escalasPub.get('e1').matriz }]]);
  assert.equal(meusHorarios([enquetesPub[1]], escalas, 'a').length, 0);
  assert.equal(meusHorarios(enquetesPub, escalasPub, null).length, 0);
});

test('minha escala: entende o horário do turno', () => {
  assert.deepEqual(horarioDoTurno('06:00 às 08:00'), { inicio: '06:00', fim: '08:00' });
  assert.deepEqual(horarioDoTurno('6h às 8h'), { inicio: '06:00', fim: '08:00' });
  assert.deepEqual(horarioDoTurno('14:30 - 16:00'), { inicio: '14:30', fim: '16:00' });
  assert.equal(horarioDoTurno('Manhã'), null);
});

test('minha escala: arquivo de calendário (.ics) com um evento por horário', () => {
  const itens = meusHorarios(enquetesPub, escalasPub, 'a');
  const ics = gerarICS(itens, new Date('2026-11-18T12:00:00Z'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 3);
  assert.ok(ics.includes('DTSTART:20261123T060000'));
  assert.ok(ics.includes('DTEND:20261123T080000'));
  assert.ok(ics.includes('SUMMARY:Carrinho – Bairro Novo'));
  assert.ok(ics.includes('DESCRIPTION:Com: B\\nHorário: 06:00 às 08:00\\nEscala: Semana 1'));
  assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'));
});

test('minha escala: link do Google Agenda já preenchido', () => {
  const [item] = meusHorarios(enquetesPub, escalasPub, 'a');
  const url = new URL(linkGoogleAgenda(item));
  assert.equal(url.hostname, 'calendar.google.com');
  assert.equal(url.searchParams.get('dates'), '20261123T060000/20261123T080000');
  assert.equal(url.searchParams.get('location'), 'Bairro Novo');
});

/* ------------------------------------------------------------ busca */

test('busca: sem acento, sem maiúscula, palavras em qualquer ordem', () => {
  assert.equal(normalizarBusca('  Márcia  Conceição '), 'marcia conceicao');
  const linha = textoBusca('Márcia Conceição', 'marcia@x.com', 'Servo Ministerial');
  assert.ok(combina(linha, 'marcia'));
  assert.ok(combina(linha, 'CONCEICAO márcia'));
  assert.ok(combina(linha, ''));
  assert.ok(!combina(linha, 'joao'));
});
