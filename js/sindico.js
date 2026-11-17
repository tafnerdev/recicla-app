/**
 * Recicla Slide: painel do síndico (/sindico).
 *
 * Sem prédio aberto: cadastrar prédio, entrar com código e PIN, ou abrir o prédio de
 * exemplo. Com ?predio=CODIGO e o PIN digitado nesta aba: visão do mês, alertas de
 * entupimento, prêmio, lixeiras, manutenção, etiquetas (QR, impressão e NFC) e fechar o mês.
 * Tudo passa pelo js/dados.js, online (Supabase) ou neste navegador (js/local.js).
 */
import * as dados from './dados.js';
import { avisar, confirmar, el, formatarNumero, icone, nomeAndar, nomeMes, ordinal, prepararAvisos, rotuloPontos, tempoRelativo, textoErroCarregar, vibrar } from './comum.js';
import { svgDoQr } from './qr.js';

const $ = (id) => document.getElementById(id);
const parametros = new URLSearchParams(location.search);
const codigoDaUrl = (parametros.get('predio') ?? '').trim().toUpperCase();

const MES_MS = 30.44 * 24 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

const estado = {
  sindico: null,
  placar: null,
  premioMexido: false, // não sobrescreve o que o síndico está digitando
  gravandoNfc: false,
  atualizando: 0,
};

/* ------------------------------------------------------------------ */
/* Telas                                                               */
/* ------------------------------------------------------------------ */

function mostrar(id) {
  for (const tela of ['s-carregando', 's-erro', 's-inicio', 's-pin', 's-painel']) $(tela).hidden = tela !== id;
}

function mostrarErroForm(id, mensagem) {
  const caixa = $(id);
  caixa.textContent = mensagem;
  caixa.hidden = !mensagem;
}

function mostrarInicio(aviso = '') {
  mostrar('s-inicio');
  $('s-sair').hidden = true;
  $('s-onde').textContent = dados.placarOnlineLigado()
    ? 'O placar online está ligado: o prédio cadastrado aqui aparece em qualquer celular.'
    : 'O placar online ainda não está ligado: o prédio cadastrado aqui fica neste navegador, para experimentar. Com o Supabase ligado (PENDENCIAS.md, item 8), ele vale para todos os celulares.';
  $('s-inicio-aviso').textContent = aviso;
  $('s-inicio-aviso').hidden = !aviso;
}

function mostrarPedirPin(codigo) {
  mostrar('s-pin');
  $('s-pin-codigo').textContent = codigo;
  $('pin-pin').focus();
}

function mostrarErro(erro) {
  mostrar('s-erro');
  const caixa = $('s-erro');
  caixa.replaceChildren(
    el('h1', {}, 'Não deu para abrir o painel'),
    el('p', {}, erro?.message || textoErroCarregar(erro)),
    el('a', { class: 'botao botao--vidro', href: './' }, 'Voltar ao início do painel'),
  );
}

/* ------------------------------------------------------------------ */
/* Formulários do início                                               */
/* ------------------------------------------------------------------ */

function irPara(codigo, extra = '') {
  location.assign(`./?predio=${encodeURIComponent(codigo)}${extra}`);
}

