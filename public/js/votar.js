import { $, STATUS, enqueteAtual, esc, estado, fecharModal, lerPref, pubPorId, tentar, toast } from './nucleo.js';
import { registrar } from './telaAuditoria.js';
import { renderAba } from './shell.js';
import { chave, nomeDia, dataCurta, celulaBloqueada, pontosDoPublicador } from './escala.js';
import { aplicarMestre, bloqueadoEmTodos, iniciarUnico } from './votoUnico.js';

export function seletorEnquete(lista, acaoId = 'escolher-enquete') {
  if (!lista.length) return '';
  return `<div class="mb-4"><label class="text-sm font-medium" for="sel-enquete">Enquete</label>
    <select id="sel-enquete" class="border rounded-lg p-2 w-full sm:w-auto" data-acao="${acaoId}">
      ${lista.map((e) => `<option value="${esc(e.id)}" ${e.id === estado.enqueteId ? 'selected' : ''}>${esc(e.titulo)} — ${STATUS[e.status]?.[0] || e.status}</option>`).join('')}
    </select></div>`;
}

export function escolherEnquetePadrao(lista) {
  if (!lista.find((e) => e.id === estado.enqueteId)) estado.enqueteId = lista[0]?.id || null;
}

/* ============================================================ votar */

export const diaDaSemana = (data) => { const [a, m, d] = data.split('-').map(Number); return new Date(a, m - 1, d).getDay(); };

/** Transforma o "costume" (dia da semana + horário) nos horários desta enquete, respeitando bloqueios. */
export function horariosDoCostume(enquete, padrao) {
  const disp = Object.fromEntries(enquete.pontos.map((ponto) => [ponto, new Set()]));
  if (!padrao) return disp;
  for (const ponto of enquete.pontos) {
    const usuais = new Set(padrao[ponto] || []);
    for (const dia of enquete.dias) {
      if (dia.ativo === false) continue;
      for (const turno of enquete.turnos) {
        if (usuais.has(`${diaDaSemana(dia.data)}|${turno}`) && !celulaBloqueada(enquete, dia.data, turno, ponto)) disp[ponto].add(chave(dia.data, turno));
      }
    }
  }
  return disp;
}

/** Guarda o voto como "costume": troca a data pelo dia da semana, para valer em qualquer semana. */
export function costumeDoVoto(disponibilidade) {
  return Object.fromEntries(Object.entries(disponibilidade).map(([ponto, lista]) => [
    ponto,
    [...new Set(lista.map((k) => { const [data, ...turno] = k.split('|'); return `${diaDaSemana(data)}|${turno.join('|')}`; }))],
  ]));
}

export async function carregarVoto(enquete, pubId) {
  const existente = await estado.backend.getVoto(enquete.id, pubId);
  let padrao = null;
  try { padrao = (await estado.backend.getPadrao(pubId))?.padrao || null; } catch { /* sem costume guardado */ }
  const temCostume = Boolean(padrao && Object.values(padrao).some((l) => l.length));
  const doCostume = !existente && temCostume;
  estado.voto = {
    enqueteId: enquete.id,
    pubId,
    jaVotou: Boolean(existente),
    filtro: lerPref('filtro-ponto') || '',
    padrao: temCostume ? padrao : null,
    preenchidoDoCostume: doCostume,
    guardarPadrao: !temCostume,
    disp: doCostume
      ? horariosDoCostume(enquete, padrao)
      : Object.fromEntries(enquete.pontos.map((ponto) => [ponto, new Set(existente?.disponibilidade?.[ponto] || [])])),
    // "Só se precisar": horários de reserva. Não entram na escala automática; viram substitutos.
    reserva: Object.fromEntries(enquete.pontos.map((ponto) => [ponto, new Set(existente?.reserva?.[ponto] || [])])),
  };
  iniciarTelaUnica();
}

/**
 * Tela em dois passos (vale quando a pessoa vota em mais de um ponto):
 * 1) uma grade única de horários  2) caixinhas "onde quero participar".
 * A grade única é a "mestre"; ela é copiada para cada ponto escolhido (veja aplicarMestre).
 */
