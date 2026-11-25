/**
 * Notificações no celular do TPMobile (enviadas pelo Firebase Cloud Messaging).
 *
 * Fica no MESMO projeto do Apps Script do backup (usa PROJETO, BASE, opcoes_ e converterCampos_
 * do arquivo Codigo.gs). Como funciona:
 *  1. O app grava um "pedido de aviso" na coleção notificacoes (status "pendente").
 *  2. A cada 5 minutos, enviarNotificacoes() procura os pendentes.
 *  3. Para cada um, descobre quem deve receber (todos, só organizadores ou algumas pessoas),
 *     pega os aparelhos dessas pessoas (coleção dispositivos) e manda o aviso pelo FCM.
 *  4. Marca o pedido como "enviada" e apaga aparelhos que não existem mais (app desinstalado etc.).
 *
 * Além disso, na mesma rodada de 5 minutos:
 *  - encerra a votação das enquetes cujo prazo passou e avisa os organizadores;
 *  - uma vez por dia, a partir das 18h: lembra quem está escalado amanhã (lembrete da véspera)
 *    e avisa quem ainda não votou numa enquete que fecha nas próximas 30 horas.
 *
 * Funções que você roda à mão (menu "Executar"):
 *  - ativarNotificacoes     -> liga o envio automático a cada 5 minutos (rodar só 1 vez)
 *  - testarNotificacao      -> manda um aviso de teste agora para os aparelhos dos administradores
 *  - desativarNotificacoes  -> desliga o envio automático
 */

const FCM = 'https://fcm.googleapis.com/v1/projects/' + PROJETO + '/messages:send';
const PAPEIS_COM_ACESSO = ['votante', 'servo', 'anciao', 'admin'];
const PAPEIS_ORGANIZADORES = ['servo', 'anciao', 'admin'];
const DIAS_GUARDAR_AVISOS = 30;       // pedidos já enviados são apagados depois disso
const DIAS_APARELHO_PARADO = 90;      // aparelho que não abre o app há 3 meses sai da lista
const FUSO = 'America/Sao_Paulo';
const HORA_LEMBRETES = 18;            // lembrete da véspera e aviso do prazo: a partir das 18h
const HORAS_AVISO_PRAZO = 30;         // avisa quem falta votar se o prazo vence nas próximas 30 horas

/** Liga o envio automático. Rode esta função UMA vez. */
function ativarNotificacoes() {
  desativarNotificacoes();
  ScriptApp.newTrigger('enviarNotificacoes').timeBased().everyMinutes(5).create();
  console.log('Pronto! Os avisos pendentes serão enviados a cada 5 minutos.');
}

/** Desliga o envio automático. */
function desativarNotificacoes() {
  ScriptApp.getProjectTriggers().forEach(function (g) {
    if (g.getHandlerFunction() === 'enviarNotificacoes') ScriptApp.deleteTrigger(g);
  });
}

/** Manda um aviso de teste para os aparelhos dos administradores (para conferir a configuração). */
function testarNotificacao() {
  const alvo = destinatarios_({ organizadores: true }, {}, function (u) { return u.papel === 'admin' || u.papel === 'anciao'; });
  if (!alvo.length) {
    console.log('Nenhum aparelho de administrador com avisos ativos. No celular: Menu > Avisos no celular > Ativar avisos.');
    return;
  }
  const r = mandar_(alvo.map(function (d) {
    return { token: d.token, titulo: '✅ Teste do TPMobile', corpo: 'Se você está lendo isto, os avisos estão funcionando.', url: './', tag: 'teste' };
  }));
  console.log('Teste: ' + r.enviados + ' enviado(s), ' + r.falhas + ' falha(s).' + (r.erro ? ' Erro: ' + r.erro : ''));
}

