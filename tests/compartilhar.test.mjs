import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarDias, chave } from '../public/js/escala.js';
import { planoDaPagina, pdfDeImagens, caber, quebrarLinhas, nomeDoArquivo, textoDaMensagem, compartilharArquivos, LARGURA_IMAGEM } from '../public/js/compartilhar.js';

// Medidor falso: cada letra mede 0,55 do tamanho da fonte.
const medir = (t, f) => t.length * 0.55 * Number(/(\d+)px/.exec(f)[1]);
const T = ['06:00 às 08:00', '08:00 às 10:00'];
const enquete = {
  titulo: 'Semana de 23/11', inicio: '2026-11-23', fim: '2026-11-29', pontos: ['Bairro Novo'], turnos: T,
  dias: gerarDias('2026-11-23', '2026-11-29'),
  bloqueios: [{ data: '2026-11-26', turno: T[1], motivo: 'Reunião do meio de semana' }],
};
const matriz = { 'Bairro Novo': { '2026-11-23': { [T[0]]: { tipo: 'equipe', pessoas: [{ id: 'a', nome: 'Ana Souza' }, { id: 'b', nome: 'Bia Lima' }] } } } };
const textos = (plano) => plano.ordens.filter((o) => o.t === 'texto').map((o) => o.texto);

test('imagem: tem o ponto, o período, os dias, os nomes empilhados, Pregação e o bloqueio', () => {
  const plano = planoDaPagina(enquete, matriz, 'Bairro Novo', medir, { geradoEm: new Date(2026, 10, 21) });
  const t = textos(plano);
  assert.equal(plano.largura, LARGURA_IMAGEM);
  for (const esperado of ['Bairro Novo', '23/11 a 29/11', 'Horário', 'Ana Souza', 'Bia Lima', 'Pregação', 'Gerado em 21/11/2026 · TPMobile']) {
    assert.ok(t.includes(esperado), `faltou "${esperado}"`);
  }
  assert.ok(t.some((x) => /Reunião/.test(x)), 'motivo do bloqueio');
  assert.ok(!t.includes('Semana de 23/11'), 'título "Semana de" não se repete');
  // Os dois nomes ficam um embaixo do outro, centralizados na mesma coluna.
  const [ana, bia] = ['Ana Souza', 'Bia Lima'].map((n) => plano.ordens.find((o) => o.texto === n));
  assert.equal(ana.x, bia.x);
  assert.ok(bia.y > ana.y);
  assert.equal(ana.alinhar, 'center');
  // Tudo cabe dentro da imagem.
  for (const o of plano.ordens.filter((x) => x.t === 'texto')) assert.ok(o.y > 0 && o.y < plano.altura);
});

test('imagem: nome comprido é cortado com reticências; texto comprido quebra em linhas', () => {
  assert.equal(caber('Ana', 1000, '20px x', medir), 'Ana');
  const cortado = caber('Maria Aparecida dos Santos Oliveira', 120, '20px x', medir);
  assert.ok(cortado.endsWith('…') && medir(cortado, '20px x') <= 120);
  const linhas = quebrarLinhas('Reunião do meio de semana', 120, '20px x', medir);
  assert.ok(linhas.length > 1 && linhas.length <= 3);
});

test('PDF: começa com %PDF, uma página por imagem e a tabela xref aponta para os objetos certos', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const bytes = pdfDeImagens([{ jpeg, largura: 1754, altura: 900 }, { jpeg, largura: 1754, altura: 1100 }]);
  const txt = new TextDecoder('latin1').decode(bytes);
  assert.ok(txt.startsWith('%PDF-1.4'));
  assert.ok(txt.trimEnd().endsWith('%%EOF'));
  assert.match(txt, /\/Count 2/);
  assert.equal((txt.match(/\/Type \/Page /g) || []).length, 2);
  // Confere cada posição da xref: no byte indicado começa "n 0 obj".
  const inicioXref = Number(/startxref\n(\d+)/.exec(txt)[1]);
  assert.ok(txt.slice(inicioXref).startsWith('xref'));
  const linhas = txt.slice(inicioXref).split('\n').slice(3, 3 + 8);
  linhas.forEach((l, i) => assert.ok(txt.slice(Number(l.slice(0, 10))).startsWith(`${i + 1} 0 obj`), `objeto ${i + 1}`));
});

test('arquivo: nome sem barras e mensagem com os pontos e o período', () => {
  assert.equal(nomeDoArquivo(enquete, 'Bairro Novo', 'png'), 'Escala - Bairro Novo - 23-11 a 29-11.png');
  assert.equal(nomeDoArquivo(enquete, '', 'pdf'), 'Escala - 23-11 a 29-11.pdf');
  assert.equal(textoDaMensagem(enquete, ['Bairro Novo', 'Atacadão']), 'Escala de carrinhos — Bairro Novo, Atacadão — 23/11 a 29/11');
});

test('compartilhar: usa a janela do aparelho quando existe; cancelar não baixa nada', async () => {
  const chamadas = [];
  const nav = { canShare: () => true, share: async (d) => { chamadas.push(d); } };
  assert.equal(await compartilharArquivos(['arq'], 'Escala', nav), 'compartilhado');
  assert.deepEqual(chamadas[0].files, ['arq']);
  const cancela = { canShare: () => true, share: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); } };
  assert.equal(await compartilharArquivos(['arq'], 'Escala', cancela), 'cancelado');
});
