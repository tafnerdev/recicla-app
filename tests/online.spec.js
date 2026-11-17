// Etapa 2 do prompt-app.md: placar online (Supabase), modo palco e fila sem internet.
//
// Não há Supabase aqui. Os testes usam:
//  - um "servidor falso" no processo do teste (globalThis.__reciclaRemotoFalso no
//    navegador chama ele), com cada celular num contexto separado do navegador, como
//    aparelhos de verdade, e um "Realtime" que entrega as novidades a todos. Ele segue
//    as regras do supabase/schema.sql;
//  - no último teste, o supabase-js de verdade falando com uma imitação da API REST.
import { test, expect } from '@playwright/test';

const CODIGO = 'TESTE1';
const CONFIG_ONLINE = "export const SUPABASE_URL = 'https://falso.supabase.co';\nexport const SUPABASE_ANON_KEY = 'chave-anon-de-teste';\n";

/**
 * O servidor falso roda aqui, no processo do teste: assim cada "celular" pode ser um
 * contexto separado do navegador (outro aparelho, outro localStorage) e todos falam
 * com o mesmo placar. Segue as regras do supabase/schema.sql. O "Realtime" entrega
 * cada novidade às páginas que estão ouvindo.
 */
function criarServidorFalso() {
  const banco = {
    seq: 1,
    predios: [
      {
        id: 'predio-falso-1',
        codigo: CODIGO,
        nome: 'Prédio do Palco',
        andares: 6,
        aptos_por_andar: 4,
        premio_titulo: 'Pizza para o andar campeão',
        premio_patrocinador: 'Padaria Exemplo',
        mes_inicio: '2026-11-01T00:00:00.000Z',
        pin: '1234',
      },
    ],
    descartes: [],
    participantes: [],
  };
  const ouvintes = new Set(); // páginas que assinaram o Realtime
  const publico = (p) => {
    const { pin, ...resto } = p;
    return { ...resto, participantes: banco.participantes.filter((x) => x.predio_id === p.id).length };
  };
  const emitir = (mensagem) => {
    for (const pagina of ouvintes) pagina.evaluate((m) => globalThis.__falsoEntregar?.(m), mensagem).catch(() => ouvintes.delete(pagina));
  };
  const metodos = {
    buscarPredio(c) {
      const p = banco.predios.find((x) => x.codigo === c);
      return p ? publico(p) : null;
    },
    buscarPlacar(c) {
      const p = banco.predios.find((x) => x.codigo === c);
      const linhas = {};
      for (const d of banco.descartes.filter((x) => x.predio_id === p.id && x.criado_em >= p.mes_inicio)) {
        linhas[d.andar] ??= { andar: d.andar, reciclavel: 0, organico: 0 };
        linhas[d.andar][d.tipo] += 1;
      }
      return Object.values(linhas);
    },
    buscarHistorico(predioId, desde, limite = 30) {
      return banco.descartes
        .filter((x) => x.predio_id === predioId && x.criado_em >= desde)
        .sort((a, b) => b.id - a.id)
        .slice(0, limite);
    },
    buscarResumo: () => [],
    buscarAlertas: () => [],
    buscarCampeoes: () => [],
    rpc(nome, a) {
      if (nome === 'criar_predio') {
        if (!(a.p_andares >= 2 && a.p_andares <= 60)) return { __erro: 'andares_invalido' };
        if (!/^[0-9]{4,6}$/.test(a.p_pin)) return { __erro: 'pin_invalido' };
        const agora = new Date().toISOString();
        const novo = {
          id: `predio-falso-${banco.predios.length + 1}`,
          codigo: 'NOVO23',
          nome: a.p_nome,
          andares: a.p_andares,
          aptos_por_andar: a.p_aptos_por_andar,
          premio_titulo: null,
          premio_patrocinador: null,
          premio_exemplo: true,
          mes_inicio: agora,
          criado_em: agora,
          limpeza_em: agora,
          inspecao_em: agora,
          pilhas_em: agora,
          pin: a.p_pin,
        };
        banco.predios.push(novo);
        return novo.codigo;
      }
      const p = banco.predios.find((x) => x.codigo === a.p_codigo);
      if (!p) return { __erro: 'predio_nao_encontrado' };
      if (nome === 'entrar') {
        const ja = banco.participantes.find((x) => x.predio_id === p.id && x.aparelho === a.p_aparelho);
        if (ja) return ja.andar;
        const contagem = Array.from({ length: p.andares }, (_, i) => ({
          andar: i + 1,
          n: banco.participantes.filter((x) => x.predio_id === p.id && x.andar === i + 1).length,
        }));
        contagem.sort((x, y) => x.n - y.n || x.andar - y.andar);
        const linha = { predio_id: p.id, aparelho: a.p_aparelho, andar: contagem[0].andar };
        banco.participantes.push(linha);
        emitir({ tipo: 'participante', predio_id: p.id, linha });
        return linha.andar;
      }
      if (nome === 'registrar_descarte') {
        if (a.p_andar < 1 || a.p_andar > p.andares) return { __erro: 'andar_invalido' };
        if (a.p_origem === 'app') {
          const recente = banco.descartes.find(
            (x) => x.aparelho === a.p_aparelho && x.origem === 'app' && Date.now() - Date.parse(x.criado_em) < 2000,
          );
          if (recente) return { __erro: 'devagar' };
        }
        const linha = {
          id: banco.seq++,
          predio_id: p.id,
          andar: a.p_andar,
          tipo: a.p_tipo,
          origem: a.p_origem,
          aparelho: a.p_aparelho,
          criado_em: new Date().toISOString(),
        };
        banco.descartes.push(linha);
        emitir({ tipo: 'descarte', predio_id: p.id, linha });
        return linha;
      }
      if (a.p_pin !== p.pin) return { ok: false, erro: 'pin_errado' };
      if (nome === 'verificar_pin') return { ok: true, codigo: p.codigo, nome: p.nome };
      if (nome === 'definir_premio') {
        Object.assign(p, { premio_titulo: a.p_titulo || null, premio_patrocinador: a.p_patrocinador || null, premio_exemplo: a.p_exemplo });
        emitir({ tipo: 'evento', predio_id: p.id, linha: { tipo: 'premio' } });
        return { ok: true };
      }
      if (nome === 'desfazer_ultimo') {
        const ultimo = banco.descartes.filter((x) => x.predio_id === p.id).sort((x, y) => y.id - x.id)[0];
        if (!ultimo) return { ok: true, nada: true };
        banco.descartes = banco.descartes.filter((x) => x.id !== ultimo.id);
        emitir({ tipo: 'evento', predio_id: p.id, linha: { tipo: 'desfeito' } });
        return { ok: true, andar: ultimo.andar, tipo: ultimo.tipo };
      }
      if (nome === 'fechar_mes') {
        p.mes_inicio = new Date().toISOString();
        emitir({ tipo: 'evento', predio_id: p.id, linha: { tipo: 'mes_fechado' } });
        return { ok: true };
      }
      return { ok: true };
    },
  };
  return { banco, ouvintes, metodos };
}

