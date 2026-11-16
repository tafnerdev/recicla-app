/**
 * Recicla Slide: service worker.
 * Guarda todas as telas no aparelho para funcionar sem internet.
 *
 * - Páginas e dados (JSON): tenta a rede primeiro (até 2,5 s) e cai no que está guardado.
 * - CSS, JS, fontes e ícones: entrega o que está guardado na hora e atualiza em segundo plano.
 *
 * Ao publicar uma versão nova, mude VERSAO. As telas avisam "Nova versão disponível".
 */
const VERSAO = 'recicla-v5';
const ESPERA_REDE = 2500;

const ARQUIVOS = [
  './',
  'app/',
  'telao/',
  'demo/',
  '404.html',
  'manifest.webmanifest',
  'data/edificio-exemplo.json',
  'css/base.css',
  'css/site.css',
  'css/app.css',
  'css/telao.css',
  'css/demo.css',
  'js/dados.js',
  'js/comum.js',
  'js/site.js',
  'js/app.js',
  'js/telao.js',
  'js/demo.js',
  'js/serial.js',
  'js/predio.js',
  'js/predio3d.js',
  'js/vendor/three.module.min.js',
  'js/vendor/three.core.min.js',
  'js/pwa.js',
  'js/vendor/gsap.min.js',
  'js/vendor/ScrollTrigger.min.js',
  'fonts/rubik-latin.woff2',
  'fonts/geist-latin.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS.map((a) => new Request(a, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((n) => n.startsWith('recicla-') && n !== VERSAO).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (evento) => {
  if (evento.data?.tipo === 'atualizar') self.skipWaiting();
});

function comPrazo(promessa, ms) {
  return new Promise((resolver, rejeitar) => {
    const relogio = setTimeout(() => rejeitar(new Error('rede lenta')), ms);
    promessa.then(
      (v) => {
        clearTimeout(relogio);
        resolver(v);
      },
      (e) => {
        clearTimeout(relogio);
        rejeitar(e);
      },
    );
  });
}

/** Resposta que veio de um redirecionamento não pode responder a uma navegação: copia limpa. */
async function semRedirecionamento(resposta) {
  if (!resposta.redirected) return resposta;
  const corpo = await resposta.blob();
  return new Response(corpo, { status: resposta.status, statusText: resposta.statusText, headers: resposta.headers });
}

/** Rede primeiro, com prazo; se falhar, o que estiver guardado. */
async function redePrimeiro(pedido, opcoesBusca) {
  const cache = await caches.open(VERSAO);
  const daRede = fetch(pedido).then((resposta) => {
    if (resposta.ok) cache.put(pedido, resposta.clone());
    return resposta;
  });
  try {
    return await comPrazo(daRede, ESPERA_REDE);
  } catch {
    const guardada = await cache.match(pedido, opcoesBusca);
    if (guardada) return guardada;
    return daRede; // nada guardado: espera a rede de qualquer jeito
  }
}

/** Guardado primeiro, atualizando em segundo plano. */
async function guardadoPrimeiro(evento) {
  const cache = await caches.open(VERSAO);
  const guardada = await cache.match(evento.request, { ignoreSearch: true });
  const daRede = fetch(evento.request)
    .then((resposta) => {
      if (resposta.ok) cache.put(evento.request, resposta.clone());
      return resposta;
    })
    .catch(() => null);
  if (guardada) {
    evento.waitUntil(daRede);
    return guardada;
  }
  return (await daRede) ?? Response.error();
}

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (request.mode === 'navigate') {
    evento.respondWith(
      (async () => {
        try {
          return await semRedirecionamento(await redePrimeiro(request, { ignoreSearch: true }));
        } catch {
          const cache = await caches.open(VERSAO);
          return (await cache.match('404.html')) ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.endsWith('.json')) {
    evento.respondWith(redePrimeiro(request, { ignoreSearch: true }));
    return;
  }

  evento.respondWith(guardadoPrimeiro(evento));
});
