// Fluxos principais: registrar descarte, placar em outra aba, zerar e abrir com ?andar=7.
import { expect, test } from '@playwright/test';

/** Pontos de um andar na linha do telão. */
const pontosNoTelao = (page, andar) => page.locator(`.t-linha[data-andar="${andar}"] .t-linha__pontos`);
/** Pontos de um andar no cartão do painel. */
const pontosNoPainel = (page, andar) => page.locator(`.d-andar[data-andar="${andar}"] .d-andar__pontos .numero`);

test.describe('painel de demonstração', () => {
  test('registrar um descarte soma 10 pontos ao andar', async ({ page }) => {
    await page.goto('demo/');
    await expect(pontosNoPainel(page, 7)).toHaveText('290');

    await page.getByRole('button', { exact: true, name: 'Reciclável no 7º andar' }).click();
    await expect(pontosNoPainel(page, 7)).toHaveText('300');
    await expect(page.locator('#d-ultimo')).toContainText('Reciclável no 7º andar');

    await page.getByRole('button', { exact: true, name: 'Orgânico no 7º andar' }).click();
    await expect(pontosNoPainel(page, 7)).toHaveText('310');
    await expect(page.locator('#d-historico li')).toHaveCount(2);
  });

  test('desfazer volta o último descarte', async ({ page }) => {
    await page.goto('demo/');
    await page.getByRole('button', { exact: true, name: 'Orgânico no 2º andar' }).click();
    await expect(pontosNoPainel(page, 2)).toHaveText('340');
    await page.getByRole('button', { name: /Desfazer: orgânico no 2º andar/ }).click();
    await expect(pontosNoPainel(page, 2)).toHaveText('330');
    await expect(page.locator('#d-desfazer')).toBeDisabled();
  });

  test('descartes automáticos registram sozinhos e desligam', async ({ page }) => {
    await page.goto('demo/');
    const chave = page.getByRole('switch', { name: 'Descartes automáticos' });
    await chave.click();
    await expect(chave).toHaveAttribute('aria-checked', 'true');
    // o primeiro sai na hora; o segundo, 4 segundos depois
    await expect(page.locator('#d-historico li')).toHaveCount(1);
    await expect(page.locator('#d-historico li')).toHaveCount(2, { timeout: 6000 });
    await chave.click();
    await expect(chave).toHaveAttribute('aria-checked', 'false');
    await page.waitForTimeout(4500);
    await expect(page.locator('#d-historico li')).toHaveCount(2);
  });

  test('atalhos de teclado: número do andar e depois R', async ({ page }) => {
    await page.goto('demo/');
    await expect(pontosNoPainel(page, 3)).toHaveText('200');
    await page.keyboard.press('3');
    await page.keyboard.press('r');
    await expect(pontosNoPainel(page, 3)).toHaveText('210');
    await page.keyboard.press('z');
    await expect(pontosNoPainel(page, 3)).toHaveText('200');
  });
});

test.describe('sincronização entre abas', () => {
  test('o telão e o app atualizam quando o painel registra um descarte', async ({ context }) => {
    const telao = await context.newPage();
    const app = await context.newPage();
    const demo = await context.newPage();
    await telao.goto('telao/');
    await app.goto('app/?andar=7');
    await demo.goto('demo/');

    await expect(pontosNoTelao(telao, 7)).toHaveText('290');
    await expect(app.locator('#destaque-pontos')).toHaveText('290');

    // 6 descartes: o 7º andar vai de 290 para 350 e passa o 2º andar (330), subindo para 3º lugar.
    for (let i = 0; i < 6; i += 1) await demo.getByRole('button', { exact: true, name: 'Reciclável no 7º andar' }).click();

    await expect(pontosNoTelao(telao, 7)).toHaveText('350');
    await expect(telao.locator('.t-linha[data-andar="7"]')).toHaveAttribute('data-posicao', '3');
    await expect(app.locator('#destaque-pontos')).toHaveText('350');
    await expect(app.locator('#destaque-posicao')).toContainText('3º lugar');
    // a lista do telão está na ordem nova
    await expect(telao.locator('.t-linha').nth(2)).toHaveAttribute('data-andar', '7');
    // e o feed mostra o último descarte
    await expect(telao.locator('.t-feed__item').first()).toContainText('7º andar');
  });

  test('novo líder dispara a celebração no telão', async ({ context }) => {
    const telao = await context.newPage();
    const demo = await context.newPage();
    await telao.goto('telao/');
    await demo.goto('demo/');
    // 4º andar lidera com 410; o 8º tem 390: 3 descartes levam o 8º a 420.
    for (let i = 0; i < 3; i += 1) await demo.getByRole('button', { exact: true, name: 'Orgânico no 8º andar' }).click();
    await expect(telao.locator('#t-lider-andar')).toHaveText('8º andar');
    await expect(telao.locator('#t-celebracao-andar')).toHaveText('8º andar');
    await expect(telao.locator('#t-celebracao')).toBeVisible();
  });
});

