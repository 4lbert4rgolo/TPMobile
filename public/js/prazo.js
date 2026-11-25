// Prazo da votação: até quando dá para votar numa enquete.
//
// O prazo fica gravado na enquete como texto ISO em UTC (ex.: "2026-11-29T23:00:00.000Z"), que é
// o jeito mais seguro de guardar um instante: não depende do fuso de quem lê.
// Na tela, ele aparece no horário do aparelho (aqui no Brasil, o de Brasília).
// Quem encerra de verdade é o script do Google (Notificacoes.gs), que confere a cada 5 minutos;
// o app também já trava a votação na hora, para ninguém ficar esperando.

import { nomeDia, dataCurta } from './escala.js';

const doisDigitos = (n) => String(n).padStart(2, '0');

/** "2026-11-29T23:00:00.000Z" → "2026-11-29T20:00" (formato do campo datetime-local, no fuso do aparelho). */
export function paraCampo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}T${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

/** O contrário: valor do campo datetime-local (hora local) → ISO em UTC. Vazio vira null (sem prazo). */
export function doCampo(valor) {
  if (!valor) return null;
  const d = new Date(valor); // sem fuso no texto: o navegador entende como hora local
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Prazo sugerido para uma enquete nova: a véspera do primeiro dia, às 20h. */
export function prazoSugerido(inicioISO) {
  const [a, m, d] = inicioISO.split('-').map(Number);
  return new Date(a, m - 1, d - 1, 20, 0).toISOString();
}

/** Já passou do prazo? (sem prazo = nunca passa) */
export const prazoPassou = (enquete, agora = new Date()) => Boolean(enquete?.prazo) && new Date(enquete.prazo) <= agora;

/** A votação está aceitando votos: aberta e dentro do prazo. */
export const votacaoAberta = (enquete, agora = new Date()) => enquete?.status === 'aberta' && !prazoPassou(enquete, agora);

/** "domingo, 29/11 às 20h" (ou "às 20h30"). */
export function textoPrazo(iso) {
  const d = new Date(iso);
  const data = `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
  const hora = d.getMinutes() ? `${d.getHours()}h${doisDigitos(d.getMinutes())}` : `${d.getHours()}h`;
  return `${nomeDia(data).replace('-feira', '').toLowerCase()}, ${dataCurta(data)} às ${hora}`;
}
