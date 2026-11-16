/**
 * Recicla Slide: a lixeira (render de assets/lixeira/) com o anel de LED vivo.
 *
 * A foto e o brilho ficam dentro da mesma "cena", que tem a proporção da imagem.
 * O brilho é um SVG com o viewBox igual ao tamanho da foto, então ele cai
 * exatamente em cima do anel em qualquer tamanho e em qualquer recorte.
 * O anel respira devagar (CSS) e dá um pulso a cada descarte: verde no
 * reciclável, laranja no orgânico.
 *
 * As curvas do anel foram medidas em capturas ampliadas da foto (pixels da imagem).
 */
import { semMovimento } from './comum.js';

export const FOTOS = {
  verde: {
    arquivo: 'lixeira-parede-verde.jpg',
    largura: 1700,
    altura: 949,
    anel: 'M664,281 C730,304 830,322 893,325 C940,327 978,301 1014,271',
    // contorno da tampa, para a versão marrom (lixeira de orgânicos)
    tampa:
      'M665,262 C665,250 669,242 688,232 L776,204 C800,198 840,199 862,203 C868,214 878,222 900,224 C920,225 935,223 946,220 L995,227 C1012,230 1019,238 1019,250 L1019,262 C1005,282 980,300 940,309 C900,316 850,312 800,303 C750,296 700,290 667,283 Z',
    luz: { cx: 842, cy: 300, rx: 250, ry: 70 },
    // centro e altura da lixeira na foto (frações), para recortar em volta dela
    foco: { x: 0.494, y: 0.511, altura: 0.537 },
    descricao: 'Lixeira do Recicla Slide: corpo branco, tampa verde e anel de LED verde aceso, presa a um tubo de aço numa parede verde.',
  },
  concreto: {
    arquivo: 'lixeira-parede-concreto.jpg',
    largura: 1400,
    altura: 782,
    anel: 'M561,227 C590,248 640,260 694,259 C736,258 784,244 823,229',
    luz: { cx: 692, cy: 240, rx: 190, ry: 55 },
    foco: { x: 0.494, y: 0.511, altura: 0.614 },
    descricao: 'Lixeira do Recicla Slide: corpo branco, tampa verde e anel de LED verde aceso, presa a um tubo de aço numa parede de concreto.',
  },
};

let contador = 0;

/** Variáveis CSS que posicionam a cena (foco = centro da lixeira na foto). */
function variaveis(dados) {
  return `--lx-proporcao: ${dados.largura} / ${dados.altura}; --lx-razao: ${(dados.altura / dados.largura).toFixed(4)}; --lx-foco-x: ${dados.foco.x}; --lx-foco-y: ${dados.foco.y}; --lx-altura: ${dados.foco.altura};`;
}

/** Tampa marrom (lixeira de orgânicos): a tampa da foto é pintada mantendo a luz e a sombra. */
function htmlTampaMarrom(dados, id) {
  if (!dados.tampa) return '';
  const caixa = `viewBox="0 0 ${dados.largura} ${dados.altura}" preserveAspectRatio="none" aria-hidden="true" focusable="false"`;
  return `
    <svg class="lixeira__tinta lixeira__tinta--sombra" ${caixa}><defs><filter id="${id}-borda"><feGaussianBlur stdDeviation="0.8" /></filter></defs><path d="${dados.tampa}" filter="url(#${id}-borda)" /></svg>
    <svg class="lixeira__tinta lixeira__tinta--cor" ${caixa}><path d="${dados.tampa}" filter="url(#${id}-borda)" /></svg>`;
}

/**
 * HTML da lixeira (usado direto no index.html da abertura e por criarLixeira).
 * tampa: 'verde' (recicláveis, a foto como é) ou 'marrom' (orgânicos).
 */
