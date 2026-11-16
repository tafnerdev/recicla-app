/**
 * Recicla Slide: telão (/telao).
 * Ranking em tela cheia para projetor. A cada descarte: a linha brilha, sobe o "+10",
 * a barra cresce e, se o andar passou alguém, ele sobe na lista. Novo líder ganha celebração.
 * Com ?sensor=1 aparece a leitura do sensor pela porta serial (desligada por padrão).
 */
import * as dados from './dados.js';
import {
  animarNumero,
  el,
  formatarNumero,
  icone,
  mostrarEstado,
  nomeAndar,
  nomeMes,
  ordinal,
  pulsar,
  reduzMovimento,
  reordenarComAnimacao,
  rotuloPontos,
  tempoRelativo,
  textoErroCarregar,
} from './comum.js';
import { BAUD_PADRAO, LeitorSerial, interpretarLinha, serialDisponivel } from './serial.js';

const $ = (id) => document.getElementById(id);
const parametros = new URLSearchParams(location.search);
const TEMPO_OCIOSO = 3000;
const ITENS_FEED = 5;

const estado = {
  edificio: null,
  placar: null,
  linhas: new Map(),
  escala: 1,
  celebracao: null,
  leitor: null,
  ignoradas: 0,
};

/* ------------------------------------------------------------------ */
/* Palco: escala para caber na tela                                    */
/* ------------------------------------------------------------------ */

function ajustarEscala() {
  const palco = $('palco');
  const escala = Math.min(innerWidth / palco.offsetWidth, innerHeight / palco.offsetHeight);
  estado.escala = escala;
  palco.style.setProperty('--escala', escala.toFixed(4));
}

/* ------------------------------------------------------------------ */
/* Controles: tela cheia, cursor ocioso, atalhos                       */
/* ------------------------------------------------------------------ */

function ligarControles() {
  const botao = $('t-tela-cheia');
  const atualizarBotao = () => {
    const cheia = Boolean(document.fullscreenElement);
    botao.querySelector('[data-icone]').innerHTML = icone(cheia ? 'sairTelaCheia' : 'telaCheia');
    botao.querySelector('.t-botao__rotulo').textContent = cheia ? 'Sair' : 'Tela cheia';
    botao.setAttribute('aria-label', cheia ? 'Sair da tela cheia (atalho: F)' : 'Tela cheia (atalho: F)');
  };
  const alternar = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      /* navegador sem tela cheia (iPhone): segue normal */
    }
  };
  if (!document.fullscreenEnabled) botao.hidden = true;
  botao.addEventListener('click', alternar);
  document.addEventListener('fullscreenchange', atualizarBotao);

  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      alternar();
    }
  });

  // Esconde cursor e botões depois de alguns segundos parado.
  let relogio = 0;
  const acordar = () => {
    document.body.classList.remove('ocioso');
    clearTimeout(relogio);
    relogio = setTimeout(() => {
      if (!document.activeElement?.closest?.('.t-sensor')) document.body.classList.add('ocioso');
    }, TEMPO_OCIOSO);
  };
  for (const evento of ['pointermove', 'pointerdown', 'keydown']) addEventListener(evento, acordar, { passive: true });
  acordar();
}

/* ------------------------------------------------------------------ */
/* Início                                                              */
/* ------------------------------------------------------------------ */

async function iniciar() {
  for (const caixa of document.querySelectorAll('[data-icone]')) caixa.innerHTML = icone(caixa.dataset.icone);
  ajustarEscala();
  addEventListener('resize', ajustarEscala);
  matchMedia('(orientation: portrait)').addEventListener('change', ajustarEscala);
  ligarControles();
  $('t-mes').textContent = nomeMes();

  try {
    await dados.iniciar();
    const [edificio, placar] = await Promise.all([dados.obterEdificio(), dados.obterPlacar()]);
    Object.assign(estado, { edificio, placar });
  } catch (erro) {
    console.error(erro);
    mostrarErro(erro);
    return;
  }

  $('t-predio').textContent = estado.edificio.nome;
  const { reciclavel, organico } = estado.edificio.pontosPorDescarte;
  $('t-regra').textContent =
    reciclavel === organico ? `Cada descarte vale ${reciclavel} pontos` : `Reciclável ${reciclavel} pontos, orgânico ${organico} pontos`;
  $('t-premio-nome').textContent = estado.edificio.premio.titulo || 'A definir pelo condomínio';
  $('t-premio-exemplo').hidden = !estado.edificio.premio.exemplo;

  $('t-carregando').hidden = true;
  renderizar(false);
  dados.aoMudar(aoMudar);
  setInterval(atualizarTempos, 20_000);

  if (parametros.get('sensor') === '1') ligarSensor();
}

