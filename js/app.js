/**
 * Recicla Slide: app do morador (/app).
 * Duas abas (#inicio, #ranking) e a folha "Pontuar" (#pontuar), no mesmo arquivo.
 * O andar vem pela URL (?andar=7, o link da etiqueta NFC) ou fica guardado no aparelho.
 * Modo palco (#palco): quem abre ?predio=CODIGO&entrar=1 (o QR code do telão) é
 * colocado num andar e toca "Reciclável" ou "Orgânico" no lugar do sensor.
 */
import * as dados from './dados.js';
import {
  animarNumero,
  ajustarBarra,
  atualizarLinhaRanking,
  avisar,
  confirmar,
  criarLinhaRanking,
  el,
  formatarNumero,
  icone,
  ligarCabecalhoQueSome,
  marcarDescarte,
  mostrarEstado,
  nomeAndar,
  nomeMes,
  ordinal,
  prepararAvisos,
  pulsar,
  reordenarComAnimacao,
  rotuloDescartes,
  rotuloPontos,
  semMovimento,
  tempoRelativo,
  textoErroCarregar,
  vibrar,
} from './comum.js';
import { criarLixeira } from './lixeira.js';
import { montarPredio } from './predio.js';

const $ = (id) => document.getElementById(id);

const estado = {
  edificio: null,
  placar: null,
  pessoal: null,
  meuAndar: null,
  vindoDaEtiqueta: false,
  focoAntesDaFolha: null,
  aba: 'inicio',
  empilhouFolha: false,
  linhas: new Map(),
  predio: null,
  lixeiras: {}, // { reciclavel, organico }: as duas lixeiras do andar
  lixeirasPalco: {}, // as mesmas, na tela do palco
  modo: null, // { online, codigo, configurado, codigoSemConfig } (js/dados.js)
  ultimoToque: null, // último descarte pela etiqueta neste aparelho: { andar, tipo, em }
};

const mes = nomeMes();

/* ------------------------------------------------------------------ */
/* Início                                                              */
/* ------------------------------------------------------------------ */

async function iniciar() {
  prepararAvisos();
  for (const caixa of document.querySelectorAll('[data-icone]')) caixa.innerHTML = icone(caixa.dataset.icone);
  ligarCabecalhoQueSome(document.querySelector('.a-topo'), {
    travado: () => Boolean(document.querySelector('dialog[open]')),
  });

  try {
    await dados.iniciar();
    const [edificio, placar, pessoal] = await Promise.all([
      dados.obterEdificio(),
      dados.obterPlacar(),
      dados.obterPessoal(),
    ]);
    Object.assign(estado, { edificio, placar, pessoal });
    estado.modo = await dados.modo();
  } catch (erro) {
    console.error(erro);
    mostrarErro(erro);
    return;
  }

  const alerta = await resolverAndar();
  preencherTextosFixos();
  montarEscolha();
  estado.lixeiras = {
    reciclavel: criarLixeira({
      foto: 'verde',
      base: '../',
      descricao: 'Lixeira de recicláveis: corpo branco, tampa verde e anel de LED, presa ao seu tubo de aço.',
    }),
    organico: criarLixeira({
      foto: 'verde',
      tampa: 'marrom',
      base: '../',
      descricao: 'Lixeira de orgânicos: corpo branco, tampa marrom e anel de LED, presa ao seu tubo de aço.',
    }),
  };
  for (const [tipo, lixeira] of Object.entries(estado.lixeiras)) $(`lixeira-foto-${tipo}`).append(lixeira.elemento);
  estado.lixeirasPalco = {
    reciclavel: criarLixeira({ foto: 'verde', base: '../', descricao: '', carregamento: 'lazy' }),
    organico: criarLixeira({ foto: 'verde', tampa: 'marrom', base: '../', descricao: '', carregamento: 'lazy' }),
  };
  for (const [tipo, lixeira] of Object.entries(estado.lixeirasPalco)) $(`palco-foto-${tipo}`).append(lixeira.elemento);
  estado.predio = montarPredio($('predio'), {
    andares: estado.edificio.andares,
    aceso: estado.meuAndar,
    lider: liderUnico()?.andar ?? null,
    pontosAndares: pontosPorAndar(),
    modo: 'morador',
    rotulos: true,
    pontos: 'app',
    interativo: true,
    largura: null,
  });
  renderizar({ animar: false });
  renderizarPessoal(false);
  ligarEventos();

  $('carregando').hidden = true;
  aplicarRota({ entrada: true });

  const entrandoNoPalco = new URLSearchParams(location.search).get('entrar') === '1';
  if (entrandoNoPalco) entrarNoPalco();
  else if (!estado.meuAndar || alerta) abrirEscolha(alerta);
  // Quem encostou na etiqueta vê o Início com um aviso "Pontuar agora" (a folha não abre sozinha).
  atualizarAvisoEtiqueta();
  if (estado.modo.codigoSemConfig) {
    avisar('Este endereço é de um prédio online, mas o placar online ainda não foi ligado. Você está vendo o prédio de exemplo.', {
      duracao: 9000,
    });
  }
  dados.aoMudarConexao(mostrarConexao);

  dados.aoMudar(aoMudarPlacar);
  dados.aoMudarPessoal((pessoal) => {
    estado.pessoal = pessoal;
    renderizarPessoal(true);
  });
  setInterval(atualizarHora, 30_000);
  addEventListener('online', renderizarLixeira);
  addEventListener('offline', renderizarLixeira);
}

