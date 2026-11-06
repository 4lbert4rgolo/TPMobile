import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarDias, gerarEscala, validarEscala, contarParticipacoes, chave, celulaBloqueada, pontosDoPublicador } from '../public/js/escala.js';

const TURNOS = ['06:00 às 08:00', '08:00 às 10:00', '10:00 às 12:00', '14:00 às 16:00', '16:00 às 18:00', '18:00 às 20:00'];
const PONTOS = ['Bairro Novo', 'Atacadão Novo Mix', 'Morada dos Canários e Sabiás'];

const publicadores = [
  { id: 'a', nome: 'Anderson', genero: 'M', conjuge: 'b' },
  { id: 'b', nome: 'Bianca', genero: 'F', conjuge: 'a' },
  { id: 'c', nome: 'Regina', genero: 'F' },
  { id: 'd', nome: 'Felipa', genero: 'F' },
  { id: 'e', nome: 'Milena', genero: 'F' },
  { id: 'f', nome: 'Evillyn', genero: 'F' },
  { id: 'g', nome: 'Sophia', genero: 'F' },
  { id: 'h', nome: 'Adrielle', genero: 'F', conjuge: 'i' },
  { id: 'i', nome: 'Jil', genero: 'M', conjuge: 'h' },
  { id: 'j', nome: 'Tereza', genero: 'F', requerTrio: true },
  { id: 'k', nome: 'Samuel', genero: 'M', conjuge: 'l' },
  { id: 'l', nome: 'Fernanda', genero: 'F', conjuge: 'k' },
  { id: 'm', nome: 'Pedro', genero: 'M' },
  { id: 'n', nome: 'Lucas', genero: 'M', requerTrio: true },
];

function enquete(extra = {}) {
  return {
    pontos: PONTOS,
    turnos: TURNOS,
    dias: gerarDias('2026-10-26', '2026-10-31'),
    bloqueios: [{ data: '2026-10-29', turno: '18:00 às 20:00', motivo: 'Reunião' }],
    regras: { maxIrmas: 3, parFixoJunto: true },
    ...extra,
  };
}

// Votos "aleatórios" mas sempre iguais (gerador congruencial simples)
function votosDeExemplo(e, probabilidade = 0.45) {
  let semente = 12345;
  const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
  return publicadores.map((p) => {
    const disponibilidade = {};
    for (const ponto of PONTOS) {
      disponibilidade[ponto] = [];
      for (const dia of e.dias) for (const t of e.turnos) if (rnd() < probabilidade) disponibilidade[ponto].push(chave(dia.data, t));
    }
    return { publicadorId: p.id, disponibilidade };
  });
}

function celulas(matriz) {
  const lista = [];
  for (const ponto of Object.keys(matriz)) for (const data of Object.keys(matriz[ponto])) for (const turno of Object.keys(matriz[ponto][data])) lista.push({ ponto, data, turno, ...matriz[ponto][data][turno] });
  return lista;
}

test('gerarDias cria os dias do período (máximo 14)', () => {
  assert.equal(gerarDias('2026-10-26', '2026-10-31').length, 6);
  assert.equal(gerarDias('2026-10-01', '2026-12-31').length, 14);
});

test('a escala respeita todas as regras', () => {
  const e = enquete();
  const votos = votosDeExemplo(e);
  const { matriz, avisos } = gerarEscala({ enquete: e, publicadores, votos });
  const porId = new Map(publicadores.map((p) => [p.id, p]));
  const todas = celulas(matriz).filter((c) => c.tipo === 'equipe');
  assert.ok(todas.length > 10, `esperava várias equipes, veio ${todas.length}`);

  // 1. irmãs: no máximo 3 participações
  for (const [id, info] of contarParticipacoes(matriz)) {
    if (porId.get(id).genero === 'F') assert.ok(info.total <= 3, `${info.nome} com ${info.total}`);
  }

  // 2. quem precisa de trio só participa com 3 pessoas; os demais em duplas
  for (const c of todas) {
    const precisa = c.pessoas.some((p) => porId.get(p.id).requerTrio);
    assert.equal(c.pessoas.length, precisa ? 3 : 2, `equipe ${c.pessoas.map((p) => p.nome)} em ${c.ponto} ${c.data}`);
  }

  // 3. par fixo sempre junto
  for (const c of todas) {
    for (const p of c.pessoas) {
      const par = porId.get(p.id).conjuge;
      if (par) assert.ok(c.pessoas.some((x) => x.id === par), `${p.nome} sem o par`);
    }
  }

  // 4. ninguém em dois pontos no mesmo horário
  const vistos = new Set();
  for (const c of todas) for (const p of c.pessoas) {
    const k = `${p.id}|${c.data}|${c.turno}`;
    assert.ok(!vistos.has(k), `${p.nome} duplicado`);
    vistos.add(k);
  }

  // 5. horário bloqueado nunca é preenchido
  for (const ponto of PONTOS) assert.equal(matriz[ponto]['2026-10-29']['18:00 às 20:00'].tipo, 'bloqueio');

  // 6. só escala quem marcou o horário
  assert.ok(!avisos.some((a) => a.nivel === 'erro'), JSON.stringify(avisos.filter((a) => a.nivel === 'erro')));
  assert.ok(!avisos.some((a) => /não marcou/.test(a.msg)));
});

