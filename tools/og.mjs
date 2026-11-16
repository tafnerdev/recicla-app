#!/usr/bin/env node
/**
 * Gera icons/og-imagem.png (1200x630), a imagem que aparece quando alguém
 * compartilha o link do site (WhatsApp, LinkedIn etc.). Usa a própria abertura
 * do site, parada, sem cabeçalho e sem botões.
 *   node tools/og.mjs
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PORTA = 4321;
const servidor = spawn(process.execPath, ['tools/servidor.mjs', '--porta', String(PORTA)], {
  cwd: RAIZ,
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((r) => servidor.stdout.once('data', r));
const navegador = await chromium.launch({ channel: 'chrome' });
try {
  const contexto = await navegador.newContext({
    viewport: { width: 1200, height: 630 },
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const page = await contexto.newPage();
  await page.goto(`http://localhost:${PORTA}/?svg=1`, { waitUntil: 'networkidle' });
  await page.addStyleTag({
    content: `
      .cabecalho, .heroi__acoes, .heroi__evento, .avisos, .selo { display: none !important; }
      .heroi { width: 1080px !important; min-height: 630px; margin: 0 auto !important; gap: 24px !important; flex-wrap: nowrap !important; }
      .heroi__texto { flex: 1 1 560px !important; }
      .heroi__figura { flex: 0 0 440px !important; }
      .heroi__titulo { margin-top: 28px !important; font-size: 64px !important; }
      .heroi__sub { font-size: 21px !important; line-height: 32px !important; }
      .heroi__texto::before {
        content: 'Recicla Slide'; display: flex; align-items: center;
        font: 800 26px/1 Rubik, sans-serif; letter-spacing: -0.01em; color: #F5F2EA;
        padding-left: 24px; background: radial-gradient(circle at 7px 50%, #8BD17C 6px, rgba(139,209,124,0.35) 8px, transparent 12px) no-repeat;
      }
    `,
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: fileURLToPath(new URL('../icons/og-imagem.png', import.meta.url)) });
  console.log('ok icons/og-imagem.png');
} finally {
  await navegador.close();
  servidor.kill();
}
