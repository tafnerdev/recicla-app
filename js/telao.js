/**
 * Recicla Slide: telão (/telao).
 * Ranking em tela cheia para projetor. A cada descarte: o número conta, a linha
 * ganha um brilho suave, aparece um "+10" pequeno e, se o andar passou alguém,
 * ele desliza para o novo lugar. Novo líder ganha uma folha de vidro por 4 s.
 * Com ?sensor=1 aparece a leitura do sensor pela porta serial (desligada por padrão).
 * Com ?estavel=1 (TV que pisca): sem desfoque, sem WebGL, sem contagem, corte seco.
 */
import * as dados from './dados.js';
import {
  ajustarBarra,
  animarNumero,
  el,
  formatarNumero,
  icone,
  marcarDescarte,
  modoEstavel,
  mostrarEstado,
  nomeAndar,
  nomeMes,
  ordinal,
  pulsar,
  reordenarComAnimacao,
  rotuloPontos,
  semMovimento,
  textoErroCarregar,
} from './comum.js';
import { montarPredio } from './predio.js';
import { definirCondicaoParaRecarregar } from './pwa.js';
import { BAUD_PADRAO, LeitorSerial, interpretarLinha, serialDisponivel } from './serial.js';

const $ = (id) => document.getElementById(id);
const parametros = new URLSearchParams(location.search);
const TEMPO_OCIOSO = 3000;
const LIMITE_LINHAS = 10; // o palco foi desenhado para 10 linhas legíveis a distância
const LINHAS_GRANDES = 3;

const estado = {
  edificio: null,
  placar: null,
  linhas: new Map(),
  escala: 1,
  predio: null,
  leitor: null,
  ignoradas: 0,
  fimCelebracao: 0,
  ultimaMudanca: 0, // quando o placar mudou pela última vez (luz caindo, números contando)
  palco: false, // ?palco=1: QR code para a plateia
  ultimaCelebracao: 0,
  animacoes: [],
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
    // Com a tela já cheia, o botão some (a tecla F e o Esc continuam valendo).
    botao.hidden = cheia || !document.fullscreenEnabled;
  };
  const alternar = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      /* navegador sem tela cheia (iPhone): segue normal */
    }
  };
  atualizarBotao();
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

/**
 * Versão nova do site: o telão só recarrega com a tela parada. Espera a celebração
 * de novo líder, 2,5 s depois do último descarte (luz caindo no prédio, números
 * contando) e a saída da tela cheia do botão, porque recarregar tiraria o telão da
 * tela cheia no meio da apresentação (com F11 do navegador, recarrega normalmente).
 */
definirCondicaoParaRecarregar(
  () =>
    !$('palco')?.classList.contains('celebrando') &&
    Date.now() - estado.ultimaMudanca > 2500 &&
    !document.fullscreenElement,
);

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

  estado.predio = montarPredio($('t-predio-caixa'), {
    andares: estado.edificio.andares,
    aceso: andarAceso(),
    pontosAndares: Object.fromEntries(estado.placar.ranking.map((i) => [i.andar, i.pontos])),
    modo: 'lider',
    pontos: 'telao',
    traco: 0.6,
    largura: null,
  });

  $('t-carregando').hidden = true;
  renderizar(false);
  dados.aoMudar(aoMudar);

  if (parametros.get('sensor') === '1') ligarSensor();
  if (parametros.get('palco') === '1') ligarPalco();
  if (parametros.get('simular') === '1') ligarSimulacao();
  else ligarConexao();
}

/* ------------------------------------------------------------------ */
/* Placar online: situação da conexão no selo do topo                  */
/* ------------------------------------------------------------------ */

function ligarConexao() {
  dados.aoMudarConexao((conexao) => {
    if (!conexao.online || estado.leitor) return; // modo local, ou o selo mostra o sensor
    if (!conexao.conectado) definirStatus('alerta', 'Sem conexão');
    else if (conexao.aoVivo) definirStatus('', 'Ao vivo');
    else definirStatus('', 'Conectando');
  });
}

/* ------------------------------------------------------------------ */
/* Modo palco (?palco=1): QR code para a plateia entrar no prédio      */
/* ------------------------------------------------------------------ */

