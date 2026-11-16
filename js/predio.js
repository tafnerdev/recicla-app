/**
 * Recicla Slide: o prédio com dois tubos de luz (verde para recicláveis,
 * laranja para orgânicos). Versão SVG, a base e o plano B do 3D.
 *
 * Geometria num viewBox de 0 0 350 320, igual às referências aprovadas:
 *   face esquerda 95,70 175,100 175,290 95,260
 *   face direita  175,100 255,70 255,260 175,290
 *   topo          95,70 175,40 255,70 175,100
 * Altura útil de 190: com N andares, cada um tem 190/N. O andar 1 é o de baixo.
 */

const NS = 'http://www.w3.org/2000/svg';
const ALTURA_UTIL = 190;
const TUBO = { reciclavel: 268.5, organico: 284.5 }; // centro de cada tubo
const FUNDO_TUBO = 290;
const PONTOS_LUZ = {
  app: { reciclavel: 182, organico: 236, nucleo: 3 },
  telao: { reciclavel: 226, organico: 150, nucleo: 2.6 },
  site: { reciclavel: 214, organico: 128, nucleo: 2.8 },
};

let contador = 0;

/** Faixa vertical de um andar: { d0, d1, meio } (deslocamentos a partir do topo da fachada). */
export function faixaDoAndar(andar, andares) {
  const ordem = [...andares].sort((a, b) => a - b);
  const n = ordem.indexOf(Number(andar)) + 1; // 1 = de baixo
  const total = ordem.length;
  const h = ALTURA_UTIL / total;
  const d0 = (total - n) * h;
  const d1 = d0 + h;
  return { d0, d1, meio: (d0 + d1) / 2, altura: h };
}

const r = (v) => Math.round(v * 100) / 100;

function textoAndar(andar) {
  return `${andar}º`;
}

/** Descrição do prédio para leitores de tela. */
export function descreverPredio(estado, andares) {
  const base = `Prédio de ${andares.length} andares com dois tubos de vidro, um de luz verde para recicláveis e um de luz laranja para orgânicos.`;
  if (!estado.aceso) return `${base} Nenhum andar aceso.`;
  if (estado.modo === 'morador') {
    const lider = estado.lider && estado.lider !== estado.aceso ? ` O ${textoAndar(estado.lider)} andar lidera o mês.` : '';
    return `${base} O ${textoAndar(estado.aceso)} andar, o seu, está aceso.${lider}`;
  }
  return `${base} O ${textoAndar(estado.aceso)} andar, líder do mês, está aceso.`;
}

/**
 * Monta o SVG do prédio.
 * opcoes: {
 *   andares: [1..N], aceso, lider, modo: 'morador' | 'lider',
 *   rotulos: true para "7º · você" e "4º · líder" (app),
 *   traco: espessura dos traços (1 no app, 0.6 no telão, 0.7 no site),
 *   pontos: 'app' | 'telao' | 'site' | null (pontos de luz parados nos tubos)
 * }
 * Devolve { elemento, atualizar(estado), soltarLuz(andar, tipo), destruir() }.
 */