function iniciarTelaUnica() {
  const v = estado.voto;
  const permitidos = pontosPermitidosDoVoto();
  const u = iniciarUnico(v.disp, v.reserva, permitidos, true);
  v.mestre = u.mestre;
  v.escolhidos = u.escolhidos;
  v.unificado = permitidos.length > 1 && u.unificado;
}

function sincronizarMestre() {
  const v = estado.voto;
  const { disp, reserva } = aplicarMestre(enqueteAtual(), v.mestre, v.escolhidos, pontosPermitidosDoVoto());
  v.disp = disp; v.reserva = reserva;
  v.salvo = false;
}

export function usarCostume() {
  const e = enqueteAtual();
  estado.voto.disp = horariosDoCostume(e, estado.voto.padrao);
  iniciarTelaUnica();
  if (estado.voto.unificado) sincronizarMestre();
  estado.voto.preenchidoDoCostume = true;
  estado.voto.salvo = false;
  renderAreaVoto();
  toast('Horários de costume marcados. Confira e salve.');
}

/** Pontos em que esta pessoa vota (todos, se não houver restrição no cadastro). */
export function pontosPermitidosDoVoto() {
  return pontosDoPublicador(pubPorId(estado.voto.pubId), enqueteAtual().pontos);
}

/** Pontos mostrados agora: os permitidos, ou só o que a pessoa escolheu no filtro. */
export function pontosVisiveis(enquete) {
  const permitidos = pontosDoPublicador(pubPorId(estado.voto.pubId), enquete.pontos);
  const filtro = estado.voto.filtro;
  return permitidos.length > 1 && permitidos.includes(filtro) ? [filtro] : permitidos;
}

export function totalMarcado(campo = 'disp') {
  const permitidos = pontosPermitidosDoVoto();
  return Object.entries(estado.voto[campo] || {})
    .filter(([ponto]) => permitidos.includes(ponto))
    .reduce((soma, [, conjunto]) => soma + conjunto.size, 0);
}

/** "5 horário(s) · 2 de reserva" */
export function textoContagem() {
  const v = estado.voto;
  if (v.unificado) {
    const reservas = v.mestre.reserva.size;
    return `${v.mestre.disp.size} horário(s) marcado(s)${reservas ? ` · ${reservas} de reserva` : ''} · ${v.escolhidos.size} ponto(s)`;
  }
  const reservas = totalMarcado('reserva');
  return `${totalMarcado()} horário(s) marcado(s)${reservas ? ` · ${reservas} de reserva` : ''}`;
}

