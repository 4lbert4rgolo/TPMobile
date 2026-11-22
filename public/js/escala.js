// Regras e gerador da escala. Funções puras (sem tela e sem banco), fáceis de testar.

const NOMES_DIA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export function parseISO(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
}

export function toISO(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function nomeDia(iso) {
  return NOMES_DIA[parseISO(iso).getDay()];
}

export function dataCurta(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** Lista de dias entre duas datas (no máximo 14), todos ativos. */
export function gerarDias(inicio, fim) {
  const dias = [];
  const cursor = parseISO(inicio);
  const limite = parseISO(fim);
  while (cursor <= limite && dias.length < 14) {
    dias.push({ data: toISO(cursor), ativo: true, motivo: '' });
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

export const chave = (data, turno) => `${data}|${turno}`;

/** Motivo pelo qual o horário não tem carrinho (dia desativado ou horário bloqueado), ou null. */
export function celulaBloqueada(enquete, data, turno, ponto = null) {
  const dia = (enquete.dias || []).find((d) => d.data === data);
  if (dia && dia.ativo === false) return dia.motivo || 'Sem carrinho';
  // Bloqueio com "ponto" vale só naquele ponto; sem "ponto", vale em todos. Turno "*" = dia todo.
  const bloqueio = (enquete.bloqueios || []).find(
    (b) => b.data === data && (b.turno === turno || b.turno === '*') && (!b.ponto || b.ponto === ponto)
  );
  if (bloqueio) return bloqueio.motivo || 'Bloqueado';
  return null;
}

/**
 * Pontos em que a pessoa vota. Sem restrição cadastrada (ou sem nenhum ponto em comum
 * com a enquete), vale todos os pontos da enquete.
 */
export function pontosDoPublicador(pub, pontosDaEnquete) {
  const escolhidos = (pub?.pontosVoto || []).filter((p) => pontosDaEnquete.includes(p));
  return escolhidos.length ? escolhidos : pontosDaEnquete;
}

export const REGRAS_PADRAO = { maxIrmas: 3, maxIrmaos: null, equilibrarSemanas: true };

/**
 * Como tratar quem tem par fixo (regra "parFixo" da enquete):
 * - 'preferencia' (padrão): escala o casal junto sempre que os dois puderem; se o par não puder,
 *   a pessoa pode sair com alguém do mesmo gênero.
 * - 'sempre': só sai junto com o par (se o par não puder, a pessoa fica de fora do horário).
 * - 'ignorar': nesta enquete o par fixo não conta.
 * Enquetes antigas guardavam só "parFixoJunto": false vira 'ignorar'; true (era o padrão) vira 'preferencia'.
 */
export function modoParFixo(regras) {
  if (['preferencia', 'sempre', 'ignorar'].includes(regras?.parFixo)) return regras.parFixo;
  return regras?.parFixoJunto === false ? 'ignorar' : 'preferencia';
}

/** Cada pessoa no máximo uma vez por dia (regra "umPorDia", ligada a não ser que a enquete desligue). */
export const umaVezPorDia = (regras) => regras?.umPorDia !== false;

/** Os dois são o par fixo um do outro (basta um dos cadastros apontar para o outro). */
export const saoCasal = (a, b) => Boolean(a && b && a.id !== b.id && (a.conjuge === b.id || b.conjuge === a.id));

/**
 * Equipe só com irmãos ou só com irmãs. A exceção é um casal (par fixo): os dois podem estar
 * juntos e completar um trio com mais alguém. Quem está sem gênero no cadastro não bloqueia.
 */
export function generosCompativeis(membros) {
  const generos = new Set(membros.map((m) => m?.genero).filter(Boolean));
  if (generos.size <= 1) return true;
  for (let i = 0; i < membros.length; i++) {
    for (let j = i + 1; j < membros.length; j++) if (saoCasal(membros[i], membros[j])) return true;
  }
  return false;
}

/** Quantas escalas anteriores contam para o equilíbrio entre semanas. */
export const SEMANAS_EQUILIBRIO = 4;

/**
 * Peso das escalas anteriores. Cada participação média por escala vale meia participação
 * desta semana: o equilíbrio da semana atual continua mandando, o histórico desempata e
 * dá a vez a quem ficou de fora nas últimas semanas.
 */
export const PESO_HISTORICO = 0.5;

/**
 * Média de participações por escala de cada pessoa, nas escalas anteriores.
 * Ex.: participou 2, 0, 1 e 1 vezes nas últimas 4 escalas -> média 1.
 * @param {object[]} matrizes matrizes das escalas anteriores
 * @returns {Map<string, number>}
 */
export function historicoDeParticipacoes(matrizes) {
  const validas = (matrizes || []).filter(Boolean);
  const media = new Map();
  if (!validas.length) return media;
  for (const matriz of validas) {
    for (const [id, info] of contarParticipacoes(matriz)) media.set(id, (media.get(id) || 0) + info.total);
  }
  for (const [id, total] of media) media.set(id, total / validas.length);
  return media;
}

const limiteDe = (pessoa, regras) => (pessoa.genero === 'F' ? regras.maxIrmas : regras.maxIrmaos);

function podeEscalar(pessoa, regras, carga) {
  const limite = limiteDe(pessoa, regras);
  return !(limite && carga.get(pessoa.id) >= limite);
}

/**
 * Monta a melhor equipe para um horário.
 * - Equipe normal: dupla. Se alguém "precisa de trio", a equipe tem 3 pessoas.
 * - Par fixo: junto sempre que os dois puderem ("de preferência") ou só junto ("sempre").
 * - Equipe só com irmãos ou só com irmãs (o casal é a exceção).
 * - Irmãs respeitam o limite de participações.
 * - Prefere quem participou menos nesta escala e, se ligado, nas escalas anteriores (equilíbrio).
 */
function escolherEquipe(slot, ctx) {
  const { porId, carga, ocupado, ocupadoNoDia, regras, pontos } = ctx;

  const livres = slot.cand
    .map((id) => porId.get(id))
    .filter((p) => !ocupado.has(`${p.id}|${slot.data}|${slot.turno}`) && podeEscalar(p, regras, carga))
    // Quem já está escalado neste dia (em qualquer horário ou ponto) não entra de novo.
    .filter((p) => !umaVezPorDia(regras) || !ocupadoNoDia.has(`${p.id}|${slot.data}`));
  const livresIds = new Set(livres.map((p) => p.id));

  const ordenados = [...livres].sort(
    (a, b) => pontos(a.id) - pontos(b.id) || a.nome.localeCompare(b.nome, 'pt')
  );

  const usados = new Set();
  const unidades = [];
  const modo = modoParFixo(regras);

  // "Unidades": o casal com par fixo entra como uma unidade só; os outros, um por um.
  for (const pessoa of ordenados) {
    if (usados.has(pessoa.id)) continue;
    usados.add(pessoa.id);
    const par = modo !== 'ignorar' && pessoa.conjuge ? porId.get(pessoa.conjuge) : null;

    if (par && livresIds.has(par.id) && !usados.has(par.id)) {
      usados.add(par.id);
      unidades.push([pessoa, par]);
    } else if (par && modo === 'sempre') {
      // "Só com o par": sem o par disponível, a pessoa não participa neste horário.
    } else {
      // "De preferência": o par não pode agora, então a pessoa entra sozinha
      // (e só vai formar equipe com alguém do mesmo gênero, pela regra abaixo).
      unidades.push([pessoa]);
    }
  }

  const U = unidades.slice(0, 10);
  let melhor = null;

  const avaliar = (membros) => {
    const requerTrio = membros.some((m) => m.requerTrio);
    const alvo = requerTrio ? 3 : 2;
    if (membros.length !== alvo) return;
    if (!generosCompativeis(membros)) return; // irmão com irmã, só se forem casal

    const media = membros.reduce((soma, m) => soma + pontos(m.id), 0) / membros.length;
    const custo = media - (requerTrio ? 0.4 : 0); // dá chance a quem precisa de trio
    if (!melhor || custo < melhor.custo) melhor = { membros, custo };
  };

  for (let i = 0; i < U.length; i++) {
    avaliar(U[i]);
    for (let j = i + 1; j < U.length; j++) {
      avaliar([...U[i], ...U[j]]);
      for (let k = j + 1; k < U.length; k++) avaliar([...U[i], ...U[j], ...U[k]]);
    }
  }

  return melhor ? melhor.membros : null;
}

/**
 * Gera a escala a partir dos votos.
 * @returns {{matriz: object, avisos: Array}} matriz[ponto][data][turno] = {tipo, pessoas?, nota?}
 */
export function gerarEscala({ enquete, publicadores, votos, historico = new Map() }) {
  const regras = { ...REGRAS_PADRAO, ...(enquete.regras || {}) };
  const pubs = publicadores.filter((p) => p.ativo !== false);
  const porId = new Map(pubs.map((p) => [p.id, p]));

  const disp = new Map();
  for (const voto of votos) {
    const d = voto.disponibilidade || {};
    for (const ponto of Object.keys(d)) {
      for (const c of d[ponto]) {
        const k = `${ponto}#${c}`;
        if (!disp.has(k)) disp.set(k, new Set());
        disp.get(k).add(voto.publicadorId);
      }
    }
  }

  const carga = new Map(pubs.map((p) => [p.id, 0]));
  const ocupado = new Set();
  const ocupadoNoDia = new Set();
  const matriz = {};
  const slots = [];

  for (const ponto of enquete.pontos) {
    matriz[ponto] = {};
    for (const dia of enquete.dias) {
      matriz[ponto][dia.data] = {};
      for (const turno of enquete.turnos) {
        const motivo = celulaBloqueada(enquete, dia.data, turno, ponto);
        if (motivo) {
          matriz[ponto][dia.data][turno] = { tipo: 'bloqueio', nota: motivo };
          continue;
        }
        matriz[ponto][dia.data][turno] = { tipo: 'vazio' };
        const cand = [...(disp.get(`${ponto}#${chave(dia.data, turno)}`) || [])]
          .filter((id) => porId.has(id) && pontosDoPublicador(porId.get(id), enquete.pontos).includes(ponto));
        slots.push({ ponto, data: dia.data, turno, cand, ordem: slots.length });
      }
    }
  }

  // Horários com menos voluntários primeiro: garante que eles sejam cobertos.
  slots.sort((a, b) => a.cand.length - b.cand.length || a.ordem - b.ordem);

  // "Pontos" de cada pessoa: participações nesta escala + peso das escalas anteriores.
  // Quem tem menos pontos é escolhido primeiro.
  const pesoHist = regras.equilibrarSemanas === false ? 0 : PESO_HISTORICO;
  const pontos = (id) => carga.get(id) + pesoHist * (historico.get(id) || 0);
  const ctx = { porId, carga, ocupado, ocupadoNoDia, regras, pontos };

  for (const slot of slots) {
    if (slot.cand.length < 2) continue;
    const equipe = escolherEquipe(slot, ctx);
    if (!equipe) continue;

    for (const membro of equipe) {
      carga.set(membro.id, carga.get(membro.id) + 1);
      ocupado.add(`${membro.id}|${slot.data}|${slot.turno}`);
      ocupadoNoDia.add(`${membro.id}|${slot.data}`);
    }

    matriz[slot.ponto][slot.data][slot.turno] = {
      tipo: 'equipe',
      pessoas: equipe.map((m) => ({ id: m.id, nome: m.nome })),
    };
  }

  return { matriz, avisos: validarEscala({ enquete, publicadores, votos, matriz }) };
}

/** Quantas vezes cada pessoa aparece na escala. */
export function contarParticipacoes(matriz) {
  const total = new Map();
  for (const ponto of Object.keys(matriz || {})) {
    for (const data of Object.keys(matriz[ponto])) {
      for (const turno of Object.keys(matriz[ponto][data])) {
        const celula = matriz[ponto][data][turno];
        if (celula.tipo !== 'equipe') continue;
        for (const p of celula.pessoas) {
          const atual = total.get(p.id) || { nome: p.nome, total: 0 };
          atual.total += 1;
          total.set(p.id, atual);
        }
      }
    }
  }
  return total;
}

/**
 * Confere a escala (gerada ou ajustada à mão) contra as regras.
 * Cada aviso: { nivel: 'erro' | 'aviso', msg, ponto?, data?, turno? }
 */
export function validarEscala({ enquete, publicadores, votos, matriz }) {
  const regras = { ...REGRAS_PADRAO, ...(enquete.regras || {}) };
  const porId = new Map(publicadores.map((p) => [p.id, p]));
  const avisos = [];

  // Quem marcou o horário como "posso" não gera aviso ao ser escalado.
  const votou = new Set();
  for (const voto of votos || []) {
    for (const d of [voto.disponibilidade || {}]) {
      for (const ponto of Object.keys(d)) {
        for (const c of d[ponto]) votou.add(`${voto.publicadorId}|${ponto}|${c}`);
      }
    }
  }

  const simultaneo = new Map();

  for (const ponto of Object.keys(matriz || {})) {
    for (const data of Object.keys(matriz[ponto])) {
      for (const turno of Object.keys(matriz[ponto][data])) {
        const celula = matriz[ponto][data][turno];
        if (celula.tipo !== 'equipe') continue;

        const onde = { ponto, data, turno };
        const nomes = celula.pessoas.map((p) => p.nome);
        const membros = celula.pessoas.map((p) => porId.get(p.id)).filter(Boolean);
        const requerTrio = membros.some((m) => m.requerTrio);

        if (celula.pessoas.length < 2) {
          avisos.push({ nivel: 'erro', msg: `Equipe incompleta (${nomes.join(', ') || 'ninguém'}).`, ...onde });
        } else if (requerTrio && celula.pessoas.length < 3) {
          const quem = membros.filter((m) => m.requerTrio).map((m) => m.nome).join(', ');
          avisos.push({ nivel: 'erro', msg: `${quem} só participa em trio, mas a equipe tem ${celula.pessoas.length} pessoas.`, ...onde });
        }

        if (!generosCompativeis(membros)) {
          avisos.push({ nivel: 'erro', msg: `Equipe com irmão e irmã que não são casal (${nomes.join(', ')}).`, ...onde });
        }

        for (const m of membros) {
          // Sem o par fixo só é aviso quando a enquete pede "só com o par".
          if (modoParFixo(regras) === 'sempre' && m.conjuge && !celula.pessoas.some((p) => p.id === m.conjuge)) {
            const par = porId.get(m.conjuge);
            avisos.push({ nivel: 'aviso', msg: `${m.nome} está sem o par fixo${par ? ` (${par.nome})` : ''}.`, ...onde });
          }

          const permitidos = pontosDoPublicador(m, enquete.pontos);
          if (!permitidos.includes(ponto)) {
            avisos.push({ nivel: 'aviso', msg: `${m.nome} está configurado para votar só em ${permitidos.join(' e ')}.`, ...onde });
          } else if (!votou.has(`${m.id}|${ponto}|${chave(data, turno)}`)) {
            avisos.push({ nivel: 'aviso', msg: `${m.nome} não marcou este horário neste ponto.`, ...onde });
          }
        }

        for (const p of celula.pessoas) {
          const k = `${p.id}|${data}|${turno}`;
          if (!simultaneo.has(k)) simultaneo.set(k, []);
          simultaneo.get(k).push(ponto);
        }
      }
    }
  }

  // Mais de uma vez no mesmo dia (horários diferentes ou pontos diferentes).
  if (umaVezPorDia(regras)) {
    const noDia = new Map();
    for (const [k, pontos] of simultaneo) {
      const [id, data, turno] = k.split('|');
      const chaveDia = `${id}|${data}`;
      if (!noDia.has(chaveDia)) noDia.set(chaveDia, []);
      noDia.get(chaveDia).push(...pontos.map((p) => `${turno} (${p})`));
    }
    for (const [k, lugares] of noDia) {
      if (lugares.length < 2) continue;
      const [id, data] = k.split('|');
      const nome = porId.get(id)?.nome || 'Alguém';
      avisos.push({ nivel: 'erro', msg: `${nome} está mais de uma vez em ${nomeDia(data).toLowerCase()}, ${dataCurta(data)}: ${lugares.join(', ')}.`, data });
    }
  }

  for (const [k, pontos] of simultaneo) {
    if (pontos.length > 1) {
      const [id, data, turno] = k.split('|');
      const nome = porId.get(id)?.nome || 'Alguém';
      avisos.push({ nivel: 'erro', msg: `${nome} está em mais de um ponto ao mesmo tempo (${pontos.join(' e ')}).`, data, turno });
    }
  }

  for (const [id, info] of contarParticipacoes(matriz)) {
    const pessoa = porId.get(id);
    const limite = pessoa ? limiteDe(pessoa, regras) : null;
    if (pessoa && limite && info.total > limite) {
      avisos.push({ nivel: 'erro', msg: `${pessoa.nome} está em ${info.total} horários (o limite ${pessoa.genero === 'F' ? 'das irmãs' : 'dos irmãos'} é ${limite}).` });
    }
  }

  return avisos;
}

/* ------------------------------------------------------------------ dois organizadores ao mesmo tempo */

/**
 * Erro lançado quando outra pessoa mudou a escala no banco depois que você a abriu.
 * Leva junto a versão mais nova (`atual`), para a tela mostrar o que mudou.
 */
export class ConflitoEscala extends Error {
  constructor(atual, tipo) {
    super('conflito-escala');
    this.code = 'app/conflito-escala';
    this.atual = atual;
    this.tipo = tipo; // 'celula' (o mesmo horário) ou 'versao' (a escala inteira)
  }
}

/** Resume a célula só no que importa (tipo e quem está nela), para comparar duas versões. */
function resumoCelula(c) {
  if (!c || c.tipo === 'vazio') return 'vazio';
  if (c.tipo === 'equipe') return `equipe:${c.pessoas.map((p) => p.id).sort().join(',')}`;
  return c.tipo;
}

export const mesmaCelula = (a, b) => resumoCelula(a) === resumoCelula(b);

/**
 * Troca UM horário em cima da versão que está no banco agora.
 * Assim, se outro organizador mexeu em OUTRO horário, a mudança dele é mantida.
 * Se ele mexeu NESTE mesmo horário depois que você abriu (`antes` ≠ banco), é conflito.
 */
export function trocarCelula(atual, { ponto, data, turno, antes, depois, matrizLocal }) {
  const matriz = structuredClone(atual?.matriz || matrizLocal || {});
  if (atual?.matriz && !mesmaCelula(matriz[ponto]?.[data]?.[turno], antes)) throw new ConflitoEscala(atual, 'celula');
  matriz[ponto] = matriz[ponto] || {};
  matriz[ponto][data] = matriz[ponto][data] || {};
  matriz[ponto][data][turno] = depois;
  return { ...(atual || {}), matriz };
}

/**
 * Para ações que trocam a escala inteira (gerar de novo, publicar):
 * só deixa gravar se a versão no banco ainda é a que está na sua tela.
 */
export function exigirVersao(atual, versaoNaTela) {
  if ((atual?.versao || 0) !== (versaoNaTela || 0)) throw new ConflitoEscala(atual, 'versao');
}