/** No navegador: o js/remoto.js falso, que chama o servidor do teste. */
function remotoFalsoNoNavegador() {
  const retornosPorPredio = [];
  globalThis.__falsoEntregar = (m) => {
    for (const { predioId, retornos } of retornosPorPredio) {
      if (m.predio_id !== predioId) continue;
      if (m.tipo === 'descarte') retornos.aoDescarte?.(m.linha);
      if (m.tipo === 'participante') retornos.aoParticipante?.(m.linha);
      if (m.tipo === 'evento') retornos.aoEvento?.(m.linha);
    }
  };
  const chamar = async (metodo, ...args) => {
    if (navigator.onLine === false) throw Object.assign(new Error('Sem conexão'), { codigo: 'rede' });
    const resposta = await globalThis.__falsoChamar(metodo, args);
    if (resposta && resposta.__erro) throw Object.assign(new Error(resposta.__erro), { codigo: resposta.__erro });
    return resposta;
  };
  globalThis.__reciclaRemotoFalso = async () => ({
    buscarPredio: (c) => chamar('buscarPredio', c),
    buscarPlacar: (c) => chamar('buscarPlacar', c),
    buscarHistorico: (id, desde, limite) => chamar('buscarHistorico', id, desde, limite),
    buscarResumo: (c) => chamar('buscarResumo', c),
    buscarAlertas: (id) => chamar('buscarAlertas', id),
    buscarCampeoes: (id) => chamar('buscarCampeoes', id),
    rpc: (nome, a) => chamar('rpc', nome, a),
    assinar(predioId, retornos) {
      retornosPorPredio.push({ predioId, retornos });
      globalThis.__falsoChamar('ouvir', []);
      setTimeout(() => retornos.aoEstado?.('ao-vivo'), 50);
      return () => {};
    },
  });
}

