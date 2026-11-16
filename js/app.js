/**
 * Recicla Slide: app do morador (/app).
 * O andar vem pela URL (?andar=7, o link da etiqueta NFC) ou fica guardado no aparelho.
 */
import * as dados from './dados.js';
import {
  animarNumero,
  atualizarLinhaRanking,
  criarLinhaRanking,
  avisar,
  confirmar,
  el,
  formatarNumero,
  icone,
  mostrarEstado,
  nomeAndar,
  nomeMes,
  ordinal,
  prepararAvisos,
  pulsar,
  reduzMovimento,
  reordenarComAnimacao,
  rotuloDescartes,
  rotuloPontos,
  tempoRelativo,
  textoErroCarregar,
} from './comum.js';

const $ = (id) => document.getElementById(id);

const estado = {
  edificio: null,
  placar: null,
  pessoal: null,
  meuAndar: null,
  vindoDaEtiqueta: false,
  escolhendo: false,
  linhas: new Map(),
};

const mes = nomeMes();

/* ------------------------------------------------------------------ */
/* Início                                                              */
/* ------------------------------------------------------------------ */

async function iniciar() {
  prepararAvisos();
  for (const caixa of document.querySelectorAll('[data-icone]')) caixa.innerHTML = icone(caixa.dataset.icone);

  try {
    await dados.iniciar();
    const [edificio, placar, pessoal] = await Promise.all([
      dados.obterEdificio(),
      dados.obterPlacar(),
      dados.obterPessoal(),
    ]);
    Object.assign(estado, { edificio, placar, pessoal });
  } catch (erro) {
    console.error(erro);
    mostrarErro(erro);
    return;
  }

  const alerta = await resolverAndar();
  preencherTextosFixos();
  montarEscolha();
  renderizar({ animar: false });
  renderizarPessoal(false);
  ligarEventos();

  $('carregando').hidden = true;
  const painel = $('painel');
  painel.hidden = false;
  painel.classList.add('entrou');

  if (!estado.meuAndar || alerta) abrirEscolha(alerta);

  dados.aoMudar(aoMudarPlacar);
  dados.aoMudarPessoal((pessoal) => {
    estado.pessoal = pessoal;
    renderizarPessoal(true);
  });
  setInterval(atualizarHora, 30_000);
}

/** Lê ?andar= da URL. Devolve um texto de alerta se o andar não existir. */
async function resolverAndar() {
  const parametro = new URLSearchParams(location.search).get('andar');
  estado.meuAndar = await dados.obterMeuAndar();
  if (parametro === null) return null;

  const numero = Number(parametro);
  if (parametro.trim() !== '' && Number.isInteger(numero) && estado.edificio.andares.includes(numero)) {
    estado.meuAndar = await dados.definirMeuAndar(numero);
    estado.vindoDaEtiqueta = true;
    return null;
  }
  const texto = parametro.trim() === '' ? 'O link não diz qual é o andar.' : `O ${/^\d+$/.test(parametro) ? `${parametro}º andar` : `andar "${parametro}"`} não existe no ${estado.edificio.nome}.`;
  return `${texto} Escolha o seu andar abaixo.`;
}

function preencherTextosFixos() {
  const { edificio } = estado;
  $('nome-predio').textContent = edificio.nome;
  $('ranking-mes').textContent = mes;
  $('premio-mes').textContent = mes;
  $('destaque-unidade').textContent = `pontos em ${mes}`;
  $('pessoal-rotulo-mes').textContent = `Seus pontos em ${mes}`;
  const { reciclavel, organico } = edificio.pontosPorDescarte;
  $('regra-pontos').textContent =
    reciclavel === organico
      ? `Cada descarte vale ${reciclavel} pontos`
      : `Reciclável vale ${reciclavel} e orgânico vale ${organico} pontos`;
  $('destaque-mais').textContent = `+${reciclavel}`;
}

function mostrarErro(erro) {
  $('carregando').hidden = true;
  const caixa = $('erro');
  caixa.hidden = false;
  mostrarEstado(caixa, {
    tipo: 'erro',
    titulo: 'Não deu para abrir o placar',
    texto: textoErroCarregar(erro),
    acao: { rotulo: 'Tentar de novo', icone: 'atualizar', aoClicar: () => location.reload() },
  });
}

/* ------------------------------------------------------------------ */
/* Escolha do andar                                                    */
/* ------------------------------------------------------------------ */

function montarEscolha() {
  const grade = $('escolher-grade');
  grade.replaceChildren(
    ...[...estado.edificio.andares]
      .sort((a, b) => b - a)
      .map((andar) =>
        el(
          'button',
          {
            type: 'button',
            class: 'escolher__andar',
            dataset: { andar },
            'aria-pressed': 'false',
            'aria-label': nomeAndar(andar),
            onclick: () => escolherAndar(andar),
          },
          el('span', { class: 'numero' }, andar === 0 ? 'T' : ordinal(andar)),
          el('small', {}, andar === 0 ? 'térreo' : 'andar'),
        ),
      ),
  );
}

