// "Minha escala": os horários de uma pessoa e a ida para o calendário do celular.
// Funções puras (sem tela e sem banco), testadas em tests/agenda.test.mjs.

import { nomeDia, dataCurta } from './escala.js';

/**
 * Todos os horários em que a pessoa está escalada, em ordem de data e horário.
 * @param {object[]} enquetes enquetes com escala publicada
 * @param {Map<string, object>} escalas enqueteId -> documento da escala
 * @param {string} pubId id do publicador da pessoa
 */
export function meusHorarios(enquetes, escalas, pubId) {
  const itens = [];
  if (!pubId) return itens;
  for (const e of enquetes) {
    const escala = escalas.get(e.id);
    if (!escala?.publicada || !escala.matriz) continue;
    for (const ponto of Object.keys(escala.matriz)) {
      for (const data of Object.keys(escala.matriz[ponto])) {
        for (const turno of Object.keys(escala.matriz[ponto][data])) {
          const cel = escala.matriz[ponto][data][turno];
          if (cel?.tipo !== 'equipe' || !cel.pessoas.some((p) => p.id === pubId)) continue;
          itens.push({
            enqueteId: e.id,
            titulo: e.titulo || '',
            data,
            turno,
            ponto,
            companheiros: cel.pessoas.filter((p) => p.id !== pubId).map((p) => p.nome),
            ordemTurno: (e.turnos || []).indexOf(turno),
          });
        }
      }
    }
  }
  return itens.sort((a, b) => a.data.localeCompare(b.data) || a.ordemTurno - b.ordemTurno || a.ponto.localeCompare(b.ponto, 'pt'));
}

/**
 * Lê o horário do turno: "06:00 às 08:00" -> { inicio: '06:00', fim: '08:00' }.
 * Aceita também "6h às 8h", "06:00 - 08:00" e "06:00 a 08:00". Se não entender, devolve null.
 */
export function horarioDoTurno(turno) {
  const m = /(\d{1,2})(?:[:h](\d{2}))?h?\s*(?:às|as|a|até|-|–)\s*(\d{1,2})(?:[:h](\d{2}))?/i.exec(String(turno || ''));
  if (!m) return null;
  const hora = (h, min) => `${String(Number(h)).padStart(2, '0')}:${min || '00'}`;
  const inicio = hora(m[1], m[2]);
  const fim = hora(m[3], m[4]);
  if (Number(m[1]) > 23 || Number(m[3]) > 24) return null;
  return { inicio, fim };
}

const compacto = (data, hora) => `${data.replace(/-/g, '')}T${hora.replace(':', '')}00`;

/** Texto do evento, igual no .ics e no Google Agenda. */
export function textosDoEvento(item) {
  return {
    titulo: `Carrinho – ${item.ponto}`,
    detalhes: [
      item.companheiros.length ? `Com: ${item.companheiros.join(' / ')}` : '',
      `Horário: ${item.turno}`,
      item.titulo ? `Escala: ${item.titulo}` : '',
    ].filter(Boolean).join('\n'),
  };
}

/** No formato .ics, vírgula, ponto e vírgula, barra e quebra de linha precisam de "\" antes. */
const escICS = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/**
 * Arquivo de calendário (.ics) com todos os horários. Abre no calendário do iPhone,
 * do computador e na maioria dos Android. O horário fica no fuso do aparelho.
 */
export function gerarICS(itens, agora = new Date()) {
  const carimbo = agora.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TPMobile//Minha escala//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const item of itens) {
    const { titulo, detalhes } = textosDoEvento(item);
    const h = horarioDoTurno(item.turno);
    linhas.push(
      'BEGIN:VEVENT',
      // O UID identifica o evento: importar de novo atualiza em vez de duplicar.
      `UID:${escICS(`${item.enqueteId}-${item.ponto}-${item.data}-${item.turno}`).replace(/\s+/g, '_')}@tpmobile`,
      `DTSTAMP:${carimbo}`,
      ...(h
        ? [`DTSTART:${compacto(item.data, h.inicio)}`, `DTEND:${compacto(item.data, h.fim)}`]
        : [`DTSTART;VALUE=DATE:${item.data.replace(/-/g, '')}`]),
      `SUMMARY:${escICS(titulo)}`,
      `LOCATION:${escICS(item.ponto)}`,
      `DESCRIPTION:${escICS(detalhes)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escICS(titulo)}`, 'TRIGGER:-PT1H', 'END:VALARM',
      'END:VEVENT'
    );
  }
  linhas.push('END:VCALENDAR');
  return linhas.join('\r\n') + '\r\n'; // o padrão do .ics pede \r\n no fim de cada linha
}

/** Link que abre o Google Agenda já com o evento preenchido (bom para Android). */
export function linkGoogleAgenda(item) {
  const { titulo, detalhes } = textosDoEvento(item);
  const h = horarioDoTurno(item.turno);
  const datas = h
    ? `${compacto(item.data, h.inicio)}/${compacto(item.data, h.fim)}`
    : `${item.data.replace(/-/g, '')}/${item.data.replace(/-/g, '')}`;
  const p = new URLSearchParams({ action: 'TEMPLATE', text: titulo, dates: datas, details: detalhes, location: item.ponto, ctz: 'America/Sao_Paulo' });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** "Segunda-feira, 23/11" */
export const rotuloDia = (data) => `${nomeDia(data)}, ${dataCurta(data)}`;