/** Envia os avisos pendentes. Roda sozinho a cada 5 minutos. */
function enviarNotificacoes() {
  // Evita duas execuções ao mesmo tempo (o que mandaria o mesmo aviso duas vezes).
  const trava = LockService.getScriptLock();
  if (!trava.tryLock(1000)) return;
  try {
    // Tarefas automáticas (cada uma isolada: se uma falhar, as outras seguem).
    try { encerrarPorPrazo_(); } catch (e) { console.warn('Encerrar pelo prazo: ' + e.message); }
    try { rotinaDiaria_(); } catch (e) { console.warn('Rotina das 18h: ' + e.message); }

    const pendentes = consultar_('notificacoes', 'status', 'EQUAL', { stringValue: 'pendente' }, 50);
    if (!pendentes.length) return; // nada a fazer: termina rápido

    const usuarios = listar_('usuarios');
    const aparelhos = listar_('dispositivos');
    pendentes.forEach(function (aviso) {
      const alvo = destinatarios_(aviso.para || {}, { usuarios: usuarios, aparelhos: aparelhos });
      const mensagens = alvo.map(function (d) {
        const pessoal = aviso.porPublicador && d.publicadorId && aviso.porPublicador[d.publicadorId];
        return {
          token: d.token,
          titulo: aviso.titulo || 'TPMobile',
          corpo: pessoal || aviso.corpo || '',
          url: aviso.url || './',
          tag: aviso.tipo || 'tpmobile'
        };
      });
      const r = mandar_(mensagens);
      marcarEnviada_(aviso._id, r);
      console.log('Aviso "' + aviso.titulo + '": ' + r.enviados + ' enviado(s), ' + r.falhas + ' falha(s).' + (r.erro ? ' Erro: ' + r.erro : ''));
    });
  } finally {
    trava.releaseLock();
  }
}

// ================== Prazo da votação e lembretes ==================

/** Fecha as enquetes abertas cujo prazo já passou e avisa os organizadores. */
function encerrarPorPrazo_() {
  const agora = new Date();
  consultar_('enquetes', 'status', 'EQUAL', { stringValue: 'aberta' }, 50).forEach(function (e) {
    if (!e.prazo || new Date(e.prazo) > agora) return;
    atualizarCampos_('enquetes/' + e._id, { status: { stringValue: 'fechada' } });
    const votaram = listar_('enquetes/' + e._id + '/votos').length;
    const ativos = listar_('publicadores').filter(function (p) { return p.ativo !== false; }).length;
    registrarAuditoria_({
      area: 'enquetes', acao: 'Votação encerrada pelo prazo', alvo: e.titulo || '', enqueteId: e._id,
      detalhe: votaram + ' de ' + ativos + ' votaram · prazo: ' + textoPrazo_(e.prazo)
    });
    const alvo = destinatarios_({ organizadores: true });
    const r = mandar_(alvo.map(function (d) {
      return { token: d.token, titulo: '🗳️ Votação encerrada', corpo: (e.titulo || 'Enquete') + ': ' + votaram + ' de ' + ativos + ' votaram. Já dá para gerar a escala.', url: '?aba=escala', tag: 'prazo-' + e._id };
    }));
    console.log('Enquete "' + e.titulo + '" encerrada pelo prazo. Aviso aos organizadores: ' + r.enviados + ' enviado(s).');
  });
}

/** Uma vez por dia, a partir das 18h: lembrete da véspera e aviso do prazo. */
function rotinaDiaria_() {
  const agora = new Date();
  const hoje = Utilities.formatDate(agora, FUSO, 'yyyy-MM-dd');
  if (Number(Utilities.formatDate(agora, FUSO, 'H')) < HORA_LEMBRETES) return;
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('rotinaDiaria') === hoje) return; // já rodou hoje
  props.setProperty('rotinaDiaria', hoje);                 // marca antes: se der erro, não repete o envio
  try { lembrarVespera_(); } catch (e) { console.warn('Lembrete da véspera: ' + e.message); }
  try { avisarPrazo_(); } catch (e) { console.warn('Aviso do prazo: ' + e.message); }
}

/** Para testar o lembrete da véspera agora (sem esperar as 18h). */
function testarLembreteVespera() { lembrarVespera_(); }

