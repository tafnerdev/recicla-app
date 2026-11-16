/**
 * Recicla Slide: registro do service worker (uso offline e instalação).
 * - Avisa quando há versão nova e só recarrega se a pessoa tocar em "Atualizar"
 *   (o telão nunca recarrega sozinho no meio da apresentação).
 * - Mostra o botão "Instalar" (elementos com data-instalar) quando o navegador permite.
 * - No iPhone, mostra a dica de "Adicionar à Tela de Início" (#dica-ios).
 * - Avisa quando a internet cai e volta.
 */
import { avisar } from './comum.js';

const URL_SW = new URL('../sw.js', import.meta.url);
const ESCOPO = new URL('../', import.meta.url);

let pedidoInstalacao = null;
let pediuAtualizacao = false;

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

function avisarConexao() {
  addEventListener('offline', () => avisar('Sem internet. O app continua funcionando com o que está guardado neste aparelho.'));
  addEventListener('online', () => avisar('Internet de volta.'));
}

async function registrar() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  try {
    const registro = await navigator.serviceWorker.register(URL_SW, { scope: ESCOPO.pathname });

    const oferecerAtualizacao = (trabalhador) => {
      avisar('Nova versão disponível.', {
        duracao: 15000,
        acao: {
          rotulo: 'Atualizar',
          aoClicar: () => {
            pediuAtualizacao = true;
            trabalhador.postMessage({ tipo: 'atualizar' });
          },
        },
      });
    };

    if (registro.waiting && navigator.serviceWorker.controller) oferecerAtualizacao(registro.waiting);
    registro.addEventListener('updatefound', () => {
      const novo = registro.installing;
      novo?.addEventListener('statechange', () => {
        if (novo.state === 'installed' && navigator.serviceWorker.controller) oferecerAtualizacao(novo);
      });
    });

    // Na primeira visita o controle também muda (clients.claim): aí não recarrega.
    let recarregando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recarregando || !pediuAtualizacao) return;
      recarregando = true;
      location.reload();
    });
  } catch (erro) {
    console.warn('[Recicla Slide] service worker não registrado:', erro);
  }
}

dicaIos();
avisarConexao();
registrar();
