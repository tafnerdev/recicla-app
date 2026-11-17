/**
 * Recicla Slide: página inicial (/).
 * Menu, revelação na rolagem, o prédio da abertura (com um laço de demonstração)
 * e a demonstração do ranking.
 */
import { criarSimulacao, obterEdificio, obterPlacar } from './dados.js';
import {
  atualizarLinhaRanking,
  avisar,
  criarLinhaRanking,
  el,
  icone,
  marcarDescarte,
  nomeAndar,
  ordinal,
  prepararAvisos,
  pulsar,
  reduzMovimento,
  reordenarComAnimacao,
  semMovimento,
  rotuloDescartes,
  rotuloPontos,
  ligarCabecalhoQueSome,
} from './comum.js';
import { ligarLixeira, trocarPorVideoSeExistir } from './lixeira.js';
import { montarPredio } from './predio.js';

const $ = (id) => document.getElementById(id);

prepararAvisos();
for (const caixa of document.querySelectorAll('[data-icone]')) caixa.innerHTML = icone(caixa.dataset.icone);

/* ------------------------------------------------------------------ */
/* Menu do celular                                                     */
/* ------------------------------------------------------------------ */

function ligarMenu() {
  const botao = $('abrir-menu');
  const folha = $('menu-folha');
  const navFolha = $('menu-folha-nav');
  const raiz = document.documentElement;

  // Os links da folha são os mesmos do menu do cabeçalho.
  const lista = document.querySelector('#menu ul').cloneNode(true);
  const contato = document.querySelector('#menu .menu__cta').cloneNode(true);
  contato.classList.add('botao--grande', 'botao--bloco');
  navFolha.replaceChildren(lista, contato);

  const abrir = () => {
    if (folha.open) return;
    folha.classList.remove('fechando');
    raiz.classList.add('menu-aberto'); // o fundo não rola
    folha.showModal();
    botao.setAttribute('aria-expanded', 'true');
  };

  const fechar = (depois) => {
    if (!folha.open || folha.classList.contains('fechando')) return;
    botao.setAttribute('aria-expanded', 'false');
    const terminar = () => {
      folha.classList.remove('fechando');
      folha.close();
      raiz.classList.remove('menu-aberto');
      depois?.();
    };
    if (semMovimento()) {
      terminar();
      return;
    }
    folha.classList.add('fechando');
    setTimeout(terminar, 220);
  };

  botao.addEventListener('click', abrir);
  $('fechar-menu').addEventListener('click', () => fechar());
  folha.addEventListener('cancel', (e) => {
    e.preventDefault();
    fechar();
  });
  folha.addEventListener('click', (e) => {
    // toque no fundo escurecido
    if (e.target === folha) {
      const r = folha.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) fechar();
      return;
    }
    const link = e.target.closest('a');
    if (!link) return;
    const destino = link.getAttribute('href');
    if (!destino.startsWith('#')) return; // outra página: segue normalmente
    e.preventDefault();
    // Fecha primeiro (destrava a rolagem) e só depois vai até a seção.
    fechar(() => {
      if (location.hash === destino) document.querySelector(destino)?.scrollIntoView();
      else location.hash = destino;
    });
  });
  // Virou tela larga com a folha aberta: fecha.
  matchMedia('(min-width: 900px)').addEventListener('change', (e) => {
    if (e.matches) fechar();
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
  const revelar = (lote) =>
    gsap.to(lote, {
      opacity: 1,
      y: 0,
      duration: 0.48,
      ease: 'expo.out',
      stagger: 0.06,
      overwrite: true,
      // Sem clearProps: apagar o transform inline traria de volta o translateY do CSS.
    });
  ScrollTrigger.batch('[data-revelar]', {
    start: 'top 90%',
    once: true,
    onEnter: revelar,
    // Quem rola rápido para baixo e volta também encontra o conteúdo.
    onEnterBack: revelar,
  });
  ligarParalaxe();
  // Fontes e conteúdo carregado depois (a demonstração do ranking) mudam a altura da página.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

/* ------------------------------------------------------------------ */
/* A lixeira da abertura                                               */
/* ------------------------------------------------------------------ */

function ligarAbertura() {
  const elemento = document.querySelector('.heroi__lixeira');
  if (!elemento) return;
  const lixeira = ligarLixeira(elemento);

  // Encaixe pronto para o vídeo do giro: se assets/lixeira/giro.mp4 existir, entra no lugar da foto.
  trocarPorVideoSeExistir(lixeira);

  // O anel dá um pulso a cada descarte de demonstração, enquanto a abertura está na tela.
  if (reduzMovimento()) return;
  let visivel = false;
  let relogio = 0;
  const agendar = (espera) => {
    clearTimeout(relogio);
    if (!visivel || document.hidden) return;
    relogio = setTimeout(() => {
      lixeira.pulsar(Math.random() < 0.58 ? 'reciclavel' : 'organico');
      agendar(3600 + Math.random() * 2400);
    }, espera);
  };
  new IntersectionObserver(
    ([entrada]) => {
      visivel = entrada.isIntersecting;
      agendar(1800);
    },
    { threshold: 0.2 },
  ).observe(elemento);
  document.addEventListener('visibilitychange', () => agendar(1800));
}

/** Paralaxe leve: a foto da abertura desce mais devagar que a página. */
function ligarParalaxe() {
  const { gsap, ScrollTrigger } = window;
  const midia = document.getElementById('heroi-midia');
  if (!gsap || !ScrollTrigger || !midia || reduzMovimento()) return;
  gsap.to(midia, {
    yPercent: 16,
    ease: 'none',
    scrollTrigger: { trigger: '.heroi', start: 'top top', end: 'bottom top', scrub: true },
  });
}

/* ------------------------------------------------------------------ */
/* Demonstração do ranking (simulação em memória)                      */
/* ------------------------------------------------------------------ */

async function ligarDemoRanking() {
  const lista = $('demo-lista');
  const status = $('demo-status');
  const opcoes = $('demo-andares');
  const botoes = [...document.querySelectorAll('.controle__botoes .botao-tipo')];
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
  for (const botao of botoes) {
    botao.querySelector('.botao-tipo__sub').textContent = `+${edificio.pontosPorDescarte[botao.dataset.tipo]} para o andar`;
  }

  opcoes.replaceChildren(
    ...edificio.andares.map((andar) =>
      el(
        'label',
        { class: 'chip-andar' },
        el('input', { type: 'radio', name: 'demo-andar', value: andar, checked: andar === escolhido, 'aria-label': nomeAndar(andar) }),
        el('span', { 'aria-hidden': 'true' }, ordinal(andar)),
      ),
    ),
  );

  let placar = await simulacao.obterPlacar();

  // O prédio, pequeno, como contexto: o andar escolhido aceso e a luz descendo a cada descarte.
  const pontosAndares = () => Object.fromEntries(placar.ranking.map((i) => [i.andar, i.pontos]));
  const predio = montarPredio($('s-predio'), {
    andares: edificio.andares,
    aceso: escolhido,
    modo: 'lider',
    pontos: 'site',
    pontosAndares: pontosAndares(),
    traco: 0.7,
    largura: null,
    interativo: true,
    descricao: (estado) => `Prédio de ${edificio.andares.length} andares com o ${nomeAndar(estado.aceso)} aceso.`,
  });

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
    const lider = placar.ranking[0];
    const totalLider = lider.reciclavel + lider.organico;
    const ordem = placar.ranking.map((item) => {
      let linha = linhas.get(item.andar);
      if (!linha) {
        linha = criarLinhaRanking(item.andar);
        linhas.set(item.andar, linha);
      }
      atualizarLinhaRanking(linha, item, { totalLider, animar, minha: item.andar === escolhido, rotulo: 'escolhido' });
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
      marcarDescarte(linhas.get(evento.andar), evento.pontos);
      const depois = novo.ranking.find((i) => i.andar === escolhido)?.posicao;
      if (antes && depois && depois < antes) {
        status.innerHTML = `<strong>Subiu de posição.</strong> ${descrever()}`;
      }
    }
    reiniciar.hidden = novo.evento?.tipo === 'restaurado';
    predio.atualizar({ aceso: escolhido, pontosAndares: pontosAndares() });
    if (evento?.tipo === 'descarte') predio.soltarLuz(evento.andar, evento.descarte);
  });

  opcoes.addEventListener('change', (e) => {
    escolhido = Number(e.target.value);
    renderizar(false);
    predio.atualizar({ aceso: escolhido });
  });

  for (const botao of botoes) {
    botao.disabled = false;
    botao.addEventListener('click', () => {
      simulacao.registrarDescarte(escolhido, botao.dataset.tipo);
      pulsar(botao.querySelector('.botao-tipo__brilho'), [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], {
        duration: 1100,
        id: 'brilho',
      });
    });
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
ligarCabecalhoQueSome(document.querySelector('.cabecalho'), {
  travado: () => document.documentElement.classList.contains('menu-aberto'),
});
ligarSecaoAtual();
ligarContato();
ligarDemoRanking();
ligarAbertura();

// GSAP e ScrollTrigger chegam com "defer"; módulos rodam depois deles, mas confere por garantia.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligarRevelacao);
else ligarRevelacao();
