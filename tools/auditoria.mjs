#!/usr/bin/env node
/**
 * Auditoria de acessibilidade feita no Chrome instalado (sem dependências novas).
 *   node tools/auditoria.mjs
 * Confere em cada tela: ordem do Tab e foco visível, nomes de botões e links,
 * ordem dos títulos, alvos de toque pequenos no celular e contraste do texto (AA).
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PORTA = 4319;
const BASE = `http://localhost:${PORTA}/recicla-app/`;
const TELAS = [
  ['site', ''],
  ['app', 'app/?andar=7'],
  ['app-sem-andar', 'app/'],
  ['telao', 'telao/?sensor=1'],
  ['demo', 'demo/'],
  ['404', 'nao-existe/'],
];

const servidor = spawn(process.execPath, ['tools/servidor.mjs', '--porta', String(PORTA), '--base', '/recicla-app/'], {
  cwd: RAIZ,
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((r) => servidor.stdout.once('data', r));
const navegador = await chromium.launch({ channel: 'chrome' });
let total = 0;

function relatar(tela, lista, titulo) {
  if (!lista.length) return;
  console.log(`\n[${tela}] ${titulo}`);
  for (const item of lista.slice(0, 25)) console.log('  -', item);
  if (lista.length > 25) console.log(`  … e mais ${lista.length - 25}`);
  total += lista.length;
}

try {
  for (const [tela, caminho] of TELAS) {
    for (const largura of [1440, 390]) {
      const contexto = await navegador.newContext({
        viewport: { width: largura, height: largura > 800 ? 900 : 844 },
        serviceWorkers: 'block',
        reducedMotion: 'reduce',
      });
      const page = await contexto.newPage();
      await page.goto(BASE + caminho, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      // 1. Estrutura e nomes (só na largura de computador, para não repetir)
      if (largura === 1440) {
        const estrutura = await page.evaluate(() => {
          const problemas = [];
          const nome = (el) =>
            (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') && [...el.getAttribute('aria-labelledby').split(' ')].map((id) => document.getElementById(id)?.textContent).join(' ') || el.textContent || el.getAttribute('title') || '').trim();
          for (const el of document.querySelectorAll('button, a[href], [role="button"], [role="switch"]')) {
            if (el.closest('[hidden]') || el.getClientRects().length === 0) continue;
            if (!nome(el)) problemas.push(`sem nome: <${el.tagName.toLowerCase()} class="${el.className}">`);
          }
          for (const el of document.querySelectorAll('input, select, textarea')) {
            if (el.type === 'hidden') continue;
            const temRotulo = el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
            if (!temRotulo) problemas.push(`campo sem rótulo: #${el.id || el.name}`);
          }
          const niveis = [...document.querySelectorAll('h1, h2, h3, h4')].filter((h) => !h.closest('[hidden]')).map((h) => Number(h.tagName[1]));
          if (niveis.filter((n) => n === 1).length !== 1) problemas.push(`h1: ${niveis.filter((n) => n === 1).length} na página`);
          niveis.forEach((n, i) => {
            if (i && n > niveis[i - 1] + 1) problemas.push(`título pula de h${niveis[i - 1]} para h${n}`);
          });
          if (!document.documentElement.lang) problemas.push('html sem lang');
          return problemas;
        });
        relatar(`${tela} ${largura}`, estrutura, 'estrutura e nomes');

        // 2. Tab: todo foco precisa ser visível
        const foco = [];
        for (let i = 0; i < 70; i += 1) {
          await page.keyboard.press('Tab');
          const info = await page.evaluate(() => {
            const el = document.activeElement;
            if (!el || el === document.body) return null;
            const estilo = getComputedStyle(el);
            const caixa = el.getBoundingClientRect();
            const contorno = estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth) > 0;
            const sombra = estilo.boxShadow !== 'none';
            // input invisível dentro de um rótulo estilizado (chip): o foco aparece no irmão
            const irmao = el.nextElementSibling ? getComputedStyle(el.nextElementSibling) : null;
            const irmaoVisivel = irmao && irmao.outlineStyle !== 'none' && parseFloat(irmao.outlineWidth) > 0;
            return {
              alvo: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${String(el.className).split(' ')[0]} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}"`,
              visivel: contorno || sombra || irmaoVisivel,
              naTela: caixa.width > 0 && caixa.height > 0,
            };
          });
          if (!info) continue;
          if (!info.visivel) foco.push(`foco invisível: ${info.alvo}`);
          if (!info.naTela) foco.push(`foco em elemento sem tamanho: ${info.alvo}`);
        }
        relatar(`${tela} ${largura}`, [...new Set(foco)], 'foco pelo teclado');
      }

      // 3. Alvos de toque no celular. O telão é um palco de 1920x1080 encolhido para caber
      // na tela: lá os alvos são medidos no tamanho do palco (no projetor, 56 px).
      if (largura === 390) {
        const escala = await page.evaluate(() => Number(getComputedStyle(document.getElementById('palco') ?? document.body).getPropertyValue('--escala')) || 1);
        const pequenos = await page.evaluate((escala) =>
          [...document.querySelectorAll('button, a[href], input, summary, [role="switch"]')]
            .filter((el) => !el.closest('[hidden]') && el.getClientRects().length)
            .map((el) => {
              const alvo = el.matches('input[type="radio"]') ? el.parentElement : el;
              const r = alvo.getBoundingClientRect();
              const c = { width: r.width / escala, height: r.height / escala };
              return { el, c, texto: (el.getAttribute('aria-label') || el.textContent || el.id).trim().slice(0, 30) };
            })
            .filter(({ el, c }) => (c.height < 44 || c.width < 44) && !(el.tagName === 'A' && getComputedStyle(el).display === 'inline'))
            .map(({ el, c, texto }) => `${el.tagName.toLowerCase()} "${texto}" ${Math.round(c.width)}x${Math.round(c.height)}`),
          escala,
        );
        relatar(`${tela} ${largura}`, pequenos, 'alvo de toque menor que 44 px');
      }

      // 4. Contraste do texto contra o fundo sólido mais próximo
      const contraste = await page.evaluate(() => {
        const rgb = (s) => {
          const m = s.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
          return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
        };
        const lum = ({ r, g, b }) => {
          const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const misturar = (cima, baixo) => ({
          r: cima.r * cima.a + baixo.r * (1 - cima.a),
          g: cima.g * cima.a + baixo.g * (1 - cima.a),
          b: cima.b * cima.a + baixo.b * (1 - cima.a),
          a: 1,
        });
        const fundoDe = (el) => {
          const camadas = [];
          for (let n = el; n; n = n.parentElement) {
            const c = rgb(getComputedStyle(n).backgroundColor);
            if (c && c.a > 0) {
              camadas.push(c);
              if (c.a >= 1) break;
            }
          }
          let base = { r: 7, g: 27, b: 22, a: 1 }; // --fundo
          for (const c of camadas.reverse()) base = misturar(c, base);
          return base;
        };
        const problemas = [];
        const andou = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const vistos = new Set();
        while (andou.nextNode()) {
          const no = andou.currentNode;
          if (!no.textContent.trim()) continue;
          const el = no.parentElement;
          if (!el || vistos.has(el) || el.closest('[hidden], svg, [aria-hidden="true"], .visualmente-oculto')) continue;
          vistos.add(el);
          const estilo = getComputedStyle(el);
          if (estilo.visibility === 'hidden' || Number(estilo.opacity) === 0 || el.getClientRects().length === 0) continue;
          const cor = rgb(estilo.color);
          if (!cor) continue;
          const fundo = fundoDe(el);
          const texto = misturar(cor, fundo);
          const [a, b] = [lum(texto), lum(fundo)].sort((x, y) => y - x);
          const razao = (a + 0.05) / (b + 0.05);
          const tamanho = parseFloat(estilo.fontSize);
          const grande = tamanho >= 24 || (tamanho >= 18.66 && Number(estilo.fontWeight) >= 700);
          if (razao < (grande ? 3 : 4.5)) {
            problemas.push(`${razao.toFixed(2)}:1 "${no.textContent.trim().slice(0, 40)}" (${Math.round(tamanho)}px, ${estilo.color})`);
          }
        }
        return problemas;
      });
      relatar(`${tela} ${largura}`, contraste, 'contraste abaixo de AA');
      await contexto.close();
    }
  }
} finally {
  await navegador.close();
  servidor.kill();
}
console.log(total ? `\n${total} apontamentos.` : '\nNenhum apontamento.');
