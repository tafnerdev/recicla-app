/**
 * Recicla Slide: página inicial (/).
 * Menu, revelação na rolagem, tobogã animado da abertura e a demonstração do ranking.
 */
import { criarSimulacao, obterEdificio } from './dados.js';
import {
  atualizarLinhaRanking,
  avisar,
  criarLinhaRanking,
  el,
  icone,
  nomeAndar,
  ordinal,
  prepararAvisos,
  pulsar,
  reduzMovimento,
  reordenarComAnimacao,
  rotuloDescartes,
  rotuloPontos,
} from './comum.js';

const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const COR = { reciclavel: '#8BD17C', organico: '#F2A541' };

prepararAvisos();
for (const caixa of document.querySelectorAll('[data-icone]')) caixa.innerHTML = icone(caixa.dataset.icone);

/* ------------------------------------------------------------------ */
/* Menu do celular                                                     */
/* ------------------------------------------------------------------ */

function ligarMenu() {
  const botao = $('abrir-menu');
  const menu = $('menu');
  const definir = (aberto) => {
    botao.setAttribute('aria-expanded', String(aberto));
    menu.classList.toggle('aberto', aberto);
  };
  botao.addEventListener('click', () => definir(botao.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) definir(false);
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && botao.getAttribute('aria-expanded') === 'true') {
      definir(false);
      botao.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.cabecalho')) definir(false);
  });
}

/** Marca no menu a seção que está na tela. */
function ligarSecaoAtual() {
  const links = [...document.querySelectorAll('.menu ul a[href^="#"]')];
  const alvos = new Map(links.map((a) => [document.querySelector(a.getAttribute('href')), a]));
  const heroi = document.querySelector('.heroi');
  if (heroi) alvos.set(heroi, null);
  const observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        const atual = alvos.get(entrada.target);
        for (const link of links) {
          if (link === atual) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        }
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  for (const alvo of alvos.keys()) if (alvo) observador.observe(alvo);
}

/* ------------------------------------------------------------------ */
/* Revelação na rolagem (ScrollTrigger)                                */
/* ------------------------------------------------------------------ */

function ligarRevelacao() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger || reduzMovimento()) return;
  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add('anima');
  ScrollTrigger.batch('[data-revelar]', {
    start: 'top 88%',
    once: true,
    onEnter: (lote) =>
      gsap.to(lote, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'expo.out',
        stagger: 0.08,
        overwrite: true,
        // Sem clearProps: apagar o transform inline traria de volta o translateY do CSS.
      }),
  });
  // Fontes e conteúdo carregado depois (a demonstração do ranking) mudam a altura da página.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

/* ------------------------------------------------------------------ */
/* Tobogã da abertura                                                  */
/* ------------------------------------------------------------------ */

const GEO = {
  entrada: (k) => 96 + 70 * k, // altura do ramal da lixeira do andar k (k = 0 é o 6º andar)
  topo: (k) => 52 + 70 * k,
  amplitude: 9,
  faixas: { reciclavel: { x: 412, dy: -8 }, organico: { x: 462, dy: 8 } },
  fundo: 530,
};

/** Caminho que o item faz: sai da lixeira, entra no tubo e desce até a central. */
function caminhoItem(k, tipo) {
  const { x, dy } = GEO.faixas[tipo];
  const y = GEO.entrada(k) + dy;
  const a = GEO.amplitude;
  let d = `M 322 ${y} L ${x - 12} ${y} Q ${x} ${y} ${x} ${y + 12}`;
  for (let i = k; i < 5; i += 1) {
    const j = GEO.entrada(i) + dy + 12;
    d += ` C ${x + a} ${j + 23} ${x - a} ${j + 47} ${x} ${j + 70}`;
  }
  return `${d} L ${x} ${GEO.fundo}`;
}

