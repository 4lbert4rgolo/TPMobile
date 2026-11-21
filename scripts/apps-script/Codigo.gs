/**
 * Backup automático do TPMobile (Firestore) para o Google Drive.
 *
 * Como funciona, em resumo:
 *  1. Pede ao Firestore a lista de coleções (publicadores, enquetes, usuarios...).
 *  2. Lê todos os documentos de cada coleção, inclusive as subcoleções
 *     (ex.: enquetes/{id}/votos e enquetes/{id}/escala).
 *  3. Junta tudo em um único arquivo .json e salva na pasta "TPMobile Backups" do seu Drive.
 *  4. Manda para a lixeira os backups com mais de DIAS_PARA_GUARDAR dias.
 *
 * Funções que você roda à mão (menu "Executar"):
 *  - fazerBackup          -> faz um backup agora (use para testar)
 *  - ativarBackupDiario   -> liga o backup automático (rodar só 1 vez)
 *  - desativarBackup      -> desliga o backup automático
 */

// ====================== Configurações ======================
const PROJETO = 'tpmobile-81727';           // ID do projeto no Firebase
const PASTA_BACKUP = 'TPMobile Backups';    // nome da pasta no Drive
const DIAS_PARA_GUARDAR = 90;               // 3 meses, igual à regra de retenção do app
const HORA_DO_BACKUP = 3;                   // roda entre 3h e 4h da manhã
// "convites" guarda os links pessoais de acesso; o botão de backup do app também não inclui.
// "dispositivos" são os endereços dos celulares para as notificações (não servem num backup).
const COLECOES_IGNORADAS = ['convites', 'dispositivos'];
// ===========================================================

const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJETO + '/databases/(default)/documents';

/** Faz o backup completo e salva no Drive. */
function fazerBackup() {
  const agora = new Date();
  const dados = {
    app: 'TPMobile',
    tipo: 'backup-automatico',
    geradoEm: agora.toISOString(),
    observacao: 'Contém nomes e telefones. Guarde em local seguro. Links pessoais (convites) não estão incluídos.',
    colecoes: {}
  };

  // '' = raiz do banco: devolve as coleções principais.
  const colecoes = listarColecoes_([''])[0];
  colecoes.forEach(function (nome) {
    if (COLECOES_IGNORADAS.indexOf(nome) !== -1) return;
    dados.colecoes[nome] = lerColecao_(nome);
  });

  const pasta = obterPasta_();
  const nomeArquivo = 'tpmobile-backup-' +
    Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy-MM-dd_HH-mm') + '.json';
  pasta.createFile(nomeArquivo, JSON.stringify(dados, null, 2), 'application/json');

  limparAntigos_(pasta);
  // Se o arquivo Notificacoes.gs estiver no projeto, aproveita para apagar avisos antigos.
  if (typeof limparNotificacoes_ === 'function') {
    try { limparNotificacoes_(); } catch (e) { console.warn('Limpeza dos avisos: ' + e.message); }
  }
  console.log('Backup salvo no Drive: ' + PASTA_BACKUP + '/' + nomeArquivo);
}

/** Liga o backup automático todos os dias. Rode esta função UMA vez. */
function ativarBackupDiario() {
  desativarBackup(); // evita criar gatilhos repetidos se rodar duas vezes
  ScriptApp.newTrigger('fazerBackup')
    .timeBased()
    .everyDays(1)
    .atHour(HORA_DO_BACKUP)
    .create();
  console.log('Pronto! O backup vai rodar todo dia entre ' + HORA_DO_BACKUP + 'h e ' + (HORA_DO_BACKUP + 1) + 'h.');
}

/** Desliga o backup automático. */
function desativarBackup() {
  ScriptApp.getProjectTriggers().forEach(function (gatilho) {
    if (gatilho.getHandlerFunction() === 'fazerBackup') ScriptApp.deleteTrigger(gatilho);
  });
}

// ================== Leitura do Firestore ==================

/**
 * Lê todos os documentos de uma coleção (ex.: 'publicadores' ou 'enquetes/abc/votos').
 * Devolve um objeto { idDoDocumento: { campos..., _subcolecoes: {...} } }.
 */
