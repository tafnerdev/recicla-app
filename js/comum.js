/**
 * Recicla Slide: peças de interface compartilhadas pelas telas.
 * Nada aqui lê ou grava dados: isso é só com js/dados.js.
 */

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */

const numeroBR = new Intl.NumberFormat('pt-BR');
const mesBR = new Intl.DateTimeFormat('pt-BR', { month: 'long' });
const horaBR = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const ROTULO_TIPO = Object.freeze({ reciclavel: 'Reciclável', organico: 'Orgânico' });
export const LETRA_TIPO = Object.freeze({ reciclavel: 'R', organico: 'O' });

/** 7 → "7º" */
export function ordinal(n) {
  return `${n}º`;
}

/** 7 → "7º andar"; 0 → "Térreo" */
export function nomeAndar(n) {
  return Number(n) === 0 ? 'Térreo' : `${n}º andar`;
}

/** 1240 → "1.240" */
export function formatarNumero(n) {
  return numeroBR.format(n);
}

/** 1240 → "1.240 pontos"; 10 → "10 pontos"; 1 → "1 ponto" */
export function rotuloPontos(n) {
  return `${numeroBR.format(n)} ${Math.abs(n) === 1 ? 'ponto' : 'pontos'}`;
}

/** 3 → "3 descartes" */
export function rotuloDescartes(n) {
  return `${numeroBR.format(n)} ${Math.abs(n) === 1 ? 'descarte' : 'descartes'}`;
}

/** "novembro" */
export function nomeMes(data = new Date()) {
  return mesBR.format(data);
}

/** "14:32" */
export function hora(iso) {
  return horaBR.format(new Date(iso));
}

/** "agora", "há 3 min", "há 2 h", "14:32" */
export function tempoRelativo(iso, agora = Date.now()) {
  const segundos = Math.round((agora - new Date(iso).getTime()) / 1000);
  if (segundos < 45) return 'agora';
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 12) return `há ${horas} h`;
  return hora(iso);
}

/* ------------------------------------------------------------------ */
/* DOM                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Cria um elemento: el('p', { class: 'x', 'aria-live': 'polite' }, 'texto', outroNo)
 * Propriedades que começam com "on" viram ouvintes de evento.
 */
export function el(tag, atributos = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos ?? {})) {
    if (valor === false || valor === null || valor === undefined) continue;
    if (nome.startsWith('on') && typeof valor === 'function') {
      no.addEventListener(nome.slice(2), valor);
    } else if (nome === 'html') {
      no.innerHTML = valor;
    } else if (nome === 'dataset') {
      Object.assign(no.dataset, valor);
    } else {
      no.setAttribute(nome, valor === true ? '' : String(valor));
    }
  }
  for (const filho of filhos.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    no.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return no;
}

export function reduzMovimento() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/* ------------------------------------------------------------------ */
/* Ícones: formas simples, traço de 2 px, sempre ao lado de texto      */
/* ------------------------------------------------------------------ */

const TRACOS = {
  trofeu:
    '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 4"/><path d="M16 6h2.5a2.5 2.5 0 0 1-2.6 4"/><path d="M12 13v4"/><path d="M8.5 20h7"/><path d="M10 17h4v3h-4z"/>',
  celular:
    '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  nfc:
    '<rect x="4" y="5" width="9" height="15" rx="2.2"/><path d="M16 9.5a4 4 0 0 1 0 5"/><path d="M18.8 7a7.5 7.5 0 0 1 0 10"/>',
  alerta: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><path d="M12 16.5v.01"/>',
  atualizar: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/>',
  desfazer: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a5.5 5.5 0 0 1 0 11h-3"/>',
  telaCheia: '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',
  sairTelaCheia: '<path d="M9 4v5H4"/><path d="M15 4v5h5"/><path d="M9 20v-5H4"/><path d="M15 20v-5h5"/>',
  seta: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  setaCima: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
  sensor: '<path d="M9 2.5v5"/><path d="M15 2.5v5"/><path d="M6 7.5h12V11a6 6 0 0 1-12 0V7.5Z"/><path d="M12 17v4.5"/>',
  predio: '<path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21"/><path d="M3 21h18"/><path d="M9 7h1.5M13.5 7H15M9 11h1.5M13.5 11H15M9 15h1.5M13.5 15H15"/>',
  lixeira:
    '<path d="M4.5 7h15"/><path d="M6 7l1 13.5h10L18 7"/><path d="M9 3.5h6"/><path d="M10 11v6M14 11v6"/>',
  pessoa: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20.5a7 7 0 0 1 14 0"/>',
  baixar: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  ok: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
};

/** Devolve o SVG do ícone como texto. Os ícones são decorativos (aria-hidden). */
export function icone(nome, classe = 'icone') {
  const tracos = TRACOS[nome] ?? TRACOS.alerta;
  return `<svg class="${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${tracos}</svg>`;
}

