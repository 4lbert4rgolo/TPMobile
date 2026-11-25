// Notificações no celular (barra de notificação).
//
// Como funciona, em quatro passos:
//  1. A pessoa toca em "Ativar avisos". O navegador pergunta se ela permite notificações.
//  2. Se permitir, o Firebase Cloud Messaging (FCM) entrega um "endereço" deste aparelho, chamado token.
//     O app guarda esse token no Firestore, na coleção "dispositivos" (só o token e quem é o dono).
//  3. Quando algo acontece (votação aberta, escala publicada, pedido de troca...), o app grava um
//     pedido de aviso na coleção "notificacoes", com o texto e para quem é.
//  4. O script do Google (o mesmo do backup, scripts/apps-script) olha essa coleção a cada 5 minutos,
//     acha os tokens das pessoas certas e manda o aviso pelo FCM. O service worker (sw.js) recebe o
//     aviso no aparelho e mostra na barra de notificação, mesmo com o app fechado.
//
// As funções "textoDe..." e "suporte" são puras (testadas em tests/notificacoes.test.mjs).

import { nomeDia, dataCurta } from './escala.js';
import { textoPrazo } from './prazo.js';

/** Para quem vai o aviso. */
export const PARA_TODOS = { todos: true };
export const PARA_ORGANIZADORES = { organizadores: true };
export const paraPublicadores = (ids) => ({ publicadores: [...new Set(ids)].filter(Boolean) });

const curto = (iso) => `${nomeDia(iso).replace('-feira', '').toLowerCase()} ${dataCurta(iso)}`;
const periodo = (e) => `${dataCurta(e.inicio)} a ${dataCurta(e.fim)}`;

/** Votação aberta (ou reaberta). */
export function avisoEnqueteAberta(enquete, reaberta = false) {
  return {
    tipo: 'enquete',
    titulo: reaberta ? '🛒 Votação reaberta' : '🛒 Nova enquete do carrinho',
    corpo: `${enquete.titulo} (${periodo(enquete)}).${enquete.prazo ? ` Vote até ${textoPrazo(enquete.prazo)}.` : ''} Toque para marcar os horários que você pode.`,
    url: '?aba=votar',
    para: PARA_TODOS,
  };
}

/** Lembrete para quem ainda não votou. */
export function avisoLembrete(enquete, idsQueFaltam) {
  return {
    tipo: 'lembrete',
    titulo: '⏰ Falta o seu voto',
    corpo: `A enquete "${enquete.titulo}" ainda está aberta. É rapidinho: toque para votar.`,
    url: '?aba=votar',
    para: paraPublicadores(idsQueFaltam),
  };
}

/**
 * Escala publicada: cada pessoa escalada recebe os próprios horários
 * ("seg 23/11, 06:00 às 08:00 – Bairro Novo"); quem não foi escalado recebe o aviso geral.
 */
export function avisoEscalaPublicada(enquete, matriz) {
  const horarios = new Map();
  for (const ponto of Object.keys(matriz || {})) {
    for (const data of Object.keys(matriz[ponto]).sort()) {
      for (const turno of Object.keys(matriz[ponto][data])) {
        const c = matriz[ponto][data][turno];
        if (c?.tipo !== 'equipe') continue;
        for (const p of c.pessoas) {
          if (!horarios.has(p.id)) horarios.set(p.id, []);
          horarios.get(p.id).push({ data, turno, ponto });
        }
      }
    }
  }
  const porPublicador = {};
  for (const [id, lista] of horarios) {
    lista.sort((a, b) => (a.data + a.turno).localeCompare(b.data + b.turno));
    const linhas = lista.map((h) => `${curto(h.data)}, ${h.turno} – ${h.ponto}`);
    porPublicador[id] = `Você está escalado: ${linhas.join('; ')}.`;
  }
  return {
    tipo: 'escala',
    titulo: '📅 Escala publicada',
    corpo: `A escala de ${periodo(enquete)} já está no app.`,
    url: '?aba=minha',
    para: PARA_TODOS,
    porPublicador,
  };
}

/**
 * Mudança num horário de escala já publicada (ajuste manual de um organizador):
 * quem entrou e quem saiu recebem um aviso com o próprio texto.
 */
export function avisoMudancaCelula({ ponto, data, turno }, antes, depois) {
  const pessoas = (c) => (c?.tipo === 'equipe' ? c.pessoas : []);
  const idsAntes = new Set(pessoas(antes).map((p) => p.id));
  const idsDepois = new Set(pessoas(depois).map((p) => p.id));
  const lugar = `${curto(data)}, ${turno} – ${ponto}`;
  const porPublicador = {};
  for (const p of pessoas(depois)) {
    if (idsAntes.has(p.id)) continue;
    const com = pessoas(depois).filter((x) => x.id !== p.id).map((x) => x.nome);
    porPublicador[p.id] = `Você entrou na escala: ${lugar}${com.length ? `, com ${com.join(' e ')}` : ''}.`;
  }
  for (const p of pessoas(antes)) {
    if (!idsDepois.has(p.id)) porPublicador[p.id] = `Você não está mais na escala em ${lugar}.`;
  }
  const ids = Object.keys(porPublicador);
  if (!ids.length) return null;
  return {
    tipo: 'escala-mudou',
    titulo: '📅 Mudança na sua escala',
    corpo: `A escala de ${lugar} mudou.`,
    url: '?aba=minha',
    para: paraPublicadores(ids),
    porPublicador,
  };
}

