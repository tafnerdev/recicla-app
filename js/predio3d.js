/**
 * Recicla Slide: o prédio em 3D (Three.js), melhoria progressiva sobre o SVG.
 * É o mesmo desenho, vivo: mesma câmera isométrica, mesmas proporções e cores.
 * Só é carregado por js/predio.js quando o aparelho aguenta. Qualquer falha
 * chama opcoes.aoFalhar() e a tela volta ao SVG, sem aviso.
 *
 * Unidades do mundo = unidades do viewBox do SVG (0 0 350 320).
 */
import * as THREE from './vendor/three.module.min.js';
import { descreverPredio } from './predio.js';

const VERDE = 0x8bd17c;
const VERDE_CLARO = 0xb6eaa8;
const LARANJA = 0xf2a541;

// Câmera: azimute 45°, elevação de 24° (o losango do topo no SVG tem razão 30/80).
const ELEVACAO = THREE.MathUtils.degToRad(24);
const AZIMUTE = THREE.MathUtils.degToRad(45);
const LADO = 80 / Math.SQRT1_2 / 1; // largura da base: a face aparece com 80 de largura
const ALTURA = 190 / Math.cos(ELEVACAO); // a aresta da frente aparece com 190 de altura
const VAO = 1.4; // vão entre os andares
const BALANCO = THREE.MathUtils.degToRad(10);
const PERIODO_BALANCO = 16; // segundos, ida e volta

/** Textura radial (branco no centro, transparente na borda) para os brilhos aditivos. */
function texturaRadial() {
  const tela = document.createElement('canvas');
  tela.width = 128;
  tela.height = 128;
  const ctx = tela.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const textura = new THREE.CanvasTexture(tela);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

function brilho(textura, cor, opacidade) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: textura,
      color: cor,
      transparent: true,
      opacity: opacidade,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  return sprite;
}

/**
 * Cria o prédio 3D dentro do contêiner (que já tem o SVG; o SVG é escondido por quem chama).
 * opcoes: { andares, aceso, lider, modo, rotulos, interativo, pontos: {andar: pontos}, aoFalhar }
 */
