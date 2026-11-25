// Copia as bibliotecas de Excel de node_modules para public/vendor, para o site servir do
// próprio endereço (sem depender de CDN de terceiros).
// Roda sozinho depois de `npm install` (script "postinstall") e no deploy do GitHub.
//
//  - xlsx-estilo.js : xlsx-js-style (planilhas com cores). Usada só para GERAR arquivos
//                     (escala em Excel e modelo de importação). Define a variável global XLSX.
//  - xlsx.mjs       : SheetJS 0.20.3, versão corrigida, usada para LER planilhas enviadas
//                     (importar publicadores). Carregada só na hora, com import(), sem global.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'public', 'vendor');
const copias = [
  ['node_modules/xlsx-js-style/dist/xlsx.bundle.js', 'xlsx-estilo.js'],
  ['node_modules/xlsx/xlsx.mjs', 'xlsx.mjs'],
];

mkdirSync(destino, { recursive: true });
let faltou = false;
for (const [origem, nome] of copias) {
  const de = join(raiz, origem);
  if (!existsSync(de)) {
    console.error(`Não achei ${origem}. Rode "npm install" de novo.`);
    faltou = true;
    continue;
  }
  copyFileSync(de, join(destino, nome));
  console.log(`Copiado: public/vendor/${nome}`);
}
if (faltou) process.exit(1);