export function htmlVoto(enquete, leitura = false) {
  const v = estado.voto;
  const aberta = enquete.status === 'aberta' && !leitura;

  const permitidos = pontosDoPublicador(pubPorId(v.pubId), enquete.pontos);
  const visiveis = pontosVisiveis(enquete);

  const nota = permitidos.length < enquete.pontos.length
    ? `<p class="text-sm text-slate-700 mb-3">Você vota ${permitidos.length === 1 ? 'apenas em' : 'em'} <strong>${permitidos.map(esc).join(' e ')}</strong>.</p>`
    : '';
  const filtro = permitidos.length > 1
    ? `<div class="flex flex-wrap items-center gap-2 mb-3"><span class="text-sm text-slate-600">Mostrar:</span>
        <button type="button" class="chip-turno" aria-pressed="${visiveis.length === permitidos.length}" data-acao="filtro-ponto" data-ponto="">Todos os pontos</button>
        ${permitidos.map((p) => `<button type="button" class="chip-turno" aria-pressed="${visiveis.length === 1 && visiveis[0] === p}" data-acao="filtro-ponto" data-ponto="${esc(p)}">${esc(p)}</button>`).join('')}
      </div>`
    : '';

  const pontos = visiveis.map((ponto) => `
    <section class="bg-white rounded-xl shadow-sm border p-4 mb-4">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 class="font-bold text-blue-800">${esc(ponto)}</h3>
        ${aberta ? `<div class="flex flex-wrap gap-2 text-sm">
          <button class="px-3 py-1 rounded-lg bg-slate-100" data-acao="marcar-tudo" data-ponto="${esc(ponto)}">Marcar tudo</button>
          <button class="px-3 py-1 rounded-lg bg-slate-100" data-acao="limpar-ponto" data-ponto="${esc(ponto)}">Limpar</button>
          ${permitidos.length > 1 ? `<button class="px-3 py-1 rounded-lg bg-blue-50 text-blue-800" data-acao="copiar-ponto" data-ponto="${esc(ponto)}">Copiar para todos os pontos</button>` : ''}
        </div>` : ''}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${enquete.dias.map((dia) => {
          if (dia.ativo === false) {
            return `<div class="border rounded-lg p-3 bg-slate-50"><p class="font-semibold text-sm">${nomeDia(dia.data)} ${dataCurta(dia.data)}</p>
              <p class="text-sm text-slate-500 italic mt-1">${esc(dia.motivo || 'Sem carrinho')}</p></div>`;
          }
          return `<div class="border rounded-lg p-3"><p class="font-semibold text-sm mb-2">${nomeDia(dia.data)} ${dataCurta(dia.data)}</p>
            <div class="flex flex-wrap gap-2">
              ${enquete.turnos.map((turno) => {
                const motivo = celulaBloqueada(enquete, dia.data, turno, ponto);
                const k = chave(dia.data, turno);
                const marcado = v.disp[ponto].has(k);
                const reserva = !marcado && v.reserva[ponto]?.has(k);
                return `<button type="button" class="chip-turno" ${motivo || !aberta ? 'disabled' : ''} title="${esc(motivo || '')}"
                  aria-pressed="${marcado}" data-reserva="${reserva}" aria-label="${esc(turno)}${marcado ? ': posso' : reserva ? ': só se precisar' : ''}"
                  data-acao="alternar-voto" data-ponto="${esc(ponto)}" data-chave="${esc(k)}">${esc(turno)}${reserva ? '<span class="chip-reserva"> · reserva</span>' : ''}</button>`;
              }).join('')}
            </div></div>`;
        }).join('')}
      </div>
    </section>`).join('');

  const unico = v.unificado ? htmlUnico(enquete, aberta) : '';
  const voltar = !v.unificado && permitidos.length > 1 && aberta
    ? '<button type="button" class="px-3 py-1 rounded-lg bg-blue-50 text-blue-800 text-sm mb-3" data-acao="voto-simples">← Voltar à tela simples (mesmos horários em todos os pontos)</button>'
    : '';

  const rodape = aberta
    ? `${v.salvo ? '<div id="aviso-salvo" class="bg-green-50 text-green-800 border border-green-200 rounded-xl p-4 mb-3 font-semibold">✔ Pronto! Seus votos foram salvos. Você pode mudar até a votação encerrar.</div>' : ''}
      <div class="sticky bottom-0 bg-slate-50/95 py-3 flex flex-wrap items-center gap-3">
        <button class="bg-blue-600 text-white rounded-lg px-5 py-2 font-semibold" data-acao="salvar-voto">Salvar meus votos</button>
        <span class="text-sm text-slate-600" id="contagem-voto">${textoContagem()}</span>
        <label class="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" data-acao="guardar-costume" ${v.guardarPadrao ? 'checked' : ''}> ${v.padrao ? 'Atualizar' : 'Guardar como'} meu costume (para já vir marcado nas próximas)</label>
      </div>`
    : `<p class="text-sm text-slate-500">${enquete.status === 'aberta' ? '' : 'A votação desta enquete está encerrada.'}</p>`;

  const avisoCostume = aberta && v.preenchidoDoCostume && !v.salvo
    ? '<div class="bg-amber-50 text-amber-900 border border-amber-200 rounded-xl p-3 mb-3 text-sm"><strong>Marcamos os seus horários de costume.</strong> Confira, mude o que precisar e toque em <strong>Salvar meus votos</strong>.</div>'
    : '';
  const botaoCostume = aberta && v.padrao && !v.preenchidoDoCostume
    ? '<button type="button" class="px-3 py-1 rounded-lg bg-blue-50 text-blue-800 text-sm mb-3" data-acao="usar-costume">↺ Marcar meus horários de costume</button>'
    : '';

  const legenda = aberta
    ? `<div class="flex flex-wrap items-center gap-x-4 text-sm text-slate-700 mb-3 legenda-toques" aria-hidden="true">
        <span class="legenda-item"><span class="chip-turno chip-legenda" aria-pressed="true">1 toque</span> posso</span>
        <span class="legenda-item"><span class="chip-turno chip-legenda" data-reserva="true">2 toques</span> só se precisar (reserva)</span>
        <span class="legenda-item"><span class="chip-turno chip-legenda">3 toques</span> desmarca</span>
      </div>`
    : '';
  return v.unificado
    ? nota + avisoCostume + botaoCostume + legenda + unico + rodape
    : nota + avisoCostume + botaoCostume + voltar + filtro + legenda + pontos + rodape;
}