test.describe('zerar e restaurar', () => {
  test('zerar placar deixa todas as telas no estado vazio', async ({ context }) => {
    const telao = await context.newPage();
    const app = await context.newPage();
    const demo = await context.newPage();
    await telao.goto('telao/');
    await app.goto('app/?andar=5');
    await demo.goto('demo/');

    await demo.getByRole('button', { name: 'Zerar placar' }).click();
    const dialogo = demo.getByRole('dialog', { name: 'Zerar o placar?' });
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Zerar placar' }).click();

    await expect(pontosNoPainel(demo, 7)).toHaveText('0');
    await expect(demo.locator('#d-vazio')).toBeVisible();
    await expect(telao.locator('#t-vazio')).toContainText('Placar zerado');
    await expect(telao.locator('#t-lider-andar')).toHaveText('Ninguém');
    await expect(app.locator('#ranking-vazio')).toContainText('Placar zerado');
    await expect(app.locator('#destaque-pontos')).toHaveText('0');

    // primeiro descarte depois de zerar: o andar vai para a frente
    await demo.getByRole('button', { exact: true, name: 'Reciclável no 5º andar' }).click();
    await expect(telao.locator('#t-lider-andar')).toHaveText('5º andar');
    await expect(app.locator('#destaque-posicao')).toContainText('1º lugar');
  });

  test('cancelar o diálogo não zera', async ({ page }) => {
    await page.goto('demo/');
    await page.getByRole('button', { name: 'Zerar placar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    await expect(pontosNoPainel(page, 4)).toHaveText('410');
  });

  test('voltar aos dados de exemplo', async ({ page }) => {
    await page.goto('demo/');
    await page.getByRole('button', { exact: true, name: 'Reciclável no 9º andar' }).click();
    await expect(pontosNoPainel(page, 9)).toHaveText('160');
    await page.getByRole('button', { name: 'Voltar aos dados de exemplo' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Voltar ao exemplo' }).click();
    await expect(pontosNoPainel(page, 9)).toHaveText('150');
  });
});

test.describe('app do morador', () => {
  test('abrir com ?andar=7 destaca o 7º andar e lembra dele', async ({ page }) => {
    await page.goto('app/?andar=7');
    await expect(page.locator('#destaque-titulo')).toHaveText(/7º\s*andar/);
    await expect(page.locator('#destaque-posicao')).toContainText('4º lugar');
    const minha = page.locator('.linha[aria-current="true"]');
    await expect(minha).toHaveAttribute('data-andar', '7');
    await expect(minha).toContainText('você');
    await expect(page.locator('#pontuar-texto')).toContainText('Etiqueta do 7º andar');

    // sem o parâmetro, o aparelho lembra do andar
    await page.goto('app/');
    await expect(page.locator('#destaque-titulo')).toHaveText(/7º\s*andar/);
    await expect(page.locator('#escolher')).toBeHidden();
  });

  test('sem andar, pede para escolher; e a escolha fica guardada', async ({ page }) => {
    await page.goto('app/');
    await expect(page.getByRole('heading', { name: 'Qual é o seu andar?' })).toBeVisible();
    await page.getByRole('button', { name: '3º andar' }).click();
    await expect(page.locator('#destaque-titulo')).toHaveText(/3º\s*andar/);
    await page.reload();
    await expect(page.locator('#destaque-titulo')).toHaveText(/3º\s*andar/);
  });

  test('trocar de andar e desistir mantém o andar atual', async ({ page }) => {
    await page.goto('app/?andar=7');
    await page.getByRole('button', { name: 'Trocar de andar' }).click();
    await expect(page.getByRole('heading', { name: 'Qual é o seu andar?' })).toBeVisible();
    await expect(page.getByRole('button', { name: '7º andar' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Manter o andar atual' }).click();
    await expect(page.locator('#destaque-titulo')).toHaveText(/7º\s*andar/);
    await page.getByRole('button', { name: 'Trocar de andar' }).click();
    await page.getByRole('button', { name: '2º andar' }).click();
    await expect(page.locator('#destaque-titulo')).toHaveText(/2º\s*andar/);
    await expect(page).toHaveURL(/andar=2/);
  });

  test('as abas trocam pelo endereço e pelo botão voltar', async ({ page }) => {
    await page.goto('app/?andar=7');
    await page.goto('app/#ranking');
    await expect(page.locator('#aba-ranking')).toBeVisible();
    await expect(page.locator('#aba-inicio')).toBeHidden();
    const barra = page.getByRole('navigation', { name: 'Principal' });
    await expect(barra.getByRole('link', { name: 'Ranking' })).toHaveAttribute('aria-current', 'page');
    await barra.getByRole('link', { name: 'Início' }).click();
    await expect(page.locator('#aba-inicio')).toBeVisible();
    await expect(page).toHaveURL(/#inicio$/);
    await page.goBack();
    await expect(page.locator('#aba-ranking')).toBeVisible();
  });

  test('a folha Pontuar abre pela barra e fecha com Esc, Concluir e voltar', async ({ page }) => {
    await page.goto('app/?andar=7');
    await page.goto('app/#inicio');
    const folha = page.locator('#folha-pontuar');
    const pontuar = page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Pontuar' });

    await pontuar.click();
    await expect(folha).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Qual boca você usou?' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(folha).toBeHidden();
    await expect(page).not.toHaveURL(/#pontuar/);
    await expect(pontuar).toBeFocused();

    await pontuar.click();
    await expect(folha).toBeVisible();
    await page.getByRole('button', { name: 'Concluir' }).click();
    await expect(folha).toBeHidden();

    await pontuar.click();
    await expect(folha).toBeVisible();
    await page.goBack();
    await expect(folha).toBeHidden();
    await expect(page.locator('#aba-inicio')).toBeVisible();
  });

  test('com ?andar=7 (etiqueta NFC) a folha Pontuar abre sozinha', async ({ page }) => {
    await page.goto('app/?andar=7');
    await expect(page.locator('#folha-pontuar')).toBeVisible({ timeout: 3000 });
    await expect(page).toHaveURL(/#pontuar$/);
  });

  test('andar que não existe mostra aviso', async ({ page }) => {
    await page.goto('app/?andar=42');
    await expect(page.locator('#escolher-alerta')).toContainText('O 42º andar não existe no Edifício Exemplo');
  });

  test('pontos no próprio nome ficam no aparelho e não mudam o andar', async ({ page }) => {
    await page.goto('app/?andar=7');
    await page.locator('.pontuar__botoes').getByRole('button', { name: 'Reciclável' }).click();
    await expect(page.locator('#pessoal-mes')).toHaveText('10');
    await expect(page.locator('#pessoal-descartes')).toHaveText('1');
    await expect(page.locator('#destaque-pontos')).toHaveText('290');
    // depois de pontuar pela etiqueta, o ?andar sai da URL
    await expect(page).not.toHaveURL(/andar=/);

    await page.locator('summary', { hasText: 'Seu nome e seus dados' }).click();
    await page.getByLabel('Seu nome ou apelido (opcional)').fill('Ana');
    await page.getByRole('button', { name: 'Salvar nome' }).click();
    await expect(page.locator('#pontuar-ola')).toHaveText('Olá, Ana.');

    await page.reload();
    await expect(page.locator('#pessoal-mes')).toHaveText('10');
    await expect(page.locator('#pontuar-ola')).toHaveText('Olá, Ana.');
  });

  test('erro ao carregar os dados mostra "Tentar de novo"', async ({ page }) => {
    await page.route('**/data/*.json', (rota) => rota.fulfill({ status: 500, body: 'erro' }));
    await page.goto('app/?andar=7');
    await expect(page.getByRole('alert')).toContainText('Não deu para abrir o placar');
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  });
});