/** Lê ?andar= da URL. Devolve um texto de alerta se o andar não existir. */
async function resolverAndar() {
  const parametro = new URLSearchParams(location.search).get('andar');
  estado.meuAndar = await dados.obterMeuAndar();
  if (parametro === null) return null;

  const numero = Number(parametro);
  if (parametro.trim() !== '' && Number.isInteger(numero) && estado.edificio.andares.includes(numero)) {
    estado.meuAndar = await dados.definirMeuAndar(numero);
    estado.vindoDaEtiqueta = true;
    return null;
  }
  const texto = parametro.trim() === '' ? 'O link não diz qual é o andar.' : `O ${/^\d+$/.test(parametro) ? `${parametro}º andar` : `andar “${parametro}”`} não existe no ${estado.edificio.nome}.`;
  return `${texto} Escolha o seu andar abaixo.`;
}

/** Aviso de vidro no topo do Início para quem chegou pela etiqueta NFC (?andar=7). */
function atualizarAvisoEtiqueta() {
  const aviso = $('aviso-etiqueta');
  const mostrar = Boolean(estado.vindoDaEtiqueta && estado.meuAndar);
  if (mostrar) $('aviso-etiqueta-andar').textContent = nomeAndar(estado.meuAndar);
  aviso.hidden = !mostrar;
}

function preencherTextosFixos() {
  const { edificio } = estado;
  $('nome-predio').textContent = edificio.nome;
  $('ranking-mes').textContent = mes;
  $('destaque-unidade').textContent = `pontos em ${mes}`;
  $('pessoal-rotulo-mes').textContent = `seus pontos em ${mes}`;
  for (const botao of document.querySelectorAll('.pontuar__botoes .botao-tipo')) {
    botao.querySelector('[data-mais]').textContent = `+${edificio.pontosPorDescarte[botao.dataset.tipo]} no seu nome`;
  }
}

function mostrarErro(erro) {
  $('carregando').hidden = true;
  document.querySelector('.a-barra').hidden = true; // sem placar, as abas não levam a nada
  const caixa = $('erro');
  caixa.hidden = false;
  mostrarEstado(caixa, {
    tipo: 'erro',
    titulo: 'Não deu para abrir o placar',
    texto: textoErroCarregar(erro),
    acao: { rotulo: 'Tentar de novo', icone: 'atualizar', aoClicar: () => location.reload() },
  });
}

/* ------------------------------------------------------------------ */
/* Abas e folha pelo endereço (#inicio, #ranking, #pontuar)            */
/* ------------------------------------------------------------------ */

function lerRota() {
  const h = location.hash.replace('#', '');
  if (h === 'ranking') return { aba: 'ranking', folha: false };
  if (h === 'pontuar') return { aba: estado.aba, folha: true };
  if (h === 'palco' && estado.modo?.online && estado.meuAndar) return { aba: 'palco', folha: false };
  return { aba: 'inicio', folha: false };
}