/** Passo 1 (grade única de horários) e passo 2 (em quais pontos participar). */
function htmlUnico(enquete, aberta) {
  const v = estado.voto;
  const permitidos = pontosPermitidosDoVoto();
  const grade = enquete.dias.map((dia) => {
    if (dia.ativo === false) {
      return `<div class="border rounded-lg p-3 bg-slate-50"><p class="font-semibold text-sm">${nomeDia(dia.data)} ${dataCurta(dia.data)}</p>
        <p class="text-sm text-slate-500 italic mt-1">${esc(dia.motivo || 'Sem carrinho')}</p></div>`;
    }
    return `<div class="border rounded-lg p-3"><p class="font-semibold text-sm mb-2">${nomeDia(dia.data)} ${dataCurta(dia.data)}</p>
      <div class="flex flex-wrap gap-2">
        ${enquete.turnos.map((turno) => {
          const bloqueado = bloqueadoEmTodos(enquete, dia.data, turno, v.escolhidos);
          const k = chave(dia.data, turno);
          const marcado = v.mestre.disp.has(k);
          const reserva = !marcado && v.mestre.reserva.has(k);
          return `<button type="button" class="chip-turno" ${bloqueado || !aberta ? 'disabled' : ''}
            aria-pressed="${marcado}" data-reserva="${reserva}" aria-label="${esc(turno)}${marcado ? ': posso' : reserva ? ': só se precisar' : ''}"
            data-acao="alternar-voto" data-ponto="*" data-chave="${esc(k)}">${esc(turno)}${reserva ? '<span class="chip-reserva"> · reserva</span>' : ''}</button>`;
        }).join('')}
      </div></div>`;
  }).join('');
  return `
    <section class="bg-white rounded-xl shadow-sm border p-4 mb-4" id="passo-horarios">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 class="font-bold text-blue-800">1. Em quais horários posso?</h3>
        ${aberta ? `<div class="flex flex-wrap gap-2 text-sm">
          <button class="px-3 py-1 rounded-lg bg-slate-100" data-acao="marcar-tudo" data-ponto="*">Marcar tudo</button>
          <button class="px-3 py-1 rounded-lg bg-slate-100" data-acao="limpar-ponto" data-ponto="*">Limpar</button></div>` : ''}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">${grade}</div>
    </section>
    <section class="bg-white rounded-xl shadow-sm border p-4 mb-4" id="passo-pontos">
      <h3 class="font-bold text-blue-800 mb-1">2. Onde quero participar?</h3>
      <p class="text-sm text-slate-600 mb-3">Marque só os pontos em que você realmente quer participar. Os horários acima valem para todos os pontos marcados.</p>
      <div class="flex flex-wrap gap-3">
        ${permitidos.map((p) => `<label class="flex items-center gap-2 border rounded-lg px-3 py-2 ${v.escolhidos.has(p) ? 'bg-blue-50 border-blue-300' : ''}">
          <input type="checkbox" data-acao="alternar-ponto-voto" data-ponto="${esc(p)}" ${v.escolhidos.has(p) ? 'checked' : ''} ${aberta ? '' : 'disabled'}> <span class="font-medium">${esc(p)}</span></label>`).join('')}
      </div>
      ${v.escolhidos.size === 0 ? '<p class="text-sm text-amber-800 mt-2">Marque pelo menos um ponto para o seu voto valer.</p>' : ''}
      ${aberta ? '<button type="button" class="mt-3 text-sm text-blue-800 underline" data-acao="voto-por-ponto">Preciso de horários diferentes em um ponto específico</button>' : ''}
    </section>`;
}

export function alternarPontoVoto(ponto) {
  const v = estado.voto;
  if (v.escolhidos.has(ponto)) v.escolhidos.delete(ponto); else v.escolhidos.add(ponto);
  sincronizarMestre();
  renderAreaVoto();
}

