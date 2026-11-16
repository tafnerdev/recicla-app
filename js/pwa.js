/**
 * Recicla Slide: registro do service worker (uso offline e instalação).
 * - Atualização automática: quando sai versão nova, o service worker assume na hora
 *   e a tela recarrega sozinha uma vez, assim que estiver parada (sem folha aberta,
 *   sem campo sendo digitado, sem animação curta rodando). O telão ainda espera a
 *   celebração e as animações de descarte terminarem (definirCondicaoParaRecarregar).
 * - Procura versão nova ao voltar para a aba, quando a internet volta e a cada 10 min.
 * - Mostra o botão "Instalar" (elementos com data-instalar) quando o navegador permite.
 * - No iPhone, mostra a dica de "Adicionar à Tela de Início" (#dica-ios).
 * - Avisa quando a internet cai e volta.
 */
import { avisar } from './comum.js';

const URL_SW = new URL('../sw.js', import.meta.url);
const ESCOPO = new URL('../', import.meta.url);

let pedidoInstalacao = null;

function instalado() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function mostrarBotoesInstalar(mostrar) {
  for (const botao of document.querySelectorAll('[data-instalar]')) botao.hidden = !mostrar;
}

addEventListener('beforeinstallprompt', (evento) => {
  evento.preventDefault();
  pedidoInstalacao = evento;
  mostrarBotoesInstalar(true);
});

addEventListener('appinstalled', () => {
  pedidoInstalacao = null;
  mostrarBotoesInstalar(false);
  avisar('App instalado. Ele abre direto da tela inicial.');
});

document.addEventListener('click', async (evento) => {
  const botao = evento.target.closest?.('[data-instalar]');
  if (!botao || !pedidoInstalacao) return;
  pedidoInstalacao.prompt();
  await pedidoInstalacao.userChoice;
  pedidoInstalacao = null;
  mostrarBotoesInstalar(false);
});

function dicaIos() {
  const dica = document.getElementById('dica-ios');
  if (!dica) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  dica.hidden = !(ios && !instalado());
}

/** O telão fica no projetor: nada de avisos pequenos aparecendo no meio da apresentação. */
const SILENCIOSO = document.body?.classList.contains('tela-telao') ?? false;

function avisarConexao() {
  if (SILENCIOSO) return;
  addEventListener('offline', () => avisar('Sem internet. O app continua funcionando com o que está guardado neste aparelho.'));
  addEventListener('online', () => avisar('Internet de volta.'));
}

/* ------------------------------------------------------------------ */
/* Atualização automática                                              */
/* ------------------------------------------------------------------ */

let condicaoExtra = () => true;
let recarregando = false;

/** A tela pode pedir para esperar (o telão no meio de uma celebração, por exemplo). */
export function definirCondicaoParaRecarregar(funcao) {
  condicaoExtra = typeof funcao === 'function' ? funcao : () => true;
}

/** A tela está parada? Sem folha aberta, sem digitação e sem animação curta rodando. */
function telaParada() {
  if (document.querySelector('dialog[open]')) return false;
  const ativo = document.activeElement;
  if (ativo?.matches?.('input:not([type="radio"]):not([type="checkbox"]), textarea, select')) return false;
  const animando = document.getAnimations().some((animacao) => {
    if (animacao.playState !== 'running') return false;
    const fim = animacao.effect?.getComputedTiming?.().endTime;
    return Number.isFinite(fim) && fim > 0; // as infinitas (luz, anel de LED) não contam
  });
  if (animando) return false;
  try {
    return condicaoExtra() !== false;
  } catch {
    return true;
  }
}

function recarregarQuandoParada() {
  if (recarregando) return;
  // Trava contra laço: no máximo uma recarga automática a cada 20 s.
  try {
    const ultima = Number(sessionStorage.getItem('recicla-recarga') || 0);
    if (Date.now() - ultima < 20_000) return;
  } catch {
    /* sem sessionStorage: segue */
  }
  recarregando = true;
  const tentar = () => {
    if (!telaParada()) {
      setTimeout(tentar, 500);
      return;
    }
    try {
      sessionStorage.setItem('recicla-recarga', String(Date.now()));
    } catch {
      /* segue */
    }
    location.reload();
  };
  tentar();
}

async function registrar() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  // Na primeira visita o controle também muda (clients.claim): aí não recarrega.
  let tinhaControle = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener('message', (evento) => {
    if (evento.data?.tipo !== 'versao-nova') return;
    // Responde que esta aba recarrega sozinha (assim o service worker não força a recarga).
    (evento.source ?? navigator.serviceWorker.controller)?.postMessage({ tipo: 'eu-recarrego' });
    recarregarQuandoParada();
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (tinhaControle) recarregarQuandoParada();
    tinhaControle = true;
  });

  try {
    const registro = await navigator.serviceWorker.register(URL_SW, { scope: ESCOPO.pathname });
    // Versão nova que ficou esperando (de um service worker antigo): manda assumir agora.
    if (registro.waiting && navigator.serviceWorker.controller) registro.waiting.postMessage({ tipo: 'atualizar' });
    registro.addEventListener('updatefound', () => {
      const novo = registro.installing;
      novo?.addEventListener('statechange', () => {
        if (novo.state === 'installed' && navigator.serviceWorker.controller) novo.postMessage({ tipo: 'atualizar' });
      });
    });
    // Procura versão nova de tempos em tempos (o telão e o app ficam abertos por horas).
    const procurar = () => registro.update().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) procurar();
    });
    addEventListener('online', procurar);
    setInterval(procurar, 10 * 60 * 1000);
  } catch (erro) {
    console.warn('[Recicla Slide] service worker não registrado:', erro);
  }
}

dicaIos();
avisarConexao();
registrar();
