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

export const REGRAS_PADRAO = { maxIrmas: 3, maxIrmaos: null, parFixoJunto: true };

const limiteDe = (pessoa, regras) => (pessoa.genero === 'F' ? regras.maxIrmas : regras.maxIrmaos);

function podeEscalar(pessoa, regras, carga) {
  const limite = limiteDe(pessoa, regras);
  return !(limite && carga.get(pessoa.id) >= limite);
}

/**
 * Monta a melhor equipe para um horário.
 * - Equipe normal: dupla. Se alguém "precisa de trio", a equipe tem 3 pessoas.
 * - Quem tem par fixo só participa junto com o par.
 * - Irmãs respeitam o limite de participações.
 * - Prefere quem participou menos (equilíbrio).
 */
function escolherEquipe(slot, ctx) {
  const { porId, carga, ocupado, regras } = ctx;

  const livres = slot.cand
    .map((id) => porId.get(id))
    .filter((p) => !ocupado.has(`${p.id}|${slot.data}|${slot.turno}`) && podeEscalar(p, regras, carga));
  const livresIds = new Set(livres.map((p) => p.id));

  const ordenados = [...livres].sort(
    (a, b) => carga.get(a.id) - carga.get(b.id) || a.nome.localeCompare(b.nome, 'pt')
  );

  const usados = new Set();
  const unidades = [];

  for (const pessoa of ordenados) {
    if (usados.has(pessoa.id)) continue;
    const par = regras.parFixoJunto && pessoa.conjuge ? porId.get(pessoa.conjuge) : null;

    if (par) {
      usados.add(pessoa.id);
      if (livresIds.has(par.id)) {
        usados.add(par.id);
        unidades.push([pessoa, par]);
      }
      // Sem o par disponível, a pessoa não participa neste horário.
    } else {
      usados.add(pessoa.id);
      unidades.push([pessoa]);
    }
  }

  const U = unidades.slice(0, 10);
  let melhor = null;

  const avaliar = (membros) => {
    const requerTrio = membros.some((m) => m.requerTrio);
    const alvo = requerTrio ? 3 : 2;
    if (membros.length !== alvo) return;

    const media = membros.reduce((soma, m) => soma + carga.get(m.id), 0) / membros.length;
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
export function gerarEscala({ enquete, publicadores, votos }) {
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

  const ctx = { porId, carga, ocupado, regras };

  for (const slot of slots) {
    if (slot.cand.length < 2) continue;
    const equipe = escolherEquipe(slot, ctx);
    if (!equipe) continue;

    for (const membro of equipe) {
      carga.set(membro.id, carga.get(membro.id) + 1);
      ocupado.add(`${membro.id}|${slot.data}|${slot.turno}`);
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

  const votou = new Set();
  for (const voto of votos || []) {
    const d = voto.disponibilidade || {};
    for (const ponto of Object.keys(d)) {
      for (const c of d[ponto]) votou.add(`${voto.publicadorId}|${ponto}|${c}`);
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

        for (const m of membros) {
          if (regras.parFixoJunto && m.conjuge && !celula.pessoas.some((p) => p.id === m.conjuge)) {
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