export function criarPredioSVG(opcoes) {
  const id = `p${(contador += 1)}`;
  const andares = [...opcoes.andares].sort((a, b) => a - b);
  const traco = opcoes.traco ?? 1;
  const largura = opcoes.largura ?? 342;
  const estado = { aceso: opcoes.aceso ?? null, lider: opcoes.lider ?? null, modo: opcoes.modo ?? 'lider' };

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 350 320');
  svg.setAttribute('class', 'predio-svg');
  svg.setAttribute('role', 'img');
  if (opcoes.largura !== null) {
    svg.setAttribute('width', String(largura));
    svg.setAttribute('height', String(Math.round((largura * 320) / 350)));
  }

  const h = ALTURA_UTIL / andares.length;
  let linhasAndar = '';
  for (let i = 1; i < andares.length; i += 1) {
    const d = r(i * h);
    linhasAndar += `M95 ${r(70 + d)}L175 ${r(100 + d)}L255 ${r(70 + d)}`;
  }
  const sw = traco === 1 ? '' : ` stroke-width="${traco}"`;
  const luz = PONTOS_LUZ[opcoes.pontos] ?? null;

  svg.innerHTML = `
    <defs>
      <linearGradient id="${id}FL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.11"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.02"/></linearGradient>
      <linearGradient id="${id}FR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.06"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.01"/></linearGradient>
      <linearGradient id="${id}GG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8BD17C" stop-opacity="0"/><stop offset="0.45" stop-color="#8BD17C" stop-opacity="1"/><stop offset="1" stop-color="#8BD17C" stop-opacity="0.3"/></linearGradient>
      <linearGradient id="${id}GO" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2A541" stop-opacity="0"/><stop offset="0.7" stop-color="#F2A541" stop-opacity="1"/><stop offset="1" stop-color="#F2A541" stop-opacity="0.3"/></linearGradient>
      <filter id="${id}B12" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="12"/></filter>
      <filter id="${id}B4" x="-300%" y="-20%" width="700%" height="140%"><feGaussianBlur stdDeviation="3.5"/></filter>
    </defs>
    <ellipse cx="175" cy="290" rx="130" ry="20" fill="#8BD17C" opacity="0.12" filter="url(#${id}B12)"/>
    <g class="predio-svg__atras"></g>
    <polygon points="95,70 175,100 175,290 95,260" fill="url(#${id}FL)" stroke="#ffffff" stroke-opacity="0.2"${sw}/>
    <polygon points="175,100 255,70 255,260 175,290" fill="url(#${id}FR)" stroke="#ffffff" stroke-opacity="0.2"${sw}/>
    <polygon points="95,70 175,40 255,70 175,100" fill="#ffffff" fill-opacity="0.1" stroke="#ffffff" stroke-opacity="0.26"${sw}/>
    <path d="${linhasAndar}" fill="none" stroke="#ffffff" stroke-opacity="0.09"${sw}/>
    <g class="predio-svg__frente"></g>
    <rect x="264" y="62" width="9" height="232" rx="4.5" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.28"${sw}/>
    <rect x="280" y="62" width="9" height="232" rx="4.5" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.28"${sw}/>
    <rect x="266.5" y="70" width="4" height="218" rx="2" fill="url(#${id}GG)" filter="url(#${id}B4)"/>
    <rect x="267.5" y="70" width="2" height="218" rx="1" fill="url(#${id}GG)"/>
    <rect x="282.5" y="70" width="4" height="218" rx="2" fill="url(#${id}GO)" filter="url(#${id}B4)"/>
    <rect x="283.5" y="70" width="2" height="218" rx="1" fill="url(#${id}GO)"/>
    ${
      luz
        ? `<circle cx="268.5" cy="${luz.reciclavel}" r="7" fill="#8BD17C" opacity="0.7" filter="url(#${id}B4)"/>
    <circle cx="268.5" cy="${luz.reciclavel}" r="${luz.nucleo}" fill="#E9FBE3"/>
    <circle cx="284.5" cy="${luz.organico}" r="7" fill="#F2A541" opacity="0.7" filter="url(#${id}B4)"/>
    <circle cx="284.5" cy="${luz.organico}" r="${luz.nucleo}" fill="#FFF1DC"/>`
        : ''
    }
    <g class="predio-svg__luzes"></g>
    <rect class="predio-svg__central" data-tipo="reciclavel" x="261" y="297" width="15" height="9" rx="3" fill="#8BD17C" fill-opacity="0.25" stroke="#8BD17C" stroke-opacity="0.7"${sw}/>
    <rect class="predio-svg__central" data-tipo="organico" x="277" y="297" width="15" height="9" rx="3" fill="#F2A541" fill-opacity="0.25" stroke="#F2A541" stroke-opacity="0.7"${sw}/>
    <rect class="predio-svg__pulso" data-tipo="reciclavel" x="259" y="295" width="19" height="13" rx="4" fill="#8BD17C" opacity="0" filter="url(#${id}B4)"/>
    <rect class="predio-svg__pulso" data-tipo="organico" x="275" y="295" width="19" height="13" rx="4" fill="#F2A541" opacity="0" filter="url(#${id}B4)"/>
    <g class="predio-svg__rotulos"></g>`;

  const atras = svg.querySelector('.predio-svg__atras');
  const frente = svg.querySelector('.predio-svg__frente');
  const rotulos = svg.querySelector('.predio-svg__rotulos');
  const camadaLuzes = svg.querySelector('.predio-svg__luzes');
  const conector = traco === 1 ? 1.5 : 1;

  function desenhar() {
    svg.setAttribute('aria-label', opcoes.descricao ? opcoes.descricao(estado) : descreverPredio(estado, andares));
    let htmlAtras = '';
    let htmlFrente = '';
    let htmlRotulos = '';

    const lider = estado.lider !== null && estado.lider !== estado.aceso && andares.includes(estado.lider) ? estado.lider : null;
    if (lider !== null && estado.modo === 'morador') {
      const { d0, d1 } = faixaDoAndar(lider, andares);
      htmlFrente += `<polygon points="95,${r(70 + d0)} 175,${r(100 + d0)} 175,${r(100 + d1)} 95,${r(70 + d1)}" fill="#ffffff" fill-opacity="0.1"/>`;
      htmlFrente += `<polygon points="175,${r(100 + d0)} 255,${r(70 + d0)} 255,${r(70 + d1)} 175,${r(100 + d1)}" fill="#ffffff" fill-opacity="0.06"/>`;
    }
    if (estado.aceso !== null && andares.includes(estado.aceso)) {
      const { d0, d1, meio } = faixaDoAndar(estado.aceso, andares);
      htmlAtras = `<polygon points="95,${r(70 + d0)} 175,${r(100 + d0)} 255,${r(70 + d0)} 255,${r(70 + d1)} 175,${r(100 + d1)} 95,${r(70 + d1)}" fill="#8BD17C" opacity="0.6" filter="url(#${id}B12)"/>`;
      htmlFrente += `<polygon points="95,${r(70 + d0)} 175,${r(100 + d0)} 175,${r(100 + d1)} 95,${r(70 + d1)}" fill="#8BD17C" fill-opacity="0.5" stroke="#B6EAA8" stroke-opacity="0.8"${sw}/>`;
      htmlFrente += `<polygon points="175,${r(100 + d0)} 255,${r(70 + d0)} 255,${r(70 + d1)} 175,${r(100 + d1)}" fill="#8BD17C" fill-opacity="0.3" stroke="#B6EAA8" stroke-opacity="0.6"${sw}/>`;
      htmlFrente += `<path d="M255 ${r(70 + meio)}H264" stroke="#8BD17C" stroke-width="${conector}"/>`;
    }

    if (opcoes.rotulos) {
      const rotulo = (andar, texto, voce) => {
        const { meio } = faixaDoAndar(andar, andares);
        const y = 70 + meio;
        return voce
          ? `<path d="M86 ${r(y + 0.5)}H95" stroke="#B6EAA8" stroke-opacity="0.8"/><text x="82" y="${r(y + 4.5)}" text-anchor="end" font-size="11" font-weight="500" fill="#B6EAA8">${texto}</text>`
          : `<path d="M86 ${r(y + 0.5)}H95" stroke="#ffffff" stroke-opacity="0.4"/><text x="82" y="${r(y + 4.5)}" text-anchor="end" font-size="11" fill="#ffffff" fill-opacity="0.66">${texto}</text>`;
      };
      if (estado.aceso !== null && andares.includes(estado.aceso)) {
        const tambemLider = estado.lider === estado.aceso;
        htmlRotulos += rotulo(estado.aceso, `${textoAndar(estado.aceso)} · você${tambemLider ? ', líder' : ''}`, true);
      }
      if (lider !== null) htmlRotulos += rotulo(lider, `${textoAndar(lider)} · líder`, false);
    }

    atras.innerHTML = htmlAtras;
    frente.innerHTML = htmlFrente;
    rotulos.innerHTML = htmlRotulos;
  }

  desenhar();

  return {
    elemento: svg,
    tipo: 'svg',
    atualizar(novo) {
      Object.assign(estado, novo);
      desenhar();
    },
    /** Um ponto de luz nasce na altura do andar, dentro do tubo certo, e desce até o térreo. */
    soltarLuz(andar, tipo, { aoChegar } = {}) {
      if (!andares.includes(Number(andar))) return;
      const reduz = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('estavel');
      if (reduz) return;
      const x = TUBO[tipo] ?? TUBO.reciclavel;
      const { meio } = faixaDoAndar(andar, andares);
      const y0 = 70 + meio;
      const queda = FUNDO_TUBO - y0;
      const cor = tipo === 'organico' ? '#F2A541' : '#8BD17C';
      const nucleo = tipo === 'organico' ? '#FFF1DC' : '#E9FBE3';
      const g = document.createElementNS(NS, 'g');
      g.innerHTML = `<circle cx="${x}" cy="${r(y0)}" r="7" fill="${cor}" opacity="0.75" filter="url(#${id}B4)"/><circle cx="${x}" cy="${r(y0)}" r="2.8" fill="${nucleo}"/>`;
      camadaLuzes.append(g);
      // 0,9 s a 1,4 s conforme a altura, acelerando como na queda (power2.in)
      const duracao = 900 + 500 * Math.min(1, queda / 220);
      const animacao = g.animate(
        [
          { transform: 'translateY(0)', opacity: 0 },
          { transform: `translateY(${r(queda * 0.04)}px)`, opacity: 1, offset: 0.08 },
          { transform: `translateY(${r(queda)}px)`, opacity: 1 },
        ],
        { duration: duracao, easing: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)', fill: 'forwards' },
      );
      animacao.finished
        .then(() => {
          const pulso = svg.querySelector(`.predio-svg__pulso[data-tipo="${tipo === 'organico' ? 'organico' : 'reciclavel'}"]`);
          pulso?.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.25 }, { opacity: 0 }], { duration: 700, easing: 'ease-out' });
          aoChegar?.();
        })
        .catch(() => {})
        .finally(() => g.remove());
    },
    destruir() {
      svg.remove();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Escolha entre 3D e SVG                                              */
/* ------------------------------------------------------------------ */

/** Liga a troca para o 3D (js/predio3d.js). */
const TRES_D_ATIVO = true;

/** Devolve o motivo para NÃO usar o 3D, ou null quando pode. */
function motivoSemTresD() {
  const parametros = new URLSearchParams(location.search);
  if (!TRES_D_ATIVO) return 'desligado';
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'reduzir-movimento';
  if (document.documentElement.classList.contains('estavel') || parametros.get('estavel') === '1') return 'estavel';
  if (parametros.get('svg') === '1') return 'svg-pedido';
  try {
    // O Three.js atual só funciona com WebGL 2.
    if (!document.createElement('canvas').getContext('webgl2')) return 'sem-webgl2';
  } catch {
    return 'sem-webgl2';
  }
  return null;
}

const TEXTO_MOTIVO = {
  desligado: '3D desligado no código',
  'reduzir-movimento': '“Reduzir movimento” está ligado no aparelho',
  estavel: 'modo estável',
  'svg-pedido': 'pedido pelo endereço (?svg=1)',
  'sem-webgl2': 'o navegador não tem WebGL 2',
  'contexto-perdido': 'a placa de vídeo descartou o 3D',
  esperando: 'esperando o prédio aparecer na tela',
  carregando: 'carregando o 3D',
  erro: 'erro ao carregar o 3D',
};

/** Com ?diag=1 no endereço, mostra embaixo do prédio se ele está em 3D ou SVG e por quê. */
function mostrarDiagnostico(conteiner) {
  if (new URLSearchParams(location.search).get('diag') !== '1') return;
  let chip = conteiner.querySelector('.predio__diag');
  if (!chip) {
    chip = document.createElement('span');
    chip.className = 'predio__diag';
    chip.setAttribute('aria-hidden', 'true');
    conteiner.append(chip);
  }
  const { modo, motivo = '', quadros } = conteiner.dataset;
  const corte = motivo.indexOf(':');
  const chave = corte < 0 ? motivo : motivo.slice(0, corte);
  const valor = corte < 0 ? '' : motivo.slice(corte + 1);
  let texto = TEXTO_MOTIVO[chave] ?? motivo;
  if (chave === 'lento') texto = `lento: ${valor} quadros/s (mínimo 24)`;
  if (chave === 'erro') texto = `erro ao carregar o 3D (${valor})`;
  chip.textContent = modo === '3d' ? `3D · ${quadros ? `${quadros} quadros/s` : 'medindo'}` : `SVG · ${texto || 'sem motivo registrado'}`;
}

/**
 * Coloca o prédio no contêiner: primeiro o SVG (sempre), depois, se o aparelho
 * aguentar, troca pelo 3D (js/predio3d.js). Qualquer falha volta ao SVG, sem aviso.
 * opcoes: as de criarPredioSVG + { interativo: true para arrastar e girar (app e site) }
 * Devolve { atualizar(estado), soltarLuz(andar, tipo), get modo(), destruir() }.
 */
export function montarPredio(conteiner, opcoes) {
  conteiner.classList.add('predio');
  const svg = criarPredioSVG(opcoes);
  conteiner.replaceChildren(svg.elemento);
  const estado = { aceso: opcoes.aceso ?? null, lider: opcoes.lider ?? null, modo: opcoes.modo ?? 'lider', pontosAndares: opcoes.pontosAndares ?? {} };
  let tresD = null;
  let destruido = false;

  const registrar = (motivo) => {
    if (motivo !== undefined) conteiner.dataset.motivo = motivo;
    mostrarDiagnostico(conteiner);
  };

  const voltarAoSVG = (motivo) => {
    if (typeof motivo === 'string') registrar(motivo);
    if (!tresD) return;
    try {
      tresD.destruir();
    } catch {
      /* já foi */
    }
    tresD = null;
    svg.elemento.removeAttribute('hidden'); // SVGElement não tem a propriedade .hidden
    conteiner.dataset.modo = 'svg';
    registrar();
  };

  conteiner.dataset.modo = 'svg';
  const semTresD = motivoSemTresD();
  registrar(semTresD ?? 'esperando');

  if (!semTresD) {
    // Carrega o 3D só quando o prédio entra na tela.
    const observador = new IntersectionObserver(async ([entrada]) => {
      if (!entrada.isIntersecting) return;
      observador.disconnect();
      registrar('carregando');
      try {
        const modulo = await import('./predio3d.js');
        if (destruido) return;
        const aoMedir = (qps) => {
          conteiner.dataset.quadros = String(qps);
          registrar();
        };
        const instancia = await modulo.criarPredio3D(conteiner, { ...opcoes, ...estado, aoFalhar: voltarAoSVG, aoMedir });
        if (destruido || !instancia) {
          instancia?.destruir();
          return;
        }
        tresD = instancia;
        svg.elemento.setAttribute('hidden', '');
        conteiner.dataset.modo = '3d';
        registrar('');
      } catch (erro) {
        console.warn('[Recicla Slide] prédio 3D indisponível, usando o desenho em SVG.', erro);
        voltarAoSVG(`erro:${erro?.message ?? erro}`.slice(0, 120));
      }
    }, { rootMargin: '120px' });
    observador.observe(conteiner);
  }

  return {
    get modo() {
      return tresD ? '3d' : 'svg';
    },
    atualizar(novo) {
      Object.assign(estado, novo);
      svg.atualizar(novo);
      tresD?.atualizar(novo);
    },
    soltarLuz(andar, tipo, extras) {
      if (tresD) tresD.soltarLuz(andar, tipo, extras);
      else svg.soltarLuz(andar, tipo, extras);
    },
    destruir() {
      destruido = true;
      voltarAoSVG();
      svg.destruir();
    },
  };
}
