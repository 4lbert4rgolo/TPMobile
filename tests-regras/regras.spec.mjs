// Testes das regras de segurança do Firestore (firestore.rules), rodando no emulador.
// Como rodar: npm run test:regras   (precisa de Java; o GitHub Actions já faz isso sozinho)
//
// A ideia: montamos um "banco de mentira" com alguns usuários e conferimos, caso a caso,
// o que cada perfil PODE e o que NÃO PODE fazer. Se alguém mudar uma regra e abrir uma
// brecha (ex.: votante lendo a lista de publicadores), um destes testes falha.

import test, { before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp, query, where } from 'firebase/firestore';

const CONVITE = 'a'.repeat(32);
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-tpmobile',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });

// Dados iniciais (gravados sem passar pelas regras).
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const usuarios = {
      adm: { nome: 'Admin', papel: 'admin' },
      servo: { nome: 'Servo', papel: 'servo' },
      anc: { nome: 'Ancião (perfil antigo)', papel: 'anciao' },
      vot: { nome: 'Votante', papel: 'votante', publicadorId: 'p1' },
      pend: { nome: 'Pendente', papel: 'pendente', publicadorId: null },
      rem: { nome: 'Removido', papel: 'removido', publicadorId: 'p3' },
    };
    for (const [uid, d] of Object.entries(usuarios)) await setDoc(doc(db, 'usuarios', uid), d);
    await setDoc(doc(db, 'publicadores', 'p1'), { nome: 'Pub Um', telefone: '5511900000001' });
    await setDoc(doc(db, 'publicadores', 'p2'), { nome: 'Pub Dois', telefone: '5511900000002' });
    await setDoc(doc(db, 'config', 'geral'), { pontos: ['A'] });
    await setDoc(doc(db, 'enquetes', 'aberta'), { titulo: 'Aberta', status: 'aberta' });
    await setDoc(doc(db, 'enquetes', 'fechada'), { titulo: 'Fechada', status: 'fechada' });
    await setDoc(doc(db, 'enquetes', 'rascunho'), { titulo: 'Rascunho', status: 'rascunho' });
    await setDoc(doc(db, 'enquetes', 'pub'), { titulo: 'Publicada', status: 'publicada' });
    await setDoc(doc(db, 'enquetes', 'aberta', 'votos', 'p1'), { publicadorId: 'p1', disponibilidade: {} });
    await setDoc(doc(db, 'enquetes', 'aberta', 'votos', 'p2'), { publicadorId: 'p2', disponibilidade: {} });
    await setDoc(doc(db, 'enquetes', 'pub', 'escala', 'atual'), { publicada: true, celulas: {} });
    await setDoc(doc(db, 'enquetes', 'fechada', 'escala', 'atual'), { publicada: false, celulas: {} });
    await setDoc(doc(db, 'disponibilidadePadrao', 'p1'), { publicadorId: 'p1', padrao: {} });
    await setDoc(doc(db, 'disponibilidadePadrao', 'p2'), { publicadorId: 'p2', padrao: {} });
    await setDoc(doc(db, 'convites', CONVITE), { ativo: true, nome: 'Pub Um', publicadorId: 'p1' });
  });
});

const como = (uid, provedor = 'password') => env.authenticatedContext(uid, { firebase: { sign_in_provider: provedor } }).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();

/* ---------------------------------------------------------------- sem login */

test('sem login: não lê nada', async () => {
  const db = anonimo();
  await assertFails(getDoc(doc(db, 'publicadores', 'p1')));
  await assertFails(getDoc(doc(db, 'enquetes', 'pub')));
  await assertFails(getDoc(doc(db, 'config', 'geral')));
  await assertFails(getDoc(doc(db, 'convites', CONVITE)));
  await assertFails(getDoc(doc(db, 'usuarios', 'vot')));
});

/* ---------------------------------------------------------------- pendente e removido */

