import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarDias, chave, validarEscala } from '../public/js/escala.js';
import { textoCelula, planilhaDoPonto, nomeDaAba, ESTILOS, CORES } from '../public/js/relatorios.js';
import { montarEvento, detalheTrocaCelula, filtrarEventos, agruparPorDia, nomesCelula } from '../public/js/auditoria.js';
import { idDaTroca, novaTroca, substitutos, substituirPessoa, trocaDoHorario, trocasAbertas } from '../public/js/trocas.js';
import { lerTexto, interpretarLinhas, lerGenero, lerPontos, mapaDeColunas, linhasDoModelo } from '../public/js/importar.js';
import { normalizarBusca } from '../public/js/busca.js';

const T = ['06:00 às 08:00', '08:00 às 10:00'];
const enquete = {
  titulo: 'Semana de 23/11 a 24/11', inicio: '2026-11-23', fim: '2026-11-24',
  pontos: ['Bairro Novo', 'Atacadão'], turnos: T, dias: gerarDias('2026-11-23', '2026-11-24'),
  bloqueios: [{ data: '2026-11-24', turno: T[1], motivo: 'Reunião' }], regras: { maxIrmas: 1 },
};
const eq = (...ps) => ({ tipo: 'equipe', pessoas: ps.map(([id, nome]) => ({ id, nome })) });
const matriz = {
  'Bairro Novo': { '2026-11-23': { [T[0]]: eq(['a', 'Ana'], ['b', 'Bruno']), [T[1]]: { tipo: 'vazio' } }, '2026-11-24': { [T[0]]: eq(['c', 'Caio'], ['d', 'Davi']) } },
  Atacadão: { '2026-11-23': { [T[0]]: eq(['e', 'Eva'], ['f', 'Fábio']) } },
};

/* ------------------------------------------------------------ impressão e Excel */

test('relatório: texto de cada célula (nomes, Pregação, bloqueio)', () => {
  assert.deepEqual(textoCelula(enquete, matriz, 'Bairro Novo', '2026-11-23', T[0]), { tipo: 'equipe', texto: 'Ana / Bruno' });
  assert.deepEqual(textoCelula(enquete, matriz, 'Bairro Novo', '2026-11-23', T[1]), { tipo: 'vazio', texto: 'Pregação' });
  assert.deepEqual(textoCelula(enquete, matriz, 'Bairro Novo', '2026-11-24', T[1]), { tipo: 'bloqueio', texto: 'Reunião' });
});

test('Excel: título, cabeçalho, horários, cores e células mescladas', () => {
  const aba = planilhaDoPonto(enquete, matriz, 'Bairro Novo', new Date(2026, 10, 20));
  assert.equal(aba.nome, 'Bairro Novo');
  assert.equal(aba.linhas[0][0], 'Escala de Carrinhos — Bairro Novo');
  assert.match(aba.linhas[1][0], /Período: 23\/11 a 24\/11/);
  assert.deepEqual(aba.linhas[3], ['Horário', 'Segunda-feira\n23/11', 'Terça-feira\n24/11']);
  assert.deepEqual(aba.linhas[4], [T[0], 'Ana / Bruno', 'Caio / Davi']);
  assert.deepEqual(aba.linhas[5], [T[1], 'Pregação', 'Reunião']);
  assert.match(aba.linhas.at(-1)[0], /Gerado pelo TPMobile em 20\/11\/2026/);
  assert.equal(aba.estilos[0][0].fill.fgColor.rgb, CORES.verde);
  assert.equal(aba.estilos[3][1].fill.fgColor.rgb, CORES.escuro);
  assert.equal(aba.estilos[4][1].alignment.horizontal, 'center');
  assert.equal(aba.estilos[5][2].fill.fgColor.rgb, CORES.bege); // bloqueio
  assert.equal(aba.estilos[5][1].font.italic, true); // Pregação
  assert.deepEqual(aba.mesclar[0], { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } });
  assert.equal(aba.larguras.length, 3);
  assert.equal(ESTILOS.cabecalho.font.bold, true);
});

test('Excel: nome de aba aceito pelo Excel', () => {
  assert.equal(nomeDaAba('Praça: Central / Norte [1]'), 'Praça  Central   Norte  1 ');
  assert.equal(nomeDaAba('x'.repeat(40)).length, 31);
});

/* ------------------------------------------------------------ auditoria */

test('auditoria: evento com quem fez, textos cortados e área conferida', () => {
  const ev = montarEvento({ area: 'escala', acao: 'Trocou pessoas', alvo: 'Semana', detalhe: 'x'.repeat(700), enqueteId: 'e1' }, { nome: 'Paulo', papel: 'admin' });
  assert.equal(ev.nome, 'Paulo');
  assert.equal(ev.papel, 'admin');
  assert.equal(ev.detalhe.length, 600);
  assert.throws(() => montarEvento({ area: 'qualquer', acao: 'x' }, {}), /desconhecida/);
});