/** Um "aparelho": contexto novo do navegador ligado ao servidor falso. */
async function aparelho(browser, servidor, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport });
  await context.route('**/js/config.js', (rota) => rota.fulfill({ contentType: 'text/javascript', body: CONFIG_ONLINE }));
  await context.exposeBinding('__falsoChamar', ({ page }, metodo, args) => {
    if (metodo === 'ouvir') {
      servidor.ouvintes.add(page);
      return null;
    }
    return servidor.metodos[metodo](...args);
  });
  await context.addInitScript(remotoFalsoNoNavegador);
  return context;
}

const numeroDoAndar = async (pagina) => Number((await pagina.locator('#palco-andar').textContent()).match(/\d+/)[0]);

test.describe('painel do síndico com o placar online (servidor falso)', () => {
  test.describe.configure({ timeout: 60_000 });

  test('o síndico cadastra o prédio no Supabase e o prêmio chega ao telão de outro aparelho', async ({ browser }) => {
    const servidor = criarServidorFalso();
    const contextoSindico = await aparelho(browser, servidor, { width: 1280, height: 900 });
    const sindico = await contextoSindico.newPage();
    await sindico.goto('sindico/');
    await expect(sindico.locator('#s-onde')).toContainText('O placar online está ligado');
    const form = sindico.locator('#form-cadastro');
    await form.getByLabel('Nome do prédio').fill('Prédio Online');
    await form.getByLabel('Andares').fill('12');
    await form.getByLabel('Apartamentos por andar').fill('4');
    await form.getByLabel('PIN do síndico').fill('2468');
    await form.getByLabel('Repita o PIN').fill('2468');
    await form.getByRole('button', { name: 'Cadastrar prédio' }).click();
    await expect(sindico).toHaveURL(/sindico\/\?predio=NOVO23&novo=1$/);
    await expect(sindico.locator('#s-onde-chip')).toHaveText('Online');
    await expect(sindico.locator('#s-novo-local')).toBeHidden();
    expect(servidor.banco.predios.at(-1)).toMatchObject({ codigo: 'NOVO23', nome: 'Prédio Online', andares: 12, aptos_por_andar: 4 });

    // o telão, em outro aparelho, abre o mesmo prédio
    const contextoTelao = await aparelho(browser, servidor, { width: 1920, height: 1080 });
    const telao = await contextoTelao.newPage();
    await telao.goto('telao/?predio=NOVO23');
    await expect(telao.locator('#t-predio')).toHaveText('Prédio Online');
    await expect(telao.locator('#t-status-texto')).toHaveText('Ao vivo');

    const premio = sindico.locator('#form-premio');
    await premio.getByLabel('Prêmio do andar campeão').fill('Churrasco no salão');
    await premio.getByLabel('Oferecido por').fill('Açougue Exemplo');
    await premio.getByRole('button', { name: 'Salvar prêmio' }).click();
    await expect(telao.locator('#t-premio-titulo')).toHaveText('Churrasco no salão');
    await expect(telao.locator('#t-premio-por')).toHaveText(' · oferecido por Açougue Exemplo');
    await expect(telao.locator('#t-premio-exemplo')).toBeVisible();
    expect(servidor.banco.predios.at(-1)).toMatchObject({ premio_titulo: 'Churrasco no salão', premio_exemplo: true });

    // outro aparelho entra com o código e o PIN
    const contextoOutro = await aparelho(browser, servidor, { width: 390, height: 844 });
    const outro = await contextoOutro.newPage();
    await outro.goto('sindico/');
    await outro.locator('#form-entrar').getByLabel('Código do prédio').fill('NOVO23');
    await outro.locator('#form-entrar').getByLabel('PIN do síndico').fill('1111');
    await outro.locator('#form-entrar').getByRole('button', { name: 'Entrar' }).click();
    await expect(outro.locator('#entrar-erro')).toHaveText('PIN errado.');
    await outro.locator('#form-entrar').getByLabel('PIN do síndico').fill('2468');
    await outro.locator('#form-entrar').getByRole('button', { name: 'Entrar' }).click();
    await expect(outro.getByRole('heading', { level: 1, name: 'Prédio Online' })).toBeVisible();
    await expect(outro.locator('#premio-titulo-campo')).toHaveValue('Churrasco no salão');
    for (const c of [contextoSindico, contextoTelao, contextoOutro]) await c.close().catch(() => {});
  });
});

