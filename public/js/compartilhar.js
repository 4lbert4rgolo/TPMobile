// Enviar a escala para o grupo (WhatsApp ou outro app) como imagem ou como PDF.
//
// Como funciona, em três partes:
//  1. planoDaPagina(): calcula ONDE vai cada retângulo e cada texto da imagem (função pura, testada
//     em tests/compartilhar.test.mjs). Ela não desenha nada: devolve uma lista de "ordens de desenho".
//  2. pintar(): pega essa lista e desenha num <canvas> do navegador (o canvas é uma "folha" em branco
//     onde o JavaScript pinta pixels). Do canvas sai a imagem PNG ou JPEG.
//  3. pdfDeImagens(): monta um arquivo PDF à mão, uma página por ponto, cada página com uma imagem JPEG.
//     Não usa biblioteca nenhuma (funciona até sem internet).
// No fim, compartilharArquivos() abre a janela "Compartilhar" do celular (onde aparece o WhatsApp).
// Se o aparelho não tiver essa janela (alguns computadores), o arquivo é baixado.

import { nomeDia, dataCurta } from './escala.js';
import { SEPARADOR_ESCALA, CORES, textoCelula, dataLonga } from './relatorios.js';

const FONTE = 'Inter, Arial, sans-serif';
const cor = (nome) => `#${CORES[nome]}`;

/** Largura da imagem em pixels (A4 deitado a 150 pontos por polegada: 1754 × 1240). */
export const LARGURA_IMAGEM = 1754;

/** "600 22px Inter, Arial, sans-serif" — o formato de fonte que o canvas entende. */
export const fonte = (tam, peso = 400, italico = false) => `${italico ? 'italic ' : ''}${peso} ${tam}px ${FONTE}`;

/**
 * Corta o texto com "…" até caber na largura. medir(texto, fonte) devolve a largura em pixels.
 */
export function caber(texto, largura, fonteTxt, medir) {
  if (medir(texto, fonteTxt) <= largura) return texto;
  let t = texto;
  while (t.length > 1 && medir(`${t}…`, fonteTxt) > largura) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/**
 * Quebra um texto em linhas que caibam na largura (quebra nos espaços).
 * Usado para o motivo de bloqueio, que pode ser comprido ("Reunião do meio de semana").
 */
export function quebrarLinhas(texto, largura, fonteTxt, medir, maxLinhas = 3) {
  const palavras = String(texto).split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (!atual || medir(tentativa, fonteTxt) <= largura) atual = tentativa;
    else { linhas.push(atual); atual = p; }
  }
  if (atual) linhas.push(atual);
  if (linhas.length > maxLinhas) {
    const resto = linhas.slice(maxLinhas - 1).join(' ');
    linhas.splice(maxLinhas - 1, linhas.length, resto);
  }
  return linhas.map((l) => caber(l, largura, fonteTxt, medir));
}

/**
 * Plano de desenho da escala de um ponto (mesmo visual da impressão).
 * Devolve { largura, altura, ordens }, onde cada ordem é:
 *   { t: 'ret', x, y, w, h, cor, raio? }                        → retângulo pintado
 *   { t: 'texto', x, y, texto, fonte, cor, alinhar }            → texto (y = meio da linha)
 *   { t: 'linha', x1, y1, x2, y2, cor }                          → linha fina (grade da tabela)
 */