test('auditoria: detalhe da troca de pessoas num horário', () => {
  const txt = detalheTrocaCelula('Bairro Novo', '2026-11-23', T[0], eq(['a', 'Ana'], ['b', 'Bia']), eq(['a', 'Ana'], ['c', 'Carla']));
  assert.equal(txt, 'Bairro Novo · Seg 23/11 · 06:00 às 08:00: Ana / Bia → Ana / Carla');
  assert.equal(nomesCelula(null), 'vazio');
});

test('auditoria: filtro por área e busca sem acento; agrupado por dia', () => {
  const eventos = [
    { area: 'escala', acao: 'Gerou a escala', nome: 'Paulo', quando: '2026-11-20T15:00:00Z' },
    { area: 'trocas', acao: 'Pediu troca', detalhe: 'Viagem', nome: 'Helena', quando: '2026-11-21T10:00:00Z' },
    { area: 'trocas', acao: 'Resolveu um pedido de troca', nome: 'Márcia', quando: '2026-11-21T11:00:00Z' },
  ];
  assert.equal(filtrarEventos(eventos, { area: 'trocas' }).length, 2);
  assert.equal(filtrarEventos(eventos, { termo: 'marcia' }, normalizarBusca).length, 1);
  assert.equal(filtrarEventos(eventos, { termo: 'viagem helena' }, normalizarBusca).length, 1);
  const grupos = agruparPorDia(eventos);
  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].eventos[0].acao, 'Resolveu um pedido de troca'); // mais novo primeiro
});

/* ------------------------------------------------------------ trocas e reserva */

const pubs = [
  { id: 'a', nome: 'Ana', genero: 'F' }, { id: 'b', nome: 'Bruno', genero: 'M' },
  { id: 'c', nome: 'Caio', genero: 'M' }, { id: 'd', nome: 'Davi', genero: 'M' },
  { id: 'e', nome: 'Eva', genero: 'F' }, { id: 'f', nome: 'Fábio', genero: 'M' },
  { id: 'g', nome: 'Gil', genero: 'M' }, { id: 'h', nome: 'Hana', genero: 'F' },
  { id: 'i', nome: 'Ivo', genero: 'M', pontosVoto: ['Atacadão'] }, { id: 'j', nome: 'Jó', genero: 'M', ativo: false },
];
const k = chave('2026-11-23', T[0]);
const votos = [
  { publicadorId: 'g', disponibilidade: { 'Bairro Novo': [k] } },
  { publicadorId: 'h', reserva: { 'Bairro Novo': [k] } },
  { publicadorId: 'e', reserva: { 'Bairro Novo': [k] } }, // já está no Atacadão no mesmo horário
  { publicadorId: 'i', disponibilidade: { 'Bairro Novo': [k] } }, // só vota no Atacadão
  { publicadorId: 'j', disponibilidade: { 'Bairro Novo': [k] } }, // inativo
  { publicadorId: 'c', disponibilidade: { 'Bairro Novo': [k] } }, // livre neste horário, mas já tem 1 participação
];

test('troca: id fixo por pessoa e horário (pedir duas vezes não duplica)', () => {
  assert.equal(idDaTroca('b', enquete, 'Bairro Novo', '2026-11-23', T[0]), 'b_2026-11-23_0_0');
  const t = novaTroca({ pubId: 'b', nome: 'Bruno', enquete, ponto: 'Bairro Novo', data: '2026-11-23', turno: T[0], motivo: '  Viagem ' }, new Date('2026-11-20T12:00:00Z'));
  assert.equal(t.id, 'b_2026-11-23_0_0');
  assert.equal(t.status, 'aberta');
  assert.equal(t.motivo, 'Viagem');
  assert.equal(trocaDoHorario([t], 'b', 'Bairro Novo', '2026-11-23', T[0]), t);
  assert.equal(trocasAbertas([{ ...t, status: 'resolvida' }]).length, 0);
});

test('troca: substitutos — reserva primeiro; fora quem está ocupado, inativo, de outro ponto ou de outro gênero', () => {
  // Bruno sai e Ana fica: só irmãs podem entrar (Hana, reserva).
  const sai = (id) => substitutos({ enquete, matriz, votos, publicadores: pubs, troca: { publicadorId: id, ponto: 'Bairro Novo', data: '2026-11-23', turno: T[0] } });
  assert.deepEqual(sai('b').map((s) => [s.id, s.tipo]), [['h', 'reserva']]);
  // Ana sai e Bruno fica: só irmãos (Gil e Caio, que marcaram; Caio já tem 1 participação).
  const subs = sai('a');
  assert.deepEqual(subs.map((s) => [s.id, s.tipo]), [['g', 'disponivel'], ['c', 'disponivel']]);
  assert.equal(subs.find((s) => s.id === 'c').carga, 1);
});