function mostrarErro(erro) {
  $('palco').classList.add('sem-dados');
  $('t-carregando').hidden = true;
  const caixa = $('t-erro');
  caixa.hidden = false;
  mostrarEstado(caixa, {
    tipo: 'erro',
    titulo: 'O placar não carregou',
    texto: textoErroCarregar(erro),
    acao: { rotulo: 'Tentar de novo', icone: 'atualizar', aoClicar: () => location.reload() },
  });
  definirStatus('erro', 'Sem placar');
}

function definirStatus(tipo, texto) {
  const status = $('t-status');
  status.classList.toggle('t-status--alerta', tipo === 'alerta');
  status.classList.toggle('t-status--erro', tipo === 'erro');
  $('t-status-texto').textContent = texto;
}

/* ------------------------------------------------------------------ */
/* Ranking                                                             */
/* ------------------------------------------------------------------ */

function liderUnico(placar) {
  const primeiros = placar?.ranking.filter((i) => i.posicao === 1) ?? [];
  return primeiros.length === 1 ? primeiros[0] : null;
}

function criarLinha(andar) {
  const linha = el('li', { class: 't-linha', dataset: { andar } });
  linha.innerHTML = `
    <span class="t-linha__brilho" aria-hidden="true"></span>
    <span class="t-linha__posicao numero" aria-hidden="true"></span>
    <span class="t-linha__andar" aria-hidden="true"><span class="t-linha__nome"></span><span class="t-linha__subiu">${icone('setaCima')}<span>subiu</span></span></span>
    <span class="t-linha__barra" aria-hidden="true"><span class="barra barra--r"></span><span class="barra barra--o"></span></span>
    <span class="t-linha__pontos numero" aria-hidden="true" data-valor="0">0</span>
    <span class="t-linha__mais numero" aria-hidden="true">+10</span>
    <span class="visualmente-oculto t-linha__leitura"></span>`;
  return linha;
}

function atualizarLinha(linha, item, maximo, animar) {
  linha.dataset.posicao = String(item.posicao ?? '');
  linha.classList.toggle('t-linha--zero', item.pontos === 0);
  linha.querySelector('.t-linha__posicao').textContent = item.posicao ? ordinal(item.posicao) : '';
  linha.querySelector('.t-linha__nome').textContent = nomeAndar(item.andar);

  const fr = item.pontosReciclavel / maximo;
  const fo = item.pontosOrganico / maximo;
  linha.querySelector('.barra--r').style.setProperty('--f', fr.toFixed(4));
  const barraO = linha.querySelector('.barra--o');
  barraO.style.setProperty('--f', fo.toFixed(4));
  barraO.style.setProperty('--x', fr.toFixed(4));

  const pontos = linha.querySelector('.t-linha__pontos');
  if (animar) animarNumero(pontos, item.pontos, { duracao: 900 });
  else {
    pontos.dataset.valor = String(item.pontos);
    pontos.textContent = formatarNumero(item.pontos);
  }
  linha.querySelector('.t-linha__leitura').textContent =
    `${item.posicao ? `${ordinal(item.posicao)} lugar` : 'Sem posição'}, ${nomeAndar(item.andar)}, ${rotuloPontos(item.pontos)}.`;
}

