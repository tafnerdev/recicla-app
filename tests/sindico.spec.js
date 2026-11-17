// Etapa 3 do prompt-app.md: painel do síndico (/sindico).
// Sem o placar online (js/config.js vazio), o prédio cadastrado fica neste navegador
// (js/local.js), com as mesmas regras do supabase/schema.sql. O caminho online
// (Supabase) está em tests/online.spec.js.
import { test, expect } from '@playwright/test';

/** Cadastra um prédio pelo módulo de dados, como o formulário faz, e devolve o código. */
async function cadastrar(page, { nome = 'Residencial Teste', andares = 60, aptos = 6, pin = '4321' } = {}) {
  await page.goto('sindico/');
  return page.evaluate(
    async ([n, a, ap, p]) => {
      const dados = await import(new URL('../js/dados.js', location.href).href);
      const { codigo } = await dados.cadastrarPredio({ nome: n, andares: a, aptosPorAndar: ap, pin: p });
      return codigo;
    },
    [nome, andares, aptos, pin],
  );
}

/** Descartes pelo módulo de dados, numa tela já aberta no prédio. */
async function descartes(page, lista) {
  await page.evaluate(async (itens) => {
    const raiz = location.pathname.match(/\/(app|telao|demo|sindico)\//) ? '../' : '';
    const dados = await import(new URL(`${raiz}js/dados.js`, location.href).href);
    for (const [andar, tipo] of itens) await dados.registrarDescarte(andar, tipo, 'demo');
  }, lista);
}

test.describe('painel do síndico: cadastro e entrada', () => {
  test('cadastra um prédio de 60 andares e mostra código, links e QR codes', async ({ page }) => {
    await page.goto('sindico/');
    await expect(page.locator('#s-onde')).toContainText('fica neste navegador');
    const form = page.locator('#form-cadastro');
    await form.getByLabel('Nome do prédio').fill('Residencial Teste');
    await form.getByLabel('Andares').fill('61');
    await form.getByLabel('Apartamentos por andar').fill('6');
    await form.getByLabel('PIN do síndico').fill('4321');
    await form.getByLabel('Repita o PIN').fill('4321');
    await form.getByRole('button', { name: 'Cadastrar prédio' }).click();
    await expect(page.locator('#cadastro-erro')).toHaveText('O prédio precisa ter de 2 a 60 andares.');
    await form.getByLabel('Andares').fill('60');
    await form.getByLabel('PIN do síndico').fill('432');
    await form.getByRole('button', { name: 'Cadastrar prédio' }).click();
    await expect(page.locator('#cadastro-erro')).toHaveText('O PIN precisa ter de 4 a 6 números.');
    await form.getByLabel('PIN do síndico').fill('4321');
    await form.getByLabel('Repita o PIN').fill('4320');
    await form.getByRole('button', { name: 'Cadastrar prédio' }).click();
    await expect(page.locator('#cadastro-erro')).toHaveText('Os dois PINs não são iguais.');
    await form.getByLabel('Repita o PIN').fill('4321');
    await form.getByRole('button', { name: 'Cadastrar prédio' }).click();

    await expect(page).toHaveURL(/sindico\/\?predio=[A-Z0-9]{6}&novo=1$/);
    const codigo = new URL(page.url()).searchParams.get('predio');
    await expect(page.locator('#s-novo')).toBeVisible();
    await expect(page.locator('#s-novo-codigo')).toHaveText(codigo);
    await expect(page.locator('#s-novo-local')).toBeVisible();
    await expect(page.locator('#s-novo-link-app')).toHaveAttribute('href', new RegExp(`/app/\\?predio=${codigo}$`));
    await expect(page.locator('#s-novo-link-telao')).toHaveAttribute('href', new RegExp(`/telao/\\?predio=${codigo}$`));
    await expect(page.locator('#s-novo .s-qr svg path')).toHaveCount(2);
    await expect(page.locator('#s-onde-chip')).toHaveText('Neste navegador');
    await expect(page.getByRole('heading', { level: 1, name: 'Residencial Teste' })).toBeVisible();
    await expect(page.locator('#s-tamanho')).toHaveText('60 andares · 6 apartamentos por andar · 360 apartamentos');
    // nada de limite de 10: uma linha e uma etiqueta para cada um dos 60 andares
    await expect(page.locator('#s-lixeiras tr')).toHaveCount(60);
    await expect(page.locator('#s-etiquetas .s-etiqueta')).toHaveCount(60);
    await expect(page.locator('.s-etiqueta[data-andar="60"] a')).toHaveAttribute('href', new RegExp(`/app/\\?predio=${codigo}&andar=60$`));
    // o PIN não fica guardado em lugar nenhum, só o hash
    const guardado = await page.evaluate((c) => localStorage.getItem(`recicla-slide:local:predio:${c}:v1`), codigo);
    expect(guardado).not.toContain('4321');
    expect(JSON.parse(guardado).predio.pin_hash).toMatch(/^[0-9a-f]{64}$/);

    await page.getByRole('button', { name: 'Pronto, ir para o painel' }).click();
    await expect(page.locator('#s-novo')).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`\\?predio=${codigo}$`));
  });

  test('entrar com código e PIN: o PIN errado avisa e o certo abre o painel', async ({ page }) => {
    const codigo = await cadastrar(page, { nome: 'Edifício do PIN', andares: 8 });
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('sindico/');
    const form = page.locator('#form-entrar');
    await form.getByLabel('Código do prédio').fill(codigo.toLowerCase());
    await form.getByLabel('PIN do síndico').fill('9999');
    await form.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('#entrar-erro')).toHaveText('PIN errado.');
    await form.getByLabel('PIN do síndico').fill('4321');
    await form.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edifício do PIN' })).toBeVisible();

    // Sair esquece o PIN: o mesmo endereço pede o PIN de novo
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page.locator('#s-inicio')).toBeVisible();
    await page.goto(`sindico/?predio=${codigo}`);
    await expect(page.getByRole('heading', { name: 'Digite o PIN do síndico' })).toBeVisible();
    await page.getByLabel('PIN', { exact: true }).fill('4321');
    await page.getByRole('button', { name: 'Abrir o painel' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edifício do PIN' })).toBeVisible();
  });

  test('código que não está neste navegador volta ao início com um aviso', async ({ page }) => {
    await page.goto('sindico/?predio=ZZZZZZ');
    await expect(page.locator('#s-inicio-aviso')).toContainText('não está neste navegador');
  });
});

