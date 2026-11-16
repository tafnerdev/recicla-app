// Etapa 1 do prompt-app.md: a lixeira no centro (abertura, anel de LED, app), vídeo de
// lançamento fora do cache e o prédio de exemplo igual ao da apresentação.
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const VIDEO = readFileSync(new URL('../assets/video/recicla-lancamento.mp4', import.meta.url));

/** Registra um descarte pelo módulo de dados, como o painel ou o sensor fariam. */
async function descarte(page, andar, tipo) {
  await page.evaluate(
    async ([a, t]) => {
      const raiz = location.pathname.match(/\/(app|telao|demo)\//) ? '../' : '';
      const dados = await import(new URL(`${raiz}js/dados.js`, location.href).href);
      await dados.registrarDescarte(a, t, 'demo');
    },
    [andar, tipo],
  );
}

test.describe('abertura do site', () => {
  for (const [largura, altura] of [
    [1440, 900],
    [390, 844],
  ]) {
    test(`a lixeira ocupa a dobra em ${largura} px, com título, uma linha e dois botões`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto('./');
      const heroi = page.locator('.heroi');
      const foto = heroi.locator('.lixeira__foto');
      await expect(foto).toBeVisible();
      await expect(foto).toHaveJSProperty('complete', true);
      expect(await foto.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
      // a abertura tem a altura da tela e a lixeira está dentro dela
      const caixa = await heroi.boundingBox();
      expect(Math.round(caixa.height)).toBeGreaterThanOrEqual(altura - 1);
      // o prédio saiu da abertura
      await expect(heroi.locator('.predio')).toHaveCount(0);
      // pouco texto: o título, uma linha e dois botões
      await expect(heroi.getByRole('heading', { level: 1 })).toHaveText(/O lixo desce pelo tobogã\.\s*O andar sobe no ranking\./);
      await expect(heroi.locator('p')).toHaveCount(1);
      await expect(heroi.locator('.heroi__acoes').getByRole('link')).toHaveCount(2);
      // o anel de LED está desenhado por cima da foto
      await expect(heroi.locator('.lixeira__led .lixeira__respira path')).toHaveCount(2);
    });
  }

  test('sem o arquivo do giro, fica a foto; com ele, entra o vídeo mudo, em laço e com a foto de capa', async ({ page }) => {
    await page.goto('./');
    await page.waitForTimeout(800);
    await expect(page.locator('.heroi .lixeira__video')).toHaveCount(0);

    await page.route('**/assets/lixeira/giro.mp4', (rota) =>
      rota.fulfill({ status: 200, contentType: 'video/mp4', body: rota.request().method() === 'HEAD' ? '' : VIDEO }),
    );
    await page.reload();
    const video = page.locator('.heroi .lixeira__video');
    await expect(video).toHaveCount(1);
    await expect(video).toHaveJSProperty('muted', true);
    await expect(video).toHaveJSProperty('loop', true);
    await expect(video).toHaveAttribute('playsinline', '');
    await expect(video).toHaveAttribute('poster', /lixeira-parede-verde\.jpg$/);
  });

  test('o anel de LED pulsa verde na lixeira de recicláveis e laranja na de orgânicos', async ({ page }) => {
    await page.goto('app/?andar=7');
    await page.goto('app/#inicio');
    const verde = page.locator('#lixeira-foto-reciclavel .lixeira');
    const marrom = page.locator('#lixeira-foto-organico .lixeira');
    await expect(verde).toBeVisible();
    await expect(marrom).toHaveAttribute('data-tampa', 'marrom');
    await descarte(page, 7, 'reciclavel');
    await expect(verde).toHaveAttribute('data-pulso', 'reciclavel');
    expect(await verde.locator('.lixeira__pulso').evaluate((g) => g.getAnimations().length)).toBeGreaterThan(0);
    await expect(marrom).not.toHaveAttribute('data-pulso', /.+/);
    await descarte(page, 7, 'organico');
    await expect(marrom).toHaveAttribute('data-pulso', 'organico');
    const cor = await marrom.locator('.lixeira__pulso .lixeira__fio').evaluate((p) => getComputedStyle(p).stroke);
    expect(cor).toBe('rgb(242, 165, 65)');
  });

  test('a seção do vídeo de lançamento carrega o vídeo só quando a pessoa toca', async ({ page, request }) => {
    await page.goto('./');
    const video = page.locator('#video video');
    await expect(video).toHaveAttribute('preload', 'none');
    await expect(video).toHaveAttribute('poster', 'assets/video/recicla-lancamento-capa.jpg');
    await expect(video.locator('source')).toHaveAttribute('src', 'assets/video/recicla-lancamento.mp4');
    const resposta = await request.get('assets/video/recicla-lancamento.mp4', { headers: { Range: 'bytes=0-99' } });
    expect(resposta.status()).toBe(206);
    expect(resposta.headers()['content-type']).toBe('video/mp4');
  });
});

test.describe('app: as duas lixeiras do andar no Início', () => {
  test('mostra as duas lixeiras, a conexão (simulada) e o último descarte de cada uma', async ({ page, context }) => {
    await page.goto('app/?andar=7');
    await page.goto('app/#inicio');
    await expect(page.getByRole('heading', { name: 'Lixeiras do 7º andar' })).toBeVisible();
    await expect(page.locator('.a-lixeira__nome')).toHaveText(['Recicláveis', 'Orgânicos']);
    await expect(page.locator('#lixeira-estado')).toHaveText('Conectadas');
    await expect(page.locator('#lixeira-simulado')).toHaveText('Simulado');
    await expect(page.locator('#lixeira-ultimo-reciclavel')).toHaveText('Nenhum descarte recente');
    await expect(page.locator('#lixeira-ultimo-organico')).toHaveText('Nenhum descarte recente');

    await descarte(page, 7, 'organico');
    await expect(page.locator('#lixeira-ultimo-organico')).toHaveText('Último descarte agora');
    await expect(page.locator('#lixeira-ultimo-reciclavel')).toHaveText('Nenhum descarte recente');

    // descarte em outro andar não muda as lixeiras do 7º
    await descarte(page, 3, 'reciclavel');
    await expect(page.locator('#lixeira-ultimo-reciclavel')).toHaveText('Nenhum descarte recente');

    await context.setOffline(true);
    await expect(page.locator('#lixeira-estado')).toHaveText('Sem sinal');
    await context.setOffline(false);
    await expect(page.locator('#lixeira-estado')).toHaveText('Conectadas');
  });

  test('pontuar pela etiqueta também acende o anel da lixeira usada e marca "agora"', async ({ page }) => {
    await page.goto('app/?andar=7');
    await page.getByRole('link', { name: /Pontuar agora/ }).click();
    await page.locator('.pontuar__botoes').getByRole('button', { name: 'Orgânico' }).click();
    await expect(page.locator('#lixeira-foto-organico .lixeira')).toHaveAttribute('data-pulso', 'organico');
    await expect(page.locator('#lixeira-ultimo-organico')).toHaveText('Último descarte agora');
  });

  test('o prédio foi para a aba Ranking, menor', async ({ page }) => {
    await page.goto('app/?andar=7');
    await page.goto('app/#inicio');
    await expect(page.locator('#aba-inicio .predio')).toHaveCount(0);
    await page.goto('app/#ranking');
    const predio = page.locator('#aba-ranking #predio');
    await expect(predio).toBeVisible();
    const caixa = await predio.boundingBox();
    expect(caixa.width).toBeLessThanOrEqual(262);
  });
});

test.describe('prédio de exemplo igual ao da apresentação', () => {
  test('20 andares e 4 apartamentos por andar (80 no total)', async ({ page }) => {
    await page.goto('app/?andar=7');
    const edificio = await page.evaluate(async () => {
      const dados = await import(new URL('../js/dados.js', location.href).href);
      return dados.obterEdificio();
    });
    expect(edificio.andares).toHaveLength(20);
    expect(edificio.apartamentosPorAndar).toBe(4);
    expect(edificio.andares.length * edificio.apartamentosPorAndar).toBe(80);
    await expect(page.locator('#destaque-posicao')).toContainText('4º lugar entre 20 andares');
  });

  test('o telão continua com 10 linhas legíveis e o painel mostra os 20 andares', async ({ page }) => {
    await page.goto('telao/');
    await expect(page.locator('.t-linha')).toHaveCount(10);
    await page.goto('demo/');
    await expect(page.locator('.d-andar')).toHaveCount(20);
  });

  test('no painel, dois números seguidos escolhem os andares acima do 10º', async ({ page }) => {
    await page.goto('demo/');
    await expect(page.locator('.d-andar')).toHaveCount(20);
    await page.keyboard.press('1');
    await page.keyboard.press('5');
    await expect(page.locator('.d-andar[aria-current="true"]')).toHaveAttribute('data-andar', '15');
    await page.waitForTimeout(1000);
    await page.keyboard.press('2');
    await expect(page.locator('.d-andar[aria-current="true"]')).toHaveAttribute('data-andar', '2');
    await page.keyboard.press('0');
    await expect(page.locator('.d-andar[aria-current="true"]')).toHaveAttribute('data-andar', '20');
  });
});

test.describe('service worker', () => {
  test.use({ serviceWorkers: 'allow' });

  test('o vídeo de lançamento fica fora do cache; a foto da lixeira fica dentro', async ({ page }) => {
    await page.goto('./');
    await expect
      .poll(async () => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state), { timeout: 20_000 })
      .toBe('activated');
    await page.evaluate(() => fetch('assets/video/recicla-lancamento.mp4').then((r) => r.arrayBuffer()));
    const guardados = await page.evaluate(async () => {
      const urls = [];
      for (const nome of await caches.keys()) {
        const cache = await caches.open(nome);
        for (const pedido of await cache.keys()) urls.push(pedido.url);
      }
      return urls;
    });
    expect(guardados.some((u) => u.endsWith('.mp4'))).toBe(false);
    expect(guardados.some((u) => u.endsWith('lixeira-parede-verde.jpg'))).toBe(true);
  });
});

test('site e app falam em duas lixeiras por andar, como na apresentação, e nunca em "boca"', async ({ page }) => {
  await page.goto('./');
  const site = await page.locator('body').innerText();
  expect(site).not.toMatch(/boca/i);
  await expect(page.locator('.heroi__sub')).toContainText('Duas lixeiras em cada andar');
  await expect(page.locator('#como-funciona')).toContainText('a verde, de recicláveis, e a marrom, de orgânicos');
  expect(await page.locator('meta[name="description"]').getAttribute('content')).toMatch(/^Duas lixeiras em cada andar/);

  await page.goto('app/?andar=7');
  await page.getByRole('link', { name: /Pontuar agora/ }).click();
  await expect(page.getByRole('heading', { name: 'Qual lixeira você usou?' })).toBeVisible();
  const app = await page.locator('body').innerText();
  expect(app).not.toMatch(/boca/i);
});