test('pendente: lê só o próprio cadastro', async () => {
  const db = como('pend');
  await assertSucceeds(getDoc(doc(db, 'usuarios', 'pend')));
  await assertFails(getDoc(doc(db, 'usuarios', 'vot')));
  await assertFails(getDoc(doc(db, 'publicadores', 'p1')));
  await assertFails(getDoc(doc(db, 'config', 'geral')));
  await assertFails(getDoc(doc(db, 'enquetes', 'aberta')));
});

test('pendente: não consegue se promover a administrador', async () => {
  await assertFails(updateDoc(doc(como('pend'), 'usuarios', 'pend'), { papel: 'admin' }));
});

test('removido: perde o acesso aos dados', async () => {
  const db = como('rem');
  await assertFails(getDoc(doc(db, 'publicadores', 'p3')));
  await assertFails(getDoc(doc(db, 'enquetes', 'pub')));
  await assertFails(getDoc(doc(db, 'config', 'geral')));
});

/* ---------------------------------------------------------------- votante */

test('votante: lê só o próprio publicador (e não o telefone dos outros)', async () => {
  const db = como('vot');
  await assertSucceeds(getDoc(doc(db, 'publicadores', 'p1')));
  await assertFails(getDoc(doc(db, 'publicadores', 'p2')));
  await assertFails(getDocs(collection(db, 'publicadores')));
});

test('votante: não altera cadastro de publicadores', async () => {
  const db = como('vot');
  await assertFails(setDoc(doc(db, 'publicadores', 'p1'), { nome: 'Outro nome' }));
  await assertFails(deleteDoc(doc(db, 'publicadores', 'p1')));
});

test('votante: vê enquetes abertas, fechadas e publicadas, mas não rascunhos', async () => {
  const db = como('vot');
  await assertSucceeds(getDoc(doc(db, 'enquetes', 'aberta')));
  await assertSucceeds(getDoc(doc(db, 'enquetes', 'fechada')));
  await assertSucceeds(getDoc(doc(db, 'enquetes', 'pub')));
  await assertFails(getDoc(doc(db, 'enquetes', 'rascunho')));
});

test('votante: não cria, altera nem apaga enquetes', async () => {
  const db = como('vot');
  await assertFails(setDoc(doc(db, 'enquetes', 'nova'), { titulo: 'x', status: 'aberta' }));
  await assertFails(updateDoc(doc(db, 'enquetes', 'aberta'), { status: 'publicada' }));
  await assertFails(deleteDoc(doc(db, 'enquetes', 'aberta')));
});

test('votante: grava o próprio voto com a votação aberta', async () => {
  await assertSucceeds(setDoc(doc(como('vot'), 'enquetes', 'aberta', 'votos', 'p1'), { publicadorId: 'p1', disponibilidade: { x: 1 } }));
  // v3.14: só os campos do voto, com tamanho limitado.
  await assertSucceeds(setDoc(doc(como('vot'), 'enquetes', 'aberta', 'votos', 'p1'), { publicadorId: 'p1', nome: 'Pub Um', disponibilidade: { A: ['2026-11-23|T'] }, atualizadoEm: serverTimestamp() }));
  await assertFails(setDoc(doc(como('vot'), 'enquetes', 'aberta', 'votos', 'p1'), { publicadorId: 'p1', disponibilidade: {}, extra: 'x' }));
  await assertFails(setDoc(doc(como('vot'), 'enquetes', 'aberta', 'votos', 'p1'), { publicadorId: 'p1', disponibilidade: 'tudo' }));
  await assertFails(setDoc(doc(como('vot'), 'enquetes', 'aberta', 'votos', 'p1'), { publicadorId: 'p1', nome: 'x'.repeat(101), disponibilidade: {} }));
});

test('votante: não grava voto de outra pessoa', async () => {
  await assertFails(setDoc(doc(como('vot'), 'enquetes', 'aberta', 'votos', 'p2'), { publicadorId: 'p2', disponibilidade: {} }));
});

test('votante: não grava o próprio voto com o publicadorId trocado', async () => {
  await assertFails(setDoc(doc(como('vot'), 'enquetes', 'aberta', 'votos', 'p1'), { publicadorId: 'p2', disponibilidade: {} }));
});