test('com limite 4, as irmãs podem chegar a 4 participações', () => {
  const e = enquete({ regras: { maxIrmas: 4, parFixoJunto: true } });
  const { matriz } = gerarEscala({ enquete: e, publicadores, votos: votosDeExemplo(e, 0.7) });
  const maxIrma = Math.max(...[...contarParticipacoes(matriz)].filter(([id]) => publicadores.find((p) => p.id === id).genero === 'F').map(([, i]) => i.total));
  assert.ok(maxIrma <= 4);
});

test('quem precisa de trio não entra se não houver gente para completar', () => {
  const e = enquete();
  const votos = [
    { publicadorId: 'j', disponibilidade: { 'Bairro Novo': [chave('2026-10-26', TURNOS[0])] } },
    { publicadorId: 'm', disponibilidade: { 'Bairro Novo': [chave('2026-10-26', TURNOS[0])] } },
  ];
  const { matriz } = gerarEscala({ enquete: e, publicadores, votos });
  assert.equal(matriz['Bairro Novo']['2026-10-26'][TURNOS[0]].tipo, 'vazio');
});

test('quem tem par fixo não participa sem o par', () => {
  const e = enquete();
  const t = chave('2026-10-26', TURNOS[1]);
  const votos = ['a', 'c', 'd'].map((id) => ({ publicadorId: id, disponibilidade: { 'Bairro Novo': [t] } }));
  const { matriz } = gerarEscala({ enquete: e, publicadores, votos });
  const cel = matriz['Bairro Novo']['2026-10-26'][TURNOS[1]];
  assert.equal(cel.tipo, 'equipe');
  assert.deepEqual(cel.pessoas.map((p) => p.id).sort(), ['c', 'd']); // Anderson (par: Bianca) ficou de fora
});

test('a validação avisa sobre ajustes manuais que quebram regras', () => {
  const e = enquete();
  const votos = [];
  const matriz = { 'Bairro Novo': { '2026-10-26': { [TURNOS[0]]: { tipo: 'equipe', pessoas: [{ id: 'j', nome: 'Tereza' }, { id: 'c', nome: 'Regina' }] } } } };
  const avisos = validarEscala({ enquete: e, publicadores, votos, matriz });
  assert.ok(avisos.some((a) => a.nivel === 'erro' && /só participa em trio/.test(a.msg)));
  assert.ok(avisos.some((a) => /não marcou/.test(a.msg)));
});

test('limite opcional por irmão distribui melhor as participações', () => {
  const e = enquete({ regras: { maxIrmas: 3, maxIrmaos: 5, parFixoJunto: true } });
  const { matriz, avisos } = gerarEscala({ enquete: e, publicadores, votos: votosDeExemplo(e, 0.6) });
  const porId = new Map(publicadores.map((p) => [p.id, p]));
  for (const [id, info] of contarParticipacoes(matriz)) {
    const limite = porId.get(id).genero === 'F' ? 3 : 5;
    assert.ok(info.total <= limite, `${info.nome} com ${info.total}`);
  }
  assert.ok(!avisos.some((a) => a.nivel === 'erro'));
});

