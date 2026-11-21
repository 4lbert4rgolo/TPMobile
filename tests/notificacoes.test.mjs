import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarDias } from '../public/js/escala.js';
import {
  avisoEnqueteAberta, avisoLembrete, avisoEscalaPublicada, avisoPedidoTroca, avisoSubstituto, suporte, paraPublicadores,
} from '../public/js/notificacoes.js';

const T = ['06:00 às 08:00', '08:00 às 10:00'];
const enquete = { titulo: 'Semana de 23/11', inicio: '2026-11-23', fim: '2026-11-28', dias: gerarDias('2026-11-23', '2026-11-28'), turnos: T, pontos: ['Bairro Novo', 'Atacadão'] };
const eq = (...ps) => ({ tipo: 'equipe', pessoas: ps.map(([id, nome]) => ({ id, nome })) });

test('aviso: votação aberta vai para todos e abre a aba Votar', () => {
  const a = avisoEnqueteAberta(enquete);
  assert.equal(a.tipo, 'enquete');
  assert.deepEqual(a.para, { todos: true });
  assert.equal(a.url, '?aba=votar');
  assert.match(a.corpo, /Semana de 23\/11 \(23\/11 a 28\/11\)/);
  assert.match(avisoEnqueteAberta(enquete, true).titulo, /reaberta/);
});

test('aviso: lembrete só para quem falta (sem repetir)', () => {
  assert.deepEqual(avisoLembrete(enquete, ['a', 'b', 'a', null]).para, { publicadores: ['a', 'b'] });
  assert.deepEqual(paraPublicadores([]), { publicadores: [] });
});

test('aviso: escala publicada traz os horários de cada pessoa, em ordem', () => {
  const matriz = {
    'Bairro Novo': { '2026-11-24': { [T[0]]: eq(['a', 'Ana'], ['b', 'Bia']) } },
    Atacadão: { '2026-11-23': { [T[1]]: eq(['a', 'Ana'], ['c', 'Cida']) }, '2026-11-25': { [T[0]]: { tipo: 'vazio' } } },
  };
  const a = avisoEscalaPublicada(enquete, matriz);
  assert.deepEqual(a.para, { todos: true });
  assert.equal(a.url, '?aba=minha');
  assert.equal(a.porPublicador.a, 'Você está escalado: segunda 23/11, 08:00 às 10:00 – Atacadão; terça 24/11, 06:00 às 08:00 – Bairro Novo.');
  assert.equal(Object.keys(a.porPublicador).sort().join(), 'a,b,c');
  assert.match(a.corpo, /23\/11 a 28\/11/);
});

test('aviso: pedido de troca vai para os organizadores; substituto recebe só o dele', () => {
  const troca = { nome: 'Bruno', data: '2026-11-26', turno: T[0], ponto: 'Bairro Novo', motivo: 'Viagem' };
  const p = avisoPedidoTroca(troca);
  assert.deepEqual(p.para, { organizadores: true });
  assert.equal(p.tipo, 'troca-pedido');
  assert.equal(p.corpo, 'Bruno não pode ir: quinta 26/11, 06:00 às 08:00 – Bairro Novo. Motivo: Viagem');
  const s = avisoSubstituto(troca, { id: 'g', nome: 'Gil' });
  assert.deepEqual(s.para, { publicadores: ['g'] });
  assert.match(s.corpo, /^Gil, você entrou no lugar de Bruno/);
});

test('aviso: textos cabem nos limites das regras do Firestore', () => {
  const longo = { nome: 'X'.repeat(60), data: '2026-11-26', turno: T[0], ponto: 'P'.repeat(60), motivo: 'm'.repeat(500) };
  for (const a of [avisoEnqueteAberta(enquete), avisoLembrete(enquete, ['a']), avisoEscalaPublicada(enquete, {}), avisoPedidoTroca(longo), avisoSubstituto(longo, { id: 'g', nome: 'Gil' })]) {
    assert.ok(a.titulo.length <= 80 && a.corpo.length <= 400 && a.url.length <= 40, a.tipo);
  }
});

test('suporte: sem chave, iPhone sem instalar, bloqueado, ativo e pronto para ativar', () => {
  const win = (permission) => ({ Notification: { permission }, navigator: { serviceWorker: {} }, PushManager: function () {} });
  assert.equal(suporte({ chave: '', win: win('default') }), 'sem-config');
  assert.equal(suporte({ chave: 'k', win: win('default'), ios: true, instalado: false }), 'ios-instalar');
  assert.equal(suporte({ chave: 'k', win: win('default'), ios: true, instalado: true }), 'pode-ativar');
  assert.equal(suporte({ chave: 'k', win: { navigator: {} } }), 'sem-suporte');
  assert.equal(suporte({ chave: 'k', win: win('denied') }), 'bloqueado');
  assert.equal(suporte({ chave: 'k', win: win('granted'), tokenGuardado: 't' }), 'ativo');
  assert.equal(suporte({ chave: 'k', win: win('granted') }), 'pode-ativar');
});

test('configuração: com Firebase ligado, tem o messagingSenderId que as notificações exigem', async () => {
  const { firebaseConfig, chaveNotificacoes } = await import('../public/js/firebase-config.js');
  if (!firebaseConfig.apiKey) return; // modo demonstração
  assert.ok(firebaseConfig.messagingSenderId, 'falta messagingSenderId');
  assert.equal(firebaseConfig.appId.split(':')[1], firebaseConfig.messagingSenderId);
  assert.ok(chaveNotificacoes.startsWith('B'));
});