function mostrarAba(aba, entrada) {
  const mudou = aba !== estado.aba || entrada;
  estado.aba = aba;
  document.body.dataset.aba = aba;
  for (const nome of ['inicio', 'ranking', 'palco']) {
    const secao = $(`aba-${nome}`);
    secao.hidden = nome !== aba;
    if (nome === aba && mudou) {
      secao.classList.remove('entrou');
      void secao.offsetWidth; // reinicia a entrada
      secao.classList.add('entrou');
    }
  }
  for (const item of document.querySelectorAll('.a-barra__item[data-aba]')) {
    if (item.dataset.aba === aba) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  }
  if (mudou && !entrada) scrollTo({ top: 0, behavior: 'instant' });
}

function aplicarRota({ entrada = false, vindoDeDentro = false } = {}) {
  const { aba, folha } = lerRota();
  mostrarAba(aba, entrada);
  const folhaPontuar = $('folha-pontuar');
  if (folha && estado.meuAndar) {
    if (!folhaPontuar.open) {
      estado.empilhouFolha = vindoDeDentro;
      abrirFolha(folhaPontuar);
    }
  } else if (folhaPontuar.open) {
    fecharFolha(folhaPontuar, devolverFoco);
  }
}

/** Depois de fechar a folha Pontuar, o foco volta a quem a abriu (ou ao item da barra). */
function devolverFoco() {
  const antes = estado.focoAntesDaFolha;
  estado.focoAntesDaFolha = null;
  const visivel = antes?.isConnected && antes.getClientRects().length > 0;
  (visivel ? antes : $('nav-pontuar')).focus();
}

/** Já pontuou pela etiqueta: o ?andar= sai do endereço (inclusive ao voltar no histórico). */
function limparAndarDaUrl() {
  if (estado.vindoDaEtiqueta) return;
  const url = new URL(location.href);
  if (!url.searchParams.has('andar')) return;
  url.searchParams.delete('andar');
  history.replaceState(history.state, '', url);
}

/** Fecha a folha Pontuar pelo botão, Esc ou toque no fundo, mantendo o histórico coerente. */
function pedirFechamentoPontuar() {
  if (estado.empilhouFolha) {
    estado.empilhouFolha = false;
    history.back(); // o hashchange fecha a folha
  } else {
    history.replaceState(null, '', `${location.pathname}${location.search}#${estado.aba}`);
    fecharFolha($('folha-pontuar'), devolverFoco);
  }
}

function abrirFolha(folha) {
  folha.classList.remove('fechando');
  if (folha.open) return;
  if (folha.id === 'folha-pontuar') estado.focoAntesDaFolha = document.activeElement;
  folha.showModal();
}

function fecharFolha(folha, depois) {
  if (!folha.open || folha.classList.contains('fechando')) return;
  const terminar = () => {
    folha.classList.remove('fechando');
    folha.close();
    depois?.();
  };
  if (semMovimento()) {
    terminar();
    return;
  }
  folha.classList.add('fechando');
  setTimeout(terminar, 220);
}

/** Clique no fundo escurecido (fora da folha) fecha. */
function aoClicarFora(folha, fechar) {
  folha.addEventListener('click', (e) => {
    if (e.target !== folha) return;
    const r = folha.getBoundingClientRect();
    const fora = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (fora) fechar();
  });
}

/* ------------------------------------------------------------------ */
/* Escolha do andar                                                    */
/* ------------------------------------------------------------------ */

function montarEscolha() {
  const grade = $('escolher-grade');
  grade.replaceChildren(
    ...[...estado.edificio.andares]
      .sort((a, b) => b - a)
      .map((andar) =>
        el(
          'button',
          {
            type: 'button',
            class: 'escolher__andar',
            dataset: { andar },
            'aria-pressed': 'false',
            'aria-label': nomeAndar(andar),
            onclick: () => escolherAndar(andar),
          },
          andar === 0 ? 'T' : ordinal(andar),
        ),
      ),
  );
}

function abrirEscolha(alerta = null) {
  const aviso = $('escolher-alerta');
  aviso.hidden = !alerta;
  aviso.textContent = alerta ?? '';
  for (const botao of $('escolher-grade').children) {
    botao.setAttribute('aria-pressed', String(Number(botao.dataset.andar) === estado.meuAndar));
  }
  $('escolher-cancelar').hidden = !estado.meuAndar;
  const folha = $('escolher');
  abrirFolha(folha);
  const titulo = $('escolher-titulo');
  titulo.tabIndex = -1;
  titulo.focus({ preventScroll: true });
}