/** Quem está escalado amanhã recebe: "06:00 às 08:00 – Bairro Novo, com Ana". */
function lembrarVespera_() {
  const amanha = Utilities.formatDate(new Date(Date.now() + 864e5), FUSO, 'yyyy-MM-dd');
  const linhas = {}; // publicadorId -> ["06:00 às 08:00 – Bairro Novo, com Ana"]
  consultar_('enquetes', 'status', 'EQUAL', { stringValue: 'publicada' }, 50).forEach(function (e) {
    const escala = lerDoc_('enquetes/' + e._id + '/escala/atual');
    if (!escala || !escala.publicada || !escala.matriz) return;
    const turnos = e.turnos || [];
    Object.keys(escala.matriz).forEach(function (ponto) {
      const dia = escala.matriz[ponto][amanha] || {};
      Object.keys(dia).sort(function (a, b) { return turnos.indexOf(a) - turnos.indexOf(b); }).forEach(function (turno) {
        const c = dia[turno];
        if (!c || c.tipo !== 'equipe') return;
        (c.pessoas || []).forEach(function (p) {
          const com = c.pessoas.filter(function (x) { return x.id !== p.id; }).map(function (x) { return x.nome; });
          (linhas[p.id] = linhas[p.id] || []).push(turno + ' – ' + ponto + (com.length ? ', com ' + com.join(' e ') : ''));
        });
      });
    });
  });
  const ids = Object.keys(linhas);
  if (!ids.length) { console.log('Lembrete da véspera: ninguém escalado amanhã (' + amanha + ').'); return; }
  const alvo = destinatarios_({ publicadores: ids });
  const r = mandar_(alvo.map(function (d) {
    return { token: d.token, titulo: '🛒 Amanhã você está no carrinho', corpo: linhas[d.publicadorId].join('; ') + '.', url: '?aba=minha', tag: 'vespera' };
  }));
  console.log('Lembrete da véspera (' + amanha + '): ' + ids.length + ' pessoa(s) escalada(s), ' + r.enviados + ' aviso(s) enviado(s).');
}

/** Enquete aberta que fecha nas próximas 30 horas: avisa quem ainda não votou (uma vez por enquete). */
function avisarPrazo_() {
  const agora = new Date();
  const props = PropertiesService.getScriptProperties();
  consultar_('enquetes', 'status', 'EQUAL', { stringValue: 'aberta' }, 50).forEach(function (e) {
    if (!e.prazo) return;
    const falta = new Date(e.prazo) - agora;
    if (falta <= 0 || falta > HORAS_AVISO_PRAZO * 3600e3) return;
    const marca = 'prazoAvisado-' + e._id + '-' + e.prazo;
    if (props.getProperty(marca)) return;
    props.setProperty(marca, '1');
    const votaram = {};
    listar_('enquetes/' + e._id + '/votos').forEach(function (v) { votaram[v._id] = true; });
    const faltam = listar_('publicadores')
      .filter(function (p) { return p.ativo !== false && !votaram[p._id]; })
      .map(function (p) { return p._id; });
    if (!faltam.length) return;
    const quando = textoPrazo_(e.prazo);
    const alvo = destinatarios_({ publicadores: faltam });
    const r = mandar_(alvo.map(function (d) {
      return { token: d.token, titulo: '⏰ A votação fecha ' + quando, corpo: 'Falta o seu voto na enquete "' + (e.titulo || '') + '". É rapidinho: toque para votar.', url: '?aba=votar', tag: 'prazo-aviso-' + e._id };
    }));
    console.log('Aviso do prazo "' + e.titulo + '": ' + faltam.length + ' sem voto, ' + r.enviados + ' aviso(s) enviado(s).');
  });
}

