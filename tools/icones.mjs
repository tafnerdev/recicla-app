#!/usr/bin/env node
/**
 * Gera os ícones PNG da PWA a partir do desenho em SVG, usando o Chrome instalado.
 *   node tools/icones.mjs
 * Quando o logo definitivo existir, troque o SVG abaixo e rode de novo.
 */
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const PASTA = new URL('../icons/', import.meta.url);

// Fundo arredondado (ícone comum) ou fundo inteiro (maskable e iPhone, que recortam sozinhos).
function desenho({ arredondado, escalaPonto = 1 }) {
  // Fundo #050807 e o ponto verde com brilho (o logo: ponto + Rubik só no nome).
  const r = 96 * escalaPonto;
  const brilho = 210 * escalaPonto;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="b" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#8BD17C" stop-opacity="0.55"/>
      <stop offset="0.45" stop-color="#8BD17C" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#8BD17C" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${arredondado ? '<rect width="512" height="512" rx="112" fill="#050807"/>' : '<rect width="512" height="512" fill="#050807"/>'}
  <circle cx="256" cy="256" r="${brilho}" fill="url(#b)"/>
  <circle cx="256" cy="256" r="${r}" fill="#8BD17C"/>
</svg>`;
}

const ICONES = [
  { arquivo: 'icon-192.png', tamanho: 192, svg: desenho({ arredondado: true }) },
  { arquivo: 'icon-512.png', tamanho: 512, svg: desenho({ arredondado: true }) },
  // maskable: o conteúdo importante precisa caber no círculo central de 80%
  { arquivo: 'maskable-512.png', tamanho: 512, svg: desenho({ arredondado: false, escalaPonto: 0.85 }) },
  { arquivo: 'apple-touch-icon.png', tamanho: 180, svg: desenho({ arredondado: false }) },
  { arquivo: 'favicon-32.png', tamanho: 32, svg: desenho({ arredondado: true, escalaPonto: 1.25 }) },
];

const navegador = await chromium.launch({ channel: 'chrome' });
try {
  for (const icone of ICONES) {
    const page = await navegador.newPage({ viewport: { width: icone.tamanho, height: icone.tamanho } });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${icone.svg.replace('<svg ', `<svg width="${icone.tamanho}" height="${icone.tamanho}" `)}</body></html>`,
    );
    const png = await page.screenshot({ omitBackground: true, type: 'png' });
    await writeFile(fileURLToPath(new URL(icone.arquivo, PASTA)), png);
    console.log('ok', icone.arquivo);
    await page.close();
  }
  await writeFile(fileURLToPath(new URL('icon.svg', PASTA)), `${desenho({ arredondado: true })}\n`);
  console.log('ok icon.svg');
} finally {
  await navegador.close();
}