function abrirEscolha(alerta = null) {
  estado.escolhendo = true;
  const aviso = $('escolher-alerta');
  aviso.hidden = !alerta;
  aviso.textContent = alerta ?? '';
  for (const botao of $('escolher-grade').children) {
    botao.setAttribute('aria-pressed', String(Number(botao.dataset.andar) === estado.meuAndar));
  }
  $('escolher-cancelar').hidden = !estado.meuAndar;
  $('escolher').hidden = false;
  $('destaque').hidden = true;
  $('pontuar').hidden = true;
  const titulo = $('escolher-titulo');
  titulo.tabIndex = -1;
  titulo.focus({ preventScroll: false });
}

function fecharEscolha() {
  estado.escolhendo = false;
  $('escolher').hidden = true;
  renderizar({ animar: false });
  renderizarPessoal(false);
}

async function escolherAndar(andar) {
  estado.meuAndar = await dados.definirMeuAndar(andar);
  const url = new URL(location.href);
  if (url.searchParams.has('andar')) {
    url.searchParams.set('andar', String(andar));
    history.replaceState(null, '', url);
  }
  fecharEscolha();
  const titulo = $('destaque-titulo');
  titulo.tabIndex = -1;
  titulo.focus();
  avisar(`Pronto. Este aparelho agora mostra o ${nomeAndar(andar)}.`);
}

/* ------------------------------------------------------------------ */
/* Placar                                                              */
/* ------------------------------------------------------------------ */

function itemDoAndar(andar, placar = estado.placar) {
  return placar.ranking.find((i) => i.andar === andar) ?? null;
}

function pontosPorDescarte() {
  const { reciclavel, organico } = estado.edificio.pontosPorDescarte;
  return Math.max(reciclavel, organico);
}

function renderizar({ animar }) {
  renderizarRanking(animar);
  renderizarDestaque(animar);
  renderizarPremio();
  atualizarHora();
}

function renderizarDestaque(animar) {
  const destaque = $('destaque');
  const andar = estado.meuAndar;
  if (!andar || estado.escolhendo) {
    destaque.hidden = true;
    return;
  }
  destaque.hidden = false;
  const { ranking, totais } = estado.placar;
  const item = itemDoAndar(andar);

  $('destaque-andar').textContent = andar === 0 ? 'Térreo' : ordinal(andar);
  $('destaque-titulo').lastChild.textContent = andar === 0 ? '' : ' andar';
  if (animar) animarNumero($('destaque-pontos'), item.pontos);
  else {
    $('destaque-pontos').dataset.valor = String(item.pontos);
    $('destaque-pontos').textContent = formatarNumero(item.pontos);
  }
  $('destaque-r').textContent = formatarNumero(item.reciclavel);
  $('destaque-o').textContent = formatarNumero(item.organico);

  const posicao = $('destaque-posicao');
  const meta = $('destaque-meta');
  const empatados = ranking.filter((i) => i.andar !== andar && i.pontos === item.pontos && item.pontos > 0);

  if (item.pontos === 0) {
    posicao.textContent = `Ainda sem pontos em ${mes}.`;
    meta.textContent =
      totais.pontos === 0
        ? 'O placar está zerado. O primeiro descarte coloca seu andar na frente.'
        : 'Um descarte já coloca seu andar no ranking.';
    return;
  }

  const lugar = `<strong>${ordinal(item.posicao)} lugar</strong>`;
  if (empatados.length) {
    posicao.innerHTML = `${lugar}, empatado com ${listaDeAndares(empatados.map((i) => i.andar))}.`;
  } else if (item.posicao === 1) {
    posicao.innerHTML = `${lugar}. Seu andar está na frente do prédio.`;
  } else {
    posicao.innerHTML = `${lugar} entre ${ranking.length} andares.`;
  }

  if (item.posicao === 1 && !empatados.length) {
    const segundo = ranking.find((i) => i.andar !== andar);
    const vantagem = item.pontos - (segundo?.pontos ?? 0);
    meta.innerHTML = segundo && segundo.pontos > 0
      ? `Vantagem de <strong>${rotuloPontos(vantagem)}</strong> sobre o ${nomeAndar(segundo.andar)}.`
      : 'Só o seu andar pontuou até agora.';
    return;
  }

  const acima = ranking.filter((i) => i.pontos > item.pontos).at(-1);
  if (!acima) {
    // empatado em 1º
    meta.innerHTML = 'Mais <strong>1 descarte</strong> e seu andar fica sozinho na frente.';
    return;
  }
  const faltam = Math.ceil((acima.pontos - item.pontos + 1) / pontosPorDescarte());
  meta.innerHTML = `${faltam === 1 ? 'Falta' : 'Faltam'} <strong>${rotuloDescartes(faltam)}</strong> para passar o ${nomeAndar(acima.andar)}, que está em ${ordinal(acima.posicao)} lugar.`;
}

