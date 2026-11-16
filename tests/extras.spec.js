// Sensor serial, página inicial, uso offline e página 404.
import { expect, test } from '@playwright/test';

test.describe('sensor pela porta serial', () => {
  test('interpretarLinha entende R,7 e O,7 e recusa o resto', async ({ page, baseURL }) => {
    await page.goto('telao/');
    const resultados = await page.evaluate(async (url) => {
      const { interpretarLinha } = await import(url);
      const andares = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      return {
        r7: interpretarLinha('R,7', andares),
        o3: interpretarLinha(' o, 3 \r', andares),
        ponto: interpretarLinha('R;10', andares),
        vazia: interpretarLinha('', andares),
        comentario: interpretarLinha('# sensor pronto', andares),
        tipo: interpretarLinha('X,7', andares),
        andar: interpretarLinha('R,42', andares),
        lixo: interpretarLinha('olá', andares),
      };
    }, `${baseURL}js/serial.js`);
    expect(resultados.r7).toEqual({ ok: true, tipo: 'reciclavel', andar: 7 });
    expect(resultados.o3).toEqual({ ok: true, tipo: 'organico', andar: 3 });
    expect(resultados.ponto).toEqual({ ok: true, tipo: 'reciclavel', andar: 10 });
    expect(resultados.vazia.ignorada).toBe(true);
    expect(resultados.comentario.ignorada).toBe(true);
    expect(resultados.tipo.ok).toBe(false);
    expect(resultados.andar.erro).toContain('não existe');
    expect(resultados.lixo.ok).toBe(false);
  });

  test('sem ?sensor=1 o painel do sensor fica escondido', async ({ page }) => {
    await page.goto('telao/');
    await expect(page.locator('.t-linha').first()).toBeVisible();
    await expect(page.locator('#t-sensor-painel')).toBeHidden();
    await expect(page.locator('#t-sensor')).toBeHidden();
  });

  test('com ?sensor=1, uma linha de teste registra o descarte', async ({ page }) => {
    await page.goto('telao/?sensor=1');
    await expect(page.locator('#t-sensor-painel')).toBeVisible();
    const pontos = page.locator('.t-linha[data-andar="7"] .t-linha__pontos');
    await expect(pontos).toHaveText('290');
    await page.getByLabel('Testar uma linha').fill('O,7');
    await page.getByLabel('Testar uma linha').press('Enter');
    await expect(pontos).toHaveText('300');
    await expect(page.locator('#t-sensor-ultima')).toContainText('"O,7"');
    await page.getByLabel('Testar uma linha').fill('Z,7');
    await page.getByLabel('Testar uma linha').press('Enter');
    await expect(page.locator('#t-sensor-ultima')).toContainText('ignorada');
    await expect(pontos).toHaveText('300');
  });
});

test.describe('página inicial', () => {
  test('a demonstração do ranking funciona e não mexe no placar de verdade', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('O lixo desce pelo tobogã.');
    const linha7 = page.locator('#demo-lista .linha[data-andar="7"] .linha__valor');
    await expect(linha7).toHaveText('290');
    const botao = page.locator('.controle__botoes').getByRole('button', { name: 'Reciclável' });
    for (let i = 0; i < 5; i += 1) await botao.click();
    await expect(linha7).toHaveText('340');
    await expect(page.locator('#demo-status')).toContainText('3º lugar');

    // outro andar
    await page.getByRole('radio', { name: '9º andar' }).check({ force: true });
    await expect(page.locator('#demo-lista .linha[aria-current="true"]')).toHaveAttribute('data-andar', '9');

    // o placar de verdade continua com os dados de exemplo
    await page.goto('demo/');
    await expect(page.locator('.d-andar[data-andar="7"] .d-andar__pontos .numero')).toHaveText('290');
  });

  test('link do menu rola até a seção e o conteúdo aparece no lugar certo', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('navigation', { name: 'Seções da página' }).getByRole('link', { name: 'Perguntas' }).click();
    await expect(page.getByRole('heading', { name: 'Perguntas frequentes' })).toBeInViewport();
    const primeira = page.locator('.pergunta').first();
    await expect(primeira).toHaveCSS('opacity', '1');
    // depois de revelado, nada fica deslocado
    await expect(primeira).toHaveCSS('transform', /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  });

  test('menu do celular abre e fecha', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');
    const botao = page.getByRole('button', { name: 'Menu' });
    await botao.click();
    await expect(botao).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('navigation', { name: 'Seções da página' }).getByRole('link', { name: 'Perguntas' }).click();
    await expect(botao).toHaveAttribute('aria-expanded', 'false');
    await expect(page).toHaveURL(/#perguntas$/);
    await expect(page.getByRole('heading', { name: 'Perguntas frequentes' })).toBeInViewport();
  });

  test('botões da abertura levam ao ranking e ao contato', async ({ page }) => {
    await page.goto('./');
    await page.locator('.heroi__acoes').getByRole('link', { name: 'Ver o ranking' }).click();
    await expect(page.getByRole('heading', { name: 'Escolha um andar e faça um descarte' })).toBeInViewport();
    await page.goto('./');
    await page.locator('.heroi__acoes').getByRole('link', { name: 'Fale com a gente' }).click();
    await expect(page.getByRole('heading', { name: 'Quer o Recicla Slide no seu próximo prédio?' })).toBeInViewport();
    await expect(page.locator('#contato-link')).toHaveAttribute('href', /^mailto:/);
  });

  test('nenhuma tela tem rolagem horizontal no celular', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    for (const caminho of ['./', 'app/?andar=10', 'demo/', 'telao/']) {
      await page.goto(caminho);
      await page.waitForTimeout(300);
      const largura = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(largura, caminho).toBeLessThanOrEqual(360);
    }
  });
});

test.describe('PWA', () => {
  test.use({ serviceWorkers: 'allow' });

  test('funciona sem internet depois da primeira visita', async ({ page, context }) => {
    await page.goto('./');
    await page.evaluate(async () => {
      const registro = await navigator.serviceWorker.ready;
      return registro.active?.state;
    });
    // espera o cache terminar de ser preenchido
    await expect
      .poll(async () => page.evaluate(async () => (await caches.keys()).length), { timeout: 15_000 })
      .toBeGreaterThan(0);
    await page.waitForTimeout(500);

    await context.setOffline(true);
    await page.goto('app/?andar=7');
    await expect(page.locator('#destaque-titulo')).toHaveText(/7º\s*andar/);
    await page.goto('telao/');
    await expect(page.locator('.t-linha')).toHaveCount(10);
    await page.goto('demo/');
    await expect(page.locator('.d-andar')).toHaveCount(10);
    await context.setOffline(false);
  });

  test('manifest com nome, ícones e início no app', async ({ request }) => {
    const resposta = await request.get('manifest.webmanifest');
    expect(resposta.ok()).toBe(true);
    const manifest = await resposta.json();
    expect(manifest.name).toBe('Recicla Slide');
    expect(manifest.start_url).toBe('app/');
    expect(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
    for (const icone of manifest.icons) {
      const arquivo = await request.get(icone.src);
      expect(arquivo.ok(), icone.src).toBe(true);
    }
  });
});

test('página 404 com links para as telas', async ({ page }) => {
  const resposta = await page.goto('nao/existe/');
  expect(resposta.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Esta página não existe.' })).toBeVisible();
  await page.getByRole('link', { name: 'Telão' }).click();
  await expect(page).toHaveURL(/\/recicla-app\/telao\/$/);
});
