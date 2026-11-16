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

const URL_DADOS = `${BASE}js/dados.js`;

async function zerar(page) {
  await page.evaluate(async (url) => {
    const dados = await import(url);
    await dados.zerarPlacar();
  }, URL_DADOS);
  await page.reload();
}

async function descartes(page, lista) {
  await page.evaluate(async ([url, itens]) => {
    const dados = await import(url);
    for (const [andar, tipo] of itens) await dados.registrarDescarte(andar, tipo, 'demo');
  }, [URL_DADOS, lista]);
}

/** Rola a página até o fim (revela o que aparece na rolagem) e volta ao topo. */
async function rolarAteOFim(page) {
  await page.evaluate(async () => {
    const passo = innerHeight * 0.6;
    for (let y = 0; y < document.documentElement.scrollHeight; y += passo) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    await new Promise((r) => setTimeout(r, 700)); // deixa as revelações do fim da página dispararem
    scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
}

const CAPTURAS = [
  { nome: 'site', url: '', tamanhos: [CELULAR, TABLET, COMPUTADOR], inteira: true, depois: rolarAteOFim },
  { nome: 'site-topo', url: '', tamanhos: [CELULAR, TABLET, COMPUTADOR], inteira: false, depois: async (page) => page.waitForTimeout(2600) },
  {
    nome: 'secoes',
    url: '',
    tamanhos: [COMPUTADOR, TABLET, CELULAR],
    secoes: ['.oque', '#como-funciona', '#ranking', '#para-quem', '#perguntas', '#contato', '.rodape'],
    depois: rolarAteOFim,
  },
  { nome: 'site-parado', url: '', tamanhos: [COMPUTADOR, CELULAR], inteira: false, movimento: 'reduce' },
  {
    nome: 'site-foco',
    url: '',
    tamanhos: [COMPUTADOR],
    inteira: false,
    depois: async (page) => {
      for (let i = 0; i < 9; i += 1) await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
    },
  },
  {
    nome: 'app-foco',
    url: 'app/?andar=7',
    tamanhos: [CELULAR],
    inteira: false,
    depois: async (page) => {
      for (let i = 0; i < 4; i += 1) await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
    },
  },
  {
    nome: 'estado-menu',
    url: '',
    tamanhos: [CELULAR],
    inteira: false,
    depois: async (page) => {
      await page.getByRole('button', { name: 'Menu' }).click();
      await page.waitForTimeout(400);
    },
  },
  {
    nome: 'estado-dialogo',
    url: 'demo/',
    tamanhos: [CELULAR, COMPUTADOR],
    inteira: false,
    depois: async (page) => {
      await page.getByRole('button', { name: 'Zerar placar' }).click();
      await page.waitForTimeout(400);
    },
  },
  {
    nome: 'estado-pessoal',
    url: 'app/?andar=7',
    tamanhos: [CELULAR],
    inteira: false,
    depois: async (page) => {
      // com ?andar=7, a folha Pontuar abre pelo aviso "Pontuar agora"
      await page.locator('#aviso-etiqueta').click();
      await page.locator('#folha-pontuar').waitFor({ state: 'visible' });
      await page.locator('.pontuar__botoes .botao-tipo').first().click();
      await page.waitForTimeout(700);
    },
  },
  {
    nome: 'estado-nome',
    url: 'app/?andar=7',
    tamanhos: [CELULAR],
    inteira: false,
    depois: async (page) => {
      await page.locator('#aviso-etiqueta').click();
      await page.locator('#folha-pontuar').waitFor({ state: 'visible' });
      await page.locator('summary', { hasText: 'Seu nome e seus dados' }).click();
      await page.locator('#form-nome').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    },
  },
  // Abas e folha do app, no tamanho das referências (o ?andar=7 grava o andar e depois a aba abre sem ele)
  { nome: 'app-inicio', url: 'app/?andar=7', tamanhos: [CELULAR], inteira: false, preparar: (page) => page.goto(`${BASE}app/#inicio`) },
  { nome: 'app-ranking-vazio', url: 'app/?andar=7', tamanhos: [CELULAR], inteira: false, preparar: async (page) => { await zerar(page); await page.goto(`${BASE}app/#ranking`); } },
  { nome: 'app-ranking', url: 'app/?andar=7', tamanhos: [CELULAR], inteira: false, preparar: (page) => page.goto(`${BASE}app/#ranking`) },
  { nome: 'app-pontuar', url: 'app/?andar=7', tamanhos: [CELULAR], inteira: false, preparar: (page) => page.goto(`${BASE}app/#pontuar`) },
  { nome: 'app', url: 'app/?andar=7', tamanhos: [CELULAR, TABLET, COMPUTADOR], inteira: true },
  { nome: 'app-sem-andar', url: 'app/', tamanhos: [CELULAR, COMPUTADOR], inteira: true },
  { nome: 'app-andar-invalido', url: 'app/?andar=42', tamanhos: [CELULAR], inteira: true },
  { nome: 'app-vazio', url: 'app/?andar=3', tamanhos: [CELULAR], inteira: true, preparar: zerar },
  { nome: 'app-erro', url: 'app/?andar=7', tamanhos: [CELULAR], inteira: true, falharDados: true },
  { nome: 'telao', url: 'telao/', tamanhos: [PROJETOR, COMPUTADOR, TABLET, CELULAR], inteira: false },
  { nome: 'telao-sensor', url: 'telao/?sensor=1', tamanhos: [PROJETOR], inteira: false },
  { nome: 'telao-tv-em-pe', url: 'telao/', tamanhos: [{ width: 1080, height: 1920 }], inteira: false },
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
        reducedMotion: captura.movimento ?? 'no-preference',
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
      if (captura.secoes) {
        for (const seletor of captura.secoes) {
          const alvo = page.locator(seletor).first();
          await alvo.scrollIntoViewIfNeeded();
          await page.waitForTimeout(700);
          const nomeSecao = seletor.replace(/[^a-z0-9-]/gi, '');
          const arquivoSecao = fileURLToPath(new URL(`${captura.nome}-${nomeSecao}-${tamanho.width}.png`, PASTA));
          await alvo.screenshot({ path: arquivoSecao, animations: 'allow' });
          console.log('ok', arquivoSecao);
        }
        await contexto.close();
        continue;
      }

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