export function votoPorPonto() { estado.voto.unificado = false; renderAreaVoto(); }

export function votoSimples() {
  // Volta para a grade única usando o primeiro ponto que tem horários marcados.
  const v = estado.voto;
  const u = iniciarUnico(v.disp, v.reserva, pontosPermitidosDoVoto(), true);
  v.mestre = u.mestre; v.escolhidos = u.escolhidos; v.unificado = true;
  sincronizarMestre();
  renderAreaVoto();
  toast('Os horários do primeiro ponto marcado foram aplicados a todos os pontos. Confira.');
}

export function renderAreaVoto() {
  const e = enqueteAtual();
  const area = $('#area-voto');
  // Organizador lançando voto por outra pessoa pode ajustar mesmo com a votação fechada.
  if (e && area) area.innerHTML = htmlVoto(estado.voto?.forcarAberta ? { ...e, status: 'aberta' } : e);
}

export async function renderVotar() {
  const c = $('#conteudo');
  const pubId = estado.perfil.publicadorId;

  if (!pubId || !pubPorId(pubId)) {
    c.innerHTML = `<div class="bg-white rounded-xl shadow p-6">
      <h2 class="font-bold mb-1">Sua conta ainda não está ligada a um publicador</h2>
      <p class="text-slate-600">Peça a um administrador para ligar o seu acesso ao seu nome na lista de publicadores. Depois você poderá votar.</p></div>`;
    return;
  }

  const abertas = estado.enquetes.filter((e) => e.status === 'aberta');
  if (!abertas.length) {
    c.innerHTML = `<div class="bg-white rounded-xl shadow p-6"><h2 class="font-bold mb-1">Nenhuma enquete aberta</h2>
      <p class="text-slate-600">Quando uma nova enquete for aberta, ela aparece aqui. Se já houver uma escala publicada, veja na aba Escala.</p></div>`;
    return;
  }

  escolherEnquetePadrao(abertas);
  const enquete = enqueteAtual();
  await carregarVoto(enquete, pubId);

  c.innerHTML = `
    <div class="mb-3">
      <p class="text-lg font-bold">Olá, ${esc((estado.perfil.nome || '').split(' ')[0])}!</p>
      <h2 class="text-base font-semibold text-blue-800">${esc(enquete.titulo)}</h2>
      <ol class="text-sm text-slate-700 list-decimal ml-5 mt-1">
        <li>Toque nos horários em que você pode participar.</li>
        <li>No final da página, toque em <strong>Salvar meus votos</strong>.</li>
      </ol>
      ${estado.voto.jaVotou ? '<p class="text-sm text-green-700 mt-1"><strong>Você já votou.</strong> Se quiser, pode mudar e salvar de novo.</p>' : ''}
    </div>
    ${seletorEnquete(abertas, 'escolher-enquete')}
    <div id="area-voto">${htmlVoto(enquete)}</div>`;
}

/**
 * Cada toque passa para o próximo estado: desmarcado → posso → só se precisar (reserva) → desmarcado.
 * "Posso" fica em estado.voto.disp e "reserva" em estado.voto.reserva (nunca nos dois).
 */
export function proximoEstado(atual) {
  return { vazio: 'posso', posso: 'reserva', reserva: 'vazio' }[atual] || 'posso';
}

export function alternarVoto(botao) {
  const { ponto, chave: k } = botao.dataset;
  const unico = ponto === '*';
  const disp = unico ? estado.voto.mestre.disp : estado.voto.disp[ponto];
  const reserva = unico ? estado.voto.mestre.reserva : (estado.voto.reserva[ponto] || (estado.voto.reserva[ponto] = new Set()));
  const atual = disp.has(k) ? 'posso' : reserva.has(k) ? 'reserva' : 'vazio';
  const novo = proximoEstado(atual);
  disp.delete(k); reserva.delete(k);
  if (novo === 'posso') disp.add(k);
  if (novo === 'reserva') reserva.add(k);
  const turno = k.split('|').slice(1).join('|');
  botao.setAttribute('aria-pressed', String(novo === 'posso'));
  botao.dataset.reserva = String(novo === 'reserva');
  botao.setAttribute('aria-label', `${turno}${novo === 'posso' ? ': posso' : novo === 'reserva' ? ': só se precisar' : ''}`);
  botao.innerHTML = `${esc(turno)}${novo === 'reserva' ? '<span class="chip-reserva"> · reserva</span>' : ''}`;
  if (unico) sincronizarMestre();
  estado.voto.salvo = false;
  $('#aviso-salvo')?.remove();
  const contagem = $('#contagem-voto');
  if (contagem) contagem.textContent = textoContagem();
}