function fecharEscolha(depois) {
  fecharFolha($('escolher'), () => {
    renderizar({ animar: false });
    renderizarPessoal(false);
    depois?.();
  });
}

async function escolherAndar(andar) {
  estado.meuAndar = await dados.definirMeuAndar(andar);
  const url = new URL(location.href);
  if (url.searchParams.has('andar')) {
    url.searchParams.set('andar', String(andar));
    history.replaceState(null, '', url);
  }
  if (estado.aba !== 'inicio') location.hash = 'inicio';
  // Trocou de andar à mão: já não está mais na frente da etiqueta.
  estado.vindoDaEtiqueta = false;
  atualizarAvisoEtiqueta();
  renderizar({ animar: false });
  renderizarPessoal(false);
  fecharEscolha(() => {
    const titulo = $('destaque-titulo');
    titulo.tabIndex = -1;
    titulo.focus();
  });
  avisar(`Pronto. Este aparelho agora mostra o ${nomeAndar(andar)}.`);
}

/* ------------------------------------------------------------------ */
/* Placar                                                              */
/* ------------------------------------------------------------------ */

function itemDoAndar(andar, placar = estado.placar) {
  return placar.ranking.find((i) => i.andar === andar) ?? null;
}

function liderUnico(placar = estado.placar) {
  const primeiros = placar?.ranking.filter((i) => i.posicao === 1) ?? [];
  return primeiros.length === 1 ? primeiros[0] : null;
}

function pontosPorAndar() {
  return Object.fromEntries(estado.placar.ranking.map((i) => [i.andar, i.pontos]));
}

function pontosPorDescarte() {
  const { reciclavel, organico } = estado.edificio.pontosPorDescarte;
  return Math.max(reciclavel, organico);
}

function renderizar({ animar }) {
  renderizarRanking(animar);
  renderizarDestaque(animar);
  renderizarLixeira();
  renderizarPalco();
  renderizarPremio();
  atualizarHora();
  estado.predio?.atualizar({ aceso: estado.meuAndar, lider: liderUnico()?.andar ?? null, pontosAndares: pontosPorAndar() });
}

function renderizarDestaque(animar) {
  const andar = estado.meuAndar;
  const chip = $('trocar-andar');
  $('destaque').hidden = !andar;
  $('sem-andar').hidden = Boolean(andar);
  if (!andar) {
    chip.hidden = true;
    $('destaque-andar').textContent = 'nenhum';
    return;
  }
  chip.hidden = false;
  $('chip-andar').textContent = nomeAndar(andar);
  chip.setAttribute('aria-label', `Trocar de andar. Andar atual: ${ordinal(andar)}`);
  $('destaque-andar').textContent = nomeAndar(andar);

  const { ranking, totais } = estado.placar;
  const item = itemDoAndar(andar);

  if (animar) animarNumero($('destaque-pontos'), item.pontos);
  else {
    $('destaque-pontos').dataset.valor = String(item.pontos);
    $('destaque-pontos').textContent = formatarNumero(item.pontos);
  }
  $('destaque-r').textContent = formatarNumero(item.reciclavel);
  $('destaque-o').textContent = formatarNumero(item.organico);
  const descartes = item.reciclavel + item.organico;
  ajustarBarra($('destaque-barra'), descartes ? item.reciclavel / descartes : 0, descartes ? item.organico / descartes : 0);

  const posicao = $('destaque-posicao');
  const meta = $('destaque-meta');
  const empatados = ranking.filter((i) => i.andar !== andar && i.pontos === item.pontos && item.pontos > 0);

  if (item.pontos === 0) {
    posicao.textContent = `Ainda sem pontos em ${mes}.`;
    meta.textContent =
      totais.pontos === 0
        ? 'O placar está zerado. O primeiro descarte coloca seu andar na frente.'
        : 'Um descarte já coloca seu andar no ranking.';
    return;
  }

  const lugar = `<strong>${ordinal(item.posicao)} lugar</strong>`;
  if (empatados.length) {
    posicao.innerHTML = `${lugar}, empatado com ${listaDeAndares(empatados.map((i) => i.andar))}.`;
  } else if (item.posicao === 1) {
    posicao.innerHTML = `${lugar}. Seu andar está na frente do prédio.`;
  } else {
    posicao.innerHTML = `${lugar} entre ${ranking.length} andares`;
  }

  if (item.posicao === 1 && !empatados.length) {
    const segundo = ranking.find((i) => i.andar !== andar);
    const vantagem = item.pontos - (segundo?.pontos ?? 0);
    meta.innerHTML = segundo && segundo.pontos > 0
      ? `Vantagem de <strong>${rotuloPontos(vantagem)}</strong> sobre o ${nomeAndar(segundo.andar)}.`
      : 'Só o seu andar pontuou até agora.';
    return;
  }

  const acima = ranking.filter((i) => i.pontos > item.pontos).at(-1);
  if (!acima) {
    // empatado em 1º
    meta.innerHTML = 'Mais <strong>1 descarte</strong> e seu andar fica sozinho na frente.';
    return;
  }
  const faltam = Math.ceil((acima.pontos - item.pontos + 1) / pontosPorDescarte());
  meta.innerHTML = `${faltam === 1 ? 'Falta' : 'Faltam'} <strong>${rotuloDescartes(faltam)}</strong> para passar o ${nomeAndar(acima.andar)}, que está em ${ordinal(acima.posicao)} lugar.`;
}