export function planoDaPagina(enquete, matriz, ponto, medir, { largura = LARGURA_IMAGEM, geradoEm = new Date() } = {}) {
  const ordens = [];
  const ret = (x, y, w, h, c, raio = 0) => ordens.push({ t: 'ret', x, y, w, h, cor: c, raio });
  const texto = (x, y, txt, f, c, alinhar = 'center') => ordens.push({ t: 'texto', x, y, texto: txt, fonte: f, cor: c, alinhar });
  const linha = (x1, y1, x2, y2, c = cor('linha')) => ordens.push({ t: 'linha', x1, y1, x2, y2, cor: c });

  const M = 48; // margem
  const util = largura - 2 * M;

  // ---- Faixa verde com o nome do ponto e o período
  const faixa = 150;
  ret(M, M, util, faixa, cor('verde'), 18);
  texto(M + 32, M + 40, 'ESCALA DE CARRINHOS · TESTEMUNHO PÚBLICO', fonte(20, 600), cor('menta'), 'left');
  texto(M + 32, M + 88, caber(ponto, util * 0.62, fonte(46, 700), medir), fonte(46, 700), '#ffffff', 'left');
  if (!/^semana de /i.test(enquete.titulo || '') && enquete.titulo) {
    texto(M + 32, M + 128, caber(enquete.titulo, util * 0.62, fonte(20), medir), fonte(20), '#e6f6f3', 'left');
  }
  texto(largura - M - 32, M + 58, 'PERÍODO', fonte(20, 600), '#e6f6f3', 'right');
  texto(largura - M - 32, M + 98, `${dataCurta(enquete.inicio)} a ${dataCurta(enquete.fim)}`, fonte(34, 700), '#ffffff', 'right');

  // ---- Colunas: a primeira (horário) é um pouco mais larga se houver poucos dias
  const dias = enquete.dias || [];
  const larguraHorario = Math.round(util * (dias.length > 5 ? 0.13 : 0.18));
  const larguraDia = (util - larguraHorario) / Math.max(dias.length, 1);
  const xCol = (i) => M + larguraHorario + i * larguraDia;
  const folga = 14; // espaço interno da célula

  // ---- Altura de cada linha: depende de quantos nomes cabem empilhados
  const fNome = fonte(24, 600);
  const fItal = fonte(22, 400, true);
  const alturaLinhaTexto = 32;
  const celulas = (enquete.turnos || []).map((turno) => dias.map((d) => {
    const { tipo, texto: txt } = textoCelula(enquete, matriz, ponto, d.data, turno);
    const linhas = tipo === 'equipe'
      ? txt.split(SEPARADOR_ESCALA).map((n) => caber(n, larguraDia - 2 * folga, fNome, medir))
      : quebrarLinhas(txt, larguraDia - 2 * folga, fItal, medir);
    return { tipo, linhas };
  }));
  const alturas = celulas.map((linhaDeCelulas) => Math.max(76, ...linhaDeCelulas.map((c) => c.linhas.length * alturaLinhaTexto + 30)));

  // ---- Cabeçalho da tabela (fundo escuro)
  const topoTabela = M + faixa + 22;
  const alturaCab = 80;
  const alturaTabela = alturaCab + alturas.reduce((a, b) => a + b, 0);
  ret(M, topoTabela, util, alturaTabela, '#ffffff', 16); // fundo branco arredondado
  ret(M, topoTabela, util, alturaCab, cor('escuro'), 16);
  ret(M, topoTabela + alturaCab - 16, util, 16, cor('escuro')); // tira o arredondado de baixo do cabeçalho
  texto(M + larguraHorario / 2, topoTabela + alturaCab / 2, 'Horário', fonte(24, 700), '#ffffff');
  dias.forEach((d, i) => {
    const cx = xCol(i) + larguraDia / 2;
    texto(cx, topoTabela + 30, nomeDia(d.data), fonte(24, 700), '#ffffff');
    texto(cx, topoTabela + 58, dataCurta(d.data), fonte(20), '#bfe5dd');
  });

  // ---- Linhas da tabela
  let y = topoTabela + alturaCab;
  (enquete.turnos || []).forEach((turno, r) => {
    const h = alturas[r];
    const ultima = r === enquete.turnos.length - 1;
    const raioFim = ultima ? 16 : 0;
    // coluna do horário (menta)
    ret(M, y, larguraHorario, h, cor('menta'), raioFim);
    if (ultima) ret(M + larguraHorario - 16, y, 16, h, cor('menta'));
    if (ultima) ret(M, y, larguraHorario, h - 16, cor('menta'));
    texto(M + larguraHorario / 2, y + h / 2, caber(turno, larguraHorario - 2 * folga, fonte(22, 700), medir), fonte(22, 700), cor('escuro'));

    celulas[r].forEach((c, i) => {
      const x = xCol(i);
      const fundo = c.tipo === 'bloqueio' ? cor('bege') : (r % 2 === 1 ? cor('claro') : '#ffffff');
      if (fundo !== '#ffffff') ret(x, y, larguraDia, h, fundo);
      const f = c.tipo === 'equipe' ? fNome : fItal;
      const corTxt = c.tipo === 'equipe' ? cor('texto') : c.tipo === 'bloqueio' ? cor('marrom') : cor('cinza');
      const inicio = y + h / 2 - ((c.linhas.length - 1) * alturaLinhaTexto) / 2;
      c.linhas.forEach((l, k) => texto(x + larguraDia / 2, inicio + k * alturaLinhaTexto, l, f, corTxt));
    });
    if (!ultima) linha(M, y + h, M + util, y + h);
    y += h;
  });

  // ---- Grade vertical e contorno
  for (let i = 0; i <= dias.length - 1; i++) linha(xCol(i), topoTabela + alturaCab, xCol(i), topoTabela + alturaTabela);
  ordens.push({ t: 'contorno', x: M, y: topoTabela, w: util, h: alturaTabela, cor: '#b9cdc8', raio: 16 });

  // ---- Rodapé com legenda e data
  const yRod = topoTabela + alturaTabela + 34;
  ret(M, yRod - 10, 20, 20, '#ffffff', 4);
  ordens.push({ t: 'contorno', x: M, y: yRod - 10, w: 20, h: 20, cor: cor('linha'), raio: 4 });
  texto(M + 30, yRod, 'Pregação: horário sem carrinho escalado', fonte(19), '#54625f', 'left');
  const xBege = M + 30 + medir('Pregação: horário sem carrinho escalado', fonte(19)) + 40;
  ret(xBege, yRod - 10, 20, 20, cor('bege'), 4);
  ordens.push({ t: 'contorno', x: xBege, y: yRod - 10, w: 20, h: 20, cor: '#e6c48a', raio: 4 });
  texto(xBege + 30, yRod, 'Sem carrinho (reunião, evento)', fonte(19), '#54625f', 'left');
  texto(largura - M, yRod, `Gerado em ${dataLonga(geradoEm)} · TPMobile`, fonte(19), '#54625f', 'right');

  return { largura, altura: Math.ceil(yRod + 10 + M), ordens };
}