function ligarFormularios() {
  $('form-cadastro').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const f = evento.currentTarget;
    const nome = f.nome.value.trim();
    const andares = Number(f.andares.value);
    const aptos = Number(f.aptos.value);
    const pin = f.pin.value.trim();
    let erro = '';
    if (nome.length < 2) erro = 'Escreva o nome do prédio.';
    else if (!Number.isInteger(andares) || andares < 2 || andares > 60) erro = 'O prédio precisa ter de 2 a 60 andares.';
    else if (!Number.isInteger(aptos) || aptos < 1 || aptos > 20) erro = 'Use de 1 a 20 apartamentos por andar.';
    else if (!/^[0-9]{4,6}$/.test(pin)) erro = 'O PIN precisa ter de 4 a 6 números.';
    else if (pin !== f.pin2.value.trim()) erro = 'Os dois PINs não são iguais.';
    mostrarErroForm('cadastro-erro', erro);
    if (erro) return;
    const botao = f.querySelector('[type="submit"]');
    botao.disabled = true;
    try {
      const { codigo } = await dados.cadastrarPredio({ nome, andares, aptosPorAndar: aptos, pin });
      irPara(codigo, '&novo=1');
    } catch (falha) {
      mostrarErroForm('cadastro-erro', falha.message);
      botao.disabled = false;
    }
  });

  $('form-entrar').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const f = evento.currentTarget;
    const botao = f.querySelector('[type="submit"]');
    botao.disabled = true;
    try {
      const { codigo } = await dados.entrarComoSindico(f.codigo.value, f.pin.value.trim());
      irPara(codigo);
    } catch (falha) {
      mostrarErroForm('entrar-erro', falha.message);
      botao.disabled = false;
    }
  });
  $('ent-codigo').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  $('form-pin').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const pin = evento.currentTarget.pin.value.trim();
    try {
      await dados.entrarComoSindico(codigoDaUrl, pin);
      mostrarErroForm('pin-erro', '');
      await abrirPainel();
    } catch (falha) {
      mostrarErroForm('pin-erro', falha.message);
    }
  });

  $('abrir-exemplo').addEventListener('click', async (evento) => {
    evento.currentTarget.disabled = true;
    try {
      const { codigo } = await dados.abrirPredioExemplo();
      irPara(codigo);
    } catch (falha) {
      avisar(falha.message || 'Não deu para abrir o exemplo.', { tipo: 'erro' });
      evento.currentTarget.disabled = false;
    }
  });

  $('s-sair').addEventListener('click', () => {
    dados.definirPinSindico('');
    location.assign('./');
  });
}

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

function enderecoDe(caminho) {
  return new URL(caminho, location.href).href;
}

function links(codigo) {
  const c = encodeURIComponent(codigo);
  return {
    app: enderecoDe(`../app/?predio=${c}`),
    telao: enderecoDe(`../telao/?predio=${c}`),
    demo: enderecoDe(`../demo/?predio=${c}`),
    andar: (n) => enderecoDe(`../app/?predio=${c}&andar=${n}`),
  };
}

