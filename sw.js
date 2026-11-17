/**
 * Recicla Slide: service worker.
 * Guarda todas as telas no aparelho para funcionar sem internet.
 *
 * - Páginas e dados (JSON): tenta a rede primeiro (até 2,5 s) e cai no que está guardado.
 * - CSS, JS, fontes e ícones: entrega o que está guardado na hora e atualiza em segundo plano.
 *
 * Ao publicar uma versão nova, mude VERSAO. As telas avisam "Nova versão disponível".
 */
const VERSAO = 'recicla-v10';
const ESPERA_REDE = 2500;

const ARQUIVOS = [
  './',
  'app/',
  'telao/',
  'demo/',
  'sindico/',
  '404.html',
  'manifest.webmanifest',
  'data/edificio-exemplo.json',
  'css/base.css',
  'css/site.css',
  'css/app.css',
  'css/telao.css',
  'css/demo.css',
  'css/sindico.css',
  'js/dados.js',
  'js/comum.js',
  'js/site.js',
  'js/app.js',
  'js/telao.js',
  'js/demo.js',
  'js/sindico.js',
  'js/local.js',
  'js/qr.js',
  'js/serial.js',
  'js/predio.js',
  'js/lixeira.js',
  'js/config.js',
  'js/remoto.js',
  'js/vendor/supabase.esm.js',
  'js/vendor/uqr.mjs',
  'assets/lixeira/lixeira-parede-verde.jpg',
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

// Versão nova assume na hora: guarda os arquivos novos e não espera as abas fecharem.
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(VERSAO)
      .then((cache) => cache.addAll(ARQUIVOS.map((a) => new Request(a, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      const antigas = nomes.filter((n) => n.startsWith('recicla-') && n !== VERSAO);
      await Promise.all(antigas.map((n) => caches.delete(n)));
      await self.clients.claim();
      // Só numa atualização (havia versão antiga): avisa as abas abertas para recarregarem.
      if (antigas.length) await avisarAbas();
    })(),
  );
});

/** Abas que responderam "eu recarrego sozinha" (código novo do js/pwa.js). */
const abasQueCuidam = new Set();

self.addEventListener('message', (evento) => {
  if (evento.data?.tipo === 'atualizar') self.skipWaiting();
  if (evento.data?.tipo === 'eu-recarrego' && evento.source?.id) abasQueCuidam.add(evento.source.id);
});

/**
 * Avisa as abas que há versão nova. As que têm o js/pwa.js novo recarregam sozinhas
 * quando a tela estiver parada. As que ainda rodam código antigo (que só recarregava
 * com um toque) são recarregadas por aqui, menos o telão, que nunca é interrompido.
 */
async function avisarAbas() {
  const abas = await self.clients.matchAll({ type: 'window' });
  for (const aba of abas) aba.postMessage({ tipo: 'versao-nova', versao: VERSAO });
  await new Promise((resolver) => setTimeout(resolver, 2500));
  for (const aba of abas) {
    if (abasQueCuidam.has(aba.id) || new URL(aba.url).pathname.includes('/telao/')) continue;
    if (typeof aba.navigate === 'function') aba.navigate(aba.url).catch(() => {});
  }
}

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
  // Vídeos ficam fora do cache: são grandes e o navegador pede em pedaços (Range).
  if (url.pathname.endsWith('.mp4') || url.pathname.includes('/assets/video/') || request.headers.has('range')) return;

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

  // Dados e a ligação com o placar online: rede primeiro (o config.js preenchido vale na hora).
  if (url.pathname.endsWith('.json') || url.pathname.endsWith('/js/config.js')) {
    evento.respondWith(redePrimeiro(request, { ignoreSearch: true }));
    return;
  }

  evento.respondWith(guardadoPrimeiro(evento));
});