export function marcarPonto(ponto, marcar) {
  const e = enqueteAtual();
  if (ponto === '*') {
    const m = estado.voto.mestre;
    m.disp.clear(); m.reserva.clear();
    if (marcar) for (const dia of e.dias) if (dia.ativo !== false) for (const turno of e.turnos) if (!bloqueadoEmTodos(e, dia.data, turno, estado.voto.escolhidos)) m.disp.add(chave(dia.data, turno));
    sincronizarMestre();
    renderAreaVoto();
    return;
  }
  const conjunto = estado.voto.disp[ponto];
  conjunto.clear();
  estado.voto.reserva[ponto]?.clear();
  if (marcar) {
    for (const dia of e.dias) for (const turno of e.turnos) if (!celulaBloqueada(e, dia.data, turno, ponto)) conjunto.add(chave(dia.data, turno));
  }
  renderAreaVoto();
}

export function copiarPonto(ponto) {
  const origem = estado.voto.disp[ponto];
  const origemReserva = estado.voto.reserva[ponto] || new Set();
  for (const outro of pontosPermitidosDoVoto()) {
    if (outro === ponto) continue;
    estado.voto.disp[outro] = new Set(origem);
    estado.voto.reserva[outro] = new Set(origemReserva);
  }
  estado.voto.salvo = false;
  renderAreaVoto();
  toast('Horários copiados para todos os pontos.');
}

export async function salvarVoto() {
  const e = enqueteAtual();
  const v = estado.voto;
  const pub = pubPorId(v.pubId);
  const permitidos = pontosPermitidosDoVoto();
  if (v.unificado && v.escolhidos.size === 0) return toast('Marque pelo menos um ponto onde você quer participar.', 'erro');
  const disponibilidade = Object.fromEntries(
    Object.entries(v.disp).filter(([ponto]) => permitidos.includes(ponto)).map(([ponto, conjunto]) => [ponto, [...conjunto]])
  );
  const reserva = Object.fromEntries(
    Object.entries(v.reserva || {}).filter(([ponto]) => permitidos.includes(ponto)).map(([ponto, conjunto]) => [ponto, [...conjunto]])
  );
  const dados = { disponibilidade, reserva, nome: pub?.nome || '' };
  const porOutro = v.pubId !== estado.perfil.publicadorId;

  // Sem internet: o voto fica guardado no aparelho e o Firebase envia sozinho quando a conexão voltar.
  if (!navigator.onLine && estado.backend.modo === 'firebase') {
    estado.backend.salvarVoto(e.id, v.pubId, dados).catch((err) => console.error(err));
    toast('Sem internet: seu voto ficou guardado no aparelho e será enviado quando a internet voltar.');
    v.salvo = true; v.jaVotou = true;
    if ($('#modal').innerHTML) { fecharModal(); renderAba(); } else renderAreaVoto();
    return;
  }

  const ok = await tentar(() => estado.backend.salvarVoto(e.id, v.pubId, dados), 'Votos salvos!');
  if (ok && porOutro) registrar({ area: 'votos', acao: 'Lançou os votos de outra pessoa', alvo: pub?.nome || v.pubId, enqueteId: e.id, detalhe: `${Object.values(disponibilidade).flat().length} horário(s), ${Object.values(reserva).flat().length} de reserva` });
  if (ok && v.guardarPadrao) {
    const padrao = costumeDoVoto(disponibilidade);
    try { await estado.backend.salvarPadrao(v.pubId, padrao); v.padrao = padrao; v.guardarPadrao = false; } catch { toast('O voto foi salvo, mas não deu para guardar o costume.', 'erro'); }
  }
  if (ok && $('#modal').innerHTML) { fecharModal(); renderAba(); return; }
  if (ok) {
    estado.voto.salvo = true;
    estado.voto.jaVotou = true;
    renderAreaVoto();
    $('#aviso-salvo')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}
