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
  await page.goto(`http://localhost:${PORTA}/`, { waitUntil: 'networkidle' });
  await page.addStyleTag({
    content: `
      .cabecalho, .heroi__acoes, .heroi__evento, .avisos { display: none !important; }
      .heroi { min-height: 630px !important; padding: 0 !important; display: grid; align-items: center; }
      .heroi__grade { width: 1080px !important; grid-template-columns: 1.15fr 0.85fr !important; }
      .heroi__titulo { font-size: 58px !important; }
      .heroi__sub { font-size: 22px !important; }
      .heroi__texto::before {
        content: 'Recicla Slide'; display: flex; align-items: center; gap: 12px;
        font: 800 28px/1 Rubik, sans-serif; letter-spacing: -0.02em; color: #F5F2EA;
        padding-left: 30px; background: radial-gradient(circle at 9px 50%, #8BD17C 8.5px, transparent 9.5px) no-repeat;
      }
      .selo { display: none !important; }
    `,
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: fileURLToPath(new URL('../icons/og-imagem.png', import.meta.url)) });
  console.log('ok icons/og-imagem.png');
} finally {
  await navegador.close();
  servidor.kill();
}
