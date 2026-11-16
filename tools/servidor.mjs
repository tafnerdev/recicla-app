#!/usr/bin/env node
/**
 * Servidor local do Recicla Slide, sem dependências.
 *
 *   node tools/servidor.mjs                 → http://localhost:8080/
 *   node tools/servidor.mjs --porta 5173
 *   node tools/servidor.mjs --base /recicla-app/   → simula o endereço do GitHub Pages
 *
 * Serve os arquivos da raiz do projeto. Pastas abrem o index.html e "/app" vira "/app/",
 * como no GitHub Pages.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));

function argumento(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

const PORTA = Number(argumento('porta', process.env.PORTA || 8080));
let BASE = argumento('base', '/');
if (!BASE.startsWith('/')) BASE = `/${BASE}`;
if (!BASE.endsWith('/')) BASE = `${BASE}/`;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.ino': 'text/plain; charset=utf-8',
};

/** Pastas que existem só para desenvolvimento e não vão para o GitHub Pages. */
const BLOQUEADAS = ['node_modules', '.git', '.claude', 'test-results', 'playwright-report'];

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let caminho = decodeURIComponent(url.pathname);

  if (!caminho.startsWith(BASE)) {
    if (`${caminho}/` === BASE) {
      res.writeHead(301, { Location: BASE });
      return res.end();
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(`Fora da base ${BASE}`);
  }
  caminho = caminho.slice(BASE.length - 1);

  const alvo = normalize(join(RAIZ, caminho));
  const relativo = alvo.slice(RAIZ.length + 1).split(sep);
  if (!alvo.startsWith(RAIZ) || BLOQUEADAS.includes(relativo[0])) {
    res.writeHead(403);
    return res.end();
  }

  try {
    let arquivo = alvo;
    const info = await stat(arquivo);
    if (info.isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
        return res.end();
      }
      arquivo = join(arquivo, 'index.html');
    }
    const corpo = await readFile(arquivo);
    const cabecalhos = {
      'Content-Type': TIPOS[extname(arquivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Accept-Ranges': 'bytes',
    };
    // Pedido parcial (Range): o vídeo precisa disso para avançar e, no iPhone, para tocar.
    const faixa = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (faixa && (faixa[1] || faixa[2])) {
      const total = corpo.length;
      let inicio = faixa[1] ? Number(faixa[1]) : total - Number(faixa[2]);
      let fim = faixa[1] && faixa[2] ? Number(faixa[2]) : total - 1;
      inicio = Math.max(0, inicio);
      fim = Math.min(fim, total - 1);
      if (inicio > fim) {
        res.writeHead(416, { 'Content-Range': `bytes */${total}` });
        return res.end();
      }
      res.writeHead(206, { ...cabecalhos, 'Content-Range': `bytes ${inicio}-${fim}/${total}`, 'Content-Length': fim - inicio + 1 });
      return res.end(corpo.subarray(inicio, fim + 1));
    }
    res.writeHead(200, { ...cabecalhos, 'Content-Length': corpo.length });
    res.end(corpo);
  } catch {
    try {
      const pagina404 = await readFile(join(RAIZ, '404.html'));
      res.writeHead(404, { 'Content-Type': TIPOS['.html'] });
      res.end(pagina404);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Não encontrado');
    }
  }
});

servidor.listen(PORTA, () => {
  const endereco = `http://localhost:${PORTA}${BASE}`;
  console.log(`Recicla Slide no ar em ${endereco}`);
  console.log(`  Site     ${endereco}`);
  console.log(`  App      ${endereco}app/?andar=7`);
  console.log(`  Telão    ${endereco}telao/`);
  console.log(`  Demo     ${endereco}demo/`);
  console.log('Ctrl+C para parar.');
});