/** "amanhã às 20h", "hoje às 20h30" ou "domingo, 29/11 às 20h" (no horário de Brasília). */
function textoPrazo_(iso) {
  const d = new Date(iso);
  const dia = Utilities.formatDate(d, FUSO, 'yyyy-MM-dd');
  const hoje = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd');
  const amanha = Utilities.formatDate(new Date(Date.now() + 864e5), FUSO, 'yyyy-MM-dd');
  const min = Utilities.formatDate(d, FUSO, 'mm');
  const hora = Utilities.formatDate(d, FUSO, 'H') + 'h' + (min === '00' ? '' : min);
  const NOMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const nome = dia === hoje ? 'hoje' : dia === amanha ? 'amanhã'
    : NOMES[Number(Utilities.formatDate(d, FUSO, 'u')) % 7] + ', ' + Utilities.formatDate(d, FUSO, 'dd/MM');
  return nome + ' às ' + hora;
}

/** Lê um documento (ou null se não existir). */
function lerDoc_(caminho) {
  const resp = UrlFetchApp.fetch(BASE + '/' + caminho, opcoes_('get'));
  if (resp.getResponseCode() === 404) return null;
  const doc = lerResposta_(resp);
  return converterCampos_(doc.fields || {});
}

/** Muda só os campos informados de um documento. */
function atualizarCampos_(caminho, campos) {
  const mascara = Object.keys(campos).map(function (c) { return 'updateMask.fieldPaths=' + c; }).join('&');
  lerResposta_(UrlFetchApp.fetch(BASE + '/' + caminho + '?' + mascara, opcoes_('patch', { fields: campos })));
}

/** Registra no histórico (Menu > Auditoria), como "TPMobile (automático)". */
function registrarAuditoria_(ev) {
  const texto = function (v) { return { stringValue: String(v || '') }; };
  const agora = new Date().toISOString();
  lerResposta_(UrlFetchApp.fetch(BASE + '/auditoria', opcoes_('post', {
    fields: {
      area: texto(ev.area), acao: texto(ev.acao), alvo: texto(ev.alvo), detalhe: texto(ev.detalhe),
      enqueteId: ev.enqueteId ? texto(ev.enqueteId) : { nullValue: null },
      nome: texto('TPMobile (automático)'), papel: texto('sistema'), uid: { nullValue: null },
      quando: { timestampValue: agora }, quandoISO: texto(agora)
    }
  })));
}

/** Apaga pedidos antigos e aparelhos parados. Chamada pelo backup diário (Codigo.gs). */
function limparNotificacoes_() {
  const limiteAvisos = new Date(Date.now() - DIAS_GUARDAR_AVISOS * 864e5).toISOString();
  consultar_('notificacoes', 'criadoEm', 'LESS_THAN', { timestampValue: limiteAvisos }, 300)
    .forEach(function (n) { apagar_('notificacoes/' + n._id); });
  const limiteAparelhos = new Date(Date.now() - DIAS_APARELHO_PARADO * 864e5).toISOString();
  consultar_('dispositivos', 'atualizadoEm', 'LESS_THAN', { timestampValue: limiteAparelhos }, 300)
    .forEach(function (d) { apagar_('dispositivos/' + encodeURIComponent(d._id)); });
}

// ================== Quem recebe ==================

/**
 * Lista de aparelhos { token, publicadorId } que devem receber, conforme "para":
 *   { todos: true } | { organizadores: true } | { publicadores: ['id1', ...] }
 * Só entra quem ainda tem acesso ao app (papel votante, servo ou administrador).
 */
function destinatarios_(para, dados, filtroExtra) {
  dados = dados || {};
  const usuarios = dados.usuarios || listar_('usuarios');
  const aparelhos = dados.aparelhos || listar_('dispositivos');
  const ids = para.publicadores ? para.publicadores : null;
  const vistos = {};
  const saida = [];
  aparelhos.forEach(function (d) {
    const u = usuarios.filter(function (x) { return x._id === d.uid; })[0];
    if (!u || PAPEIS_COM_ACESSO.indexOf(u.papel) === -1 || !d.token || vistos[d.token]) return;
    if (filtroExtra && !filtroExtra(u)) return;
    const serve = para.todos
      || (para.organizadores && PAPEIS_ORGANIZADORES.indexOf(u.papel) !== -1)
      || (ids && u.publicadorId && ids.indexOf(u.publicadorId) !== -1);
    if (!serve) return;
    vistos[d.token] = true;
    saida.push({ token: d.token, publicadorId: u.publicadorId || null });
  });
  return saida;
}

