// Safari do iPhone (iOS 26): cabeçalho a 10 px do topo no navegador, área segura só no app
// instalado (e uma vez só), degradê atrás do cabeçalho, cabeçalho que some ao rolar,
// barra de baixo e avisos acima da barrinha do iPhone e fundos que passam do fim da tela.
// O Chrome simula a área segura do iPhone (59 px em cima, 34 px embaixo) pelo DevTools.
import { test, expect } from '@playwright/test';

const AREA = { top: 59, bottom: 34, left: 0, right: 0 };
const IPHONE = { width: 393, height: 852 };

/** Um iPhone: área segura simulada e, se pedido, aberto pela tela de início. */
async function iphone(browser, { instalado = false } = {}) {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: IPHONE,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  });
  if (instalado) await context.addInitScript(() => Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: AREA });
  return { context, page };
}

const caixa = (page, seletor) =>
  page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
  }, seletor);

const pseudo = (page, seletor, qual = '::before') =>
  page.evaluate(
    ([s, q]) => {
      const estilo = getComputedStyle(document.querySelector(s), q);
      return { top: parseFloat(estilo.top), bottom: parseFloat(estilo.bottom), height: parseFloat(estilo.height), fundo: estilo.backgroundImage };
    },
    [seletor, qual],
  );

test.describe('iPhone: topo', () => {
  test('no navegador, o cabeçalho do site e o topo do app ficam a 10 px do alto, sem somar a área segura', async ({ browser }) => {
    const { context, page } = await iphone(browser);
    await page.goto('./');
    await expect(page.locator('html')).not.toHaveClass(/instalado/);
    expect((await caixa(page, '.cabecalho__pilula')).top).toBe(10);
    // a faixa do relógio só existe no app instalado
    expect((await pseudo(page, 'body')).height).toBe(0);
    await page.goto('app/?andar=7');
    await expect(page.locator('#aba-inicio')).toBeVisible();
    expect((await caixa(page, '.a-topo')).top).toBe(10);
    await context.close();
  });

  test('no app instalado, a área segura entra uma vez só e o link "Pular" fica fora da tela', async ({ browser }) => {
    const { context, page } = await iphone(browser, { instalado: true });
    await page.goto('./');
    await expect(page.locator('html')).toHaveClass(/instalado/);
    expect((await caixa(page, '.cabecalho__pilula')).top).toBe(10 + AREA.top);
    expect((await caixa(page, '.pular-para-conteudo')).bottom).toBeLessThanOrEqual(0);
    // faixa escura atrás do relógio e da bateria
    expect((await pseudo(page, 'body')).height).toBeGreaterThanOrEqual(AREA.top);
    await page.goto('app/?andar=7');
    await expect(page.locator('#aba-inicio')).toBeVisible();
    expect((await caixa(page, '.a-topo')).top).toBe(10 + AREA.top);
    expect((await caixa(page, '.pular-para-conteudo')).bottom).toBeLessThanOrEqual(0);
    await context.close();
  });

  test('um degradê escuro vai do alto da tela até abaixo do cabeçalho', async ({ browser }) => {
    const { context, page } = await iphone(browser);
    await page.goto('./');
    const site = await pseudo(page, '.cabecalho');
    expect(site.fundo).toContain('linear-gradient');
    expect(site.top).toBeLessThanOrEqual(-10); // começa acima da tela
    expect(site.bottom).toBeLessThanOrEqual(-40); // termina abaixo da cápsula
    await page.goto('app/?andar=7');
    await expect(page.locator('#aba-inicio')).toBeVisible();
    const app = await pseudo(page, '.a-topo');
    expect(app.fundo).toContain('linear-gradient');
    expect(app.top).toBeLessThanOrEqual(-10);
    expect(app.bottom).toBeLessThanOrEqual(-40);
    await context.close();
  });

  test('o cabeçalho some ao rolar para baixo e volta ao rolar para cima', async ({ browser }) => {
    const { context, page } = await iphone(browser);
    await page.goto('./');
    const cabecalho = page.locator('.cabecalho');
    await page.mouse.move(200, 400);
    await page.mouse.wheel(0, 900);
    await expect(cabecalho).toHaveClass(/escondido/);
    await expect.poll(async () => (await caixa(page, '.cabecalho__pilula')).bottom).toBeLessThan(-40);
    await page.mouse.wheel(0, -120);
    await expect(cabecalho).not.toHaveClass(/escondido/);
    await expect.poll(async () => (await caixa(page, '.cabecalho__pilula')).top).toBe(10);
    // no topo da página ele sempre aparece
    await page.mouse.wheel(0, 600);
    await expect(cabecalho).toHaveClass(/escondido/);
    await page.evaluate(() => scrollTo(0, 0));
    await expect(cabecalho).not.toHaveClass(/escondido/);

    // no app instalado, o topo também some e volta
    const instalado = await iphone(browser, { instalado: true });
    await instalado.page.goto('app/?andar=7');
    await expect(instalado.page.locator('#aba-inicio')).toBeVisible();
    await instalado.page.mouse.move(200, 400);
    await instalado.page.mouse.wheel(0, 400);
    await expect(instalado.page.locator('.a-topo')).toHaveClass(/escondido/);
    await instalado.page.mouse.wheel(0, -100);
    await expect(instalado.page.locator('.a-topo')).not.toHaveClass(/escondido/);
    await instalado.context.close();
    await context.close();
  });

  test('com o teclado, o cabeçalho escondido volta ao receber foco', async ({ browser }) => {
    const { context, page } = await iphone(browser);
    await page.goto('./');
    await page.evaluate(() => scrollTo({ top: 1500, behavior: 'instant' }));
    await expect(page.locator('.cabecalho')).toHaveClass(/escondido/);
    await page.getByRole('button', { name: 'Menu' }).focus();
    await expect(page.locator('.cabecalho')).not.toHaveClass(/escondido/);
    await context.close();
  });
});