/* ------------------------------------------------------------ PDF feito à mão */

/**
 * Monta um PDF com uma imagem JPEG por página (A4 deitado, imagem centralizada).
 * paginas: [{ jpeg: Uint8Array, largura, altura }] (largura/altura da imagem em pixels).
 *
 * Um PDF é um texto com "objetos" numerados (catálogo, lista de páginas, cada página, cada imagem)
 * e, no fim, uma tabela ("xref") dizendo em que byte do arquivo começa cada objeto.
 * O JPEG entra do jeito que está (o PDF sabe ler JPEG: filtro DCTDecode).
 */
export function pdfDeImagens(paginas) {
  const W = 842; const H = 595; // A4 deitado, em pontos (1 ponto = 1/72 de polegada)
  const M = 18;
  const enc = new TextEncoder();
  const partes = [];
  let tamanho = 0;
  const offsets = [];
  const escrever = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; partes.push(b); tamanho += b.length; };
  const objeto = (n, corpo) => { offsets[n] = tamanho; escrever(`${n} 0 obj\n`); corpo(); escrever('\nendobj\n'); };

  escrever('%PDF-1.4\n');
  // 1 = catálogo, 2 = lista de páginas; cada página usa 3 objetos: página, imagem, desenho.
  const idsPaginas = paginas.map((_, i) => 3 + i * 3);
  objeto(1, () => escrever('<< /Type /Catalog /Pages 2 0 R >>'));
  objeto(2, () => escrever(`<< /Type /Pages /Kids [${idsPaginas.map((id) => `${id} 0 R`).join(' ')}] /Count ${paginas.length} >>`));

  paginas.forEach((p, i) => {
    const idPag = 3 + i * 3; const idImg = idPag + 1; const idDes = idPag + 2;
    // Cabe a imagem na página mantendo a proporção.
    const escala = Math.min((W - 2 * M) / p.largura, (H - 2 * M) / p.altura);
    const w = +(p.largura * escala).toFixed(2); const h = +(p.altura * escala).toFixed(2);
    const x = +((W - w) / 2).toFixed(2); const y = +((H - h) / 2).toFixed(2);
    const desenho = `q ${w} 0 0 ${h} ${x} ${y} cm /Im0 Do Q`;

    objeto(idPag, () => escrever(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${idImg} 0 R >> >> /Contents ${idDes} 0 R >>`));
    objeto(idImg, () => {
      escrever(`<< /Type /XObject /Subtype /Image /Width ${p.largura} /Height ${p.altura} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
      escrever(p.jpeg);
      escrever('\nendstream');
    });
    objeto(idDes, () => escrever(`<< /Length ${desenho.length} >>\nstream\n${desenho}\nendstream`));
  });

  const total = 3 + paginas.length * 3;
  const inicioXref = tamanho;
  escrever(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) escrever(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  escrever(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`);

  const saida = new Uint8Array(tamanho);
  let pos = 0;
  for (const b of partes) { saida.set(b, pos); pos += b.length; }
  return saida;
}

/** Nome de arquivo sem caracteres proibidos: "Escala - Bairro Novo - 23-11 a 29-11". */
export function nomeDoArquivo(enquete, ponto, extensao) {
  const periodo = `${dataCurta(enquete.inicio)} a ${dataCurta(enquete.fim)}`.replace(/\//g, '-');
  return `Escala - ${ponto ? `${ponto} - ` : ''}${periodo}.${extensao}`.replace(/[\\/:*?"<>|]/g, '-');
}

/** Texto que acompanha os arquivos na mensagem. */
export function textoDaMensagem(enquete, pontos) {
  const periodo = `${dataCurta(enquete.inicio)} a ${dataCurta(enquete.fim)}`;
  return `Escala de carrinhos — ${pontos.join(', ')} — ${periodo}`;
}

/* ------------------------------------------------------------ navegador */

/** Desenha o plano num canvas e devolve o canvas. */
export function pintar(plano, doc = document) {
  const canvas = doc.createElement('canvas');
  canvas.width = plano.largura;
  canvas.height = plano.altura;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'middle';
  const caminhoArredondado = (o) => {
    ctx.beginPath();
    if (o.raio && ctx.roundRect) ctx.roundRect(o.x, o.y, o.w, o.h, o.raio);
    else ctx.rect(o.x, o.y, o.w, o.h);
  };
  for (const o of plano.ordens) {
    if (o.t === 'ret') { ctx.fillStyle = o.cor; caminhoArredondado(o); ctx.fill(); }
    else if (o.t === 'contorno') { ctx.strokeStyle = o.cor; ctx.lineWidth = 2; caminhoArredondado(o); ctx.stroke(); }
    else if (o.t === 'linha') { ctx.strokeStyle = o.cor; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(o.x1, o.y1); ctx.lineTo(o.x2, o.y2); ctx.stroke(); }
    else if (o.t === 'texto') { ctx.font = o.fonte; ctx.fillStyle = o.cor; ctx.textAlign = o.alinhar; ctx.fillText(o.texto, o.x, o.y); }
  }
  return canvas;
}

/** Mede o texto com o próprio canvas do navegador (a mesma fonte que vai ser desenhada). */
export function medidorDoNavegador(doc = document) {
  const ctx = doc.createElement('canvas').getContext('2d');
  return (texto, f) => { ctx.font = f; return ctx.measureText(texto).width; };
}

const paraBlob = (canvas, tipo, qualidade) => new Promise((ok, erro) =>
  canvas.toBlob((b) => (b ? ok(b) : erro(new Error('Não foi possível gerar a imagem.'))), tipo, qualidade));

/** Canvas de um ponto, já com a fonte carregada. */
export async function canvasDoPonto(enquete, matriz, ponto) {
  try { await document.fonts?.ready; } catch { /* sem a fonte Inter, usa Arial */ }
  return pintar(planoDaPagina(enquete, matriz, ponto, medidorDoNavegador()));
}

/** Um arquivo PNG por ponto. */
export async function imagensDaEscala(enquete, matriz, pontos) {
  const arquivos = [];
  for (const ponto of pontos) {
    const canvas = await canvasDoPonto(enquete, matriz, ponto);
    const blob = await paraBlob(canvas, 'image/png');
    arquivos.push(new File([blob], nomeDoArquivo(enquete, ponto, 'png'), { type: 'image/png' }));
  }
  return arquivos;
}

/** Um único PDF, uma página por ponto. */
export async function pdfDaEscala(enquete, matriz, pontos) {
  const paginas = [];
  for (const ponto of pontos) {
    const canvas = await canvasDoPonto(enquete, matriz, ponto);
    const blob = await paraBlob(canvas, 'image/jpeg', 0.92);
    paginas.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), largura: canvas.width, altura: canvas.height });
  }
  const bytes = pdfDeImagens(paginas);
  return new File([bytes], nomeDoArquivo(enquete, pontos.length === 1 ? pontos[0] : '', 'pdf'), { type: 'application/pdf' });
}

/**
 * Abre a janela "Compartilhar" do aparelho com os arquivos (no celular aparece o WhatsApp;
 * é só escolher o grupo). Devolve 'compartilhado', 'cancelado' ou 'baixado'.
 */
export async function compartilharArquivos(arquivos, texto, nav = navigator) {
  const dados = { files: arquivos, title: texto, text: texto };
  if (nav.canShare?.(dados)) {
    try {
      await nav.share(dados);
      return 'compartilhado';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelado'; // a pessoa fechou a janela
      // Alguns navegadores recusam o texto junto com arquivos: tenta só os arquivos.
      try { await nav.share({ files: arquivos }); return 'compartilhado'; } catch (e2) {
        if (e2?.name === 'AbortError') return 'cancelado';
      }
    }
  }
  // Sem a janela de compartilhar (computador): baixa os arquivos.
  for (const f of arquivos) {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url; a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return 'baixado';
}
