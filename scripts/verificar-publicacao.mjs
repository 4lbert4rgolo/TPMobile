// Confere a pasta public ANTES de publicar no Firebase Hosting.
// Uso: npm run verificar   (o comando `npm run deploy` já faz isso e depois publica)

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => readFileSync(join(raiz, p), 'utf-8');
const existe = (p) => existsSync(join(raiz, p));
const erros = [];
const avisos = [];

function arquivos(pasta) {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
  });
}

// 1) firebase.json aponta para a pasta public
try {
  const cfg = JSON.parse(ler('firebase.json'));
  if (cfg.hosting?.public !== 'public') erros.push(`firebase.json publica a pasta "${cfg.hosting?.public}", mas o app está em "public".`);
} catch {
  erros.push('Não consegui ler o firebase.json.');
}

// 2) arquivos do app
const obrigatorios = [
  'public/index.html', 'public/js/app.js', 'public/js/data.js', 'public/js/escala.js',
  'public/js/firebase-config.js', 'public/css/tailwind.css', 'public/css/app.css',
  'public/manifest.webmanifest', 'public/sw.js', 'public/icons/icon-192.png', 'public/icons/icon-512.png',
];
for (const f of obrigatorios) if (!existe(f)) erros.push(`Falta o arquivo ${f}.`);

// 3) o index.html é o do app, e não o modelo que o `firebase init` cria
if (existe('public/index.html')) {
  const html = ler('public/index.html');
  if (html.includes('Firebase Hosting Setup Complete')) {
    erros.push('public/index.html é o modelo do Firebase ("Firebase Hosting Setup Complete"). O `firebase init` sobrescreveu o app. Restaure o index.html do zip.');
  } else if (!html.includes('Gestor de Escalas')) {
    erros.push('public/index.html não parece ser o do app (não achei "Gestor de Escalas").');
  }
}

// 4) configuração do Firebase preenchida
if (existe('public/js/firebase-config.js')) {
  const cfg = ler('public/js/firebase-config.js');
  const vazio = (campo) => new RegExp(`${campo}:\\s*['"]\\s*['"]`).test(cfg);
  if (vazio('apiKey') || vazio('appId')) avisos.push('firebase-config.js está sem apiKey/appId: o site vai abrir em MODO DEMONSTRAÇÃO (dados só no navegador de cada pessoa).');
}

// 5) projeto padrão
try {
  const projeto = JSON.parse(ler('.firebaserc')).projects?.default;
  if (projeto !== 'tpmobile-81727') avisos.push(`.firebaserc aponta para "${projeto}", e não para tpmobile-81727.`);
} catch {
  avisos.push('Não consegui ler o .firebaserc.');
}

const lista = existe('public') ? arquivos(join(raiz, 'public')) : [];
console.log(`\nArquivos que serão publicados: ${lista.length}`);
for (const a of lista) console.log('  -', a.slice(join(raiz, 'public').length + 1).replace(/\\/g, '/'));
console.log('');
for (const a of avisos) console.log('ATENÇÃO:', a);
for (const e of erros) console.log('ERRO:', e);

if (erros.length) {
  console.log('\nNada foi publicado. Corrija o que está acima e rode de novo.');
  process.exit(1);
}
console.log(avisos.length ? '\nPode publicar (veja a atenção acima).' : 'Tudo certo para publicar.');