const semProtocolo = (url) => url.replace(/^https?:\/\//, '');

async function abrirPainel() {
  mostrar('s-carregando');
  try {
    [estado.placar, estado.sindico] = await Promise.all([dados.obterPlacar(), dados.obterSindico()]);
  } catch (erro) {
    mostrarErro(erro);
    return;
  }
  // ouve desde já: o que mudar enquanto o painel monta também aparece
  dados.aoMudar((placar) => {
    estado.placar = placar;
    agendarAtualizacao();
  });
  const s = estado.sindico;
  mostrar('s-painel');
  $('s-sair').hidden = false;
  document.title = `${s.nome} | Painel do síndico`;

  const l = links(s.codigo);
  $('s-codigo').textContent = s.codigo;
  $('s-onde-chip').textContent = s.local ? 'Neste navegador' : 'Online';
  $('s-exemplo-chip').hidden = !s.exemplo;
  $('s-aviso-exemplo').hidden = !s.exemplo;
  $('s-link-app').href = l.app;
  $('s-link-telao').href = l.telao;
  $('s-link-demo').href = l.demo;
  for (const link of document.querySelectorAll('[data-icone-fim]')) {
    if (!link.querySelector('svg')) link.insertAdjacentHTML('beforeend', icone(link.dataset.iconeFim));
  }

  if (parametros.get('novo') === '1') await mostrarNovo(s, l);
  renderizar();
  await renderizarEtiquetas();
  ligarPainel();
  $('s-nome').focus({ preventScroll: true });
}

async function mostrarNovo(s, l) {
  $('s-novo').hidden = false;
  $('s-novo-codigo').textContent = s.codigo;
  $('s-novo-local').hidden = !s.local;
  for (const [tipo, endereco] of [['app', l.app], ['telao', l.telao]]) {
    const link = $(`s-novo-link-${tipo}`);
    link.href = endereco;
    link.textContent = semProtocolo(endereco);
    const qr = $(`s-novo-qr-${tipo}`);
    qr.innerHTML = await svgDoQr(endereco);
    qr.setAttribute('role', 'img');
    qr.setAttribute('aria-label', `QR code: ${endereco}`);
  }
  $('s-novo-fechar').addEventListener('click', () => {
    $('s-novo').hidden = true;
    history.replaceState(null, '', `./?predio=${encodeURIComponent(s.codigo)}`);
    $('mes').scrollIntoView({ block: 'start' });
  });
}

/** Várias mudanças seguidas (descartes ao vivo) viram uma atualização só. */
function agendarAtualizacao() {
  clearTimeout(estado.atualizando);
  estado.atualizando = setTimeout(async () => {
    try {
      estado.sindico = await dados.obterSindico();
      renderizar();
    } catch (erro) {
      console.warn('[Recicla Slide] painel não atualizou:', erro);
    }
  }, 300);
}

function renderizar() {
  const s = estado.sindico;
  $('s-nome').textContent = s.nome;
  const aptos = s.andares * s.aptosPorAndar;
  $('s-tamanho').textContent = `${s.andares} andares · ${s.aptosPorAndar} apartamentos por andar · ${aptos} apartamentos`;
  renderizarMes();
  renderizarAlertas();
  renderizarPremio();
  renderizarLixeiras();
  renderizarManutencao();
  renderizarCampeoes();
}

/* ------------------------------ Mês ------------------------------- */

/** "16 de novembro" ("1º de dezembro" no primeiro dia) */
function dataLonga(iso) {
  const d = new Date(iso);
  const mes = d.toLocaleDateString('pt-BR', { month: 'long' });
  return `${d.getDate() === 1 ? '1º' : d.getDate()} de ${mes}`;
}
const dataCurta = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

function quando(iso) {
  if (!iso) return 'Nenhum este mês';
  const passou = Date.now() - Date.parse(iso);
  if (passou < 12 * 60 * 60 * 1000) return tempoRelativo(iso);
  return `${dataCurta(iso)}, ${new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function diaIso(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function renderizarMes() {
  const s = estado.sindico;
  const { totais, ranking } = estado.placar;
  const inicio = new Date(s.mesInicio);
  $('mes-titulo').textContent = `Visão de ${nomeMes(new Date())}`;
  $('mes-desde').textContent = `Desde ${dataLonga(s.mesInicio)}.`;
  $('mes-total').textContent = formatarNumero(totais.descartes);
  $('mes-reciclavel').textContent = formatarNumero(totais.reciclavel);
  $('mes-organico').textContent = formatarNumero(totais.organico);
  const lider = ranking[0];
  $('mes-lider').textContent = lider && lider.pontos > 0 ? `${nomeAndar(lider.andar)} · ${rotuloPontos(lider.pontos)}` : 'Nenhum ainda';

  // um dia por barra, do começo do mês (ou do último fechamento) até hoje
  const porDia = new Map(s.resumo.map((d) => [d.dia, d]));
  const dias = [];
  for (let d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()); d <= new Date(); d = new Date(d.getTime() + DIA_MS)) {
    const chave = diaIso(d);
    if (dias.at(-1)?.dia === chave) continue; // horário de verão
    dias.push({ dia: chave, data: new Date(d), reciclavel: porDia.get(chave)?.reciclavel ?? 0, organico: porDia.get(chave)?.organico ?? 0 });
  }
  desenharGrafico(dias);
}

function desenharGrafico(dias) {
  const area = $('mes-barras');
  const maximo = Math.max(1, ...dias.map((d) => d.reciclavel + d.organico));
  const largura = Math.max(dias.length * 14, 280);
  const altura = 140;
  const passo = largura / Math.max(dias.length, 1);
  const barra = Math.max(4, Math.min(18, passo * 0.62));
  let svg = '';
  dias.forEach((d, i) => {
    const x = i * passo + (passo - barra) / 2;
    const hR = (d.reciclavel / maximo) * (altura - 4);
    const hO = (d.organico / maximo) * (altura - 4);
    const titulo = `${d.data.getDate()}: ${d.reciclavel} recicláveis, ${d.organico} orgânicos`;
    svg += `<g><title>${titulo}</title>`;
    if (hR > 0) svg += `<rect class="s-barra-r" x="${x.toFixed(1)}" y="${(altura - hR).toFixed(1)}" width="${barra.toFixed(1)}" height="${hR.toFixed(1)}" rx="2"/>`;
    if (hO > 0) svg += `<rect class="s-barra-o" x="${x.toFixed(1)}" y="${(altura - hR - hO - (hR > 0 ? 2 : 0)).toFixed(1)}" width="${barra.toFixed(1)}" height="${hO.toFixed(1)}" rx="2"/>`;
    if (hR + hO === 0) svg += `<rect class="s-barra-zero" x="${x.toFixed(1)}" y="${altura - 2}" width="${barra.toFixed(1)}" height="2" rx="1"/>`;
    svg += '</g>';
  });
  // os números dos dias ficam em HTML, embaixo: o SVG estica na largura e o texto não
  const rotulos = dias
    .map((d, i) => `<span>${i === 0 || i === dias.length - 1 || d.data.getDate() % 5 === 0 ? d.data.getDate() : ''}</span>`)
    .join('');
  area.innerHTML = `<svg viewBox="0 0 ${largura} ${altura}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${svg}</svg><div class="s-grafico__dias" aria-hidden="true">${rotulos}</div>`;
  area.style.setProperty('--colunas', dias.length);

  const tabela = $('mes-tabela');
  tabela.replaceChildren(
    el('caption', {}, 'Descartes por dia'),
    el('tr', {}, el('th', { scope: 'col' }, 'Dia'), el('th', { scope: 'col' }, 'Recicláveis'), el('th', { scope: 'col' }, 'Orgânicos')),
    ...dias.map((d) => el('tr', {}, el('th', { scope: 'row' }, dataCurta(d.data)), el('td', {}, String(d.reciclavel)), el('td', {}, String(d.organico)))),
  );
}

/* ---------------------------- Alertas ----------------------------- */

const nomeTubo = (tipo) => (tipo === 'organico' ? 'Tubo de orgânicos' : 'Tubo de recicláveis');

function renderizarAlertas() {
  const { alertas } = estado.sindico;
  const lista = $('s-alertas');
  $('s-alertas-vazio').hidden = alertas.length > 0;
  lista.hidden = !alertas.length;
  const conta = $('s-conta-alertas');
  conta.hidden = !alertas.length;
  conta.textContent = String(alertas.length);
  lista.replaceChildren(
    ...alertas.map((a) =>
      el(
        'li',
        { class: 's-alerta', 'data-andar': String(a.andar) },
        el('span', { class: 's-alerta__icone', 'aria-hidden': 'true' }),
        el(
          'div',
          { class: 's-alerta__textos' },
          el('p', { class: 's-alerta__titulo' }, `Possível entupimento entre o ${ordinal(a.andar)} e o térreo`),
          el('p', { class: 's-alerta__sub' }, `${nomeTubo(a.tipo)} · ${quando(a.em)}. Um descarte entrou no ${nomeAndar(a.andar)} e não chegou à central.`),
        ),
        el(
          'button',
          {
            type: 'button',
            class: 'botao botao--vidro',
            onclick: async (e) => {
              e.currentTarget.disabled = true;
              try {
                await dados.resolverAlerta(a.id);
                avisar('Alerta resolvido.');
              } catch (erro) {
                avisar(erro.message, { tipo: 'erro' });
                e.currentTarget.disabled = false;
              }
            },
          },
          'Marcar como resolvido',
        ),
      ),
    ),
  );
}

/* ----------------------------- Prêmio ----------------------------- */

function renderizarPremio() {
  if (estado.premioMexido) return;
  const { premio } = estado.sindico;
  const f = $('form-premio');
  f.titulo.value = premio.titulo;
  f.patrocinador.value = premio.patrocinador;
  f.exemplo.checked = premio.exemplo;
}

/* ---------------------------- Lixeiras ---------------------------- */

function hashTexto(texto) {
  let h = 2166136261;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** Estado e pilhas simulados (sem sensores ainda), sempre os mesmos para o mesmo prédio. */
function lixeiraSimulada(s, andar, tipo) {
  const h = hashTexto(`${s.codigo}:${andar}:${tipo}`);
  const dias = (Date.now() - Date.parse(s.manutencao.pilhasEm)) / DIA_MS;
  const pilhas = Math.max(4, Math.min(100, Math.round(100 - (dias / 91) * 90 - (h % 12))));
  const andarSemSinal = s.andares >= 6 ? 1 + (hashTexto(s.codigo) % s.andares) : 0;
  const entupida = s.alertas.some((a) => a.andar === andar && a.tipo === tipo);
  const estadoTexto = entupida ? 'Possível entupimento' : andar === andarSemSinal && tipo === 'organico' ? 'Sem sinal' : 'Conectada';
  return { pilhas, estado: estadoTexto, classe: entupida ? 'alerta' : estadoTexto === 'Sem sinal' ? 'sem-sinal' : 'ok' };
}

function celulaEstado(lixeira) {
  return el('td', {}, el('span', { class: `s-estado s-estado--${lixeira.classe}` }, el('span', { class: 's-estado__ponto', 'aria-hidden': 'true' }), lixeira.estado));
}

function renderizarLixeiras() {
  const s = estado.sindico;
  const linhas = [];
  for (let andar = 1; andar <= s.andares; andar += 1) {
    const r = lixeiraSimulada(s, andar, 'reciclavel');
    const o = lixeiraSimulada(s, andar, 'organico');
    const pilhas = Math.min(r.pilhas, o.pilhas);
    linhas.push(
      el(
        'tr',
        { 'data-andar': String(andar) },
        el('th', { scope: 'row' }, nomeAndar(andar)),
        celulaEstado(r),
        celulaEstado(o),
        el('td', { class: 's-tabela__quando' }, quando(s.ultimos[andar])),
        el(
          'td',
          {},
          el(
            'span',
            { class: `s-pilhas${pilhas < 20 ? ' s-pilhas--baixa' : ''}` },
            el('span', { class: 's-pilhas__barra', style: `--nivel: ${pilhas}%`, 'aria-hidden': 'true' }),
            el('span', { class: 'numero' }, `${pilhas}%`),
          ),
        ),
      ),
    );
  }
  $('s-lixeiras').replaceChildren(...linhas);
}

/* --------------------------- Manutenção --------------------------- */

const ITENS = [
  { item: 'limpeza', titulo: 'Limpeza dos tubos', meses: 3, campo: 'limpezaEm', botao: 'Limpeza feita hoje' },
  { item: 'inspecao', titulo: 'Inspeção das portinholas corta-fogo', meses: 1, campo: 'inspecaoEm', botao: 'Inspeção feita hoje' },
  { item: 'pilhas', titulo: 'Troca das pilhas dos sensores', meses: 3, campo: 'pilhasEm', botao: 'Pilhas trocadas hoje' },
];

function somarMeses(iso, meses) {
  const d = new Date(iso);
  const dia = d.getDate();
  d.setMonth(d.getMonth() + meses);
  if (d.getDate() !== dia) d.setDate(0); // 31/01 + 1 mês = 28/02
  return d;
}

function renderizarManutencao() {
  const { manutencao } = estado.sindico;
  $('s-manutencao').replaceChildren(
    ...ITENS.map(({ item, titulo, meses, campo, botao }) => {
      const ultima = manutencao[campo];
      const proxima = somarMeses(ultima, meses);
      const faltam = Math.ceil((proxima - Date.now()) / DIA_MS);
      const situacao = faltam < 0 ? `Atrasada há ${-faltam} ${-faltam === 1 ? 'dia' : 'dias'}` : faltam === 0 ? 'Vence hoje' : faltam <= 7 ? `Vence em ${faltam} ${faltam === 1 ? 'dia' : 'dias'}` : 'Em dia';
      return el(
        'li',
        { class: `s-manut${faltam < 0 ? ' s-manut--atrasada' : faltam <= 7 ? ' s-manut--perto' : ''}`, 'data-item': item },
        el(
          'div',
          { class: 's-manut__textos' },
          el('p', { class: 's-manut__titulo' }, titulo),
          el('p', { class: 's-manut__quando' }, `Próxima: ${dataLonga(proxima.toISOString())} · ${meses === 1 ? 'todo mês' : `a cada ${meses} meses`}`),
          el('p', { class: 's-manut__ultima' }, `Última: ${dataLonga(ultima)}`),
        ),
        el('span', { class: 'chip s-manut__situacao' }, situacao),
        el(
          'button',
          {
            type: 'button',
            class: 'botao botao--vidro',
            onclick: async (e) => {
              e.currentTarget.disabled = true;
              try {
                await dados.registrarManutencao(item);
                avisar(`${titulo}: registrado hoje.`);
              } catch (erro) {
                avisar(erro.message, { tipo: 'erro' });
              } finally {
                e.currentTarget.disabled = false;
              }
            },
          },
          botao,
        ),
      );
    }),
  );
}

/* ---------------------------- Etiquetas --------------------------- */

const temNfc = () => 'NDEFReader' in globalThis;

async function renderizarEtiquetas() {
  const s = estado.sindico;
  const l = links(s.codigo);
  $('s-nfc-texto').textContent = temNfc()
    ? 'Este celular grava etiquetas NFC: toque em “Gravar etiqueta NFC” e encoste o celular na etiqueta.'
    : 'Este navegador não grava NFC (só o Chrome do Android grava). Use “Como gravar” para gravar com um app, ou imprima o QR code.';
  const itens = [];
  for (let andar = 1; andar <= s.andares; andar += 1) {
    const endereco = l.andar(andar);
    const status = el('p', { class: 's-etiqueta__status', role: 'status' });
    const qr = el('div', { class: 's-qr s-qr--pequeno', role: 'img', 'aria-label': `QR code do ${nomeAndar(andar)}` });
    qr.innerHTML = await svgDoQr(endereco);
    itens.push(
      el(
        'li',
        { class: 's-etiqueta', 'data-andar': String(andar) },
        qr,
        el(
          'div',
          { class: 's-etiqueta__textos' },
          el('p', { class: 's-etiqueta__andar' }, nomeAndar(andar)),
          el('a', { class: 's-link-longo', href: endereco, target: 'app-recicla' }, semProtocolo(endereco)),
          status,
        ),
        el(
          'div',
          { class: 's-etiqueta__acoes' },
          el('button', { type: 'button', class: 'botao botao--vidro', onclick: () => copiar(endereco) }, 'Copiar link'),
          temNfc()
            ? el('button', { type: 'button', class: 'botao', onclick: (e) => gravarNfc(endereco, e.currentTarget, status) }, 'Gravar etiqueta NFC')
            : el('button', { type: 'button', class: 'botao botao--vidro', onclick: () => comoGravar(andar, endereco) }, 'Como gravar'),
        ),
      ),
    );
  }
  $('s-etiquetas').replaceChildren(...itens);
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    avisar('Link copiado.');
  } catch {
    avisar(`Copie à mão: ${texto}`);
  }
}

/** Web NFC (Chrome do Android): grava um registro de URL na etiqueta. */
async function gravarNfc(endereco, botao, status) {
  if (estado.gravandoNfc) return;
  estado.gravandoNfc = true;
  botao.disabled = true;
  const controle = new AbortController();
  const tempo = setTimeout(() => controle.abort(), 30_000);
  status.textContent = 'Encoste o celular na etiqueta…';
  try {
    const leitor = new globalThis.NDEFReader();
    await leitor.write({ records: [{ recordType: 'url', data: endereco }] }, { signal: controle.signal });
    status.textContent = 'Etiqueta gravada. Encoste de novo para testar.';
    vibrar();
  } catch (erro) {
    status.textContent =
      erro?.name === 'NotAllowedError'
        ? 'O NFC não foi permitido. Ligue o NFC nas configurações e permita o acesso.'
        : erro?.name === 'AbortError'
          ? 'Passou o tempo sem encostar. Toque de novo para tentar.'
          : erro?.name === 'NotSupportedError'
            ? 'Este celular não tem NFC.'
            : `Não gravou: ${erro?.message || 'erro desconhecido'}.`;
  } finally {
    clearTimeout(tempo);
    estado.gravandoNfc = false;
    botao.disabled = false;
  }
}

/** Sem Web NFC: o passo a passo do docs/etiqueta-nfc.md, com o link do andar. */
function comoGravar(andar, endereco) {
  const dialogo = el(
    'dialog',
    { class: 'dialogo s-como', 'aria-labelledby': 'como-titulo' },
    el('h2', { id: 'como-titulo' }, `Gravar a etiqueta do ${nomeAndar(andar)}`),
    el('p', {}, 'Com o app gratuito NFC Tools (Android e iPhone):'),
    el(
      'ol',
      { class: 's-como__passos' },
      el('li', {}, 'Abra o NFC Tools e toque em Escrever.'),
      el('li', {}, 'Toque em Adicionar um registro e escolha URL / URI.'),
      el('li', {}, 'Cole o link do andar (abaixo) e confirme.'),
      el('li', {}, 'Toque em Escrever e encoste o celular na etiqueta até aparecer a confirmação.'),
      el('li', {}, 'Teste: com a tela destravada, encoste o celular. O app deve abrir no andar certo.'),
    ),
    el('p', { class: 's-como__link' }, el('span', { class: 's-link-longo' }, endereco)),
    el('p', { class: 's-como__dica' }, 'Lixeira de metal atrapalha o NFC: use etiqueta anti-metal. Cabe numa NTAG213, a mais barata. Do lado, cole também o QR code impresso.'),
    el(
      'div',
      { class: 'dialogo__acoes' },
      el('button', { type: 'button', class: 'botao botao--vidro', onclick: () => copiar(endereco) }, 'Copiar link'),
      el('button', { type: 'button', class: 'botao', onclick: () => dialogo.close() }, 'Fechar'),
    ),
  );
  dialogo.addEventListener('close', () => dialogo.remove());
  document.body.append(dialogo);
  dialogo.showModal();
}

/** Folha de etiquetas: um cartão por andar, com o QR code grande, para imprimir e colar. */
async function imprimirEtiquetas() {
  const s = estado.sindico;
  const l = links(s.codigo);
  const folha = $('s-impressao');
  const cartoes = [];
  for (let andar = 1; andar <= s.andares; andar += 1) {
    const endereco = l.andar(andar);
    const qr = el('div', { class: 's-imp__qr' });
    qr.innerHTML = await svgDoQr(endereco);
    cartoes.push(
      el(
        'div',
        { class: 's-imp__cartao' },
        el('p', { class: 's-imp__predio' }, s.nome),
        el('p', { class: 's-imp__andar' }, nomeAndar(andar)),
        qr,
        el('p', { class: 's-imp__texto' }, 'Encoste o celular ou aponte a câmera para pontuar no seu nome'),
        el('p', { class: 's-imp__link' }, semProtocolo(endereco)),
      ),
    );
  }
  folha.replaceChildren(...cartoes);
  print();
}

/* --------------------------- Fechar o mês ------------------------- */

function renderizarCampeoes() {
  const { campeoes } = estado.sindico;
  $('s-campeoes-vazio').hidden = campeoes.length > 0;
  $('s-campeoes').hidden = !campeoes.length;
  $('s-campeoes').replaceChildren(
    ...campeoes.map((c) => {
      const mes = new Date(c.inicio).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return el(
        'li',
        { class: 's-campeao' },
        el('span', { class: 's-campeao__mes' }, mes.charAt(0).toUpperCase() + mes.slice(1)),
        el('span', { class: 's-campeao__andar' }, c.andar ? nomeAndar(c.andar) : 'Sem descartes'),
        el('span', { class: 's-campeao__pontos numero' }, rotuloPontos(c.pontos)),
      );
    }),
  );
}

async function fecharMes() {
  const { ranking } = estado.placar;
  const lider = ranking[0]?.pontos > 0 ? ranking[0] : null;
  const ok = await confirmar({
    titulo: `Fechar o mês de ${nomeMes(new Date())}?`,
    texto: lider
      ? `O ${nomeAndar(lider.andar)} fica guardado como campeão, com ${rotuloPontos(lider.pontos)}, e o placar de todas as telas volta a zero. Não dá para desfazer.`
      : 'Ninguém pontuou ainda. O placar de todas as telas recomeça do zero. Não dá para desfazer.',
    confirmar: 'Fechar o mês',
    perigo: true,
  });
  if (!ok) return;
  try {
    await dados.zerarPlacar();
    avisar(lider ? `Mês fechado. Campeão: ${nomeAndar(lider.andar)}.` : 'Mês fechado.');
    agendarAtualizacao();
  } catch (erro) {
    avisar(erro.message, { tipo: 'erro' });
  }
}

/* ------------------------------------------------------------------ */

function ligarPainel() {
  const form = $('form-premio');
  form.addEventListener('input', () => {
    estado.premioMexido = true;
  });
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const botao = form.querySelector('[type="submit"]');
    botao.disabled = true;
    try {
      await dados.definirPremio({ titulo: form.titulo.value, patrocinador: form.patrocinador.value, exemplo: form.exemplo.checked });
      estado.premioMexido = false;
      avisar('Prêmio salvo. O app e o telão já mostram.');
    } catch (erro) {
      avisar(erro.message, { tipo: 'erro' });
    } finally {
      botao.disabled = false;
    }
  });
  $('s-imprimir').addEventListener('click', imprimirEtiquetas);
  $('s-fechar-mes').addEventListener('click', fecharMes);
  // o "há 3 min" das lixeiras e dos alertas anda sozinho
  setInterval(() => {
    if (!document.hidden && estado.sindico) {
      renderizarLixeiras();
      renderizarAlertas();
    }
  }, 30_000);
}

async function iniciar() {
  prepararAvisos();
  for (const caixa of document.querySelectorAll('[data-icone]')) caixa.innerHTML = icone(caixa.dataset.icone);
  ligarFormularios();

  if (!codigoDaUrl) {
    mostrarInicio();
    return;
  }
  try {
    await dados.iniciar();
  } catch (erro) {
    if (erro?.codigo === 'predio-nao-encontrado' || erro?.codigo === 'codigo-invalido') mostrarInicio(erro.message);
    else mostrarErro(erro);
    return;
  }
  const modo = await dados.modo();
  if (!modo.online) {
    mostrarInicio(`O prédio ${codigoDaUrl} não está neste navegador. Para abrir um prédio de outro aparelho, o placar online precisa estar ligado.`);
    return;
  }
  if (!(await dados.temPinSindico())) {
    mostrarPedirPin(modo.codigo);
    return;
  }
  await abrirPainel();
}

iniciar();