// ================== Envio pelo FCM ==================

/**
 * Manda as mensagens (várias ao mesmo tempo, com fetchAll). Aparelho que não existe mais
 * (o FCM responde UNREGISTERED ou token inválido) é apagado da coleção dispositivos.
 */
function mandar_(mensagens) {
  const r = { enviados: 0, falhas: 0, erro: '' };
  for (let i = 0; i < mensagens.length; i += 50) {
    const lote = mensagens.slice(i, i + 50);
    const pedidos = lote.map(function (m) {
      const p = opcoes_('post', {
        message: {
          token: m.token,
          // Só "data" (sem "notification"): quem monta a notificação é o sw.js do app.
          data: { titulo: String(m.titulo), corpo: String(m.corpo), url: String(m.url), tag: String(m.tag) },
          webpush: { headers: { TTL: '86400', Urgency: 'high' } }
        }
      });
      p.url = FCM;
      return p;
    });
    UrlFetchApp.fetchAll(pedidos).forEach(function (resp, k) {
      const codigo = resp.getResponseCode();
      if (codigo === 200) { r.enviados++; return; }
      r.falhas++;
      const texto = resp.getContentText();
      if (codigo === 404 || /UNREGISTERED|registration token is not a valid/i.test(texto)) {
        apagar_('dispositivos/' + encodeURIComponent(lote[k].token));
      } else if (!r.erro) {
        r.erro = codigo + ' ' + texto.slice(0, 300);
      }
    });
  }
  return r;
}

// ================== Firestore (leitura e escrita simples) ==================

/** Todos os documentos de uma coleção (sem subcoleções). Cada um ganha o campo _id. */
function listar_(colecao) {
  const saida = [];
  let pageToken = '';
  do {
    let url = BASE + '/' + colecao + '?pageSize=300';
    if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
    const resp = lerResposta_(UrlFetchApp.fetch(url, opcoes_('get')));
    (resp.documents || []).forEach(function (doc) {
      const d = converterCampos_(doc.fields || {});
      d._id = decodeURIComponent(doc.name.split('/').pop());
      saida.push(d);
    });
    pageToken = resp.nextPageToken || '';
  } while (pageToken);
  return saida;
}

/** Busca com um filtro só (ex.: status == 'pendente'). Não precisa de índice. */
function consultar_(colecao, campo, operador, valor, limite) {
  const pedido = opcoes_('post', {
    structuredQuery: {
      from: [{ collectionId: colecao }],
      where: { fieldFilter: { field: { fieldPath: campo }, op: operador, value: valor } },
      limit: limite || 50
    }
  });
  const resp = lerResposta_(UrlFetchApp.fetch(BASE + ':runQuery', pedido));
  return (resp || []).filter(function (x) { return x.document; }).map(function (x) {
    const d = converterCampos_(x.document.fields || {});
    d._id = decodeURIComponent(x.document.name.split('/').pop());
    return d;
  });
}

function marcarEnviada_(id, r) {
  const campos = ['status', 'enviadaEm', 'enviados', 'falhas'];
  const url = BASE + '/notificacoes/' + id + '?' + campos.map(function (c) { return 'updateMask.fieldPaths=' + c; }).join('&');
  const corpo = {
    fields: {
      status: { stringValue: 'enviada' },
      enviadaEm: { timestampValue: new Date().toISOString() },
      enviados: { integerValue: String(r.enviados) },
      falhas: { integerValue: String(r.falhas) }
    }
  };
  lerResposta_(UrlFetchApp.fetch(url, opcoes_('patch', corpo)));
}

function apagar_(caminho) {
  UrlFetchApp.fetch(BASE + '/' + caminho, opcoes_('delete'));
}
