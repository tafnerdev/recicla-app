#!/usr/bin/env node
/**
 * Captura as telas de referência aprovadas (pasta referencia/, fora do git) nos
 * tamanhos combinados e salva em capturas/referencia/.
 *   node tools/capturas-referencia.mjs
 */
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const SAIDA = new URL('../capturas/referencia/', import.meta.url);
const REFERENCIAS = [
  ['app-inicio', 390, 844],
  ['app-ranking', 390, 844],
  ['app-pontuar', 390, 844],
  ['telao', 1920, 1080],
  ['site-abertura', 1440, 900],
];

await mkdir(SAIDA, { recursive: true });
const navegador = await chromium.launch({ channel: 'chrome' });
try {
  for (const [nome, largura, altura] of REFERENCIAS) {
    const arquivo = `${RAIZ}referencia/${nome}.html`;
    if (!existsSync(arquivo)) {
      console.log('não encontrado:', arquivo);
      continue;
    }
    const page = await navegador.newPage({ viewport: { width: largura, height: altura } });
    await page.goto(pathToFileURL(arquivo).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const destino = fileURLToPath(new URL(`${nome}-${largura}x${altura}.png`, SAIDA));
    await page.screenshot({ path: destino });
    console.log('ok', destino);
    await page.close();
  }
} finally {
  await navegador.close();
}