function listaDeAndares(andares) {
  const nomes = andares.map((a) => nomeAndar(a));
  if (nomes.length === 1) return `o ${nomes[0]}`;
  return `os andares ${andares.slice(0, -1).map(ordinal).join(', ')} e ${ordinal(andares.at(-1))}`;
}

function renderizarRanking(animar) {
  const lista = $('ranking-lista');
  const vazio = $('ranking-vazio');
  const { ranking, totais } = estado.placar;

  $('ranking-total').textContent = totais.descartes ? `${rotuloDescartes(totais.descartes)} no prédio` : '';

  if (totais.pontos === 0) {
    lista.hidden = true;
    vazio.hidden = false;
    mostrarEstado(vazio, {
      tipo: 'vazio',
      nivel: 'h3',
      icone: 'lixeira',
      titulo: 'Placar zerado',
      texto: `Ninguém descartou ainda em ${mes}. O primeiro descarte coloca o andar na frente.`,
    });
    return;
  }
  lista.hidden = false;
  vazio.hidden = true;

  const maximo = Math.max(1, ...ranking.map((i) => i.pontos));
  const linhas = ranking.map((item) => {
    let linha = estado.linhas.get(item.andar);
    if (!linha) {
      linha = criarLinhaRanking(item.andar);
      estado.linhas.set(item.andar, linha);
    }
    atualizarLinhaRanking(linha, item, { maximo, animar, minha: item.andar === estado.meuAndar });
    return linha;
  });

  if (!lista.children.length) lista.append(...linhas);
  else reordenarComAnimacao(lista, linhas, { duracao: 760 });
}

function renderizarPremio() {
  const { premio } = estado.edificio;
  const caixa = $('premio');
  if (!premio.titulo) {
    caixa.hidden = true;
    return;
  }
  caixa.hidden = false;
  $('premio-nome').textContent = premio.titulo;
  $('premio-descricao').textContent = premio.descricao;
  $('premio-exemplo').hidden = !premio.exemplo;

  const { ranking, totais } = estado.placar;
  const hoje = new Date();
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const fecha = `O mês fecha em ${ultimoDia} de ${mes}.`;
  const lider = $('premio-lider');
  if (totais.pontos === 0) {
    lider.textContent = `Nenhum andar pontuou ainda. ${fecha}`;
    return;
  }
  const primeiros = ranking.filter((i) => i.posicao === 1);
  if (primeiros.length > 1) {
    lider.innerHTML = `Hoje, empatados na frente: <strong>${primeiros.map((i) => ordinal(i.andar)).join(' e ')} andares</strong>. ${fecha}`;
  } else {
    const [primeiro] = primeiros;
    const eu = primeiro.andar === estado.meuAndar;
    lider.innerHTML = `Hoje na frente: <strong>${eu ? 'o seu andar' : `o ${nomeAndar(primeiro.andar)}`}</strong>, com ${rotuloPontos(primeiro.pontos)}. ${fecha}`;
  }
}

function atualizarHora() {
  if (!estado.placar) return;
  const quando = tempoRelativo(estado.placar.atualizadoEm);
  $('atualizado').textContent = quando === 'agora' ? 'Atualizado agora' : `Atualizado ${quando}`;
}

function aoMudarPlacar(placar) {
  const antes = estado.meuAndar ? itemDoAndar(estado.meuAndar) : null;
  estado.placar = placar;
  renderizar({ animar: true });

  const evento = placar.evento;
  if (!evento) return;

  if (evento.tipo === 'descarte') {
    const brilho = estado.linhas.get(evento.andar)?.querySelector('.linha__brilho');
    if (brilho) {
      brilho.dataset.tipo = evento.descarte;
      pulsar(brilho, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: 1100, id: 'brilho' });
    }

    if (evento.andar === estado.meuAndar && !$('destaque').hidden) {
      const mais = $('destaque-mais');
      mais.textContent = `+${evento.pontos}`;
      mais.style.color = evento.descarte === 'organico' ? 'var(--laranja)' : 'var(--verde-claro)';
      pulsar(
        mais,
        [
          { opacity: 0, transform: 'translateY(8px) scale(0.8)' },
          { opacity: 1, transform: 'translateY(-14px) scale(1.05)', offset: 0.35 },
          { opacity: 0, transform: 'translateY(-34px) scale(1)' },
        ],
        { duration: 1100, id: 'mais' },
      );
      if (reduzMovimento()) {
        mais.style.opacity = '1';
        clearTimeout(estado.relogioMais);
        estado.relogioMais = setTimeout(() => (mais.style.opacity = ''), 1600);
      }
      const depois = itemDoAndar(estado.meuAndar);
      if (antes?.posicao && depois?.posicao && depois.posicao < antes.posicao) {
        avisar(`Seu andar subiu para o ${ordinal(depois.posicao)} lugar.`);
      }
    }
  } else if (evento.tipo === 'zerado') {
    avisar('O placar do mês foi zerado.');
  } else if (evento.tipo === 'restaurado') {
    avisar('O placar voltou aos dados de exemplo.');
  }
}

