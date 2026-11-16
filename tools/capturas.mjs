#!/usr/bin/env node
/**
 * Tira capturas de todas as telas nos tamanhos do ciclo de polimento.
 *
 *   node tools/capturas.mjs            → todas
 *   node tools/capturas.mjs app telao  → só as que começam com "app" ou "telao"
 *
 * As imagens vão para capturas/ (fora do git). Usa o Chrome instalado no PC.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PORTA = 4317;
const BASE = `http://localhost:${PORTA}/recicla-app/`;
const PASTA = new URL('../capturas/', import.meta.url);

const CELULAR = { width: 390, height: 844 };
const TABLET = { width: 768, height: 1024 };
const COMPUTADOR = { width: 1440, height: 900 };
const PROJETOR = { width: 1920, height: 1080 };

async function zerar(page) {
  await page.evaluate(async () => {
    const dados = await import(new URL('js/dados.js', document.baseURI).href);
    await dados.zerarPlacar();
  });
  await page.reload();
}

async function descartes(page, lista) {
  await page.evaluate(async (itens) => {
    const dados = await import(new URL('js/dados.js', document.baseURI).href);
    for (const [andar, tipo] of itens) await dados.registrarDescarte(andar, tipo, 'demo');
  }, lista);
}

const CAPTURAS = [
  { nome: 'site', url: '', tamanhos: [CELULAR, TABLET, COMPUTADOR], inteira: true },
  { nome: 'app', url: 'app/?andar=7', tamanhos: [CELULAR, TABLET, COMPUTADOR], inteira: true },
  { nome: 'app-sem-andar', url: 'app/', tamanhos: [CELULAR, COMPUTADOR], inteira: true },
  { nome: 'app-andar-invalido', url: 'app/?andar=42', tamanhos: [CELULAR], inteira: true },
  { nome: 'app-vazio', url: 'app/?andar=3', tamanhos: [CELULAR], inteira: true, preparar: zerar },
  { nome: 'app-erro', url: 'app/?andar=7', tamanhos: [CELULAR], inteira: true, falharDados: true },
  { nome: 'telao', url: 'telao/', tamanhos: [PROJETOR, COMPUTADOR, TABLET, CELULAR], inteira: false },
  { nome: 'telao-sensor', url: 'telao/?sensor=1', tamanhos: [PROJETOR], inteira: false },
  {
    nome: 'telao-subindo',
    url: 'telao/',
    tamanhos: [PROJETOR],
    inteira: false,
    depois: async (page) => {
      await descartes(page, [[7, 'reciclavel'], [7, 'organico'], [7, 'reciclavel'], [7, 'reciclavel'], [7, 'organico'], [7, 'reciclavel']]);
      await page.waitForTimeout(450);
    },
  },
  { nome: 'telao-vazio', url: 'telao/', tamanhos: [PROJETOR], inteira: false, preparar: zerar },
  { nome: 'telao-erro', url: 'telao/', tamanhos: [PROJETOR], inteira: false, falharDados: true },
  { nome: 'demo', url: 'demo/', tamanhos: [CELULAR, TABLET, COMPUTADOR], inteira: true },
  { nome: 'demo-vazio', url: 'demo/', tamanhos: [COMPUTADOR], inteira: true, preparar: zerar },
  { nome: 'pagina-404', url: 'nao-existe/', tamanhos: [CELULAR, COMPUTADOR], inteira: true },
];

function subirServidor() {
  const processo = spawn(process.execPath, ['tools/servidor.mjs', '--porta', String(PORTA), '--base', '/recicla-app/'], {
    cwd: RAIZ,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((resolver, rejeitar) => {
    processo.stdout.once('data', () => resolver(processo));
    processo.once('error', rejeitar);
  });
}

const filtros = process.argv.slice(2);
const escolhidas = filtros.length ? CAPTURAS.filter((c) => filtros.some((f) => c.nome.startsWith(f))) : CAPTURAS;

await mkdir(PASTA, { recursive: true });
const servidor = await subirServidor();
const navegador = await chromium.launch({ channel: 'chrome' });
const problemas = [];

try {
  for (const captura of escolhidas) {
    for (const tamanho of captura.tamanhos) {
      const contexto = await navegador.newContext({
        viewport: tamanho,
        deviceScaleFactor: 1,
        serviceWorkers: 'block',
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        hasTouch: tamanho.width < 800,
        isMobile: false,
      });
      const page = await contexto.newPage();
      page.on('pageerror', (e) => problemas.push(`${captura.nome} ${tamanho.width}: ${e.message}`));
      page.on('console', (m) => m.type() === 'error' && problemas.push(`${captura.nome} ${tamanho.width}: console: ${m.text()}`));
      if (captura.falharDados) await page.route('**/data/*.json', (r) => r.fulfill({ status: 500, body: 'erro' }));
      await page.goto(BASE + captura.url, { waitUntil: 'networkidle' });
      if (captura.preparar) {
        await captura.preparar(page);
        await page.waitForLoadState('networkidle');
      }
      await page.waitForTimeout(900);
      if (captura.depois) await captura.depois(page);

      const largura = await page.evaluate(() => document.documentElement.scrollWidth);
      if (largura > tamanho.width) problemas.push(`${captura.nome} ${tamanho.width}: rolagem horizontal (${largura}px)`);

      const arquivo = fileURLToPath(new URL(`${captura.nome}-${tamanho.width}x${tamanho.height}.png`, PASTA));
      await page.screenshot({ path: arquivo, fullPage: captura.inteira, animations: 'allow' });
      console.log('ok', arquivo);
      await contexto.close();
    }
  }
} finally {
  await navegador.close();
  servidor.kill();
}

if (problemas.length) {
  console.log('\nProblemas encontrados:');
  for (const p of problemas) console.log(' -', p);
  process.exitCode = 1;
}