function ligarTobogan() {
  const svg = $('tobogan');
  if (!svg) return;
  const camadaItens = $('tobogan-itens');
  const camadaPontos = $('tobogan-pontos');
  const { gsap, MotionPathPlugin } = window;

  if (!gsap || !MotionPathPlugin || reduzMovimento()) {
    desenharParado(camadaItens);
    return;
  }
  gsap.registerPlugin(MotionPathPlugin);

  let visivel = false;
  let relogio = 0;
  const agendar = (espera) => {
    clearTimeout(relogio);
    if (!visivel || document.hidden) return;
    relogio = setTimeout(() => {
      soltar();
      agendar(gsap.utils.random(1100, 1900));
    }, espera);
  };
  new IntersectionObserver(
    ([entrada]) => {
      visivel = entrada.isIntersecting;
      agendar(450);
    },
    { threshold: 0.2 },
  ).observe(svg);
  document.addEventListener('visibilitychange', () => agendar(450));

  let ultimoAndar = null;
  function soltar() {
    let k = Math.floor(Math.random() * 6);
    if (6 - k === ultimoAndar) k = (k + 2) % 6; // evita o mesmo andar duas vezes seguidas
    const andar = 6 - k;
    ultimoAndar = andar;
    const tipo = Math.random() < 0.56 ? 'reciclavel' : 'organico';
    const { dy } = GEO.faixas[tipo];

    const item = document.createElementNS(NS, 'circle');
    item.setAttribute('r', '6.5');
    item.setAttribute('fill', COR[tipo]);
    camadaItens.append(item);

    const queda = 0.75 + 0.26 * (5 - k);
    gsap
      .timeline({ onComplete: () => item.remove() })
      .set(item, { x: 322, y: GEO.entrada(k) + dy, opacity: 0, scale: 0.3, transformOrigin: '50% 50%' })
      .to(item, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2.2)' })
      .add(() => pontuar(k, andar, tipo))
      .to(item, { motionPath: { path: caminhoItem(k, tipo) }, duration: queda, ease: 'power2.in' })
      .add(() => chegar(tipo), `-=0.08`)
      .to(item, { opacity: 0, scale: 0.5, duration: 0.18 }, '>-0.04');
  }

  function pontuar(k, andar, tipo) {
    const faixa = svg.querySelector(`.tobogan__faixas rect[data-andar="${andar}"]`);
    faixa.dataset.tipo = tipo;
    gsap.fromTo(faixa, { opacity: 0.16 }, { opacity: 0, duration: 1.4, ease: 'power2.out', overwrite: true });

    const mais = document.createElementNS(NS, 'text');
    mais.setAttribute('class', 'tobogan__mais');
    mais.setAttribute('fill', COR[tipo]);
    mais.setAttribute('x', '290');
    mais.setAttribute('y', String(GEO.topo(k) + 19));
    mais.setAttribute('text-anchor', 'middle');
    mais.textContent = '+10';
    camadaPontos.append(mais);
    gsap.fromTo(
      mais,
      { opacity: 0, y: 10 },
      {
        keyframes: [
          { opacity: 1, y: -4, duration: 0.35, ease: 'back.out(2)' },
          { opacity: 0, y: -22, duration: 0.7, ease: 'power1.in', delay: 0.35 },
        ],
        onComplete: () => mais.remove(),
      },
    );

    const cartao = $('heroi-evento');
    $('heroi-evento-andar').textContent = nomeAndar(andar);
    const marca = $('heroi-evento-marca');
    marca.textContent = tipo === 'organico' ? 'O' : 'R';
    marca.classList.toggle('marca-tipo--organico', tipo === 'organico');
    gsap.fromTo(cartao, { opacity: 0, y: 10, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'expo.out', overwrite: true });
  }

  function chegar(tipo) {
    const central = $(tipo === 'organico' ? 'central-o' : 'central-r');
    gsap.fromTo(central, { scaleY: 0.9, scaleX: 1.05 }, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1, 0.45)', overwrite: true });
  }
}

/** Sem animação: alguns itens parados no meio dos tubos mostram o caminho. */
function desenharParado(camada) {
  const posicoes = [
    [0, 'reciclavel', 0.55],
    [2, 'organico', 0.4],
    [3, 'reciclavel', 0.7],
    [1, 'organico', 0.8],
  ];
  for (const [k, tipo, fracao] of posicoes) {
    const caminho = document.createElementNS(NS, 'path');
    caminho.setAttribute('d', caminhoItem(k, tipo));
    const ponto = caminho.getPointAtLength(caminho.getTotalLength() * fracao);
    const item = document.createElementNS(NS, 'circle');
    item.setAttribute('r', '6.5');
    item.setAttribute('cx', ponto.x.toFixed(1));
    item.setAttribute('cy', ponto.y.toFixed(1));
    item.setAttribute('fill', COR[tipo]);
    camada.append(item);
  }
  $('heroi-evento').classList.add('visivel');
}

/* ------------------------------------------------------------------ */
/* Demonstração do ranking (simulação em memória)                      */
/* ------------------------------------------------------------------ */

