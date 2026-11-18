// Busca nas listas (publicadores, usuários e links de acesso).
// Cada linha da tabela leva um atributo data-busca com o texto já "limpo" (sem acento, minúsculo).
// Ao digitar, as linhas que não contêm o texto procurado ficam escondidas. Nada vai ao servidor.

/** Tira acentos e deixa minúsculo: "Márcia " -> "marcia". Assim "marcia" acha "Márcia". */
export const normalizarBusca = (t) =>
  String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Junta vários pedaços (nome, e-mail, ponto...) no texto que vai em data-busca. */
export const textoBusca = (...partes) => normalizarBusca(partes.filter(Boolean).join(' '));

/** Todas as palavras digitadas precisam aparecer (em qualquer ordem). */
export function combina(textoDaLinha, termo) {
  const palavras = normalizarBusca(termo).split(' ').filter(Boolean);
  return palavras.every((p) => textoDaLinha.includes(p));
}

/** Campo de busca. Fica acima da(s) tabela(s) da seção. */
export function campoBusca(placeholder = 'Buscar') {
  return `<div class="mb-3">
    <input type="search" class="w-full max-w-md border rounded-lg p-2" data-busca-campo
      placeholder="${placeholder}" aria-label="${placeholder}" autocomplete="off">
    <p class="text-sm text-slate-500 mt-1 hidden" data-busca-vazio>Ninguém encontrado com esse nome.</p>
  </div>`;
}

/** Aplica o filtro em todas as linhas com data-busca dentro da área de conteúdo. */
export function filtrarLinhas(campo) {
  const area = campo.closest('#conteudo') || document;
  const linhas = [...area.querySelectorAll('[data-busca]')];
  let visiveis = 0;
  for (const linha of linhas) {
    const mostra = combina(linha.dataset.busca, campo.value);
    linha.hidden = !mostra;
    if (mostra) visiveis += 1;
  }
  area.querySelector('[data-busca-vazio]')?.classList.toggle('hidden', visiveis > 0 || !linhas.length);
}