/* ------------------------------------------------------------------ */
/* Contador pessoal                                                    */
/* ------------------------------------------------------------------ */

function renderizarPessoal(animar) {
  const caixa = $('pontuar');
  if (!estado.meuAndar || estado.escolhendo) {
    caixa.hidden = true;
    return;
  }
  caixa.hidden = false;
  caixa.classList.toggle('vindo-da-etiqueta', estado.vindoDaEtiqueta);
  $('pontuar-texto').textContent = estado.vindoDaEtiqueta
    ? `Você encostou na etiqueta do ${nomeAndar(estado.meuAndar)}. Qual boca você usou?`
    : 'Encostou o celular na etiqueta da lixeira? Toque na boca que você usou.';

  const { nome, mes: doMes, total } = estado.pessoal;
  const ola = $('pontuar-ola');
  ola.hidden = !nome;
  ola.textContent = nome ? `Olá, ${nome}.` : '';
  const campo = $('campo-nome');
  if (document.activeElement !== campo) campo.value = nome;

  const valorMes = $('pessoal-mes');
  if (animar) animarNumero(valorMes, doMes.pontos);
  else {
    valorMes.dataset.valor = String(doMes.pontos);
    valorMes.textContent = formatarNumero(doMes.pontos);
  }
  $('pessoal-descartes').textContent = formatarNumero(doMes.descartes);
  $('pessoal-total').textContent = formatarNumero(total.pontos);
}

async function pontuarPessoal(tipo, botao) {
  const botoes = document.querySelectorAll('.pontuar__botoes .botao');
  for (const b of botoes) b.disabled = true;
  try {
    const resumo = await dados.registrarDescartePessoal(tipo, estado.meuAndar);
    estado.pessoal = resumo;
    renderizarPessoal(true);
    const pontos = estado.edificio.pontosPorDescarte[tipo];
    avisar(`+${pontos} pontos no seu nome (${tipo === 'organico' ? 'orgânico' : 'reciclável'}). Obrigado por separar.`);
    pulsar(botao, [{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 420, id: 'toque' });
    if (estado.vindoDaEtiqueta) {
      // Já pontuou pela etiqueta: um recarregamento não deve sugerir de novo.
      estado.vindoDaEtiqueta = false;
      const url = new URL(location.href);
      url.searchParams.delete('andar');
      history.replaceState(null, '', url);
      $('pontuar').classList.remove('vindo-da-etiqueta');
    }
  } catch (erro) {
    console.error(erro);
    avisar('Não deu para registrar. Tente de novo.', { tipo: 'erro' });
  } finally {
    setTimeout(() => {
      for (const b of botoes) b.disabled = false;
    }, 900);
  }
}

/* ------------------------------------------------------------------ */
/* Eventos                                                             */
/* ------------------------------------------------------------------ */

function ligarEventos() {
  $('trocar-andar').addEventListener('click', () => abrirEscolha());
  $('escolher-cancelar').addEventListener('click', () => {
    fecharEscolha();
    $('trocar-andar').focus();
  });

  for (const botao of document.querySelectorAll('.pontuar__botoes .botao')) {
    botao.addEventListener('click', () => pontuarPessoal(botao.dataset.tipo, botao));
  }

  $('form-nome').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = $('campo-nome').value;
    estado.pessoal = await dados.definirNomePessoal(nome);
    renderizarPessoal(false);
    $('campo-nome').blur();
    avisar(estado.pessoal.nome ? `Nome salvo: ${estado.pessoal.nome}.` : 'Nome apagado deste aparelho.');
  });

  $('zerar-pessoal').addEventListener('click', async () => {
    const ok = await confirmar({
      titulo: 'Apagar seus pontos?',
      texto: 'Os pontos no seu nome guardados neste celular vão sumir. Os pontos do andar não mudam.',
      confirmar: 'Apagar meus pontos',
      perigo: true,
    });
    if (!ok) return;
    estado.pessoal = await dados.zerarPessoal();
    renderizarPessoal(false);
    avisar('Seus pontos foram apagados deste aparelho.');
  });
}

iniciar();