test.describe('iPhone: embaixo e fundos', () => {
  test('a barra de baixo, os avisos e o rodapé ficam acima da barrinha do iPhone', async ({ browser }) => {
    const { context, page } = await iphone(browser, { instalado: true });
    await page.goto('app/?andar=7');
    await expect(page.locator('#aba-inicio')).toBeVisible();
    const barra = await caixa(page, '.a-barra');
    expect(barra.bottom).toBe(IPHONE.height - AREA.bottom - 20);
    // o fim do conteúdo passa por cima da barra: dá para ler a última linha
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const ultimo = await page.evaluate(() => {
      const filhos = [...document.querySelectorAll('#aba-inicio > *')].filter((e) => e.getBoundingClientRect().height > 0);
      return Math.round(filhos.at(-1).getBoundingClientRect().bottom);
    });
    expect(ultimo).toBeLessThanOrEqual(barra.top);
    // aviso: acima da barra
    await page.evaluate(async () => {
      const comum = await import(new URL('../js/comum.js', location.href).href);
      comum.avisar('Teste do aviso');
    });
    const aviso = page.locator('.aviso').filter({ hasText: 'Teste do aviso' });
    await expect(aviso).toBeVisible();
    const caixaAviso = await aviso.boundingBox();
    expect(caixaAviso.y + caixaAviso.height).toBeLessThanOrEqual(barra.top);

    // site: o rodapé termina acima da barrinha
    await page.goto('./');
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const folga = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.rodape')).paddingBottom));
    expect(folga).toBeGreaterThanOrEqual(40 + AREA.bottom);
    await context.close();
  });

  test('as camadas de fundo fixas passam do fim da tela (sem faixa reta atrás da barra do Safari)', async ({ browser }) => {
    const { context, page } = await iphone(browser);
    for (const caminho of ['./', 'app/?andar=7', 'demo/']) {
      await page.goto(caminho);
      const luzes = await caixa(page, '.luzes');
      expect(luzes.top).toBe(0);
      expect(luzes.bottom, caminho).toBeGreaterThan(IPHONE.height * 1.3);
    }
    // fundo da entrada do palco e o fundo escurecido das folhas
    await page.goto('app/?andar=7');
    await page.evaluate(() => (document.querySelector('.a-entrada').hidden = false));
    expect((await pseudo(page, '.a-entrada')).height).toBeGreaterThan(IPHONE.height * 1.3);
    await page.evaluate(() => (document.querySelector('.a-entrada').hidden = true));
    await page.goto('./');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    expect((await pseudo(page, '#menu-folha', '::backdrop')).height).toBeGreaterThan(IPHONE.height * 1.3);
    // a foto da abertura some num degradê nas bordas, sem linha reta
    await page.keyboard.press('Escape');
    const mascara = await page.evaluate(() => {
      const estilo = getComputedStyle(document.querySelector('.heroi__lixeira .lixeira__cena'));
      return estilo.maskImage || estilo.webkitMaskImage;
    });
    expect(mascara).toContain('linear-gradient');
    await context.close();
  });
});