/** Mesmo ícone, como nó do DOM. */
export function iconeNo(nome, classe) {
  const caixa = document.createElement('span');
  caixa.innerHTML = icone(nome, classe);
  return caixa.firstElementChild;
}

/* ------------------------------------------------------------------ */
/* Avisos (toast)                                                      */
/* ------------------------------------------------------------------ */

let caixaAvisos = null;

function obterCaixaAvisos() {
  if (caixaAvisos?.isConnected) return caixaAvisos;
  caixaAvisos = el('div', { class: 'avisos', role: 'status', 'aria-live': 'polite' });
  document.body.append(caixaAvisos);
  return caixaAvisos;
}

/** Prepara a região de avisos cedo, para o leitor de tela anunciar o primeiro aviso. */
export function prepararAvisos() {
  obterCaixaAvisos();
}

/**
 * Mostra um aviso curto. opcoes: { tipo: 'erro', duracao, acao: { rotulo, aoClicar } }
 */
export function avisar(mensagem, opcoes = {}) {
  const caixa = obterCaixaAvisos();
  const aviso = el('div', { class: `aviso${opcoes.tipo === 'erro' ? ' aviso--erro' : ''}` }, el('span', {}, mensagem));
  const fechar = () => {
    if (!aviso.isConnected || aviso.classList.contains('aviso--saindo')) return;
    aviso.classList.add('aviso--saindo');
    const remover = () => aviso.remove();
    aviso.addEventListener('animationend', remover, { once: true });
    setTimeout(remover, 400);
  };
  if (opcoes.acao) {
    aviso.append(
      el(
        'button',
        {
          type: 'button',
          class: 'botao botao--fantasma',
          onclick: () => {
            fechar();
            opcoes.acao.aoClicar();
          },
        },
        opcoes.acao.rotulo,
      ),
    );
  }
  while (caixa.children.length >= 3) caixa.firstElementChild.remove();
  caixa.append(aviso);
  setTimeout(fechar, opcoes.duracao ?? (opcoes.acao ? 6000 : 4000));
  return fechar;
}

/* ------------------------------------------------------------------ */
/* Estados de erro e vazio                                             */
/* ------------------------------------------------------------------ */

/**
 * Monta um bloco de estado (erro ou vazio) dentro do contêiner.
 * opcoes: { tipo: 'erro' | 'vazio', icone, titulo, texto, acao: { rotulo, aoClicar } }
 */
export function mostrarEstado(conteiner, opcoes) {
  const bloco = el(
    'div',
    { class: `estado${opcoes.tipo === 'erro' ? ' estado--erro' : ''}`, role: opcoes.tipo === 'erro' ? 'alert' : null },
    iconeNo(opcoes.icone ?? (opcoes.tipo === 'erro' ? 'alerta' : 'lixeira'), 'estado__icone'),
    el(opcoes.nivel ?? 'h2', {}, opcoes.titulo),
    opcoes.texto ? el('p', {}, opcoes.texto) : null,
    opcoes.acao
      ? el(
          'button',
          { type: 'button', class: 'botao botao--fantasma', onclick: opcoes.acao.aoClicar },
          opcoes.acao.icone ? iconeNo(opcoes.acao.icone) : null,
          opcoes.acao.rotulo,
        )
      : null,
  );
  conteiner.replaceChildren(bloco);
  return bloco;
}

/** Mensagem de erro amigável para falha ao carregar os dados. */
export function textoErroCarregar(erro) {
  if (!navigator.onLine) {
    return 'Você está sem internet e esta tela ainda não foi guardada no aparelho. Conecte-se uma vez e tente de novo.';
  }
  if (location.protocol === 'file:') {
    return 'Abra pelo servidor local (npm run servir) ou pelo endereço publicado. Com duplo clique no arquivo, o navegador bloqueia os dados.';
  }
  const codigo = /HTTP (\d+)/.exec(erro?.message ?? '')?.[1];
  return codigo
    ? `O servidor respondeu com erro ${codigo}. Confira a conexão e tente de novo.`
    : 'Confira a conexão com a internet e tente de novo.';
}

/* ------------------------------------------------------------------ */
/* Animações                                                           */
/* ------------------------------------------------------------------ */

/**
 * Reordena os filhos de `lista` na ordem de `itens` e anima cada um da posição
 * antiga para a nova (técnica FLIP, só com transform).
 * opcoes.escala: use quando a lista está dentro de um elemento com transform: scale().
 * Devolve a lista de itens que subiram.
 */