test('troca: irmã no limite aparece com aviso e vai para o fim do seu grupo', () => {
  const m2 = { ...matriz, Atacadão: { '2026-11-24': { [T[0]]: eq(['h', 'Hana'], ['f', 'Fábio']) } } };
  const troca = { publicadorId: 'b', ponto: 'Bairro Novo', data: '2026-11-23', turno: T[0] };
  const h = substitutos({ enquete, matriz: m2, votos, publicadores: pubs, troca }).find((s) => s.id === 'h');
  assert.equal(h.acimaDoLimite, true); // maxIrmas: 1 e ela já tem 1
});

test('troca: o substituto entra na mesma posição', () => {
  const nova = substituirPessoa(eq(['a', 'Ana'], ['b', 'Bruno']), 'b', { id: 'g', nome: 'Gil' });
  assert.deepEqual(nova.pessoas, [{ id: 'a', nome: 'Ana' }, { id: 'g', nome: 'Gil' }]);
});

test('reserva: escalar quem marcou "só se precisar" não gera aviso', () => {
  const m = { 'Bairro Novo': { '2026-11-23': { [T[0]]: eq(['h', 'Hana'], ['g', 'Gil']) } } };
  const avisos = validarEscala({ enquete: { ...enquete, regras: {} }, publicadores: pubs, votos, matriz: m });
  assert.equal(avisos.filter((a) => /não marcou/.test(a.msg)).length, 0);
});

/* ------------------------------------------------------------ importar */

test('importar: lê colado do Excel (tab), CSV com ";" e aspas', () => {
  assert.deepEqual(lerTexto('Nome\tGênero\nAna\tF\n'), [['Nome', 'Gênero'], ['Ana', 'F']]);
  assert.deepEqual(lerTexto('"Silva; João";M'), [['Silva; João', 'M']]);
  assert.deepEqual(lerTexto('a,"b ""c""",d'), [['a', 'b "c"', 'd']]);
});

test('importar: títulos em qualquer ordem ou sem títulos', () => {
  assert.deepEqual(mapaDeColunas(['Gênero', 'Nome', 'Celular']), { genero: 0, nome: 1, telefone: 2 });
  assert.equal(mapaDeColunas(['Ana', 'F']), null);
  assert.equal(lerGenero('irmã'), 'F');
  assert.equal(lerGenero('M'), 'M');
  assert.equal(lerGenero('?'), null);
  assert.deepEqual(lerPontos('bairro novo, ATACADÃO', ['Bairro Novo', 'Atacadão']), { ok: true, lista: ['Bairro Novo', 'Atacadão'] });
  assert.deepEqual(lerPontos('Todos', ['Bairro Novo']), { ok: true, lista: [] });
  assert.equal(lerPontos('Praça', ['Bairro Novo']).ok, false);
});

test('importar: novos, erros e ignorados (já cadastrados ou repetidos no arquivo)', () => {
  const linhas = [
    ['Nome', 'Gênero', 'Telefone', 'Onde vota', 'Precisa de trio'],
    ['Joana', 'F', '(11) 98888-7777', 'Bairro Novo', 'não'],
    ['Pedro', 'irmão', '', 'Todos', 'sim'],
    ['ana', 'F', '', '', ''], // já existe "Ana"
    ['Pedro', 'M', '', '', ''], // repetido no arquivo
    ['Rui', '', '', '', ''], // sem gênero
    ['Lia', 'F', '123', '', ''], // telefone curto
    ['Téo', 'M', '', 'Praça', ''], // ponto desconhecido
    ['', '', '', '', ''],
  ];
  const r = interpretarLinhas(linhas, { existentes: [{ nome: 'Ana' }], pontos: ['Bairro Novo', 'Atacadão'] });
  assert.deepEqual(r.novos.map((p) => p.nome), ['Joana', 'Pedro']);
  assert.equal(r.novos[1].requerTrio, true);
  assert.deepEqual(r.novos[0].pontosVoto, ['Bairro Novo']);
  assert.deepEqual(r.ignorados.map((x) => [x.linha, x.nome]), [[4, 'ana'], [5, 'Pedro']]);
  assert.deepEqual(r.erros.map((x) => x.linha), [6, 7, 8]);
});

test('importar: modelo tem as colunas e exemplos', () => {
  const m = linhasDoModelo(['Bairro Novo']);
  assert.equal(m[0][0], 'Nome');
  assert.equal(m.length, 3);
  const r = interpretarLinhas(m, { pontos: ['Bairro Novo'] });
  assert.equal(r.novos.length, 2); // o próprio modelo é válido
});