test('votante: não vota em enquete fechada', async () => {
  await assertFails(setDoc(doc(como('vot'), 'enquetes', 'fechada', 'votos', 'p1'), { publicadorId: 'p1', disponibilidade: {} }));
});

test('votante: lê o próprio voto, não o dos outros', async () => {
  const db = como('vot');
  await assertSucceeds(getDoc(doc(db, 'enquetes', 'aberta', 'votos', 'p1')));
  await assertFails(getDoc(doc(db, 'enquetes', 'aberta', 'votos', 'p2')));
  await assertFails(getDocs(collection(db, 'enquetes', 'aberta', 'votos')));
});

test('votante: só vê a escala publicada', async () => {
  const db = como('vot');
  await assertSucceeds(getDoc(doc(db, 'enquetes', 'pub', 'escala', 'atual')));
  await assertFails(getDoc(doc(db, 'enquetes', 'fechada', 'escala', 'atual')));
});

test('votante: não altera a escala', async () => {
  await assertFails(setDoc(doc(como('vot'), 'enquetes', 'pub', 'escala', 'atual'), { publicada: true, celulas: { a: 1 } }));
});

test('votante: costume — lê e grava só o próprio', async () => {
  const db = como('vot');
  await assertSucceeds(getDoc(doc(db, 'disponibilidadePadrao', 'p1')));
  await assertSucceeds(setDoc(doc(db, 'disponibilidadePadrao', 'p1'), { publicadorId: 'p1', padrao: { ponto: ['1|x'] } }));
  await assertFails(getDoc(doc(db, 'disponibilidadePadrao', 'p2')));
  await assertFails(setDoc(doc(db, 'disponibilidadePadrao', 'p2'), { publicadorId: 'p2', padrao: {} }));
  await assertFails(setDoc(doc(db, 'disponibilidadePadrao', 'p1'), { publicadorId: 'p2', padrao: {} }));
});

test('votante: lê a configuração, mas não altera', async () => {
  const db = como('vot');
  await assertSucceeds(getDoc(doc(db, 'config', 'geral')));
  await assertFails(setDoc(doc(db, 'config', 'geral'), { pontos: [] }));
});

test('votante: não lê a lista de usuários nem muda o próprio perfil', async () => {
  const db = como('vot');
  await assertFails(getDocs(collection(db, 'usuarios')));
  await assertFails(getDoc(doc(db, 'usuarios', 'adm')));
  await assertFails(updateDoc(doc(db, 'usuarios', 'vot'), { papel: 'admin' }));
});

/* ---------------------------------------------------------------- organizadores */

for (const uid of ['servo']) {
  test(`${uid}: lê todos os publicadores e edita o cadastro`, async () => {
    const db = como(uid);
    await assertSucceeds(getDocs(collection(db, 'publicadores')));
    await assertSucceeds(setDoc(doc(db, 'publicadores', 'p9'), { nome: 'Novo' }));
    await assertSucceeds(deleteDoc(doc(db, 'publicadores', 'p9')));
  });

  test(`${uid}: cria enquete, vê rascunhos, lê votos e mexe na escala`, async () => {
    const db = como(uid);
    await assertSucceeds(setDoc(doc(db, 'enquetes', 'n1'), { titulo: 'N', status: 'rascunho' }));
    await assertSucceeds(getDoc(doc(db, 'enquetes', 'rascunho')));
    await assertSucceeds(getDocs(collection(db, 'enquetes', 'aberta', 'votos')));
    await assertSucceeds(setDoc(doc(db, 'enquetes', 'fechada', 'votos', 'p2'), { publicadorId: 'p2', disponibilidade: {} }));
    await assertSucceeds(setDoc(doc(db, 'enquetes', 'fechada', 'escala', 'atual'), { publicada: false, celulas: {} }));
    await assertSucceeds(getDoc(doc(db, 'disponibilidadePadrao', 'p2')));
  });

  test(`${uid}: não lê a lista de usuários nem muda perfis`, async () => {
    const db = como(uid);
    await assertFails(getDocs(collection(db, 'usuarios')));
    await assertFails(updateDoc(doc(db, 'usuarios', 'vot'), { papel: 'admin' }));
    await assertFails(updateDoc(doc(db, 'usuarios', uid), { papel: 'admin' }));
  });

  test(`${uid}: não lista nem cria links pessoais`, async () => {
    const db = como(uid);
    await assertFails(getDocs(collection(db, 'convites')));
    await assertFails(setDoc(doc(db, 'convites', 'b'.repeat(32)), { ativo: true, nome: 'X', publicadorId: 'p2' }));
  });
}