test.describe('painel do síndico: o mês, o prêmio e as telas', () => {
  test('prédio de exemplo: visão do mês com totais, líder e uma barra por dia', async ({ page }) => {
    await page.goto('sindico/');
    await page.getByRole('button', { name: 'Ver o painel com o prédio de exemplo' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edifício Exemplo' })).toBeVisible();
    await expect(page.locator('#s-exemplo-chip')).toBeVisible();
    await expect(page.locator('#s-aviso-exemplo')).toContainText('1234');
    await expect(page.locator('#mes-total')).toHaveText('486');
    await expect(page.locator('#mes-lider')).toHaveText('4º andar · 410 pontos');
    const hoje = new Date().getDate();
    await expect(page.locator('#mes-tabela tr')).toHaveCount(hoje + 1); // cabeçalho + um por dia
    expect(await page.locator('#mes-barras rect.s-barra-r').count()).toBeGreaterThan(0);
    // abrir de novo usa o mesmo prédio
    const codigo = new URL(page.url()).searchParams.get('predio');
    await page.goto('sindico/');
    await page.getByRole('button', { name: 'Ver o painel com o prédio de exemplo' }).click();
    await expect(page).toHaveURL(new RegExp(`predio=${codigo}$`));
  });

  test('o prêmio com patrocinador aparece no app e no telão, marcado como exemplo', async ({ page, context }) => {
    const codigo = await cadastrar(page, { andares: 20 });
    await page.goto(`sindico/?predio=${codigo}`);
    const telao = await context.newPage();
    await telao.setViewportSize({ width: 1920, height: 1080 });
    await telao.goto(`telao/?predio=${codigo}`);
    await expect(telao.locator('#t-predio')).toHaveText('Residencial Teste');
    await expect(telao.locator('#t-premio')).toBeHidden();

    const form = page.locator('#form-premio');
    await form.getByLabel('Prêmio do andar campeão').fill('Noite da pizza no salão de festas');
    await form.getByLabel('Oferecido por').fill('Pizzaria do Bairro');
    await expect(form.getByRole('checkbox')).toBeChecked();
    await form.getByRole('button', { name: 'Salvar prêmio' }).click();
    await expect(page.locator('.aviso')).toContainText('Prêmio salvo');

    await expect(telao.locator('#t-premio-titulo')).toHaveText('Noite da pizza no salão de festas');
    await expect(telao.locator('#t-premio-por')).toHaveText(' · oferecido por Pizzaria do Bairro');
    await expect(telao.locator('#t-premio-exemplo')).toBeVisible();

    const app = await context.newPage();
    await app.goto(`app/?predio=${codigo}&andar=3#ranking`);
    await expect(app.locator('#premio-nome')).toHaveText('Noite da pizza no salão de festas');
    await expect(app.locator('#premio-por')).toHaveText('Oferecido por Pizzaria do Bairro');
    await expect(app.locator('#premio-exemplo')).toBeVisible();

    // patrocinador confirmado: sai o "Exemplo"
    await form.getByRole('checkbox').uncheck();
    await form.getByRole('button', { name: 'Salvar prêmio' }).click();
    await expect(telao.locator('#t-premio-exemplo')).toBeHidden();
    await expect(app.locator('#premio-exemplo')).toBeHidden();
  });

  test('60 andares: o telão mostra 10 por vez e alterna as páginas; app e painel aceitam o 60º', async ({ page, context }) => {
    const codigo = await cadastrar(page, { nome: 'Torre Sessenta' });
    await page.goto(`demo/?predio=${codigo}`);
    await expect(page.locator('.d-andar')).toHaveCount(60);
    await descartes(
      page,
      Array.from({ length: 25 }, (_, i) => [60 - i, 'reciclavel']),
    );

    const telao = await context.newPage();
    await telao.clock.install();
    await telao.setViewportSize({ width: 1920, height: 1080 });
    await telao.goto(`telao/?predio=${codigo}`);
    await expect(telao.locator('#t-lista .t-linha')).toHaveCount(10);
    await expect(telao.locator('#t-paginas')).toHaveText('1º ao 10º de 60 andares');
    await telao.clock.runFor(13_000);
    await expect(telao.locator('#t-paginas')).toHaveText('11º ao 20º de 60 andares');
    await expect(telao.locator('#t-lista .t-linha')).toHaveCount(10);
    await expect(telao.locator('#t-lista .t-linha--lider')).toHaveCount(0);
    await telao.clock.runFor(9_000);
    await expect(telao.locator('#t-paginas')).toHaveText('21º ao 30º de 60 andares');

    const app = await context.newPage();
    await app.goto(`app/?predio=${codigo}&andar=60`);
    await expect(app.locator('#lixeira-titulo')).toHaveText('Lixeiras do 60º andar');
  });

  test('entupimento simulado no painel de demonstração aparece no painel do síndico e some ao resolver', async ({ page, context }) => {
    const codigo = await cadastrar(page, { andares: 20 });
    await page.goto(`sindico/?predio=${codigo}`);
    await expect(page.locator('#s-alertas-vazio')).toBeVisible();

    const demo = await context.newPage();
    await demo.goto(`demo/?predio=${codigo}`);
    await expect(demo.locator('#d-entupimento')).toBeVisible();
    await demo.getByLabel('Andar', { exact: true }).fill('12');
    await demo.getByRole('button', { name: 'Simular entupimento' }).click();
    // outra aba: pede o PIN do síndico
    const dialogo = demo.getByRole('dialog', { name: 'PIN do síndico' });
    await dialogo.getByLabel('PIN').fill('4321');
    await dialogo.getByRole('button', { name: 'Continuar' }).click();
    await expect(demo.locator('.aviso')).toContainText('Entupimento simulado entre o 12º e o térreo');

    const alerta = page.locator('.s-alerta');
    await expect(alerta).toHaveCount(1);
    await expect(alerta).toContainText('Possível entupimento entre o 12º e o térreo');
    await expect(alerta).toContainText('Tubo de recicláveis');
    await expect(page.locator('#s-conta-alertas')).toHaveText('1');
    await expect(page.locator('#s-lixeiras tr[data-andar="12"]')).toContainText('Possível entupimento');

    await alerta.getByRole('button', { name: 'Marcar como resolvido' }).click();
    await expect(page.locator('.s-alerta')).toHaveCount(0);
    await expect(page.locator('#s-alertas-vazio')).toBeVisible();
    await expect(page.locator('#s-conta-alertas')).toBeHidden();
  });

  test('manutenção: prazos da apresentação, aviso de atraso e registro de hoje', async ({ page }) => {
    const codigo = await cadastrar(page, { andares: 10 });
    // a última limpeza foi há 4 meses (direto no "banco" deste navegador)
    await page.evaluate((c) => {
      const chave = `recicla-slide:local:predio:${c}:v1`;
      const banco = JSON.parse(localStorage.getItem(chave));
      const antes = new Date();
      antes.setMonth(antes.getMonth() - 4);
      banco.predio.limpeza_em = antes.toISOString();
      localStorage.setItem(chave, JSON.stringify(banco));
    }, codigo);
    await page.goto(`sindico/?predio=${codigo}`);
    const limpeza = page.locator('.s-manut[data-item="limpeza"]');
    await expect(limpeza).toContainText('a cada 3 meses');
    await expect(limpeza.locator('.s-manut__situacao')).toHaveText(/^Atrasada há \d+ dias$/);
    await expect(page.locator('.s-manut[data-item="inspecao"]')).toContainText('todo mês');
    await expect(page.locator('.s-manut[data-item="pilhas"]')).toContainText('a cada 3 meses');
    await limpeza.getByRole('button', { name: 'Limpeza feita hoje' }).click();
    await expect(limpeza.locator('.s-manut__situacao')).toHaveText('Em dia');
    const proxima = new Date();
    proxima.setMonth(proxima.getMonth() + 3);
    await expect(limpeza).toContainText(proxima.toLocaleDateString('pt-BR', { month: 'long' }));
  });

  test('fechar o mês guarda o campeão e zera o placar em todas as telas', async ({ page, context }) => {
    const codigo = await cadastrar(page, { andares: 10 });
    await page.goto(`sindico/?predio=${codigo}`);
    await expect(page.locator('#s-etiquetas .s-etiqueta')).toHaveCount(10);
    await descartes(page, [
      [5, 'reciclavel'],
      [5, 'organico'],
      [5, 'reciclavel'],
      [2, 'reciclavel'],
    ]);
    await expect(page.locator('#mes-total')).toHaveText('4');
    const telao = await context.newPage();
    await telao.goto(`telao/?predio=${codigo}`);
    await expect(telao.locator('#t-total')).toHaveText('4');

    await page.getByRole('button', { name: 'Fechar o mês' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toContainText('O 5º andar fica guardado como campeão, com 30 pontos');
    await dialogo.getByRole('button', { name: 'Fechar o mês' }).click();
    await expect(page.locator('.s-campeao')).toHaveCount(1);
    await expect(page.locator('.s-campeao')).toContainText('5º andar');
    await expect(page.locator('.s-campeao')).toContainText('30 pontos');
    await expect(page.locator('#mes-total')).toHaveText('0');
    await expect(telao.locator('#t-vazio')).toContainText('Placar zerado');
  });
});

test.describe('painel do síndico: etiquetas', () => {
  test('com Web NFC, grava a URL do andar na etiqueta', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 412, height: 915 }, serviceWorkers: 'block' });
    // NDEFReader falso: guarda o que seria gravado na etiqueta
    await context.addInitScript(() => {
      globalThis.NDEFReader = class {
        async write(mensagem) {
          globalThis.__gravado = mensagem;
        }
      };
    });
    const page = await context.newPage();
    const codigo = await cadastrar(page, { andares: 12 });
    await page.goto(`sindico/?predio=${codigo}`);
    await expect(page.locator('#s-nfc-texto')).toContainText('Este celular grava etiquetas NFC');
    const etiqueta = page.locator('.s-etiqueta[data-andar="7"]');
    await etiqueta.getByRole('button', { name: 'Gravar etiqueta NFC' }).click();
    await expect(etiqueta.locator('.s-etiqueta__status')).toHaveText('Etiqueta gravada. Encoste de novo para testar.');
    const gravado = await page.evaluate(() => globalThis.__gravado);
    expect(gravado.records).toHaveLength(1);
    expect(gravado.records[0].recordType).toBe('url');
    expect(gravado.records[0].data).toMatch(new RegExp(`/app/\\?predio=${codigo}&andar=7$`));
    await context.close();
  });

  test('sem Web NFC, mostra como gravar com um app; e imprime uma etiqueta por andar', async ({ page }) => {
    const codigo = await cadastrar(page, { andares: 12 });
    await page.goto(`sindico/?predio=${codigo}`);
    await expect(page.locator('#s-nfc-texto')).toContainText('não grava NFC');
    await page.locator('.s-etiqueta[data-andar="3"]').getByRole('button', { name: 'Como gravar' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Gravar a etiqueta do 3º andar' });
    await expect(dialogo).toContainText('NFC Tools');
    await expect(dialogo).toContainText(`predio=${codigo}&andar=3`);
    await dialogo.getByRole('button', { name: 'Fechar' }).click();
    await expect(dialogo).toBeHidden();

    await page.evaluate(() => {
      globalThis.print = () => {
        globalThis.__imprimiu = true;
      };
    });
    await page.getByRole('button', { name: 'Imprimir etiquetas' }).click();
    await expect.poll(() => page.evaluate(() => globalThis.__imprimiu)).toBe(true);
    await expect(page.locator('#s-impressao .s-imp__cartao')).toHaveCount(12);
    await expect(page.locator('#s-impressao .s-imp__cartao').nth(11)).toContainText('12º andar');
    await expect(page.locator('#s-impressao .s-imp__qr svg')).toHaveCount(12);
  });

  test('o palco de um prédio que só existe neste navegador explica que precisa do placar online', async ({ page }) => {
    const codigo = await cadastrar(page, { andares: 10 });
    await page.goto(`telao/?predio=${codigo}&palco=1`);
    await expect(page.locator('#t-palco-titulo')).toHaveText('O modo palco precisa do placar online');
    await expect(page.locator('#t-palco-qr')).toBeHidden();
  });
});
