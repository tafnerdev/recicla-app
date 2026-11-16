/**
 * Recicla Slide: painel de demonstração (/demo).
 * Registra descartes à mão, desfaz, zera, volta ao exemplo e liga descartes automáticos.
 * É o plano B do palco se o sensor falhar.
 */
import * as dados from './dados.js';
import {
  ROTULO_TIPO,
  avisar,
  confirmar,
  el,
  formatarNumero,
  icone,
  mostrarEstado,
  nomeAndar,
  ordinal,
  prepararAvisos,
  pulsar,
  rotuloPontos,
  tempoRelativo,
  textoErroCarregar,
} from './comum.js';

const $ = (id) => document.getElementById(id);
const INTERVALO_AUTOMATICO = 4000;
const ORIGEM = { demo: 'painel', sensor: 'sensor', app: 'app' };

const estado = {
  edificio: null,
  placar: null,
  cartoes: new Map(),
  escolhido: null,
  automatico: 0,
  ocupado: false,
};

async function iniciar() {
  prepararAvisos();
  for (const caixa of document.querySelectorAll('[data-icone]')) caixa.innerHTML = icone(caixa.dataset.icone);
  for (const link of document.querySelectorAll('[data-icone-fim]')) link.insertAdjacentHTML('beforeend', icone(link.dataset.iconeFim));

  try {
    await dados.iniciar();
    const [edificio, placar] = await Promise.all([dados.obterEdificio(), dados.obterPlacar()]);
    Object.assign(estado, { edificio, placar });
  } catch (erro) {
    console.error(erro);
    $('d-carregando').hidden = true;
    const caixa = $('d-erro');
    caixa.hidden = false;
    mostrarEstado(caixa, {
      tipo: 'erro',
      titulo: 'O placar não carregou',
      texto: textoErroCarregar(erro),
      acao: { rotulo: 'Tentar de novo', icone: 'atualizar', aoClicar: () => location.reload() },
    });
    return;
  }

  montarCartoes();
  renderizar();
  ligarEventos();
  $('d-carregando').hidden = true;
  $('d-painel').hidden = false;
  dados.aoMudar((placar) => {
    estado.placar = placar;
    renderizar();
    if (placar.evento?.tipo === 'descarte') destacar(placar.evento);
  });
  setInterval(atualizarTempos, 20_000);
}

/* ------------------------------------------------------------------ */
/* Cartões dos andares                                                 */
/* ------------------------------------------------------------------ */

function montarCartoes() {
  const lista = $('d-lista');
  // Do andar mais alto para o mais baixo, como no prédio.
  const andares = [...estado.edificio.andares].sort((a, b) => b - a);
  for (const andar of andares) {
    const titulo = `d-andar-${andar}`;
    const cartao = el(
      'li',
      { class: 'd-andar', dataset: { andar }, 'aria-labelledby': titulo },
      el('span', { class: 'd-andar__brilho', 'aria-hidden': 'true' }),
      el('h2', { class: 'd-andar__nome', id: titulo }, nomeAndar(andar)),
      el(
        'p',
        { class: 'd-andar__info' },
        el('span', { class: 'd-andar__pontos' }, el('span', { class: 'numero' }, '0'), ' pontos'),
        el('span', { class: 'd-andar__posicao' }),
      ),
      el(
        'div',
        { class: 'd-andar__botoes' },
        ...['reciclavel', 'organico'].map((tipo) =>
          el(
            'button',
            {
              type: 'button',
              class: `botao${tipo === 'organico' ? ' botao--organico' : ''}`,
              dataset: { tipo },
              'aria-label': `${ROTULO_TIPO[tipo]} no ${nomeAndar(andar)}`,
              onclick: () => registrar(andar, tipo),
            },
            el('span', { class: `marca-tipo${tipo === 'organico' ? ' marca-tipo--organico' : ''}`, 'aria-hidden': 'true' }, tipo === 'organico' ? 'O' : 'R'),
            ROTULO_TIPO[tipo],
          ),
        ),
      ),
    );
    estado.cartoes.set(andar, cartao);
    lista.append(cartao);
  }
}

function renderizar() {
  const { ranking, totais, historico } = estado.placar;
  for (const item of ranking) {
    const cartao = estado.cartoes.get(item.andar);
    if (!cartao) continue;
    cartao.dataset.posicao = String(item.posicao ?? '');
    cartao.querySelector('.d-andar__posicao').textContent = item.posicao ? `${ordinal(item.posicao)} lugar` : '';
    cartao.querySelector('.d-andar__pontos .numero').textContent = formatarNumero(item.pontos);
  }
  $('d-vazio').hidden = totais.pontos !== 0;

  const ultimo = historico[0];
  const desfazer = $('d-desfazer');
  desfazer.disabled = !ultimo;
  $('d-desfazer-texto').textContent = ultimo
    ? `Desfazer: ${ROTULO_TIPO[ultimo.descarte].toLowerCase()} no ${nomeAndar(ultimo.andar)}`
    : 'Desfazer último';

  const lista = $('d-historico');
  lista.replaceChildren(
    ...historico.slice(0, 12).map((h) =>
      el(
        'li',
        { class: 'd-historico__item', dataset: { em: h.em } },
        el('span', { class: `marca-tipo${h.descarte === 'organico' ? ' marca-tipo--organico' : ''}`, 'aria-hidden': 'true' }, h.descarte === 'organico' ? 'O' : 'R'),
        el(
          'span',
          {},
          el('strong', {}, `${ROTULO_TIPO[h.descarte]}, ${nomeAndar(h.andar)}`),
          el('span', { class: 'd-historico__origem' }, `+${h.pontos} pontos, pelo ${ORIGEM[h.origem] ?? h.origem}`),
        ),
        el('span', { class: 'd-historico__quando' }, tempoRelativo(h.em)),
      ),
    ),
  );
  $('d-historico-vazio').hidden = historico.length > 0;
}