export function htmlLixeira({ foto = 'verde', base = '', descricao, carregamento = 'eager', id = `lx-${++contador}`, classe = '', tampa = 'verde' } = {}) {
  const dados = FOTOS[foto] ?? FOTOS.verde;
  const { cx, cy, rx, ry } = dados.luz;
  const alt = (descricao ?? dados.descricao).replace(/"/g, '&quot;');
  return `<div class="lixeira${classe ? ` ${classe}` : ''}" data-foto="${foto}" data-tampa="${tampa}" style="${variaveis(dados)}">
  <div class="lixeira__cena">
    <img class="lixeira__foto" src="${base}assets/lixeira/${dados.arquivo}" width="${dados.largura}" height="${dados.altura}" alt="${alt}" decoding="async" loading="${carregamento}" />${tampa === 'marrom' ? htmlTampaMarrom(dados, id) : ''}
    <svg class="lixeira__led" viewBox="0 0 ${dados.largura} ${dados.altura}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <filter id="${id}-halo" x="-30%" y="-300%" width="160%" height="700%"><feGaussianBlur stdDeviation="9" /></filter>
        <filter id="${id}-largo" x="-40%" y="-400%" width="180%" height="900%"><feGaussianBlur stdDeviation="22" /></filter>
        <filter id="${id}-fio" x="-10%" y="-100%" width="120%" height="300%"><feGaussianBlur stdDeviation="1.4" /></filter>
      </defs>
      <g class="lixeira__respira">
        <path class="lixeira__halo" d="${dados.anel}" stroke-width="16" filter="url(#${id}-halo)" />
        <path class="lixeira__fio" d="${dados.anel}" stroke-width="3" filter="url(#${id}-fio)" />
      </g>
      <g class="lixeira__pulso">
        <ellipse class="lixeira__luz" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" filter="url(#${id}-largo)" />
        <path class="lixeira__halo" d="${dados.anel}" stroke-width="30" filter="url(#${id}-largo)" />
        <path class="lixeira__fio" d="${dados.anel}" stroke-width="5" filter="url(#${id}-fio)" />
      </g>
    </svg>
  </div>
</div>`;
}

/** Liga uma lixeira que já está na página. Devolve { elemento, cena, pulsar(tipo) }. */
export function ligarLixeira(elemento) {
  const pulso = elemento.querySelector('.lixeira__pulso');
  return {
    elemento,
    cena: elemento.querySelector('.lixeira__cena'),
    /** Pulso do anel a cada descarte: verde (reciclável) ou laranja (orgânico). */
    pulsar(tipo = 'reciclavel') {
      elemento.dataset.pulso = tipo === 'organico' ? 'organico' : 'reciclavel';
      pulso.getAnimations().forEach((a) => a.cancel());
      if (semMovimento()) {
        // sem movimento: acende e apaga, sem crescer
        pulso.animate([{ opacity: 0.85 }, { opacity: 0.85, offset: 0.7 }, { opacity: 0 }], { duration: 1200 });
        return;
      }
      pulso.animate([{ opacity: 0 }, { opacity: 1, offset: 0.14 }, { opacity: 0 }], {
        duration: 1500,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      });
    },
  };
}

/** Cria a lixeira (mesmas opções de htmlLixeira). */
export function criarLixeira(opcoes = {}) {
  const caixa = document.createElement('div');
  caixa.innerHTML = htmlLixeira(opcoes);
  return ligarLixeira(caixa.firstElementChild);
}

/**
 * Se existir o vídeo do giro (assets/lixeira/giro.mp4), ele entra no lugar da foto,
 * mudo e em laço, com a foto como capa. Sem o arquivo, fica a foto. Com "reduzir
 * movimento" ou economia de dados, também fica a foto.
 */
export async function trocarPorVideoSeExistir(lixeira, { base = '' } = {}) {
  if (semMovimento() || navigator.connection?.saveData) return false;
  const endereco = `${base}assets/lixeira/giro.mp4`;
  try {
    const resposta = await fetch(endereco, { method: 'HEAD', cache: 'no-store' });
    if (!resposta.ok || !(resposta.headers.get('content-type') ?? '').includes('video')) return false;
  } catch {
    return false;
  }
  const foto = lixeira.elemento.querySelector('.lixeira__foto');
  const video = document.createElement('video');
  video.className = 'lixeira__video';
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.autoplay = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.poster = foto.currentSrc || foto.src;
  video.src = endereco;
  video.addEventListener('playing', () => lixeira.elemento.classList.add('lixeira--video'), { once: true });
  video.addEventListener('error', () => {
    video.remove();
    lixeira.elemento.classList.remove('lixeira--video');
  });
  foto.after(video);
  video.play().catch(() => {});
  return true;
}