function lerColecao_(caminho) {
  const resultado = {};
  let pageToken = '';

  // O Firestore entrega no máximo 300 documentos por vez ("páginas").
  // Enquanto vier um nextPageToken, ainda tem mais página para buscar.
  do {
    let url = BASE + '/' + caminho + '?pageSize=300';
    if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
    const resposta = lerResposta_(UrlFetchApp.fetch(url, opcoes_('get')));
    const documentos = resposta.documents || [];

    // Descobre de uma vez quais documentos desta página têm subcoleções.
    const caminhosDocs = documentos.map(function (doc) {
      return caminho + '/' + doc.name.split('/').pop();
    });
    const subcolecoesDeCada = listarColecoes_(caminhosDocs);

    documentos.forEach(function (doc, i) {
      const id = doc.name.split('/').pop();
      const registro = converterCampos_(doc.fields || {});
      const subs = subcolecoesDeCada[i];
      if (subs.length) {
        registro._subcolecoes = {};
        subs.forEach(function (sub) {
          registro._subcolecoes[sub] = lerColecao_(caminhosDocs[i] + '/' + sub);
        });
      }
      resultado[id] = registro;
    });

    pageToken = resposta.nextPageToken || '';
  } while (pageToken);

  return resultado;
}

/**
 * Para cada caminho de documento recebido, devolve a lista de subcoleções dele.
 * Usa UrlFetchApp.fetchAll, que faz todas as chamadas ao mesmo tempo (bem mais rápido
 * do que uma por uma).
 */
function listarColecoes_(caminhosDocs) {
  if (!caminhosDocs.length) return [];
  const pedidos = caminhosDocs.map(function (caminhoDoc) {
    const pedido = opcoes_('post', { pageSize: 100 });
    pedido.url = BASE + (caminhoDoc ? '/' + caminhoDoc : '') + ':listCollectionIds';
    return pedido;
  });
  return UrlFetchApp.fetchAll(pedidos).map(function (resp) {
    return lerResposta_(resp).collectionIds || [];
  });
}

/** Monta as opções de uma chamada à API, já com a sua autorização. */
function opcoes_(metodo, corpo) {
  const opcoes = {
    method: metodo,
    contentType: 'application/json',
    muteHttpExceptions: true, // deixa a gente tratar o erro e mostrar uma mensagem clara
    headers: {
      // Token da SUA conta Google (a dona do projeto no Firebase). Não precisa de senha nem chave.
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      // Diz ao Google que o uso da API conta no projeto do TPMobile.
      'x-goog-user-project': PROJETO
    }
  };
  if (corpo) opcoes.payload = JSON.stringify(corpo);
  return opcoes;
}

/** Confere se a resposta deu certo e transforma o texto JSON em objeto. */
function lerResposta_(resp) {
  const codigo = resp.getResponseCode();
  if (codigo !== 200) {
    throw new Error('O Firestore respondeu ' + codigo + ': ' + resp.getContentText().slice(0, 500));
  }
  return JSON.parse(resp.getContentText() || '{}');
}

// ========== Conversão do formato do Firestore para JSON simples ==========
// A API devolve cada campo "embrulhado" com o tipo, ex.: { nome: { stringValue: "João" } }.
// Estas funções tiram o embrulho: { nome: "João" }.

function converterCampos_(campos) {
  const saida = {};
  Object.keys(campos).forEach(function (chave) {
    saida[chave] = converterValor_(campos[chave]);
  });
  return saida;
}

function converterValor_(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue); // vem como texto, ex.: "3"
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return converterCampos_(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(converterValor_);
  if ('referenceValue' in v) return v.referenceValue.split('/documents/')[1];
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('bytesValue' in v) return v.bytesValue;
  return null;
}

// ======================== Google Drive ========================

/** Acha a pasta de backups no Drive; se não existir, cria. */
function obterPasta_() {
  const pastas = DriveApp.getFoldersByName(PASTA_BACKUP);
  return pastas.hasNext() ? pastas.next() : DriveApp.createFolder(PASTA_BACKUP);
}

/** Manda para a lixeira os backups mais velhos que DIAS_PARA_GUARDAR. */
function limparAntigos_(pasta) {
  const limite = new Date(Date.now() - DIAS_PARA_GUARDAR * 24 * 60 * 60 * 1000);
  const arquivos = pasta.getFiles();
  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    if (arquivo.getName().indexOf('tpmobile-backup-') === 0 && arquivo.getDateCreated() < limite) {
      arquivo.setTrashed(true);
    }
  }
}