function atualizarTempos() {
  for (const item of document.querySelectorAll('.d-historico__item')) {
    item.querySelector('.d-historico__quando').textContent = tempoRelativo(item.dataset.em);
  }
}

function destacar(evento) {
  const cartao = estado.cartoes.get(evento.andar);
  const brilho = cartao?.querySelector('.d-andar__brilho');
  if (!brilho) return;
  brilho.dataset.tipo = evento.descarte;
  pulsar(brilho, [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0 }], { duration: 900, id: 'brilho' });
}

/* ------------------------------------------------------------------ */
/* Ações                                                               */
/* ------------------------------------------------------------------ */

async function registrar(andar, tipo) {
  try {
    const placar = await dados.registrarDescarte(andar, tipo, 'demo');
    const item = placar.ranking.find((i) => i.andar === andar);
    $('d-ultimo').innerHTML = `<strong>${ROTULO_TIPO[tipo]} no ${nomeAndar(andar)}</strong>: +${placar.evento.pontos}, agora com ${rotuloPontos(item.pontos)} (${ordinal(item.posicao)} lugar).`;
  } catch (erro) {
    console.error(erro);
    avisar(`Não registrou: ${erro.message}`, { tipo: 'erro' });
  }
}

async function desfazer() {
  const placar = await dados.desfazerUltimo();
  if (!placar) {
    avisar('Não há descarte para desfazer.');
    return;
  }
  const ev = placar.evento;
  $('d-ultimo').innerHTML = `<strong>Desfeito:</strong> ${ROTULO_TIPO[ev.descarte].toLowerCase()} no ${nomeAndar(ev.andar)}.`;
}

function escolherAndar(andar) {
  estado.escolhido = andar;
  for (const [numero, cartao] of estado.cartoes) {
    if (numero === andar) cartao.setAttribute('aria-current', 'true');
    else cartao.removeAttribute('aria-current');
  }
  $('d-ultimo').innerHTML = `<strong>${nomeAndar(andar)}</strong> escolhido. Tecle R (reciclável) ou O (orgânico).`;
}

function alternarAutomatico() {
  const chave = $('d-auto');
  if (estado.automatico) {
    clearInterval(estado.automatico);
    estado.automatico = 0;
    chave.setAttribute('aria-checked', 'false');
    avisar('Descartes automáticos desligados.');
    return;
  }
  const andares = estado.edificio.andares;
  const sortear = () => {
    const andar = andares[Math.floor(Math.random() * andares.length)];
    // Um pouco mais de reciclável que orgânico, só para variar o telão.
    const tipo = Math.random() < 0.58 ? 'reciclavel' : 'organico';
    registrar(andar, tipo);
  };
  sortear();
  estado.automatico = setInterval(sortear, INTERVALO_AUTOMATICO);
  chave.setAttribute('aria-checked', 'true');
  avisar('Descartes automáticos ligados. Deixe só uma aba do painel com isso ligado.');
}

function ligarEventos() {
  $('d-desfazer').addEventListener('click', desfazer);
  $('d-auto').addEventListener('click', alternarAutomatico);

  $('d-restaurar').addEventListener('click', async () => {
    const ok = await confirmar({
      titulo: 'Voltar aos dados de exemplo?',
      texto: 'O placar volta aos números do arquivo de exemplo, e a lista de últimos descartes fica vazia. Faça isso antes de começar a apresentação.',
      confirmar: 'Voltar ao exemplo',
    });
    if (!ok) return;
    await dados.restaurarExemplo();
    $('d-ultimo').textContent = 'Placar de volta aos dados de exemplo.';
    avisar('Placar de volta aos dados de exemplo.');
  });

  $('d-zerar').addEventListener('click', async () => {
    const ok = await confirmar({
      titulo: 'Zerar o placar?',
      texto: 'Todos os andares voltam a zero. Isso não dá para desfazer, mas depois você pode voltar aos dados de exemplo.',
      confirmar: 'Zerar placar',
      perigo: true,
    });
    if (!ok) return;
    await dados.zerarPlacar();
    $('d-ultimo').textContent = 'Placar zerado.';
    avisar('Placar zerado.');
  });

  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, dialog')) return;
    if (document.querySelector('dialog[open]')) return;
    const tecla = e.key.toLowerCase();
    if (/^[0-9]$/.test(tecla)) {
      const andar = tecla === '0' ? 10 : Number(tecla);
      if (estado.cartoes.has(andar)) {
        e.preventDefault();
        escolherAndar(andar);
      }
    } else if (tecla === 'r' || tecla === 'o') {
      e.preventDefault();
      if (estado.escolhido === null) {
        avisar('Escolha o andar primeiro com as teclas 1 a 9 ou 0.');
        return;
      }
      registrar(estado.escolhido, tecla === 'r' ? 'reciclavel' : 'organico');
    } else if (tecla === 'z') {
      e.preventDefault();
      desfazer();
    }
  });
}

iniciar();