/* ---------------------------------------------------------------- administrador */

test('administrador: lê e altera usuários, lista e cria convites', async () => {
  const db = como('adm');
  await assertSucceeds(getDocs(collection(db, 'usuarios')));
  await assertSucceeds(updateDoc(doc(db, 'usuarios', 'pend'), { papel: 'votante' }));
  await assertSucceeds(getDocs(collection(db, 'convites')));
  await assertSucceeds(setDoc(doc(db, 'convites', 'c'.repeat(32)), { ativo: true, nome: 'Pub Dois', publicadorId: 'p2' }));
  await assertSucceeds(updateDoc(doc(db, 'convites', CONVITE), { ativo: false }));
});

test('administrador: apaga enquete com votos e escala (limpeza de dados antigos)', async () => {
  const db = como('adm');
  await assertSucceeds(deleteDoc(doc(db, 'enquetes', 'aberta', 'votos', 'p1')));
  await assertSucceeds(deleteDoc(doc(db, 'enquetes', 'pub', 'escala', 'atual')));
  await assertSucceeds(deleteDoc(doc(db, 'enquetes', 'pub')));
});

// O perfil "Ancião" deixou de existir: cadastros antigos com papel "anciao" valem como administrador.
test('ancião (perfil antigo): tem o mesmo acesso do administrador', async () => {
  const db = como('anc');
  await assertSucceeds(getDocs(collection(db, 'publicadores')));
  await assertSucceeds(setDoc(doc(db, 'enquetes', 'fechada', 'escala', 'atual'), { publicada: false, celulas: {} }));
  await assertSucceeds(getDocs(collection(db, 'usuarios')));
  await assertSucceeds(updateDoc(doc(db, 'usuarios', 'anc'), { papel: 'admin' }));
  await assertSucceeds(getDocs(collection(db, 'convites')));
});

/* ---------------------------------------------------------------- cadastro de usuário */

test('cadastro por e-mail: só entra como pendente', async () => {
  const db = como('novo');
  await assertSucceeds(setDoc(doc(db, 'usuarios', 'novo'), { nome: 'Novo', email: 'n@x.com', papel: 'pendente', publicadorId: null }));
});

test('cadastro por e-mail: não entra já como administrador nem com publicador vinculado', async () => {
  const db = como('novo');
  await assertFails(setDoc(doc(db, 'usuarios', 'novo'), { nome: 'Novo', email: 'n@x.com', papel: 'admin', publicadorId: null }));
  await assertFails(setDoc(doc(db, 'usuarios', 'novo'), { nome: 'Novo', email: 'n@x.com', papel: 'pendente', publicadorId: 'p1' }));
});

test('cadastro por e-mail: não aceita campos extras', async () => {
  await assertFails(setDoc(doc(como('novo'), 'usuarios', 'novo'), { nome: 'Novo', email: 'n@x.com', papel: 'pendente', publicadorId: null, extra: 1 }));
});

test('ninguém cria cadastro em nome de outra pessoa', async () => {
  await assertFails(setDoc(doc(como('novo'), 'usuarios', 'outro'), { nome: 'X', email: 'x@x.com', papel: 'pendente', publicadorId: null }));
});

test('link pessoal: convite válido cria votante ligado ao publicador do link', async () => {
  const db = como('anon1', 'anonymous');
  await assertSucceeds(getDoc(doc(db, 'convites', CONVITE)));
  await assertSucceeds(setDoc(doc(db, 'usuarios', 'anon1'), { nome: 'Pub Um', email: null, papel: 'votante', publicadorId: 'p1', conviteId: CONVITE }));
});