export async function criarPredio3D(conteiner, opcoes) {
  const andares = [...opcoes.andares].sort((a, b) => a - b);
  const total = andares.length;
  const alturaAndar = ALTURA / total;
  const estado = {
    aceso: opcoes.aceso ?? null,
    lider: opcoes.lider ?? null,
    modo: opcoes.modo ?? 'lider',
    pontos: opcoes.pontos ?? {},
  };

  // ---------------------------------------------------------------- render
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const tela = renderer.domElement;
  tela.className = 'predio-3d';
  tela.setAttribute('role', 'img');
  tela.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    opcoes.aoFalhar?.();
  });

  const cena = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-175, 175, 160, -160, 1, 4000);
  const alvo = new THREE.Vector3(0, 100 / Math.cos(ELEVACAO), 0);
  const direcao = new THREE.Vector3(Math.sin(AZIMUTE) * Math.cos(ELEVACAO), Math.sin(ELEVACAO), Math.cos(AZIMUTE) * Math.cos(ELEVACAO));
  camera.position.copy(alvo).addScaledVector(direcao, 1200);
  camera.lookAt(alvo);

  cena.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sol = new THREE.DirectionalLight(0xffffff, 1.1);
  sol.position.set(-200, 500, 600); // ilumina mais a face esquerda, como no SVG
  cena.add(sol);

  const textura = texturaRadial();
  const grupo = new THREE.Group();
  cena.add(grupo);

  // ---------------------------------------------------------------- andares
  const caixa = new THREE.BoxGeometry(LADO, alturaAndar - VAO, LADO);
  const arestas = new THREE.EdgesGeometry(caixa);
  const blocos = new Map();
  andares.forEach((andar, i) => {
    const material = new THREE.MeshStandardMaterial({
      color: 0x0e1513,
      roughness: 0.6,
      metalness: 0,
      transparent: true,
      opacity: 0.55,
      emissive: VERDE,
      emissiveIntensity: 0.03,
      // escreve profundidade: as arestas de trás ficam escondidas, como no desenho
      depthWrite: true,
    });
    const malha = new THREE.Mesh(caixa, material);
    const y = (i + 0.5) * alturaAndar;
    malha.position.set(0, y, 0);
    const linhas = new THREE.LineSegments(arestas, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }));
    linhas.position.copy(malha.position);
    linhas.scale.setScalar(1.002); // um fio por fora da caixa, para não brigar com a face
    linhas.renderOrder = 2;
    grupo.add(malha, linhas);
    blocos.set(andar, { malha, linhas, y });
  });

  // brilho atrás do andar aceso e no chão
  const brilhoAceso = brilho(textura, VERDE, 0);
  brilhoAceso.scale.set(LADO * 2.6, alturaAndar * 3.2, 1);
  brilhoAceso.renderOrder = -1;
  grupo.add(brilhoAceso);
  const brilhoChao = brilho(textura, VERDE, 0.22);
  brilhoChao.scale.set(LADO * 3.4, 46, 1);
  brilhoChao.position.set(0, -6, 0);
  grupo.add(brilhoChao);

  // ---------------------------------------------------------------- tubos
  // Na diagonal da quina direita, para fora: nunca somem atrás do prédio no balanço.
  const quina = new THREE.Vector3(LADO / 2, 0, -LADO / 2);
  const fora = new THREE.Vector3(1, 0, -1).normalize();
  const posTubo = {
    reciclavel: quina.clone().addScaledVector(fora, 19),
    organico: quina.clone().addScaledVector(fora, 41.5),
  };
  const baseTubo = -38;
  const topoTubo = ALTURA + 10;
  const alturaTubo = topoTubo - baseTubo;
  const vidroTubo = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.05,
    metalness: 0,
    transmission: 0.9,
    ior: 1.45,
    thickness: 2,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const geoTubo = new THREE.CylinderGeometry(4.5, 4.5, alturaTubo, 24, 1, true);
  const geoFilete = new THREE.CylinderGeometry(1, 1, alturaTubo - 14, 12);
  const centrais = {};
  for (const [tipo, cor] of [['reciclavel', VERDE], ['organico', LARANJA]]) {
    const p = posTubo[tipo];
    const tubo = new THREE.Mesh(geoTubo, vidroTubo);
    tubo.position.set(p.x, baseTubo + alturaTubo / 2, p.z);
    const contorno = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.CylinderGeometry(4.5, 4.5, alturaTubo, 4, 1, true)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }),
    );
    contorno.position.copy(tubo.position);
    const filete = new THREE.Mesh(geoFilete, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.9 }));
    filete.position.copy(tubo.position);
    const luzFilete = brilho(textura, cor, 0.32);
    luzFilete.scale.set(16, alturaTubo * 1.05, 1);
    luzFilete.position.copy(tubo.position);
    const central = new THREE.Mesh(
      new THREE.BoxGeometry(14, 9, 14),
      new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    central.position.set(p.x, baseTubo - 5, p.z);
    const luzCentral = brilho(textura, cor, 0.25);
    luzCentral.scale.set(40, 26, 1);
    luzCentral.position.copy(central.position);
    centrais[tipo] = { luz: luzCentral, pulso: 0 };
    grupo.add(tubo, contorno, filete, luzFilete, central, luzCentral);
  }

  // ---------------------------------------------------------------- rótulos HTML
  const rotulos = { voce: null, lider: null };
  if (opcoes.rotulos) {
    for (const chave of ['voce', 'lider']) {
      const r = document.createElement('span');
      r.className = `predio-3d__rotulo predio-3d__rotulo--${chave}`;
      r.setAttribute('aria-hidden', 'true');
      r.hidden = true;
      conteiner.append(r);
      rotulos[chave] = r;
    }
  }

  // ---------------------------------------------------------------- estado visual
  function aplicarEstado() {
    tela.setAttribute('aria-label', descreverPredio(estado, andares));
    const valores = Object.values(estado.pontos ?? {}).map(Number);
    const maxPontos = Math.max(0, ...valores);
    const minPontos = Math.min(maxPontos, ...valores);
    const faixa = Math.max(1, maxPontos - minPontos);
    for (const [andar, { malha, linhas }] of blocos) {
      const aceso = andar === estado.aceso;
      const lider = estado.modo === 'morador' && andar === estado.lider && !aceso;
      // Emissão bem fraca: de 0,03 (menos pontos do prédio) a 0,2 (mais pontos), num verde atenuado.
      const pontosAndar = Number(estado.pontos?.[andar]) || 0;
      const fracao = maxPontos > 0 ? (pontosAndar - minPontos) / faixa : 0;
      if (aceso) malha.material.emissive.setHex(VERDE);
      else if (lider) malha.material.emissive.setHex(0xffffff);
      else malha.material.emissive.setHex(VERDE).multiplyScalar(0.45);
      malha.material.emissiveIntensity = aceso ? 0.9 : lider ? 0.08 : 0.03 + 0.17 * fracao;
      malha.material.opacity = aceso ? 0.75 : 0.55;
      linhas.material.color.setHex(aceso ? VERDE_CLARO : 0xffffff);
      linhas.material.opacity = aceso ? 0.85 : lider ? 0.4 : 0.22;
    }
    const acesoBloco = blocos.get(estado.aceso);
    brilhoAceso.material.opacity = acesoBloco ? 0.45 : 0;
    if (acesoBloco) brilhoAceso.position.set(0, acesoBloco.y, 0);
    pedirQuadro();
  }

  // ---------------------------------------------------------------- pontos de luz
  const quedas = [];
  const geoPonto = new THREE.SphereGeometry(2.6, 16, 12);
  function soltarLuz(andar, tipo, { aoChegar } = {}) {
    const bloco = blocos.get(Number(andar));
    if (!bloco) return;
    const t = tipo === 'organico' ? 'organico' : 'reciclavel';
    const cor = t === 'organico' ? LARANJA : VERDE;
    const p = posTubo[t];
    const nucleo = new THREE.Mesh(geoPonto, new THREE.MeshBasicMaterial({ color: t === 'organico' ? 0xfff1dc : 0xe9fbe3, transparent: true }));
    const halo = brilho(textura, cor, 0.9);
    halo.scale.set(26, 26, 1);
    const grupoPonto = new THREE.Group();
    grupoPonto.add(halo, nucleo);
    grupoPonto.position.set(p.x, bloco.y, p.z);
    grupo.add(grupoPonto);
    const queda = bloco.y - (baseTubo - 2);
    quedas.push({
      objeto: grupoPonto,
      inicio: performance.now(),
      duracao: 900 + 500 * Math.min(1, queda / ALTURA),
      y0: bloco.y,
      y1: baseTubo - 2,
      tipo: t,
      aoChegar,
    });
    pedirQuadro();
  }

  // ---------------------------------------------------------------- arrastar para girar
  const giro = { arrasto: 0, velocidade: 0, segurando: false, ultimoX: 0 };
  if (opcoes.interativo) {
    tela.style.touchAction = 'pan-y';
    tela.style.cursor = 'grab';
    tela.addEventListener('pointerdown', (e) => {
      giro.segurando = true;
      giro.ultimoX = e.clientX;
      giro.velocidade = 0;
      tela.setPointerCapture(e.pointerId);
      tela.style.cursor = 'grabbing';
    });
    tela.addEventListener('pointermove', (e) => {
      if (!giro.segurando) return;
      const dx = e.clientX - giro.ultimoX;
      giro.ultimoX = e.clientX;
      const delta = (dx / Math.max(1, tela.clientWidth)) * Math.PI * 1.2;
      giro.arrasto += delta;
      giro.velocidade = delta;
      pedirQuadro();
    });
    const soltar = () => {
      giro.segurando = false;
      tela.style.cursor = 'grab';
    };
    tela.addEventListener('pointerup', soltar);
    tela.addEventListener('pointercancel', soltar);
  }

  // ---------------------------------------------------------------- tamanho
  conteiner.append(tela);
  function ajustarTamanho() {
    const largura = Math.max(1, conteiner.clientWidth);
    const altura = Math.max(1, conteiner.clientHeight || (largura * 320) / 350);
    renderer.setSize(largura, altura, false);
    tela.style.width = '100%';
    tela.style.height = '100%';
    pedirQuadro();
  }
  const observadorTamanho = new ResizeObserver(ajustarTamanho);
  observadorTamanho.observe(conteiner);

  // ---------------------------------------------------------------- laço de desenho
  let quadro = 0;
  let visivel = true;
  let ultimo = performance.now();
  let relogio = 0; // tempo do balanço, em segundos
  let contagem = { inicio: 0, quadros: 0, feita: false };
  let falhou = false;

  const vetor = new THREE.Vector3();
  function posicionarRotulo(elemento, andar, texto) {
    const bloco = blocos.get(andar);
    if (!elemento) return;
    if (!bloco) {
      elemento.hidden = true;
      return;
    }
    vetor.set(-LADO / 2, bloco.y, LADO / 2);
    grupo.localToWorld(vetor);
    vetor.project(camera);
    const largura = conteiner.clientWidth;
    const escala = largura / 350;
    elemento.hidden = false;
    elemento.textContent = texto;
    elemento.style.setProperty('--escala', escala.toFixed(3));
    elemento.style.transform = `translate(${((vetor.x + 1) / 2) * largura}px, ${((1 - vetor.y) / 2) * conteiner.clientHeight}px)`;
  }

  function desenhar(agora) {
    quadro = 0;
    if (falhou) return;
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    relogio += dt;

    // balanço lento + arrasto com inércia que volta sozinho ao balanço
    if (!giro.segurando) {
      giro.arrasto += giro.velocidade;
      giro.velocidade *= 0.92;
      if (Math.abs(giro.velocidade) < 0.0004) {
        giro.velocidade = 0;
        giro.arrasto *= 0.94;
      }
    }
    grupo.rotation.y = Math.sin((relogio / PERIODO_BALANCO) * Math.PI * 2) * BALANCO + giro.arrasto;

    // pontos de luz descendo (aceleração tipo power2.in)
    for (let i = quedas.length - 1; i >= 0; i -= 1) {
      const q = quedas[i];
      const t = Math.min(1, (agora - q.inicio) / q.duracao);
      q.objeto.position.y = q.y0 + (q.y1 - q.y0) * t * t;
      if (t >= 1) {
        grupo.remove(q.objeto);
        for (const filho of q.objeto.children) filho.material.dispose();
        centrais[q.tipo].pulso = 1;
        quedas.splice(i, 1);
        q.aoChegar?.();
      }
    }
    for (const c of Object.values(centrais)) {
      c.luz.material.opacity = 0.25 + 0.75 * c.pulso;
      c.pulso = Math.max(0, c.pulso - dt * 1.6);
    }

    renderer.render(cena, camera);

    if (opcoes.rotulos) {
      const voceLider = estado.aceso !== null && estado.aceso === estado.lider;
      posicionarRotulo(rotulos.voce, estado.aceso, `${estado.aceso}º · você${voceLider ? ', líder' : ''}`);
      if (estado.lider !== null && !voceLider && estado.modo === 'morador') posicionarRotulo(rotulos.lider, estado.lider, `${estado.lider}º · líder`);
      else if (rotulos.lider) rotulos.lider.hidden = true;
    }

    // Desempenho: se o primeiro segundo ficar abaixo de 30 quadros, volta ao SVG.
    if (!contagem.feita) {
      if (!contagem.inicio) contagem.inicio = agora;
      contagem.quadros += 1;
      if (agora - contagem.inicio >= 1000) {
        contagem.feita = true;
        if (contagem.quadros < 30) {
          falhou = true;
          opcoes.aoFalhar?.();
          return;
        }
      }
    }
    pedirQuadro();
  }

  function pedirQuadro() {
    if (quadro || !visivel || document.hidden || falhou) return;
    quadro = requestAnimationFrame(desenhar);
  }

  const observadorTela = new IntersectionObserver(([entrada]) => {
    visivel = entrada.isIntersecting;
    if (visivel) {
      ultimo = performance.now();
      pedirQuadro();
    } else {
      cancelAnimationFrame(quadro);
      quadro = 0;
    }
  });
  observadorTela.observe(conteiner);
  const aoMudarVisibilidade = () => {
    if (document.hidden) {
      cancelAnimationFrame(quadro);
      quadro = 0;
      // a contagem de quadros recomeça quando a aba voltar
      if (!contagem.feita) contagem = { inicio: 0, quadros: 0, feita: false };
    } else {
      ultimo = performance.now();
      pedirQuadro();
    }
  };
  document.addEventListener('visibilitychange', aoMudarVisibilidade);

  ajustarTamanho();
  aplicarEstado();
  // Garante que algo foi desenhado antes de esconder o SVG.
  renderer.render(cena, camera);

  return {
    atualizar(novo) {
      Object.assign(estado, novo);
      aplicarEstado();
    },
    soltarLuz,
    destruir() {
      falhou = true;
      cancelAnimationFrame(quadro);
      observadorTela.disconnect();
      observadorTamanho.disconnect();
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
      cena.traverse((objeto) => {
        objeto.geometry?.dispose();
        const materiais = Array.isArray(objeto.material) ? objeto.material : [objeto.material];
        for (const m of materiais) m?.dispose();
      });
      textura.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      tela.remove();
      for (const r of Object.values(rotulos)) r?.remove();
    },
  };
}