function renderizarRanking(animar) {
  const lista = $('t-lista');
  const vazio = $('t-vazio');
  const { ranking, totais } = estado.placar;

  $('palco').classList.toggle('placar-vazio', totais.pontos === 0);
  if (totais.pontos === 0) {
    lista.hidden = true;
    vazio.hidden = false;
    mostrarEstado(vazio, {
      tipo: 'vazio',
      icone: 'lixeira',
      titulo: 'Placar zerado',
      texto: 'O primeiro descarte do mês coloca o andar na frente.',
    });
    return [];
  }
  vazio.hidden = true;
  const estavaEscondida = lista.hidden;
  lista.hidden = false;
  lista.style.setProperty('--linhas', String(ranking.length));

  const maximo = Math.max(1, ...ranking.map((i) => i.pontos));
  const linhas = ranking.map((item) => {
    let linha = estado.linhas.get(item.andar);
    if (!linha) {
      linha = criarLinha(item.andar);
      estado.linhas.set(item.andar, linha);
    }
    atualizarLinha(linha, item, maximo, animar && !estavaEscondida);
    return linha;
  });

  if (!lista.children.length || estavaEscondida) {
    lista.replaceChildren(...linhas);
    if (animar && !reduzMovimento()) {
      linhas.forEach((linha, i) =>
        pulsar(linha, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], {
          duration: 600,
          delay: i * 45,
          fill: 'backwards',
          id: 'entrada',
        }),
      );
    }
    return [];
  }
  return reordenarComAnimacao(lista, linhas, { duracao: 900, escala: estado.escala });
}

/* ------------------------------------------------------------------ */
/* Coluna lateral                                                      */
/* ------------------------------------------------------------------ */

function renderizarLider() {
  const { ranking, totais } = estado.placar;
  const andar = $('t-lider-andar');
  const pontos = $('t-lider-pontos');
  if (totais.pontos === 0) {
    andar.textContent = 'Ninguém';
    pontos.textContent = 'O primeiro descarte assume a liderança.';
    return;
  }
  const primeiros = ranking.filter((i) => i.posicao === 1);
  if (primeiros.length > 1) {
    andar.textContent = `${primeiros.map((i) => ordinal(i.andar)).join(' e ')}`;
    pontos.innerHTML = `Empatados com <strong>${rotuloPontos(primeiros[0].pontos)}</strong>`;
    return;
  }
  andar.textContent = nomeAndar(primeiros[0].andar);
  const segundo = ranking[1];
  const vantagem = segundo ? primeiros[0].pontos - segundo.pontos : 0;
  pontos.innerHTML = `<strong>${rotuloPontos(primeiros[0].pontos)}</strong>${segundo && vantagem > 0 ? `, ${formatarNumero(vantagem)} à frente` : ''}`;
}

function renderizarFeed(eventoNovo) {
  const lista = $('t-feed');
  const historico = estado.placar.historico.slice(0, ITENS_FEED);
  $('t-feed-vazio').hidden = historico.length > 0;
  lista.replaceChildren(
    ...historico.map((h) =>
      el(
        'li',
        { class: 't-feed__item', dataset: { tipo: h.descarte, id: h.id, em: h.em } },
        el('span', { class: `marca-tipo${h.descarte === 'organico' ? ' marca-tipo--organico' : ''}`, 'aria-hidden': 'true' }, h.descarte === 'organico' ? 'O' : 'R'),
        el('span', { class: 't-feed__andar' }, nomeAndar(h.andar)),
        el('span', { class: 't-feed__pontos' }, `+${h.pontos}`),
        el('span', { class: 't-feed__quando' }, tempoRelativo(h.em)),
      ),
    ),
  );
  // Mostra só os itens que cabem inteiros na altura do cartão.
  const altura = lista.clientHeight;
  for (const item of lista.children) item.hidden = item.offsetTop + item.offsetHeight > altura + 1;
  if (eventoNovo?.tipo === 'descarte' && lista.firstElementChild) {
    pulsar(lista.firstElementChild, [{ opacity: 0, transform: 'translateY(-16px)' }, { opacity: 1, transform: 'none' }], {
      duration: 520,
      id: 'feed',
    });
  }
}

function renderizarTotais(animar) {
  const { totais } = estado.placar;
  for (const [id, valor] of [['t-total-r', totais.reciclavel], ['t-total-o', totais.organico]]) {
    const no = $(id);
    if (animar) animarNumero(no, valor);
    else {
      no.dataset.valor = String(valor);
      no.textContent = formatarNumero(valor);
    }
  }
}

function atualizarTempos() {
  for (const item of document.querySelectorAll('.t-feed__item')) {
    item.querySelector('.t-feed__quando').textContent = tempoRelativo(item.dataset.em);
  }
}

function renderizar(animar, evento = null) {
  const subiram = renderizarRanking(animar);
  renderizarLider();
  renderizarFeed(evento);
  renderizarTotais(animar);
  return subiram;
}

/* ------------------------------------------------------------------ */
/* Mudanças ao vivo                                                    */
/* ------------------------------------------------------------------ */