async function ligarDemoRanking() {
  const lista = $('demo-lista');
  const status = $('demo-status');
  const opcoes = $('demo-andares');
  const botoes = [...document.querySelectorAll('.controle__botoes .botao')];
  const reiniciar = $('demo-reiniciar');

  let simulacao;
  let edificio;
  try {
    [simulacao, edificio] = await Promise.all([criarSimulacao(), obterEdificio()]);
  } catch (erro) {
    console.error(erro);
    status.textContent =
      location.protocol === 'file:'
        ? 'Abra o site pelo servidor local (npm run servir) para ver a demonstração.'
        : 'Não deu para carregar o placar de exemplo. Recarregue a página para tentar de novo.';
    return;
  }

  let escolhido = edificio.andares.includes(7) ? 7 : edificio.andares[0];
  const linhas = new Map();
  const pontosPorDescarte = Math.max(edificio.pontosPorDescarte.reciclavel, edificio.pontosPorDescarte.organico);

  opcoes.replaceChildren(
    ...edificio.andares.map((andar) =>
      el(
        'label',
        { class: 'chip' },
        el('input', { type: 'radio', name: 'demo-andar', value: andar, checked: andar === escolhido, 'aria-label': nomeAndar(andar) }),
        el('span', { 'aria-hidden': 'true' }, ordinal(andar)),
      ),
    ),
  );

  let placar = await simulacao.obterPlacar();

  function descrever() {
    const { ranking } = placar;
    const item = ranking.find((i) => i.andar === escolhido);
    const nome = `<strong>${nomeAndar(escolhido)}</strong>`;
    if (!item.posicao) return `${nome} ainda não pontuou.`;
    const acima = ranking.filter((i) => i.pontos > item.pontos).at(-1);
    const lugar = `${ordinal(item.posicao)} lugar, com ${rotuloPontos(item.pontos)}`;
    if (!acima) {
      const empatados = ranking.filter((i) => i.posicao === 1).length > 1;
      return empatados ? `${nome} está empatado na frente, com ${rotuloPontos(item.pontos)}.` : `${nome} está na frente, com ${rotuloPontos(item.pontos)}.`;
    }
    const faltam = Math.ceil((acima.pontos - item.pontos + 1) / pontosPorDescarte);
    return `${nome}: ${lugar}. ${faltam === 1 ? 'Falta' : 'Faltam'} ${rotuloDescartes(faltam)} para passar o ${nomeAndar(acima.andar)}.`;
  }

  function renderizar(animar) {
    const maximo = Math.max(1, ...placar.ranking.map((i) => i.pontos));
    const ordem = placar.ranking.map((item) => {
      let linha = linhas.get(item.andar);
      if (!linha) {
        linha = criarLinhaRanking(item.andar);
        linhas.set(item.andar, linha);
      }
      atualizarLinhaRanking(linha, item, { maximo, animar, minha: item.andar === escolhido, rotulo: 'Escolhido' });
      return linha;
    });
    if (!lista.children.length) {
      lista.append(...ordem);
      // A lista mudou a altura da página: recalcula onde cada revelação começa.
      window.ScrollTrigger?.refresh();
    } else {
      reordenarComAnimacao(lista, ordem, { duracao: 760 });
    }
    status.innerHTML = descrever();
  }

  simulacao.aoMudar((novo) => {
    const antes = placar.ranking.find((i) => i.andar === escolhido)?.posicao;
    placar = novo;
    renderizar(true);
    const evento = novo.evento;
    if (evento?.tipo === 'descarte') {
      const brilho = linhas.get(evento.andar)?.querySelector('.linha__brilho');
      if (brilho) {
        brilho.dataset.tipo = evento.descarte;
        pulsar(brilho, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: 1000, id: 'brilho' });
      }
      const depois = novo.ranking.find((i) => i.andar === escolhido)?.posicao;
      if (antes && depois && depois < antes) {
        status.innerHTML = `<strong>Subiu de posição.</strong> ${descrever()}`;
      }
    }
    reiniciar.hidden = novo.evento?.tipo === 'restaurado';
  });

  opcoes.addEventListener('change', (e) => {
    escolhido = Number(e.target.value);
    renderizar(false);
  });

  for (const botao of botoes) {
    botao.disabled = false;
    botao.addEventListener('click', () => simulacao.registrarDescarte(escolhido, botao.dataset.tipo));
  }
  reiniciar.addEventListener('click', () => simulacao.restaurar());

  renderizar(false);
}

/* ------------------------------------------------------------------ */
/* Contato                                                             */
/* ------------------------------------------------------------------ */

function ligarContato() {
  const botao = $('contato-copiar');
  if (!botao) return;
  botao.addEventListener('click', async () => {
    const email = botao.dataset.email;
    try {
      await navigator.clipboard.writeText(email);
      avisar(`E-mail copiado: ${email}`);
    } catch {
      avisar(`Copie à mão: ${email}`);
    }
  });
}

/* ------------------------------------------------------------------ */

ligarMenu();
ligarSecaoAtual();
ligarContato();
ligarDemoRanking();

// GSAP e plugins chegam com "defer"; módulos rodam depois deles, mas confere por garantia.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ligarRevelacao();
    ligarTobogan();
  });
} else {
  ligarRevelacao();
  ligarTobogan();
}