function listaDeAndares(andares) {
  const nomes = andares.map((a) => nomeAndar(a));
  if (nomes.length === 1) return `o ${nomes[0]}`;
  return `os andares ${andares.slice(0, -1).map(ordinal).join(', ')} e ${ordinal(andares.at(-1))}`;
}

function renderizarRanking(animar) {
  const lista = $('ranking-lista');
  const vazio = $('ranking-vazio');
  const { ranking, totais } = estado.placar;
  const { reciclavel, organico } = estado.edificio.pontosPorDescarte;
  const regra = reciclavel === organico ? `Cada um vale ${reciclavel} pontos.` : `Reciclável vale ${reciclavel} e orgânico vale ${organico} pontos.`;
  $('ranking-total').textContent = `${rotuloDescartes(totais.descartes)} no prédio. ${regra}`;

  if (totais.pontos === 0) {
    lista.hidden = true;
    vazio.hidden = false;
    mostrarEstado(vazio, {
      tipo: 'vazio',
      nivel: 'h2',
      icone: 'lixeira',
      titulo: 'Placar zerado',
      texto: `Ninguém descartou ainda em ${mes}. O primeiro descarte coloca o andar na frente.`,
    });
    return;
  }
  lista.hidden = false;
  vazio.hidden = true;

  const lider = ranking[0];
  const totalLider = lider.reciclavel + lider.organico;
  const linhas = ranking.map((item) => {
    let linha = estado.linhas.get(item.andar);
    if (!linha) {
      linha = criarLinhaRanking(item.andar);
      estado.linhas.set(item.andar, linha);
    }
    atualizarLinhaRanking(linha, item, { totalLider, animar, minha: item.andar === estado.meuAndar });
    return linha;
  });

  if (!lista.children.length) lista.append(...linhas);
  else reordenarComAnimacao(lista, linhas, { duracao: 760 });
}

function renderizarPremio() {
  const { premio } = estado.edificio;
  const caixa = $('premio');
  caixa.hidden = !premio.titulo;
  $('premio-nome').textContent = premio.titulo;
  $('premio-exemplo').hidden = !premio.exemplo;
}

/** As duas lixeiras do andar: estado da conexão e último descarte de cada uma. */
function renderizarLixeira() {
  const andar = estado.meuAndar;
  const caixa = $('lixeira');
  caixa.hidden = !andar;
  if (!andar || !estado.placar) return;
  $('lixeira-andar').textContent = nomeAndar(andar);

  // Ainda não há sensor de verdade: a conexão é simulada, e "Sem sinal" é quando o celular está sem internet.
  const online = navigator.onLine !== false;
  caixa.dataset.sinal = online ? 'ok' : 'sem';
  $('lixeira-estado').textContent = online ? 'Conectadas' : 'Sem sinal';

  for (const tipo of ['reciclavel', 'organico']) {
    const doPlacar = estado.placar.historico?.find((h) => h.andar === andar && h.descarte === tipo)?.em ?? null;
    const toque = estado.ultimoToque?.andar === andar && estado.ultimoToque.tipo === tipo ? estado.ultimoToque.em : null;
    const ultimo = [doPlacar, toque].filter(Boolean).sort().at(-1);
    const linha = $(`lixeira-ultimo-${tipo}`);
    if (!ultimo) {
      linha.textContent = 'Nenhum descarte recente';
      continue;
    }
    const quando = tempoRelativo(ultimo);
    linha.textContent = /^\d/.test(quando) ? `Último descarte às ${quando}` : `Último descarte ${quando}`;
  }
}