/** Desenha o QR code (uqr) como SVG: módulos escuros sobre o fundo claro do cartão. */
function svgDoQr({ data, size }) {
  let caminho = '';
  data.forEach((linha, y) =>
    linha.forEach((escuro, x) => {
      if (escuro) caminho += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path d="${caminho}" fill="#050807"/></svg>`;
}

function mostrarPessoas(total, animar) {
  const numero = $('t-palco-pessoas');
  if (animar) animarNumero(numero, total);
  else {
    numero.dataset.valor = String(total);
    numero.textContent = formatarNumero(total);
  }
  $('t-palco-pessoas-rotulo').textContent = total === 1 ? 'pessoa no prédio' : 'pessoas no prédio';
}

async function ligarPalco() {
  const { online, codigo } = await dados.modo();
  estado.palco = true;
  $('palco').classList.add('com-palco');
  $('t-palco').hidden = false;
  if (!online) {
    // Sem o placar online, cada celular teria o seu placar: o QR não faria sentido.
    $('t-palco-qr').hidden = true;
    $('t-palco-pessoas-linha').hidden = true;
    $('t-palco-titulo').textContent = 'O modo palco precisa do placar online';
    $('t-palco-endereco').textContent =
      'Preencha o js/config.js com o endereço e a chave do Supabase e abra o telão com ?predio=CÓDIGO&palco=1 (passo a passo no PENDENCIAS.md).';
    return;
  }
  const endereco = new URL(`../app/?predio=${encodeURIComponent(codigo)}&entrar=1`, location.href).href;
  const { encode } = await import('./vendor/uqr.mjs');
  const qr = $('t-palco-qr');
  qr.innerHTML = svgDoQr(encode(endereco, { ecc: 'M', border: 0 }));
  qr.setAttribute('role', 'img');
  qr.setAttribute('aria-label', `QR code para entrar no prédio: ${endereco}`);
  $('t-palco-endereco').textContent = endereco.replace(/^https?:\/\//, '');
  mostrarPessoas(await dados.obterParticipantes(), false);
  dados.aoMudarParticipantes((total) => mostrarPessoas(total, !semMovimento()));
}

/* ------------------------------------------------------------------ */
/* Plano B sem internet (?simular=1): demonstração local automática    */
/* ------------------------------------------------------------------ */

function ligarSimulacao() {
  definirStatus('', 'Demonstração');
  const andares = estado.edificio.andares;
  const passo = () => {
    if (document.hidden) return;
    const andar = andares[Math.floor(Math.random() * andares.length)];
    const tipo = Math.random() < 0.58 ? 'reciclavel' : 'organico';
    dados.registrarDescarte(andar, tipo, 'demo').catch(() => {});
  };
  setTimeout(passo, 1500);
  setInterval(passo, 3200);
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

/** O andar aceso no prédio do telão é o líder (no empate, o primeiro da lista). */
function andarAceso(placar = estado.placar) {
  const primeiro = placar?.ranking[0];
  return primeiro && primeiro.pontos > 0 ? primeiro.andar : null;
}

function criarLinha(andar) {
  const linha = el('li', { class: 't-linha', dataset: { andar } });
  linha.innerHTML = `
    <span class="t-linha__brilho" aria-hidden="true"></span>
    <span class="t-linha__posicao" aria-hidden="true"><span class="t-linha__num"></span><span class="t-linha__subiu">${icone('setaCima')}</span></span>
    <span class="t-linha__nome" aria-hidden="true"></span>
    <span class="barra barra--grossa t-linha__barra" aria-hidden="true"><span class="barra__r"></span><span class="barra__o"></span></span>
    <span class="t-linha__celula" aria-hidden="true"><span class="t-linha__mais">+10</span><span class="t-linha__pontos" data-valor="0">0</span></span>
    <span class="visualmente-oculto t-linha__leitura"></span>`;
  return linha;
}

function atualizarLinha(linha, item, indice, totalLider, animar) {
  linha.dataset.posicao = String(item.posicao ?? '');
  linha.classList.toggle('t-linha--topo', indice < LINHAS_GRANDES);
  linha.classList.toggle('t-linha--resto', indice >= LINHAS_GRANDES);
  linha.classList.toggle('t-linha--lider', indice === 0 && item.posicao === 1);
  linha.classList.toggle('t-linha--zero', item.pontos === 0);
  linha.querySelector('.t-linha__num').textContent = item.posicao ? ordinal(item.posicao) : '';
  linha.querySelector('.t-linha__nome').textContent = nomeAndar(item.andar);

  const total = Math.max(1, totalLider);
  ajustarBarra(linha.querySelector('.t-linha__barra'), item.reciclavel / total, item.organico / total);

  const pontos = linha.querySelector('.t-linha__pontos');
  if (animar) animarNumero(pontos, item.pontos);
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
    return;
  }
  vazio.hidden = true;
  const estavaEscondida = lista.hidden;
  lista.hidden = false;

  const visiveis = ranking.slice(0, LIMITE_LINHAS);
  const totalLider = visiveis[0].reciclavel + visiveis[0].organico;
  const linhas = visiveis.map((item, indice) => {
    let linha = estado.linhas.get(item.andar);
    if (!linha) {
      linha = criarLinha(item.andar);
      estado.linhas.set(item.andar, linha);
    }
    atualizarLinha(linha, item, indice, totalLider, animar && !estavaEscondida);
    return linha;
  });

  if (!lista.children.length || estavaEscondida) {
    lista.replaceChildren(...linhas);
    if (animar && !semMovimento()) {
      // entrada: sobem 12 px com opacidade, 60 ms entre elas
      linhas.forEach((linha, i) =>
        pulsar(linha, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], {
          duration: 480,
          delay: i * 60,
          fill: 'backwards',
          id: 'entrada',
        }),
      );
    }
    return;
  }
  // Quem saiu dos 10 primeiros sai da lista.
  for (const filho of [...lista.children]) if (!linhas.includes(filho)) filho.remove();
  reordenarComAnimacao(lista, linhas, { duracao: 900, escala: estado.escala });
}

function renderizarTotais(animar) {
  const { totais } = estado.placar;
  for (const [id, valor] of [['t-total', totais.descartes], ['t-total-r', totais.reciclavel], ['t-total-o', totais.organico]]) {
    const no = $(id);
    if (animar) animarNumero(no, valor);
    else {
      no.dataset.valor = String(valor);
      no.textContent = formatarNumero(valor);
    }
  }
}

function renderizar(animar) {
  renderizarRanking(animar);
  renderizarTotais(animar);
  estado.predio?.atualizar({ aceso: andarAceso(), pontosAndares: Object.fromEntries(estado.placar.ranking.map((i) => [i.andar, i.pontos])) });
}

/* ------------------------------------------------------------------ */
/* Mudanças ao vivo                                                    */
/* ------------------------------------------------------------------ */

function aoMudar(placar) {
  estado.ultimaMudanca = Date.now();
  const antes = estado.placar;
  const liderAntes = liderUnico(antes);
  const posicaoAntes = new Map(antes.ranking.map((i) => [i.andar, i.posicao]));
  estado.placar = placar;
  const evento = placar.evento;

  renderizar(true);

  if (evento?.tipo !== 'descarte') {
    if (evento?.tipo === 'zerado') anunciar('Placar zerado.');
    if (evento?.tipo === 'restaurado') anunciar('Placar voltou aos dados de exemplo.');
    return;
  }

  const item = placar.ranking.find((i) => i.andar === evento.andar);
  const linha = estado.linhas.get(evento.andar);
  if (linha?.isConnected && item) destacarLinha(linha, evento, posicaoAntes.get(evento.andar), item.posicao);
  estado.predio?.soltarLuz(evento.andar, evento.descarte);

  const tipo = evento.descarte === 'organico' ? 'orgânico' : 'reciclável';
  anunciar(`${nomeAndar(evento.andar)}: mais ${evento.pontos} pontos, ${tipo}. Agora em ${ordinal(item.posicao)} lugar.`);

  const lider = liderUnico(placar);
  if (lider && lider.andar === evento.andar && lider.andar !== liderAntes?.andar) {
    // No palco, com a plateia tocando, o líder troca toda hora: no máximo uma celebração a cada 15 s.
    const descanso = estado.palco && Date.now() - estado.ultimaCelebracao < 15_000;
    if (!descanso) {
      estado.ultimaCelebracao = Date.now();
      celebrar(lider);
    }
  }
}

function destacarLinha(linha, evento, posicaoAntes, posicaoDepois) {
  marcarDescarte(linha, evento.pontos, { brilho: '.t-linha__brilho', mais: '.t-linha__mais' });

  if (posicaoAntes && posicaoDepois && posicaoDepois < posicaoAntes) {
    // Seta pequena para cima, em texto secundário, ao lado da posição, por 6 s.
    const seta = linha.querySelector('.t-linha__subiu');
    if (semMovimento()) {
      seta.style.opacity = '1';
      clearTimeout(Number(seta.dataset.relogio));
      seta.dataset.relogio = String(setTimeout(() => (seta.style.opacity = ''), 6000));
    } else {
      pulsar(seta, [{ opacity: 0 }, { opacity: 1, offset: 0.05 }, { opacity: 1, offset: 0.92 }, { opacity: 0 }], {
        duration: 6000,
        id: 'subiu',
      });
    }
  }
}

function anunciar(texto) {
  $('t-anuncio').textContent = texto;
}

/* ------------------------------------------------------------------ */
/* Novo líder: folha de vidro, sem festa                               */
/* ------------------------------------------------------------------ */

function celebrar(lider) {
  const palco = $('palco');
  const camada = $('t-celebracao');
  const folha = camada.querySelector('.t-celebracao__folha');
  const feixe = camada.querySelector('.t-celebracao__feixe');
  $('t-celebracao-andar').textContent = nomeAndar(lider.andar);
  $('t-celebracao-texto').textContent = `assumiu a liderança com ${rotuloPontos(lider.pontos)}`;
  anunciar(`Novo líder: ${nomeAndar(lider.andar)}.`);

  clearTimeout(estado.fimCelebracao);
  for (const a of estado.animacoes) a.cancel();
  estado.animacoes = [];

  camada.hidden = false;
  palco.classList.add('celebrando');
  const terminar = () => {
    camada.hidden = true;
    palco.classList.remove('celebrando');
  };

  if (semMovimento()) {
    // Sem movimento (ou modo estável): aparece parada e some depois de 4 s.
    estado.fimCelebracao = setTimeout(terminar, 4000);
    return;
  }

  const atraso = 600; // deixa a linha terminar de subir
  estado.animacoes.push(
    folha.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], {
      duration: 480,
      delay: atraso,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'backwards',
    }),
    feixe.animate([{ transform: 'translateX(-120%)' }, { transform: 'translateX(260%)' }], {
      duration: 1600,
      delay: atraso + 500,
      easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
      fill: 'both',
    }),
  );
  estado.fimCelebracao = setTimeout(() => {
    const saida = folha.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: 'ease-in', fill: 'forwards' });
    estado.animacoes.push(saida);
    saida.finished
      .then(() => {
        terminar();
        saida.cancel();
      })
      .catch(() => {});
  }, atraso + 4000);
}

/* ------------------------------------------------------------------ */
/* Sensor pela porta serial (?sensor=1)                                */
/* ------------------------------------------------------------------ */

function ligarSensor() {
  const painel = $('t-sensor-painel');
  const botao = $('t-sensor');
  $('palco').classList.add('com-sensor');
  painel.hidden = false;

  if (!serialDisponivel()) {
    botao.disabled = true;
    $('t-sensor-texto').textContent = 'Indisponível';
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
  $('t-sensor-texto').textContent = situacao === 'conectado' ? 'Desconectar' : 'Conectar sensor';
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
    ultima.textContent = `${teste ? 'Teste' : 'Recebido'} às ${quando}: “${String(linha).trim()}”`;
  } catch (erro) {
    ultima.textContent = `Não registrou: ${erro.message}`;
  }
}

// Sem movimento contínuo no modo estável: nada de luz derivando, nada de WebGL.
if (modoEstavel()) document.body.classList.add('estavel-ativo');

iniciar();