test('link pessoal: não dá para usar o link de um e virar outro publicador', async () => {
  const db = como('anon1', 'anonymous');
  await assertFails(setDoc(doc(db, 'usuarios', 'anon1'), { nome: 'Pub Um', email: null, papel: 'votante', publicadorId: 'p2', conviteId: CONVITE }));
  await assertFails(setDoc(doc(db, 'usuarios', 'anon1'), { nome: 'Outro Nome', email: null, papel: 'votante', publicadorId: 'p1', conviteId: CONVITE }));
});

test('link pessoal: o perfil do usuário tem de ser o perfil que o link dá', async () => {
  const db = como('anon1', 'anonymous');
  // Link antigo, sem o campo papel: só Votante.
  await assertFails(setDoc(doc(db, 'usuarios', 'anon1'), { nome: 'Pub Um', email: null, papel: 'admin', publicadorId: 'p1', conviteId: CONVITE }));
  await assertFails(setDoc(doc(db, 'usuarios', 'anon1'), { nome: 'Pub Um', email: null, papel: 'servo', publicadorId: 'p1', conviteId: CONVITE }));
  // Link de Servo Ministerial: entra como servo, e não como votante nem como administrador.
  await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'convites', CONVITE), { papel: 'servo' }));
  await assertFails(setDoc(doc(db, 'usuarios', 'anon1'), { nome: 'Pub Um', email: null, papel: 'admin', publicadorId: 'p1', conviteId: CONVITE }));
  await assertFails(setDoc(doc(db, 'usuarios', 'anon1'), { nome: 'Pub Um', email: null, papel: 'votante', publicadorId: 'p1', conviteId: CONVITE }));
  await assertSucceeds(setDoc(doc(db, 'usuarios', 'anon1'), { nome: 'Pub Um', email: null, papel: 'servo', publicadorId: 'p1', conviteId: CONVITE }));
});

test('link pessoal: convite revogado não cria acesso', async () => {
  await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'convites', CONVITE), { ativo: false }));
  const db = como('anon1', 'anonymous');
  await assertFails(setDoc(doc(db, 'usuarios', 'anon1'), { nome: 'Pub Um', email: null, papel: 'votante', publicadorId: 'p1', conviteId: CONVITE }));
});

test('link pessoal: acesso anônimo sem convite não vira votante', async () => {
  const db = como('anon1', 'anonymous');
  await assertFails(setDoc(doc(db, 'usuarios', 'anon1'), { nome: 'X', email: null, papel: 'votante', publicadorId: 'p1', conviteId: 'z'.repeat(32) }));
  await assertFails(setDoc(doc(db, 'usuarios', 'anon1'), { nome: 'X', email: null, papel: 'pendente', publicadorId: null }));
});

/* ---------------------------------------------------------------- convites */

test('convites: quem está logado abre um convite pelo código, mas ninguém lista', async () => {
  const db = como('vot');
  await assertSucceeds(getDoc(doc(db, 'convites', CONVITE)));
  await assertFails(getDocs(collection(db, 'convites')));
  await assertFails(updateDoc(doc(db, 'convites', CONVITE), { ativo: false }));
});

/* ---------------------------------------------------------------- v3.1: privacidade, auditoria e trocas */


test('privacidade: a pessoa grava o próprio aceite, e só isso', async () => {
  const db = como('vot');
  await assertSucceeds(updateDoc(doc(db, 'usuarios', 'vot'), { privacidadeAceitaEm: '2026-11-20T12:00:00.000Z', privacidadeVersao: 1 }));
  await assertFails(updateDoc(doc(db, 'usuarios', 'vot'), { privacidadeAceitaEm: '2026-11-20T12:00:00.000Z', papel: 'admin' }));
  await assertFails(updateDoc(doc(db, 'usuarios', 'servo'), { privacidadeAceitaEm: '2026-11-20T12:00:00.000Z', privacidadeVersao: 1 }));
  await assertSucceeds(updateDoc(doc(como('pend'), 'usuarios', 'pend'), { privacidadeAceitaEm: '2026-11-20T12:00:00.000Z', privacidadeVersao: 1 }));
});