test.describe('placar online (servidor falso)', () => {
  // vários aparelhos ao mesmo tempo: mais folga quando a bateria inteira roda em paralelo
  test.describe.configure({ timeout: 60_000 });

  test('dois celulares entram pelo QR, cada um num andar, e o telão muda em menos de um segundo', async ({ browser }) => {
    const servidor = criarServidorFalso();
    const contextoTelao = await aparelho(browser, servidor, { width: 1280, height: 720 });
    const telao = await contextoTelao.newPage();
    await telao.goto(`telao/?predio=${CODIGO}&palco=1`);
    await expect(telao.locator('#t-predio')).toHaveText('Prédio do Palco');
    await expect(telao.locator('#t-status-texto')).toHaveText('Ao vivo');
    // QR code para o app, já no prédio, e o contador de pessoas
    const qr = telao.locator('#t-palco-qr');
    await expect(qr.locator('svg path')).toHaveCount(1);
    await expect(qr).toHaveAttribute('aria-label', new RegExp(`app/\\?predio=${CODIGO}&entrar=1`));
    await expect(telao.locator('#t-palco-pessoas')).toHaveText('0');

    const contextoA = await aparelho(browser, servidor);
    const celularA = await contextoA.newPage();
    await celularA.goto(`app/?predio=${CODIGO}&entrar=1`);
    await expect(celularA.locator('#entrada-andar')).toHaveText(/º andar/);
    await expect(celularA.locator('#aba-palco')).toBeVisible({ timeout: 5000 });
    const andarA = await numeroDoAndar(celularA);
    await expect(celularA).toHaveURL(/#palco$/);
    await expect(celularA).not.toHaveURL(/entrar=1/);
    await expect(celularA.locator('.a-palco__nota')).toHaveText('No palco, o botão faz o papel do sensor da lixeira.');
    await expect(telao.locator('#t-palco-pessoas')).toHaveText('1');

    const contextoB = await aparelho(browser, servidor);
    const celularB = await contextoB.newPage();
    await celularB.goto(`app/?predio=${CODIGO}&entrar=1`);
    await expect(celularB.locator('#aba-palco')).toBeVisible({ timeout: 5000 });
    expect(await numeroDoAndar(celularB)).not.toBe(andarA); // sempre o andar com menos gente
    await expect(telao.locator('#t-palco-pessoas')).toHaveText('2');

    // toque no celular A: o telão e o celular B veem em menos de um segundo
    const inicio = Date.now();
    await celularA.locator('.a-palco__botao[data-tipo="reciclavel"]').click();
    await expect(telao.locator(`.t-linha[data-andar="${andarA}"] .t-linha__pontos`)).toHaveText('10', { timeout: 1000 });
    expect(Date.now() - inicio).toBeLessThan(1000);
    await expect(celularA.locator('#palco-foto-reciclavel .lixeira')).toHaveAttribute('data-pulso', 'reciclavel');
    await expect(celularA.locator('#palco-posicao')).toHaveText('1º lugar · 10 pontos');
    await celularB.getByRole('link', { name: 'Ver o ranking do prédio' }).click();
    await expect(celularB.locator(`.linha[data-andar="${andarA}"]`)).toContainText('10');

    // entrar de novo pelo mesmo celular devolve o mesmo andar
    await celularA.goto(`app/?predio=${CODIGO}&entrar=1`);
    await expect(celularA.locator('#aba-palco')).toBeVisible({ timeout: 5000 });
    expect(await numeroDoAndar(celularA)).toBe(andarA);
    await expect(telao.locator('#t-palco-pessoas')).toHaveText('2');
    for (const c of [contextoTelao, contextoA, contextoB]) await c.close().catch(() => {});
  });

  test('a trava de 2 segundos vale no servidor e o botão espera', async ({ browser }) => {
    const servidor = criarServidorFalso();
    const contexto = await aparelho(browser, servidor);
    const celular = await contexto.newPage();
    await celular.goto(`app/?predio=${CODIGO}&entrar=1`);
    await expect(celular.locator('#aba-palco')).toBeVisible({ timeout: 5000 });
    const botao = celular.locator('.a-palco__botao[data-tipo="organico"]');
    await botao.click();
    await expect(botao).toBeDisabled();
    await expect(botao).toHaveClass(/esperando/);
    // mesmo forçando um segundo toque, o servidor recusa
    const codigo = await celular.evaluate(async () => {
      const dados = await import(new URL('../js/dados.js', location.href).href);
      const andar = await dados.obterMeuAndar();
      try {
        await dados.registrarDescarte(andar, 'organico', 'app');
        return 'aceitou';
      } catch (erro) {
        return erro.codigo;
      }
    });
    expect(codigo).toBe('devagar');
    await expect(botao).toBeEnabled({ timeout: 3000 });
    expect(servidor.banco.descartes).toHaveLength(1);
    await contexto.close();
  });

  test('sem internet, o toque espera na fila com o chip "Sem conexão" e vai quando a internet volta', async ({ browser }) => {
    const servidor = criarServidorFalso();
    const contextoTelao = await aparelho(browser, servidor, { width: 1280, height: 720 });
    const telao = await contextoTelao.newPage();
    await telao.goto(`telao/?predio=${CODIGO}`);
    await expect(telao.locator('#t-status-texto')).toHaveText('Ao vivo');

    const contexto = await aparelho(browser, servidor);
    const celular = await contexto.newPage();
    await celular.goto(`app/?predio=${CODIGO}&entrar=1`);
    await expect(celular.locator('#aba-palco')).toBeVisible({ timeout: 5000 });
    const andar = await numeroDoAndar(celular);

    await contexto.setOffline(true);
    await contextoTelao.setOffline(true);
    await expect(telao.locator('#t-status-texto')).toHaveText('Sem conexão');
    await celular.locator('.a-palco__botao[data-tipo="reciclavel"]').click();
    await expect(celular.locator('#conexao')).toBeVisible();
    await expect(celular.locator('#conexao-texto')).toHaveText('Sem conexão · 1 toque guardado');
    expect(servidor.banco.descartes).toHaveLength(0);
    // o telão continua de pé com o último placar
    await expect(telao.locator('#t-predio')).toHaveText('Prédio do Palco');

    await contextoTelao.setOffline(false);
    await contexto.setOffline(false);
    await expect(celular.locator('#conexao')).toBeHidden({ timeout: 8000 });
    await expect(telao.locator(`.t-linha[data-andar="${andar}"] .t-linha__pontos`)).toHaveText('10', { timeout: 8000 });
    expect(servidor.banco.descartes).toHaveLength(1);
    await contexto.close();
    await contextoTelao.close();
  });

  test('no painel online, desfazer pede o PIN do síndico', async ({ browser }) => {
    const servidor = criarServidorFalso();
    const contexto = await aparelho(browser, servidor, { width: 1280, height: 900 });
    const painel = await contexto.newPage();
    await painel.goto(`demo/?predio=${CODIGO}`);
    await expect(painel.locator('#d-aviso-texto')).toContainText(`código ${CODIGO}`);
    await expect(painel.locator('#d-restaurar')).toBeHidden();
    await expect(painel.locator('#d-zerar-texto')).toHaveText('Fechar o mês');
    await expect(painel.locator('.d-andar')).toHaveCount(6);

    await painel.locator('.d-andar[data-andar="2"]').getByRole('button', { name: /Reciclável/ }).click();
    await expect(painel.locator('.d-andar[data-andar="2"] .d-andar__pontos .numero')).toHaveText('10');
    await painel.locator('#d-desfazer').click();
    let dialogo = painel.getByRole('dialog', { name: 'PIN do síndico' });
    await expect(dialogo).toBeVisible();
    await dialogo.getByLabel('PIN').fill('9999');
    await dialogo.getByRole('button', { name: 'Continuar' }).click();
    dialogo = painel.getByRole('dialog', { name: 'PIN do síndico' });
    await expect(dialogo).toContainText('PIN errado');
    await dialogo.getByLabel('PIN').fill('1234');
    await dialogo.getByRole('button', { name: 'Continuar' }).click();
    await expect(painel.locator('.d-andar[data-andar="2"] .d-andar__pontos .numero')).toHaveText('0');
    expect(servidor.banco.descartes).toHaveLength(0);
    await contexto.close();
  });
});

test.describe('sem o placar online configurado', () => {
  test('?predio= cai no prédio de exemplo e o telão no palco explica o que falta', async ({ page }) => {
    await page.goto(`telao/?predio=${CODIGO}&palco=1`);
    await expect(page.locator('#t-palco-titulo')).toHaveText('O modo palco precisa do placar online');
    await expect(page.locator('#t-palco-qr')).toBeHidden();
    await expect(page.locator('.t-linha').first()).toHaveAttribute('data-andar', '4'); // o prédio de exemplo
  });

  test('o app aberto pelo QR sem o placar online avisa e fica no app normal', async ({ page }) => {
    await page.goto(`app/?predio=${CODIGO}&entrar=1&andar=7`);
    await expect(page.locator('.avisos')).toContainText('O modo palco precisa do placar online');
    await expect(page.locator('#aba-inicio')).toBeVisible();
    await expect(page).not.toHaveURL(/entrar=1/);
  });

  test('plano B: o telão com ?simular=1 faz descartes sozinho, sem internet', async ({ page, context }) => {
    await page.goto('telao/?simular=1');
    await expect(page.locator('#t-status-texto')).toHaveText('Demonstração');
    const antes = Number((await page.locator('#t-total').textContent()).replace(/\D/g, ''));
    await context.setOffline(true);
    await expect.poll(async () => Number((await page.locator('#t-total').textContent()).replace(/\D/g, '')), { timeout: 8000 }).toBeGreaterThan(antes);
    await context.setOffline(false);
  });

  test('a página inicial usa sempre o prédio de exemplo, mesmo num aparelho que abriu um prédio online', async ({ page, context }) => {
    await context.route('**/js/config.js', (rota) => rota.fulfill({ contentType: 'text/javascript', body: CONFIG_ONLINE }));
    await page.addInitScript(() => localStorage.setItem('recicla-slide:predio:v1', JSON.stringify('TESTE1')));
    await page.goto('./');
    await expect(page.locator('#demo-status')).toContainText('7º andar');
    await expect(page.locator('#demo-lista .linha').first()).toHaveAttribute('data-andar', '4');
  });
});

test.describe('supabase-js de verdade', () => {
  test('carrega a biblioteca e conversa com a API do Supabase (REST imitada)', async ({ page, context }) => {
    await context.route('**/js/config.js', (rota) => rota.fulfill({ contentType: 'text/javascript', body: CONFIG_ONLINE }));
    const chamadas = [];
    const predio = {
      id: 'predio-rest-1',
      codigo: CODIGO,
      nome: 'Prédio pela API',
      andares: 5,
      aptos_por_andar: 4,
      premio_titulo: null,
      premio_patrocinador: null,
      mes_inicio: '2026-11-01T00:00:00+00:00',
      participantes: 0,
    };
    let proximoId = 1;
    const descartes = [];
    await context.route('https://falso.supabase.co/**', async (rota) => {
      const pedido = rota.request();
      const url = new URL(pedido.url());
      chamadas.push(`${pedido.method()} ${url.pathname}${url.search}`);
      expect(pedido.headers().apikey).toBe('chave-anon-de-teste');
      const json = (corpo) => rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });
      if (url.pathname === '/rest/v1/predios_publicos') {
        const umSo = (pedido.headers().accept ?? '').includes('vnd.pgrst.object');
        return json(umSo ? predio : [predio]);
      }
      if (url.pathname === '/rest/v1/placar_publico') {
        const linhas = {};
        for (const d of descartes) {
          linhas[d.andar] ??= { andar: d.andar, reciclavel: 0, organico: 0 };
          linhas[d.andar][d.tipo] += 1;
        }
        return json(Object.values(linhas));
      }
      if (url.pathname === '/rest/v1/descartes') return json([...descartes].reverse());
      if (url.pathname === '/rest/v1/rpc/registrar_descarte') {
        const a = pedido.postDataJSON();
        const linha = { id: proximoId++, predio_id: predio.id, andar: a.p_andar, tipo: a.p_tipo, origem: a.p_origem, aparelho: a.p_aparelho, criado_em: new Date().toISOString() };
        descartes.push(linha);
        return json(linha);
      }
      return rota.fulfill({ status: 404, body: '{}' });
    });

    await page.goto(`telao/?predio=${CODIGO}`);
    await expect(page.locator('#t-predio')).toHaveText('Prédio pela API');
    expect(chamadas.some((c) => c.startsWith(`GET /rest/v1/predios_publicos?select=*&codigo=eq.${CODIGO}`))).toBe(true);
    expect(chamadas.some((c) => c.startsWith(`GET /rest/v1/placar_publico?select=andar%2Creciclavel%2Corganico%2Cultimo_em&codigo=eq.${CODIGO}`))).toBe(true);

    // um descarte pelo painel no mesmo navegador chega ao telão (pela conferência periódica, sem o Realtime)
    const painel = await context.newPage();
    await painel.goto(`demo/?predio=${CODIGO}`);
    await painel.locator('.d-andar[data-andar="3"]').getByRole('button', { name: /Orgânico/ }).click();
    expect(chamadas.some((c) => c === 'POST /rest/v1/rpc/registrar_descarte')).toBe(true);
    await expect(page.locator('.t-linha[data-andar="3"] .t-linha__pontos')).toHaveText('10', { timeout: 6000 });
  });
});