/* ------------------------------------------------------------------ */
/* Modo palco                                                          */
/* ------------------------------------------------------------------ */

function renderizarPalco() {
  if (!estado.meuAndar || !estado.placar) return;
  $('palco-predio').textContent = estado.edificio.nome;
  $('palco-andar').textContent = nomeAndar(estado.meuAndar);
  const item = itemDoAndar(estado.meuAndar);
  $('palco-posicao').textContent = item?.posicao
    ? `${ordinal(item.posicao)} lugar · ${rotuloPontos(item.pontos)}`
    : 'Ainda sem pontos. O primeiro toque coloca seu andar no ranking.';
}

/** Quem chegou pelo QR code do telão: entra no prédio, recebe um andar e vai para o palco. */
async function entrarNoPalco() {
  const url = new URL(location.href);
  url.searchParams.delete('entrar');
  url.searchParams.delete('andar');
  if (!estado.modo.online) {
    history.replaceState(null, '', url);
    avisar('O modo palco precisa do placar online. Você está no app normal, com o prédio de exemplo.', { duracao: 9000 });
    if (!estado.meuAndar) abrirEscolha();
    return;
  }
  const entrada = $('entrada');
  entrada.hidden = false;
  entrada.classList.remove('chegou', 'saindo');
  $('entrada-rotulo').textContent = 'Entrando no prédio…';
  $('entrada-andar').textContent = '';
  try {
    const andar = await dados.entrarNoPredio();
    estado.meuAndar = andar;
    renderizar({ animar: false });
    estado.predio?.atualizar({ aceso: andar });
    $('entrada-rotulo').textContent = 'Você mora no';
    $('entrada-andar').textContent = nomeAndar(andar);
    entrada.classList.add('chegou');
    vibrar();
    url.hash = 'palco';
    history.replaceState(null, '', url);
    await new Promise((resolver) => setTimeout(resolver, semMovimento() ? 1400 : 1900));
    aplicarRota({ entrada: true });
    const sair = () => {
      entrada.hidden = true;
      entrada.classList.remove('saindo', 'chegou');
    };
    if (semMovimento()) sair();
    else {
      entrada.classList.add('saindo');
      setTimeout(sair, 220);
    }
    $('palco-titulo').focus?.();
  } catch (erro) {
    console.error(erro);
    entrada.hidden = true;
    history.replaceState(null, '', url);
    avisar(erro.message || 'Não deu para entrar no prédio. Tente de novo.', { tipo: 'erro', duracao: 9000 });
    if (!estado.meuAndar) abrirEscolha();
  }
}

/** Toque no palco: faz o papel do sensor da lixeira (conta para o andar). */
async function tocarNoPalco(tipo, botao) {
  const botoes = document.querySelectorAll('.a-palco__botao');
  if (botao.disabled) return;
  for (const b of botoes) {
    b.disabled = true;
    b.classList.remove('esperando');
    void b.offsetWidth;
    b.classList.add('esperando');
  }
  vibrar();
  estado.lixeirasPalco[tipo]?.pulsar(tipo);
  pulsar(botao.querySelector('.botao-tipo__brilho'), [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], {
    duration: 1100,
    id: 'brilho',
  });
  try {
    // Sem internet, o toque fica na fila: o chip "Sem conexão · N toques guardados" já conta.
    await dados.registrarDescarte(estado.meuAndar, tipo, 'app');
  } catch (erro) {
    if (erro?.codigo === 'devagar') avisar('Um toque a cada 2 segundos.');
    else {
      console.error(erro);
      avisar(erro.message || 'Não deu para enviar. Tente de novo.', { tipo: 'erro' });
    }
  } finally {
    setTimeout(() => {
      for (const b of botoes) {
        b.disabled = false;
        b.classList.remove('esperando');
      }
    }, 2000);
  }
}