const PAPEL_DE = { adm: 'admin', servo: 'servo', anc: 'anciao', vot: 'votante', pend: 'pendente' };
const evento = (uid, nome, area, extra = {}) => ({
  area, acao: 'Ação', alvo: '', detalhe: '', enqueteId: null, uid, nome, papel: PAPEL_DE[uid] || 'x', quando: serverTimestamp(), quandoISO: '2026-11-20T12:00:00.000Z', ...extra,
});

test('auditoria: cada um registra em nome próprio; votante só privacidade e trocas', async () => {
  await assertSucceeds(addDoc(collection(como('servo'), 'auditoria'), evento('servo', 'Servo', 'escala')));
  await assertSucceeds(addDoc(collection(como('vot'), 'auditoria'), evento('vot', 'Votante', 'trocas')));
  await assertFails(addDoc(collection(como('vot'), 'auditoria'), evento('vot', 'Votante', 'escala')));
  await assertFails(addDoc(collection(como('servo'), 'auditoria'), evento('adm', 'Admin', 'escala'))); // uid de outro
  await assertFails(addDoc(collection(como('servo'), 'auditoria'), evento('servo', 'Admin', 'escala'))); // nome de outro
  await assertFails(addDoc(collection(como('servo'), 'auditoria'), evento('servo', 'Servo', 'escala', { quando: '2020-01-01' }))); // hora inventada
  await assertFails(addDoc(collection(como('servo'), 'auditoria'), evento('servo', 'Servo', 'escala', { extra: 1 })));
  await assertFails(addDoc(collection(como('pend'), 'auditoria'), evento('pend', 'Pendente', 'privacidade')));
});

test('auditoria (v3.14): o perfil gravado é o real e os textos têm limite', async () => {
  await assertFails(addDoc(collection(como('vot'), 'auditoria'), evento('vot', 'Votante', 'trocas', { papel: 'admin' }))); // perfil falso
  await assertFails(addDoc(collection(como('servo'), 'auditoria'), evento('servo', 'Servo', 'escala', { papel: 'admin' })));
  await assertSucceeds(addDoc(collection(como('anc'), 'auditoria'), evento('anc', 'Ancião (perfil antigo)', 'escala', { papel: 'admin' }))); // antigo vale como admin
  await assertFails(addDoc(collection(como('servo'), 'auditoria'), evento('servo', 'Servo', 'escala', { alvo: 'x'.repeat(161) })));
  await assertFails(addDoc(collection(como('servo'), 'auditoria'), evento('servo', 'Servo', 'escala', { area: 'x'.repeat(41) })));
});

test('auditoria: organizadores leem; ninguém edita; só o administrador apaga', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'auditoria', 'a1'), { area: 'escala', acao: 'x', nome: 'Servo', uid: 'servo', quandoISO: '2026-01-01' }));
  await assertSucceeds(getDoc(doc(como('servo'), 'auditoria', 'a1')));
  await assertFails(getDoc(doc(como('vot'), 'auditoria', 'a1')));
  await assertFails(updateDoc(doc(como('adm'), 'auditoria', 'a1'), { acao: 'mudei' }));
  await assertFails(deleteDoc(doc(como('servo'), 'auditoria', 'a1')));
  await assertSucceeds(deleteDoc(doc(como('adm'), 'auditoria', 'a1')));
});

const troca = (pub, extra = {}) => ({ publicadorId: pub, nome: 'Pub', ponto: 'A', data: '2026-11-23', turno: 'T', motivo: '', status: 'aberta', criadoEm: '2026-11-20', ...extra });