test('bloqueio com ponto vale só naquele ponto; sem ponto vale em todos; turno * bloqueia o dia todo', () => {
  const e = enquete({
    bloqueios: [
      { data: '2026-10-27', turno: TURNOS[0], ponto: 'Bairro Novo', motivo: 'Feira' },
      { data: '2026-10-28', turno: '*', ponto: 'Atacadão Novo Mix', motivo: 'Obra' },
      { data: '2026-10-29', turno: TURNOS[1], motivo: 'Reunião' },
    ],
  });
  assert.equal(celulaBloqueada(e, '2026-10-27', TURNOS[0], 'Bairro Novo'), 'Feira');
  assert.equal(celulaBloqueada(e, '2026-10-27', TURNOS[0], 'Atacadão Novo Mix'), null);
  assert.equal(celulaBloqueada(e, '2026-10-28', TURNOS[3], 'Atacadão Novo Mix'), 'Obra');
  assert.equal(celulaBloqueada(e, '2026-10-28', TURNOS[3], 'Bairro Novo'), null);
  assert.equal(celulaBloqueada(e, '2026-10-29', TURNOS[1], 'Morada dos Canários e Sabiás'), 'Reunião');

  const { matriz } = gerarEscala({ enquete: e, publicadores, votos: votosDeExemplo(e, 0.9) });
  assert.equal(matriz['Bairro Novo']['2026-10-27'][TURNOS[0]].tipo, 'bloqueio');
  assert.notEqual(matriz['Atacadão Novo Mix']['2026-10-27'][TURNOS[0]].tipo, 'bloqueio');
  for (const t of TURNOS) {
    assert.equal(matriz['Atacadão Novo Mix']['2026-10-28'][t].tipo, 'bloqueio');
    assert.notEqual(matriz['Bairro Novo']['2026-10-28'][t].tipo, 'bloqueio');
  }
});

test('pontosDoPublicador: sem restrição vale todos; restrição sem ponto em comum também volta a todos', () => {
  assert.deepEqual(pontosDoPublicador({}, PONTOS), PONTOS);
  assert.deepEqual(pontosDoPublicador({ pontosVoto: [] }, PONTOS), PONTOS);
  assert.deepEqual(pontosDoPublicador({ pontosVoto: ['Bairro Novo'] }, PONTOS), ['Bairro Novo']);
  assert.deepEqual(pontosDoPublicador({ pontosVoto: ['Bairro Novo', 'Outro'] }, PONTOS), ['Bairro Novo']);
  assert.deepEqual(pontosDoPublicador({ pontosVoto: ['Praça que não existe'] }, PONTOS), PONTOS);
});

test('quem vota só em um ponto nunca é escalado em outro, mesmo com voto antigo nos demais', () => {
  const e = enquete();
  const restritos = publicadores.map((p) => (p.id === 'c' || p.id === 'd' ? { ...p, pontosVoto: ['Atacadão Novo Mix'] } : p));
  const { matriz, avisos } = gerarEscala({ enquete: e, publicadores: restritos, votos: votosDeExemplo(e, 0.9) });
  for (const ponto of PONTOS) {
    if (ponto === 'Atacadão Novo Mix') continue;
    for (const data of Object.keys(matriz[ponto])) for (const turno of Object.keys(matriz[ponto][data])) {
      const cel = matriz[ponto][data][turno];
      if (cel.tipo === 'equipe') assert.ok(!cel.pessoas.some((p) => p.id === 'c' || p.id === 'd'), `${ponto} ${data} ${turno}`);
    }
  }
  const noAtacadao = Object.values(matriz['Atacadão Novo Mix']).flatMap((d) => Object.values(d)).filter((c) => c.tipo === 'equipe' && c.pessoas.some((p) => p.id === 'c' || p.id === 'd'));
  assert.ok(noAtacadao.length > 0, 'elas deveriam aparecer no ponto delas');
  assert.ok(!avisos.some((a) => a.nivel === 'erro'));
});

test('a validação avisa quando um ajuste manual põe alguém fora do ponto dele', () => {
  const e = enquete();
  const restritos = publicadores.map((p) => (p.id === 'c' ? { ...p, pontosVoto: ['Atacadão Novo Mix'] } : p));
  const matriz = { 'Bairro Novo': { '2026-10-26': { [TURNOS[0]]: { tipo: 'equipe', pessoas: [{ id: 'c', nome: 'Regina' }, { id: 'd', nome: 'Felipa' }] } } } };
  const avisos = validarEscala({ enquete: e, publicadores: restritos, votos: [], matriz });
  assert.ok(avisos.some((a) => /Regina está configurado para votar só em Atacadão Novo Mix/.test(a.msg)));
  assert.ok(!avisos.some((a) => /Regina não marcou/.test(a.msg)), 'não repete o aviso genérico para quem está fora do ponto');
});