/** Chip discreto "Sem conexão" (placar online): os toques esperam numa fila. */
function mostrarConexao(conexao) {
  const chip = $('conexao');
  const precisa = conexao.online && (!conexao.conectado || conexao.pendentes > 0);
  chip.hidden = !precisa;
  document.body.classList.toggle('com-conexao', precisa); // o cabeçalho desce para o chip caber
  if (!precisa) return;
  const base = conexao.conectado ? 'Enviando' : 'Sem conexão';
  const fila = conexao.pendentes ? ` · ${conexao.pendentes} ${conexao.pendentes === 1 ? 'toque guardado' : 'toques guardados'}` : '';
  $('conexao-texto').textContent = base + fila;
}

function atualizarHora() {
  if (!estado.placar) return;
  renderizarLixeira();
  const quando = tempoRelativo(estado.placar.atualizadoEm);
  $('atualizado').textContent = quando === 'agora' ? 'Atualizado agora' : `Atualizado ${quando}`;
}

function aoMudarPlacar(placar) {
  const antes = estado.meuAndar ? itemDoAndar(estado.meuAndar) : null;
  estado.placar = placar;
  renderizar({ animar: true });

  const evento = placar.evento;
  if (!evento) return;

  if (evento.tipo === 'descarte') {
    marcarDescarte(estado.linhas.get(evento.andar), evento.pontos);
    estado.predio?.soltarLuz(evento.andar, evento.descarte);

    if (evento.andar === estado.meuAndar) {
      estado.lixeiras[evento.descarte]?.pulsar(evento.descarte);
      estado.lixeirasPalco[evento.descarte]?.pulsar(evento.descarte);
      const mais = $('destaque-mais');
      mais.textContent = `+${evento.pontos}`;
      if (semMovimento()) {
        mais.style.opacity = '1';
        clearTimeout(estado.relogioMais);
        estado.relogioMais = setTimeout(() => (mais.style.opacity = ''), 1200);
      } else {
        pulsar(mais, [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], {
          duration: 1600,
          id: 'mais',
        });
      }
      const depois = itemDoAndar(estado.meuAndar);
      if (antes?.posicao && depois?.posicao && depois.posicao < antes.posicao) {
        avisar(`Seu andar subiu para o ${ordinal(depois.posicao)} lugar.`);
      }
    }
  } else if (evento.tipo === 'zerado') {
    avisar('O placar do mês foi zerado.');
  } else if (evento.tipo === 'restaurado') {
    avisar('O placar voltou aos dados de exemplo.');
  }
}

/* ------------------------------------------------------------------ */
/* Contador pessoal                                                    */
/* ------------------------------------------------------------------ */

function renderizarPessoal(animar) {
  if (estado.meuAndar) $('pontuar-texto').textContent = `Etiqueta do ${nomeAndar(estado.meuAndar)}`;

  const { nome, mes: doMes } = estado.pessoal;
  const ola = $('pontuar-ola');
  ola.hidden = !nome;
  ola.textContent = nome ? `Olá, ${nome}.` : '';
  const campo = $('campo-nome');
  if (document.activeElement !== campo) campo.value = nome;

  for (const [id, valor] of [['pessoal-mes', doMes.pontos], ['pessoal-descartes', doMes.descartes]]) {
    const no = $(id);
    if (animar) animarNumero(no, valor);
    else {
      no.dataset.valor = String(valor);
      no.textContent = formatarNumero(valor);
    }
  }
}