test('trocas: votante pede e cancela só os próprios; organizador resolve', async () => {
  const dbv = como('vot');
  await assertSucceeds(setDoc(doc(dbv, 'enquetes', 'pub', 'trocas', 'p1_2026-11-23_0_0'), troca('p1')));
  await assertFails(setDoc(doc(dbv, 'enquetes', 'pub', 'trocas', 'p2_2026-11-23_0_0'), troca('p2'))); // de outra pessoa
  await assertFails(setDoc(doc(dbv, 'enquetes', 'pub', 'trocas', 'p2_x'), troca('p1'))); // id de outra pessoa
  await assertFails(setDoc(doc(dbv, 'enquetes', 'pub', 'trocas', 'p1_y'), troca('p1', { status: 'resolvida' })));
  await assertSucceeds(getDocs(query(collection(dbv, 'enquetes', 'pub', 'trocas'), where('publicadorId', '==', 'p1'))));
  await assertFails(getDocs(collection(dbv, 'enquetes', 'pub', 'trocas'))); // não lista as dos outros
  await assertFails(updateDoc(doc(dbv, 'enquetes', 'pub', 'trocas', 'p1_2026-11-23_0_0'), { status: 'resolvida' }));
  await assertSucceeds(updateDoc(doc(dbv, 'enquetes', 'pub', 'trocas', 'p1_2026-11-23_0_0'), { status: 'cancelada' }));
  await assertSucceeds(updateDoc(doc(como('servo'), 'enquetes', 'pub', 'trocas', 'p1_2026-11-23_0_0'), { status: 'resolvida', substitutoId: 'p2' }));
  await assertSucceeds(getDocs(collection(como('servo'), 'enquetes', 'pub', 'trocas')));
});

test('trocas (v3.14): o pedido do votante só tem os campos do pedido, com tamanho limitado', async () => {
  const dbv = como('vot');
  await assertFails(setDoc(doc(dbv, 'enquetes', 'pub', 'trocas', 'p1_a'), troca('p1', { substitutoId: 'p2' }))); // campo a mais
  await assertFails(setDoc(doc(dbv, 'enquetes', 'pub', 'trocas', 'p1_b'), troca('p1', { motivo: 'x'.repeat(201) })));
  await assertSucceeds(setDoc(doc(dbv, 'enquetes', 'pub', 'trocas', 'p1_c'), troca('p1', { motivo: 'Viagem' })));
  // Cancelar e pedir de novo: o pedido novo também é conferido.
  await assertSucceeds(updateDoc(doc(dbv, 'enquetes', 'pub', 'trocas', 'p1_c'), { status: 'cancelada' }));
  await assertFails(setDoc(doc(dbv, 'enquetes', 'pub', 'trocas', 'p1_c'), troca('p1', { resolvidoPor: 'eu' })));
  await assertSucceeds(setDoc(doc(dbv, 'enquetes', 'pub', 'trocas', 'p1_c'), troca('p1', { criadoEm: '2026-11-21' })));
});

test('enquete arquivada: organizador arquiva; votante não', async () => {
  await assertSucceeds(updateDoc(doc(como('servo'), 'enquetes', 'pub'), { arquivada: true }));
  await assertFails(updateDoc(doc(como('vot'), 'enquetes', 'pub'), { arquivada: false }));
});

/* ---------------------------------------------------------------- notificações */

const disp = (uid, token = 'tok1') => ({ token, uid, plataforma: 'Android', atualizadoEm: serverTimestamp() });
const aviso = (extra = {}) => ({ tipo: 'enquete', titulo: 'Nova enquete', corpo: 'Vote', url: '?aba=votar', para: { todos: true }, uid: 'servo', status: 'pendente', criadoEm: serverTimestamp(), ...extra });

test('notificações: cada um grava e apaga só o próprio aparelho', async () => {
  await assertSucceeds(setDoc(doc(como('vot'), 'dispositivos', 'tok1'), disp('vot')));
  await assertFails(setDoc(doc(como('vot'), 'dispositivos', 'tok2'), disp('adm', 'tok2')));
  await assertFails(setDoc(doc(como('vot'), 'dispositivos', 'tok3'), disp('vot', 'outro')));
  await assertFails(setDoc(doc(como('pend'), 'dispositivos', 'tok4'), disp('pend', 'tok4')));
  await assertFails(getDocs(collection(como('servo'), 'dispositivos')));
  await assertFails(deleteDoc(doc(como('servo'), 'dispositivos', 'tok1')));
  await assertSucceeds(deleteDoc(doc(como('vot'), 'dispositivos', 'tok1')));
});

