// Atualização automática: versão nova assume na hora e a tela recarrega sozinha uma vez,
// quando estiver parada. O telão espera a celebração e as animações de descarte.
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** O aviso que o service worker manda às abas numa atualização. */
async function avisarVersaoNova(page) {
  await page.evaluate(() =>
    navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { tipo: 'versao-nova', versao: 'teste' } })),
  );
}

async function marcarPagina(page) {
  await page.evaluate(() => {
    window.__antesDaRecarga = true;
  });
}

const recarregou = (page) => page.evaluate(() => !window.__antesDaRecarga).catch(() => false);

test('com a tela parada, a versão nova recarrega o app sozinha', async ({ page }) => {
  await page.goto('app/?andar=7');
  await page.goto('app/#inicio');
  await page.waitForTimeout(1200); // fim das animações de entrada
  await marcarPagina(page);
  await avisarVersaoNova(page);
  await expect.poll(() => recarregou(page), { timeout: 5000 }).toBe(true);
  await expect(page.locator('#destaque-titulo')).toHaveText(/7º\s*andar/);
});

test('com uma folha aberta, espera fechar para recarregar', async ({ page }) => {
  await page.goto('app/?andar=7');
  await page.goto('app/#inicio');
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Pontuar' }).click();
  await expect(page.locator('#folha-pontuar')).toBeVisible();
  await page.waitForTimeout(600);
  await marcarPagina(page);
  await avisarVersaoNova(page);
  await page.waitForTimeout(1500);
  expect(await recarregou(page)).toBe(false);
  await page.getByRole('button', { name: 'Concluir' }).click();
  await expect.poll(() => recarregou(page), { timeout: 5000 }).toBe(true);
});

test('o telão não recarrega no meio da celebração de novo líder', async ({ page }) => {
  await page.goto('telao/');
  await expect(page.locator('.t-linha').first()).toBeVisible();
  await page.waitForTimeout(800);
  // três descartes no 8º andar: ele passa o 4º e entra a celebração (4 s)
  await page.evaluate(async () => {
    const dados = await import(new URL('../js/dados.js', location.href).href);
    for (let i = 0; i < 3; i += 1) await dados.registrarDescarte(8, 'reciclavel', 'demo');
  });
  await expect(page.locator('#palco')).toHaveClass(/celebrando/, { timeout: 3000 });
  await marcarPagina(page);
  await avisarVersaoNova(page);
  await page.waitForTimeout(2000);
  expect(await recarregou(page)).toBe(false);
  // depois da celebração e de 2,5 s sem descartes, recarrega
  await expect.poll(() => recarregou(page), { timeout: 12_000 }).toBe(true);
  await expect(page.locator('.t-linha').first()).toBeVisible();
});

test.describe('com o service worker de verdade', () => {
  test.use({ serviceWorkers: 'allow' });

  // Uma cópia do site num servidor à parte: o teste "publica" uma versão nova
  // trocando o sw.js da cópia, sem mexer no site que os outros testes usam.
  const PORTA = 4360 + (process.pid % 30);
  let pasta;
  let servidor;

  test.beforeAll(async () => {
    pasta = mkdtempSync(join(tmpdir(), 'recicla-atualizacao-'));
    const raiz = fileURLToPath(new URL('..', import.meta.url));
    const fora = ['node_modules', '.git', 'capturas', 'test-results', 'playwright-report', '.claude', 'video'];
    cpSync(raiz, pasta, { recursive: true, filter: (origem) => !fora.includes(basename(origem)) });
    servidor = spawn(process.execPath, [join(pasta, 'tools', 'servidor.mjs'), '--porta', String(PORTA)], { stdio: ['ignore', 'pipe', 'ignore'] });
    await new Promise((resolver) => servidor.stdout.once('data', resolver));
  });

  test.afterAll(() => {
    servidor?.kill();
    try {
      rmSync(pasta, { recursive: true, force: true });
    } catch {
      /* o Windows às vezes segura um arquivo; a pasta temporária fica para trás */
    }
  });

  test('uma versão nova publicada assume sozinha e a página recarrega uma vez', async ({ page }) => {
    const base = `http://localhost:${PORTA}/`;
    await page.goto(`${base}app/?andar=7`);
    await expect
      .poll(async () => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state), { timeout: 20_000 })
      .toBe('activated');
    await page.goto(`${base}app/#inicio`);
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 10_000 }).toBe(true);
    await page.waitForTimeout(1200);

    // "Publica" uma versão nova: o mesmo sw.js com outro nome de cache.
    const arquivo = join(pasta, 'sw.js');
    writeFileSync(arquivo, readFileSync(arquivo, 'utf8').replace(/const VERSAO = 'recicla-v\d+';/, "const VERSAO = 'recicla-teste-nova';"));

    await marcarPagina(page);
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await expect.poll(() => recarregou(page), { timeout: 20_000 }).toBe(true);
    await expect(page.locator('#destaque-titulo')).toHaveText(/7º\s*andar/);
    expect(await page.evaluate(() => caches.keys())).toEqual(['recicla-teste-nova']);
    // só uma recarga: a página nova não recarrega de novo
    await marcarPagina(page);
    await page.waitForTimeout(3000);
    expect(await recarregou(page)).toBe(false);
  });
});