/** Troca resolvida: avisa quem pediu. */
export function avisoTrocaResolvida(troca, substituto) {
  return {
    tipo: 'troca-resolvida',
    titulo: '✅ Troca resolvida',
    corpo: `${substituto.nome} entra no seu lugar: ${curto(troca.data)}, ${troca.turno} – ${troca.ponto}.`,
    url: '?aba=minha',
    para: paraPublicadores([troca.publicadorId]),
  };
}

/** Pedido de troca: vai para os organizadores. */
export function avisoPedidoTroca(troca) {
  return {
    tipo: 'troca-pedido',
    titulo: '🔁 Pedido de troca',
    corpo: `${troca.nome} não pode ir: ${curto(troca.data)}, ${troca.turno} – ${troca.ponto}.${troca.motivo ? ` Motivo: ${troca.motivo}` : ''}`.slice(0, 300),
    url: '?aba=escala',
    para: PARA_ORGANIZADORES,
  };
}

/** Substituto escolhido: vai só para ele. */
export function avisoSubstituto(troca, substituto) {
  return {
    tipo: 'troca-substituto',
    titulo: '🛒 Você entrou na escala',
    corpo: `${substituto.nome}, você entrou no lugar de ${troca.nome}: ${curto(troca.data)}, ${troca.turno} – ${troca.ponto}.`,
    url: '?aba=minha',
    para: paraPublicadores([substituto.id]),
  };
}

/**
 * O que este aparelho consegue fazer:
 *  'sem-config'    → falta a chave de notificações no firebase-config.js (só o administrador resolve);
 *  'ios-instalar'  → iPhone: só funciona com o app instalado na tela de início;
 *  'sem-suporte'   → navegador sem notificações;
 *  'bloqueado'     → a pessoa negou a permissão (tem que liberar nas configurações do navegador);
 *  'ativo'         → permissão dada e token guardado; 'pode-ativar' → falta tocar em "Ativar".
 */
export function suporte({ chave, win = globalThis, ios = false, instalado = false, tokenGuardado = null }) {
  if (!chave) return 'sem-config';
  const temApi = Boolean(win.Notification && win.navigator?.serviceWorker && win.PushManager);
  if (ios && !instalado) return 'ios-instalar';
  if (!temApi) return 'sem-suporte';
  if (win.Notification.permission === 'denied') return 'bloqueado';
  if (win.Notification.permission === 'granted' && tokenGuardado) return 'ativo';
  return 'pode-ativar';
}

/* ------------------------------------------------------------ navegador */

const CHAVE_TOKEN = 'tp:push:token';
export const tokenGuardado = () => { try { return localStorage.getItem(CHAVE_TOKEN); } catch { return null; } };
const guardarToken = (t) => { try { t ? localStorage.setItem(CHAVE_TOKEN, t) : localStorage.removeItem(CHAVE_TOKEN); } catch { /* sem armazenamento */ } };

/**
 * Pede a permissão, pega o token do FCM e guarda no Firestore.
 * Devolve 'ativo', 'negado' ou lança erro.
 */
export async function ativar(backend, chave, uid) {
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') return 'negado';
  const registro = await navigator.serviceWorker.ready;
  const token = await backend.obterTokenPush(chave, registro);
  if (!token) throw new Error('O aparelho não entregou o endereço de notificação.');
  await backend.salvarDispositivo(token, uid);
  guardarToken(token);
  return 'ativo';
}

/** Para de receber neste aparelho. */
export async function desativar(backend) {
  const token = tokenGuardado();
  guardarToken(null);
  if (!token) return;
  try { await backend.removerDispositivo(token); } catch (e) { console.warn(e); }
  try { await backend.apagarTokenPush(); } catch (e) { console.warn(e); }
}

/**
 * Ao abrir o app: se as notificações já estavam ativas, confere se o token mudou
 * (o FCM troca de vez em quando) e regrava. Não pergunta nada à pessoa.
 */
export async function renovar(backend, chave, uid) {
  if (!chave || !tokenGuardado() || globalThis.Notification?.permission !== 'granted') return;
  try {
    const registro = await navigator.serviceWorker.ready;
    const token = await backend.obterTokenPush(chave, registro);
    if (token && token !== tokenGuardado()) {
      await backend.removerDispositivo(tokenGuardado()).catch(() => {});
      guardarToken(token);
    }
    if (token) await backend.salvarDispositivo(token, uid);
  } catch (e) {
    console.warn('Não foi possível renovar as notificações:', e);
  }
}

/** Grava o pedido de aviso. Falha aqui nunca atrapalha a ação principal (só vai para o console). */
export async function avisar(backend, aviso) {
  try {
    await backend.enfileirarNotificacao(aviso);
    return true;
  } catch (e) {
    console.warn('Aviso por notificação não registrado:', e);
    return false;
  }
}