async function pontuarPessoal(tipo, botao) {
  const botoes = document.querySelectorAll('.pontuar__botoes .botao-tipo');
  for (const b of botoes) b.disabled = true;
  const vinhaDaEtiqueta = estado.vindoDaEtiqueta;
  // Já pontuou pela etiqueta: um recarregamento não deve sugerir de novo.
  estado.vindoDaEtiqueta = false;
  try {
    const resumo = await dados.registrarDescartePessoal(tipo, estado.meuAndar);
    estado.pessoal = resumo;
    renderizarPessoal(true);
    vibrar();
    estado.ultimoToque = { andar: estado.meuAndar, tipo, em: new Date().toISOString() };
    renderizarLixeira();
    estado.lixeiras[tipo]?.pulsar(tipo);
    const pontos = estado.edificio.pontosPorDescarte[tipo];
    avisar(`+${pontos} pontos no seu nome (${tipo === 'organico' ? 'orgânico' : 'reciclável'}). Obrigado por separar.`);
    pulsar(botao.querySelector('.botao-tipo__brilho'), [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], {
      duration: 1100,
      id: 'brilho',
    });
    if (vinhaDaEtiqueta) limparAndarDaUrl();
    atualizarAvisoEtiqueta();
  } catch (erro) {
    console.error(erro);
    estado.vindoDaEtiqueta = vinhaDaEtiqueta;
    avisar('Não deu para registrar. Tente de novo.', { tipo: 'erro' });
  } finally {
    setTimeout(() => {
      for (const b of botoes) b.disabled = false;
    }, 900);
  }
}

/* ------------------------------------------------------------------ */
/* Eventos                                                             */
/* ------------------------------------------------------------------ */

function ligarEventos() {
  addEventListener('hashchange', () => aplicarRota({ vindoDeDentro: true }));
  // Voltar no histórico entre endereços que mudam mais do que o # (depois de tirar o ?andar=)
  // não dispara hashchange, só popstate. A rota é a mesma; aplicar duas vezes não faz mal.
  addEventListener('popstate', () => {
    limparAndarDaUrl();
    aplicarRota({ vindoDeDentro: true });
  });

  // Logo: leva ao Início do app (no Início, volta ao topo)
  $('logo-app').addEventListener('click', () => {
    if (lerRota().aba === 'inicio' && !lerRota().folha) scrollTo({ top: 0, behavior: semMovimento() ? 'instant' : 'smooth' });
  });

  // Folha Pontuar
  const folhaPontuar = $('folha-pontuar');
  folhaPontuar.addEventListener('cancel', (e) => {
    e.preventDefault();
    pedirFechamentoPontuar();
  });
  aoClicarFora(folhaPontuar, pedirFechamentoPontuar);
  $('concluir').addEventListener('click', pedirFechamentoPontuar);
  $('nav-pontuar').addEventListener('click', (e) => {
    if (!estado.meuAndar) {
      e.preventDefault();
      abrirEscolha();
    }
  });
  for (const botao of document.querySelectorAll('.pontuar__botoes .botao-tipo')) {
    botao.addEventListener('click', () => pontuarPessoal(botao.dataset.tipo, botao));
  }
  for (const botao of document.querySelectorAll('.a-palco__botao')) {
    botao.addEventListener('click', () => tocarNoPalco(botao.dataset.tipo, botao));
  }

  // Folha de escolher o andar
  const folhaEscolher = $('escolher');
  const fecharEscolhaSemTrocar = () => fecharEscolha(() => (estado.meuAndar ? $('trocar-andar') : $('escolher-andar-botao')).focus());
  folhaEscolher.addEventListener('cancel', (e) => {
    e.preventDefault();
    fecharEscolhaSemTrocar();
  });
  aoClicarFora(folhaEscolher, fecharEscolhaSemTrocar);
  $('escolher-cancelar').addEventListener('click', fecharEscolhaSemTrocar);
  $('trocar-andar').addEventListener('click', () => abrirEscolha());
  $('escolher-andar-botao').addEventListener('click', () => abrirEscolha());

  // Nome e dados
  $('form-nome').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = $('campo-nome').value;
    estado.pessoal = await dados.definirNomePessoal(nome);
    renderizarPessoal(false);
    $('campo-nome').blur();
    avisar(estado.pessoal.nome ? `Nome salvo: ${estado.pessoal.nome}.` : 'Nome apagado deste aparelho.');
  });

  $('zerar-pessoal').addEventListener('click', async () => {
    const ok = await confirmar({
      titulo: 'Apagar seus pontos?',
      texto: 'Os pontos no seu nome guardados neste celular vão sumir. Os pontos do andar não mudam.',
      confirmar: 'Apagar meus pontos',
      perigo: true,
    });
    if (!ok) return;
    estado.pessoal = await dados.zerarPessoal();
    renderizarPessoal(false);
    avisar('Seus pontos foram apagados deste aparelho.');
  });
}

iniciar();