function aoMudar(placar) {
  const antes = estado.placar;
  const liderAntes = liderUnico(antes);
  const posicaoAntes = new Map(antes.ranking.map((i) => [i.andar, i.posicao]));
  estado.placar = placar;
  const evento = placar.evento;

  renderizar(true, evento);

  if (evento?.tipo !== 'descarte') {
    if (evento?.tipo === 'zerado') anunciar('Placar zerado.');
    if (evento?.tipo === 'restaurado') anunciar('Placar voltou aos dados de exemplo.');
    return;
  }

  const item = placar.ranking.find((i) => i.andar === evento.andar);
  const linha = estado.linhas.get(evento.andar);
  if (linha && item) destacarLinha(linha, evento, posicaoAntes.get(evento.andar), item.posicao);

  const tipo = evento.descarte === 'organico' ? 'orgânico' : 'reciclável';
  anunciar(`${nomeAndar(evento.andar)}: mais ${evento.pontos} pontos, ${tipo}. Agora em ${ordinal(item.posicao)} lugar.`);

  const lider = liderUnico(placar);
  if (lider && lider.andar === evento.andar && lider.andar !== liderAntes?.andar) celebrar(lider);
}

function destacarLinha(linha, evento, posicaoAntes, posicaoDepois) {
  const brilho = linha.querySelector('.t-linha__brilho');
  brilho.dataset.tipo = evento.descarte;
  pulsar(brilho, [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0 }], { duration: 1600, id: 'brilho' });

  const mais = linha.querySelector('.t-linha__mais');
  mais.textContent = `+${evento.pontos}`;
  mais.dataset.tipo = evento.descarte;
  pulsar(
    mais,
    [
      { opacity: 0, transform: 'translateY(20px) scale(0.7)' },
      { opacity: 1, transform: 'translateY(-6px) scale(1.08)', offset: 0.25 },
      { opacity: 1, transform: 'translateY(-14px) scale(1)', offset: 0.6 },
      { opacity: 0, transform: 'translateY(-40px) scale(1)' },
    ],
    { duration: 1500, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', id: 'mais' },
  );

  if (posicaoAntes && posicaoDepois && posicaoDepois < posicaoAntes) {
    const selo = linha.querySelector('.t-linha__subiu');
    const casas = posicaoAntes - posicaoDepois;
    selo.lastElementChild.textContent = casas > 1 ? `subiu ${casas}` : 'subiu';
    pulsar(
      selo,
      [
        { opacity: 0, transform: 'translateY(6px) scale(0.9)' },
        { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.08 },
        { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.9 },
        { opacity: 0, transform: 'translateY(-4px) scale(0.96)' },
      ],
      { duration: 4200, delay: 500, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', id: 'subiu', fill: 'backwards' },
    );
    if (reduzMovimento()) {
      // Sem animação, o selo aparece parado por alguns segundos.
      selo.style.opacity = '1';
      setTimeout(() => (selo.style.opacity = ''), 4000);
    }
  }
}

function anunciar(texto) {
  $('t-anuncio').textContent = texto;
}

/* ------------------------------------------------------------------ */
/* Celebração de novo líder (GSAP)                                     */
/* ------------------------------------------------------------------ */

function celebrar(lider) {
  const camada = $('t-celebracao');
  const cartao = camada.querySelector('.t-celebracao__cartao');
  const pecas = $('t-celebracao-pecas');
  $('t-celebracao-andar').textContent = nomeAndar(lider.andar);
  const premio = estado.edificio.premio.titulo;
  $('t-celebracao-texto').textContent = `assumiu a liderança com ${rotuloPontos(lider.pontos)}.${premio ? ` Prêmio do mês: ${premio.charAt(0).toLowerCase()}${premio.slice(1)}.` : ''}`;
  anunciar(`Novo líder: ${nomeAndar(lider.andar)}.`);

  estado.celebracao?.kill();
  camada.hidden = false;
  const gsap = window.gsap;

  if (!gsap || reduzMovimento()) {
    camada.style.opacity = '1';
    clearTimeout(estado.fimCelebracao);
    estado.fimCelebracao = setTimeout(() => (camada.hidden = true), 3500);
    return;
  }

  pecas.replaceChildren(...Array.from({ length: 22 }, () => el('span', { class: 't-peca' })));
  const largura = $('palco').offsetWidth;
  estado.celebracao = gsap
    .timeline({
      delay: 0.65, // deixa a linha terminar de subir antes
      onComplete: () => {
        camada.hidden = true;
        pecas.replaceChildren();
      },
    })
    .fromTo(camada, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' })
    .fromTo(
      cartao,
      { opacity: 0, scale: 0.82, y: 50 },
      { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: 'back.out(1.5)' },
      '<0.05',
    )
    .fromTo(
      pecas.children,
      { x: 0, y: 0, scale: 0.3, opacity: 1, rotation: 0 },
      {
        x: () => gsap.utils.random(-largura * 0.42, largura * 0.42),
        y: () => gsap.utils.random(-460, 420),
        rotation: () => gsap.utils.random(-200, 200),
        scale: () => gsap.utils.random(0.7, 1.4),
        opacity: 0,
        duration: 1.9,
        ease: 'power3.out',
        stagger: 0.012,
      },
      '<0.1',
    )
    .to(cartao, { opacity: 0, scale: 0.96, y: -20, duration: 0.45, ease: 'power2.in' }, '+=1.6')
    .to(camada, { opacity: 0, duration: 0.4, ease: 'power2.in' }, '<0.15');
}

/* ------------------------------------------------------------------ */
/* Sensor pela porta serial (?sensor=1)                                */
/* ------------------------------------------------------------------ */

function ligarSensor() {
  const painel = $('t-sensor-painel');
  const botao = $('t-sensor');
  $('palco').classList.add('com-sensor');
  painel.hidden = false;
  botao.hidden = false;

  if (!serialDisponivel()) {
    botao.disabled = true;
    $('t-sensor-texto').textContent = 'Sensor indisponível';
    $('t-sensor-estado').textContent = window.isSecureContext
      ? 'Este navegador não lê a porta serial. Use Chrome ou Edge no computador.'
      : 'A porta serial só funciona em https ou em localhost.';
    definirStatus('alerta', 'Sensor indisponível');
  } else {
    const baud = Number(parametros.get('baud')) || BAUD_PADRAO;
    estado.leitor = new LeitorSerial({ aoLinha: (l) => processarLinha(l), aoEstado: atualizarSensor, baud });
    atualizarSensor('desconectado');
    botao.addEventListener('click', async () => {
      try {
        if (estado.leitor.estado === 'conectado') await estado.leitor.desconectar();
        else await estado.leitor.conectar();
      } catch (erro) {
        if (erro.name === 'NotFoundError') return; // fechou a janela sem escolher
        atualizarSensor('erro', erro.message);
      }
    });
    estado.leitor.reconectar().catch((erro) => atualizarSensor('erro', erro.message));
  }

  $('t-sensor-teste').addEventListener('submit', (e) => {
    e.preventDefault();
    const campo = $('t-sensor-linha');
    processarLinha(campo.value, true);
    campo.select();
  });
}

function atualizarSensor(situacao, detalhe = '') {
  const textos = {
    desconectado: 'Sensor desconectado',
    conectando: 'Conectando ao sensor…',
    conectado: 'Sensor conectado',
    erro: 'Erro no sensor',
  };
  $('t-sensor-estado').textContent = detalhe ? `${textos[situacao]}. ${detalhe}` : `${textos[situacao]}.`;
  $('t-sensor-texto').textContent = situacao === 'conectado' ? 'Desconectar sensor' : 'Conectar sensor';
  definirStatus(situacao === 'conectado' ? 'ok' : situacao === 'erro' ? 'erro' : 'alerta', textos[situacao]);
}

async function processarLinha(linha, teste = false) {
  const resultado = interpretarLinha(linha, estado.edificio?.andares ?? null);
  if (resultado.ignorada) return;
  const quando = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const ultima = $('t-sensor-ultima');
  if (!resultado.ok) {
    estado.ignoradas += 1;
    ultima.textContent = `${teste ? 'Teste' : 'Linha'} ignorada às ${quando}: ${resultado.erro}`;
    return;
  }
  try {
    await dados.registrarDescarte(resultado.andar, resultado.tipo, 'sensor');
    ultima.textContent = `${teste ? 'Teste' : 'Recebido'} às ${quando}: "${String(linha).trim()}"`;
  } catch (erro) {
    ultima.textContent = `Não registrou: ${erro.message}`;
  }
}

iniciar();