export function reordenarComAnimacao(lista, itens, opcoes = {}) {
  const duracao = opcoes.duracao ?? 900;
  const escala = opcoes.escala ?? 1;
  const easing = opcoes.easing ?? 'cubic-bezier(0.65, 0, 0.35, 1)';
  const antes = new Map();
  for (const item of itens) {
    if (item.isConnected) antes.set(item, item.getBoundingClientRect().top);
  }
  for (const item of itens) {
    for (const animacao of item.getAnimations()) {
      if (animacao.id === 'flip') animacao.cancel();
    }
  }

  // Só mexe no DOM se a ordem mudou de fato (evita reflow à toa).
  const atual = [...lista.children].filter((c) => itens.includes(c));
  const mudou = atual.length !== itens.length || atual.some((c, i) => c !== itens[i]);
  if (mudou) for (const item of itens) lista.append(item);

  const subiram = [];
  if (reduzMovimento() || !mudou) return subiram;

  for (const item of itens) {
    const topoAntes = antes.get(item);
    if (topoAntes === undefined) continue;
    const delta = (topoAntes - item.getBoundingClientRect().top) / escala;
    if (Math.abs(delta) < 1) continue;
    if (delta > 0) subiram.push(item);
    if (opcoes.antesDeAnimar) opcoes.antesDeAnimar(item, delta);
    const animacao = item.animate(
      [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }],
      { duration: duracao, easing },
    );
    animacao.id = 'flip';
    item.classList.add(delta > 0 ? 'subindo' : 'descendo');
    animacao.finished
      .catch(() => {})
      .finally(() => item.classList.remove('subindo', 'descendo'));
  }
  return subiram;
}

/**
 * Conta de um número a outro no texto do elemento.
 * O valor final fica em data-valor para a próxima contagem.
 */
export function animarNumero(elemento, para, opcoes = {}) {
  const de = Number(elemento.dataset.valor ?? para);
  elemento.dataset.valor = String(para);
  const formatar = opcoes.formatar ?? formatarNumero;
  cancelAnimationFrame(Number(elemento.dataset.quadro) || 0);
  if (de === para || reduzMovimento()) {
    elemento.textContent = formatar(para);
    return;
  }
  const duracao = opcoes.duracao ?? 700;
  const inicio = performance.now();
  const passo = (agora) => {
    const t = Math.min(1, (agora - inicio) / duracao);
    const suave = 1 - (1 - t) ** 3;
    elemento.textContent = formatar(Math.round(de + (para - de) * suave));
    if (t < 1) elemento.dataset.quadro = String(requestAnimationFrame(passo));
  };
  elemento.dataset.quadro = String(requestAnimationFrame(passo));
}

/** Toca uma animação de keyframes uma vez (reinicia se já estiver tocando). */
export function pulsar(elemento, quadros, opcoes = {}) {
  if (!elemento || reduzMovimento()) return null;
  for (const a of elemento.getAnimations()) if (a.id === opcoes.id) a.cancel();
  const animacao = elemento.animate(quadros, {
    duration: 600,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    ...opcoes,
  });
  if (opcoes.id) animacao.id = opcoes.id;
  return animacao;
}

/* ------------------------------------------------------------------ */
/* Diálogo de confirmação                                              */
/* ------------------------------------------------------------------ */

/**
 * Abre um <dialog> de confirmação e devolve uma promessa com true/false.
 * opcoes: { titulo, texto, confirmar, cancelar, perigo }
 */
export function confirmar(opcoes) {
  return new Promise((resolver) => {
    const titulo = el('h2', { id: 'dialogo-titulo' }, opcoes.titulo);
    const botaoCancelar = el('button', { type: 'button', class: 'botao botao--fantasma', value: 'nao' }, opcoes.cancelar ?? 'Cancelar');
    const botaoConfirmar = el(
      'button',
      { type: 'button', class: `botao ${opcoes.perigo ? 'botao--perigo' : ''}`, value: 'sim' },
      opcoes.confirmar ?? 'Confirmar',
    );
    const dialogo = el(
      'dialog',
      { class: 'dialogo', 'aria-labelledby': 'dialogo-titulo' },
      titulo,
      opcoes.texto ? el('p', {}, opcoes.texto) : null,
      el('div', { class: 'dialogo__acoes' }, botaoCancelar, botaoConfirmar),
    );
    const fechar = (resposta) => {
      dialogo.close();
      dialogo.remove();
      resolver(resposta);
    };
    botaoCancelar.addEventListener('click', () => fechar(false));
    botaoConfirmar.addEventListener('click', () => fechar(true));
    dialogo.addEventListener('cancel', (e) => {
      e.preventDefault();
      fechar(false);
    });
    dialogo.addEventListener('click', (e) => {
      // Clique no fundo escurecido (fora da caixa) cancela.
      if (e.target !== dialogo) return;
      const r = dialogo.getBoundingClientRect();
      const fora = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      if (fora) fechar(false);
    });
    document.body.append(dialogo);
    dialogo.showModal();
    botaoCancelar.focus();
  });
}