test('notificações: organizador pede aviso para todos; votante só avisa troca aos organizadores', async () => {
  await assertSucceeds(addDoc(collection(como('servo'), 'notificacoes'), aviso()));
  await assertFails(addDoc(collection(como('servo'), 'notificacoes'), aviso({ status: 'enviada' })));
  await assertFails(addDoc(collection(como('vot'), 'notificacoes'), aviso({ uid: 'vot' })));
  // v3.14: o aviso de troca do votante tem id fixo ligado a um pedido aberto dele: um aviso por pedido.
  const avisoTroca = (extra = {}) => aviso({ uid: 'vot', tipo: 'troca-pedido', para: { organizadores: true }, ...extra });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore(); // abre uma vez só (abrir de novo dá erro no emulador)
    await setDoc(doc(db, 'enquetes', 'pub', 'trocas', 'p1_t'), troca('p1', { criadoEm: '2026-11-25T10:00:00.000Z' }));
    await setDoc(doc(db, 'enquetes', 'pub', 'trocas', 'p2_t'), troca('p2', { criadoEm: '2026-11-25T10:00:00.000Z' }));
    await setDoc(doc(db, 'enquetes', 'pub', 'trocas', 'p1_fechada'), troca('p1', { status: 'resolvida', criadoEm: '2026-11-25T10:00:00.000Z' }));
  });
  const id = 'troca~pub~p1_t~2026-11-25T10:00:00.000Z';
  await assertFails(addDoc(collection(como('vot'), 'notificacoes'), avisoTroca())); // id automático: não
  await assertFails(setDoc(doc(como('vot'), 'notificacoes', id), avisoTroca({ para: { todos: true } })));
  await assertSucceeds(setDoc(doc(como('vot'), 'notificacoes', id), avisoTroca()));
  await assertFails(setDoc(doc(como('vot'), 'notificacoes', id), avisoTroca())); // repetir o mesmo aviso: não
  await assertFails(setDoc(doc(como('vot'), 'notificacoes', 'troca~pub~p2_t~2026-11-25T10:00:00.000Z'), avisoTroca())); // pedido de outra pessoa
  await assertFails(setDoc(doc(como('vot'), 'notificacoes', 'troca~pub~p1_fechada~2026-11-25T10:00:00.000Z'), avisoTroca())); // pedido já resolvido
  await assertFails(setDoc(doc(como('vot'), 'notificacoes', 'troca~pub~p1_t~2020-01-01'), avisoTroca())); // data que não confere
  await assertFails(setDoc(doc(como('vot'), 'notificacoes', 'troca~pub~nao-existe~x'), avisoTroca()));
  await assertFails(getDocs(collection(como('vot'), 'notificacoes')));
  await assertSucceeds(getDocs(collection(como('servo'), 'notificacoes')));
});

/* ---------------------------------------------------------------- mural de novidades */

const novidade = (uid, extra = {}) => ({ titulo: 'Carrinho suspenso', texto: 'Sábado sem carrinho no Atacadão.', ate: null, autorNome: 'Servo', uid, criadoEm: serverTimestamp(), criadoISO: new Date().toISOString(), ...extra });

test('novidades: servo e administrador escrevem; votante só lê', async () => {
  await assertSucceeds(addDoc(collection(como('servo'), 'novidades'), novidade('servo')));
  await assertSucceeds(addDoc(collection(como('adm'), 'novidades'), novidade('adm', { ate: '2026-12-31' })));
  await assertFails(addDoc(collection(como('vot'), 'novidades'), novidade('vot')));
  await assertFails(addDoc(collection(como('servo'), 'novidades'), novidade('adm')), 'em nome de outro');
  await assertFails(addDoc(collection(como('servo'), 'novidades'), novidade('servo', { titulo: '' })));
  await assertFails(addDoc(collection(como('servo'), 'novidades'), novidade('servo', { extra: 1 })));
  await assertSucceeds(getDocs(collection(como('vot'), 'novidades')));
  await assertFails(getDocs(collection(como('pend'), 'novidades')));
});
