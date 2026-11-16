/**
 * Recicla Slide: módulo de dados.
 *
 * Toda leitura e escrita das telas passa por este arquivo. Há dois modos, com
 * as mesmas funções e o mesmo formato:
 *  - local: o prédio de exemplo (data/edificio-exemplo.json), com o placar no
 *    localStorage deste navegador e as abas se avisando pelo BroadcastChannel;
 *  - online: com js/config.js preenchido e um prédio aberto por ?predio=CODIGO,
 *    o placar vive no Supabase (js/remoto.js, supabase/schema.sql) e chega ao
 *    vivo pelo Realtime. Sem internet, os toques esperam numa fila e vão
 *    quando a conexão voltar; a tela continua com o último placar.
 * A página inicial (meta recicla-dados=exemplo) e o telão com ?simular=1 usam
 * sempre o prédio de exemplo.
 *
 * Formato do placar devolvido por obterPlacar() e entregue em aoMudar():
 *   {
 *     versao, atualizadoEm,
 *     ranking:   [{ andar, posicao, pontos, reciclavel, organico,
 *                   pontosReciclavel, pontosOrganico }],   // já ordenado
 *     totais:    { pontos, reciclavel, organico, descartes },
 *     historico: [{ id, tipo, andar, descarte, pontos, origem, em }],
 *     evento                                  // só em aoMudar: o que mudou
 *   }
 *
 * "reciclavel" e "organico" são contagens de descartes; os pontos são
 * calculados com config.pontosPorDescarte (no JSON de exemplo).
 */

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js';

const URL_DADOS = new URL('../data/edificio-exemplo.json', import.meta.url);

const PREFIXO = 'recicla-slide';
const CHAVE_PLACAR = `${PREFIXO}:placar:v1`;
const CHAVE_PESSOAL = `${PREFIXO}:pessoal:v1`;
const CHAVE_MEU_ANDAR = `${PREFIXO}:meu-andar:v1`;
const CHAVE_PREDIO = `${PREFIXO}:predio:v1`;
const CHAVE_APARELHO = `${PREFIXO}:aparelho:v1`;
const CHAVE_FILA = `${PREFIXO}:fila:v1`;
const LIMITE_HISTORICO = 30;
const LIMITE_HISTORICO_PESSOAL = 20;

export const TIPOS = Object.freeze(['reciclavel', 'organico']);
export const ORIGENS = Object.freeze(['demo', 'sensor', 'app']);

let config = null;
let carregando = null;
let canal = null;
let ultimaSerie = null;
let ultimaVersao = -1;
const ouvintesPlacar = new Set();
const ouvintesPessoal = new Set();

/* ------------------------------------------------------------------ */
/* Armazenamento: localStorage com reserva em memória (aba anônima,    */
/* armazenamento bloqueado). Sem localStorage, nada passa entre abas.  */
/* ------------------------------------------------------------------ */

const memoria = new Map();

function ler(chave) {
  try {
    const bruto = localStorage.getItem(chave);
    if (bruto !== null) return JSON.parse(bruto);
  } catch {
    /* sem acesso ao localStorage ou valor corrompido: usa a memória */
  }
  return memoria.has(chave) ? structuredClone(memoria.get(chave)) : null;
}

function gravar(chave, valor) {
  memoria.set(chave, structuredClone(valor));
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem localStorage: o valor fica só na memória desta aba */
  }
}

function novoId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Evita que duas abas gravem ao mesmo tempo (Web Locks, quando existir). */
function comTrava(fn) {
  if (navigator.locks?.request) return navigator.locks.request(`${PREFIXO}:placar`, fn);
  return Promise.resolve().then(fn);
}

/* ------------------------------------------------------------------ */
/* Configuração (JSON de exemplo)                                      */
/* ------------------------------------------------------------------ */

function validarConfig(bruto) {
  const andares = Array.isArray(bruto?.andares) ? bruto.andares : [];
  const numeros = andares.map((a) => Number(a.numero));
  if (!andares.length || numeros.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error('JSON de dados sem lista de andares válida.');
  }
  const pontos = bruto.pontosPorDescarte ?? {};
  return {
    versaoDados: Number(bruto.versaoDados) || 1,
    edificio: {
      id: String(bruto.edificio?.id ?? 'edificio'),
      nome: String(bruto.edificio?.nome ?? 'Edifício'),
      apartamentosPorAndar: Math.max(1, Math.round(Number(bruto.edificio?.apartamentosPorAndar)) || 1),
    },
    pontosPorDescarte: {
      reciclavel: Number(pontos.reciclavel) || 10,
      organico: Number(pontos.organico) || 10,
    },
    premio: {
      exemplo: Boolean(bruto.premio?.exemplo),
      titulo: String(bruto.premio?.titulo ?? ''),
      descricao: String(bruto.premio?.descricao ?? ''),
    },
    andares: andares
      .map((a) => ({
        numero: Number(a.numero),
        reciclavel: Math.max(0, Number(a.reciclavel) || 0),
        organico: Math.max(0, Number(a.organico) || 0),
      }))
      .sort((a, b) => a.numero - b.numero),
  };
}

/**
 * Carrega o JSON e prepara o placar. As outras funções chamam isto sozinhas;
 * as telas podem chamar antes para tratar erro de carregamento.
 */
export function iniciar() {
  if (!carregando) {
    carregando = (async () => {
      const codigo = codigoPedido();
      if (codigo && configurado()) {
        await iniciarOnline(codigo);
        ligarSincronizacao();
        return;
      }
      codigoSemConfig = codigo;
      const resposta = await fetch(URL_DADOS, { cache: 'no-cache' });
      if (!resposta.ok) throw new Error(`Não carregou os dados (HTTP ${resposta.status}).`);
      config = validarConfig(await resposta.json());
      const estado = garantirEstado();
      marcarVisto(estado);
      ligarSincronizacao();
    })().catch((erro) => {
      carregando = null;
      throw erro;
    });
  }
  return carregando;
}

/* ------------------------------------------------------------------ */
/* Estado do placar                                                    */
/* ------------------------------------------------------------------ */

function contagensDoExemplo() {
  return Object.fromEntries(
    config.andares.map((a) => [a.numero, { reciclavel: a.reciclavel, organico: a.organico }]),
  );
}

function contagensZeradas() {
  return Object.fromEntries(config.andares.map((a) => [a.numero, { reciclavel: 0, organico: 0 }]));
}

function estadoInicial() {
  return {
    schema: 1,
    edificioId: config.edificio.id,
    versaoDados: config.versaoDados,
    serie: novoId(),
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    andares: contagensDoExemplo(),
    historico: [],
    ultimoEvento: null,
  };
}

function estadoValido(estado) {
  return (
    estado &&
    estado.schema === 1 &&
    estado.edificioId === config.edificio.id &&
    estado.versaoDados === config.versaoDados &&
    estado.andares &&
    typeof estado.andares === 'object'
  );
}

function normalizar(estado) {
  for (const { numero } of config.andares) {
    const atual = estado.andares[numero] ?? {};
    estado.andares[numero] = {
      reciclavel: Math.max(0, Number(atual.reciclavel) || 0),
      organico: Math.max(0, Number(atual.organico) || 0),
    };
  }
  if (!Array.isArray(estado.historico)) estado.historico = [];
  return estado;
}

function lerEstado() {
  const estado = ler(CHAVE_PLACAR);
  return estadoValido(estado) ? normalizar(estado) : null;
}

function garantirEstado() {
  let estado = lerEstado();
  if (!estado) {
    estado = estadoInicial();
    gravar(CHAVE_PLACAR, estado);
  }
  return estado;
}

function marcarVisto(estado) {
  ultimaSerie = estado.serie;
  ultimaVersao = estado.versao;
}

function eNovo(estado) {
  return estado.serie !== ultimaSerie || estado.versao > ultimaVersao;
}

function existeAndar(numero) {
  return config.andares.some((a) => a.numero === numero);
}

function montarPlacar(estado) {
  const pp = config.pontosPorDescarte;
  const ranking = config.andares.map(({ numero }) => {
    const c = estado.andares[numero];
    const pontosReciclavel = c.reciclavel * pp.reciclavel;
    const pontosOrganico = c.organico * pp.organico;
    return {
      andar: numero,
      reciclavel: c.reciclavel,
      organico: c.organico,
      pontosReciclavel,
      pontosOrganico,
      pontos: pontosReciclavel + pontosOrganico,
      posicao: null,
    };
  });

  // Mais pontos primeiro; no empate, o andar mais baixo vem antes (ordem estável).
  ranking.sort((a, b) => b.pontos - a.pontos || a.andar - b.andar);
  // Empatados dividem a posição (1º, 2º, 2º, 4º). Andar sem pontos fica sem posição.
  for (const item of ranking) {
    item.posicao = item.pontos > 0 ? 1 + ranking.filter((o) => o.pontos > item.pontos).length : null;
  }

  const totais = ranking.reduce(
    (t, i) => ({
      pontos: t.pontos + i.pontos,
      reciclavel: t.reciclavel + i.reciclavel,
      organico: t.organico + i.organico,
      descartes: t.descartes + i.reciclavel + i.organico,
    }),
    { pontos: 0, reciclavel: 0, organico: 0, descartes: 0 },
  );

  return {
    versao: estado.versao,
    atualizadoEm: estado.atualizadoEm,
    ranking,
    totais,
    historico: structuredClone(estado.historico),
  };
}

/** Lê, altera e grava o placar com trava; depois avisa esta aba e as outras. */
async function alterar(mutador) {
  await iniciar();
  return comTrava(() => {
    const estado = lerEstado() ?? estadoInicial();
    const evento = mutador(estado);
    estado.versao += 1;
    estado.atualizadoEm = evento.em;
    estado.ultimoEvento = evento;
    gravar(CHAVE_PLACAR, estado);
    marcarVisto(estado);
    canal?.postMessage({ tipo: 'placar', estado, evento });
    const placar = { ...montarPlacar(estado), evento };
    avisar(ouvintesPlacar, placar);
    return placar;
  });
}

function avisar(ouvintes, valor) {
  for (const fn of ouvintes) {
    try {
      fn(valor);
    } catch (erro) {
      console.error('[Recicla Slide] erro num ouvinte:', erro);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Sincronização entre abas                                            */
/* ------------------------------------------------------------------ */

function receberPlacar(estado, evento) {
  if (!estadoValido(estado) || !eNovo(estado)) return;
  normalizar(estado);
  marcarVisto(estado);
  avisar(ouvintesPlacar, { ...montarPlacar(estado), evento: evento ?? estado.ultimoEvento ?? null });
}

/** Relê o localStorage (aba que voltou do segundo plano ou do cache do navegador). */
function conferirArmazenamento() {
  if (!config) return;
  if (on) {
    sincronizar();
    avisarPessoal();
    return;
  }
  const estado = lerEstado();
  if (estado) receberPlacar(estado, { tipo: 'sincronizado', em: estado.atualizadoEm });
  avisarPessoal();
}

function ligarSincronizacao() {
  if (canal !== null) return;
  if ('BroadcastChannel' in globalThis) {
    canal = new BroadcastChannel(PREFIXO);
    canal.addEventListener('message', ({ data }) => {
      if (data?.tipo === 'placar') receberPlacar(data.estado, data.evento);
      if (data?.tipo === 'pessoal') avisarPessoal();
    });
  } else {
    canal = undefined;
    addEventListener('storage', (e) => {
      if (e.key === CHAVE_PLACAR && e.newValue) {
        try {
          const estado = JSON.parse(e.newValue);
          receberPlacar(estado, estado.ultimoEvento);
        } catch {
          /* valor inválido: ignora */
        }
      }
      if (e.key === CHAVE_PESSOAL) avisarPessoal();
    });
  }
  addEventListener('pageshow', (e) => e.persisted && conferirArmazenamento());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') conferirArmazenamento();
  });
}

/* ------------------------------------------------------------------ */
/* Modo online (Supabase)                                              */
/* ------------------------------------------------------------------ */

const CODIGO_VALIDO = /^[A-Z0-9]{6}$/;
const LIMITE_FILA = 200;
const ESPERA_TOQUE_MS = 2100; // a trava do servidor é de 2 s entre toques do mesmo aparelho

/** Erros com código curto para as telas tratarem (precisa-pin, pin-errado, so-no-exemplo...). */
export class ErroDados extends Error {
  constructor(codigo, mensagem) {
    super(mensagem || codigo);
    this.name = 'ErroDados';
    this.codigo = codigo;
  }
}

let on = null; // estado do prédio online (null = modo local)
let codigoSemConfig = null;
const ouvintesConexao = new Set();
const ouvintesParticipantes = new Set();

function configurado() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function parametros() {
  try {
    return new URLSearchParams(location.search);
  } catch {
    return new URLSearchParams();
  }
}

/** A página inicial e o ?simular=1 do telão usam sempre o prédio de exemplo. */
function paginaSoDeExemplo() {
  return Boolean(globalThis.document?.querySelector('meta[name="recicla-dados"][content="exemplo"]')) || parametros().get('simular') === '1';
}

/**
 * Código do prédio desta tela: o ?predio=CODIGO do endereço (que fica guardado no
 * aparelho, para o app instalado abrir no mesmo prédio) ou o guardado antes.
 * ?predio=exemplo volta ao prédio de exemplo.
 */
function codigoPedido() {
  if (paginaSoDeExemplo()) return null;
  const pedido = parametros().get('predio');
  if (pedido !== null) {
    const codigo = pedido.trim().toUpperCase();
    if (CODIGO_VALIDO.test(codigo)) {
      gravar(CHAVE_PREDIO, codigo);
      return codigo;
    }
    gravar(CHAVE_PREDIO, null);
    if (codigo && codigo !== 'EXEMPLO') throw new ErroDados('codigo-invalido', `O código de prédio “${pedido}” não existe. Confira as 6 letras e números.`);
    return null;
  }
  const guardado = ler(CHAVE_PREDIO);
  return typeof guardado === 'string' && CODIGO_VALIDO.test(guardado) ? guardado : null;
}

/** Identificador aleatório deste aparelho (não é dado pessoal). */
function aparelho() {
  let id = ler(CHAVE_APARELHO);
  if (typeof id !== 'string' || id.length < 8) {
    id = `ap-${novoId()}`;
    gravar(CHAVE_APARELHO, id);
  }
  return id;
}

function configDoPredio(predio) {
  return {
    versaoDados: 1,
    edificio: {
      id: `predio-${predio.codigo}`,
      nome: predio.nome,
      apartamentosPorAndar: Math.max(1, Number(predio.aptos_por_andar) || 1),
    },
    pontosPorDescarte: { reciclavel: 10, organico: 10 },
    premio: {
      exemplo: false,
      titulo: predio.premio_titulo ?? '',
      patrocinador: predio.premio_patrocinador ?? '',
      descricao: predio.premio_patrocinador ? `Oferecido por ${predio.premio_patrocinador}.` : '',
    },
    andares: Array.from({ length: Number(predio.andares) || 0 }, (_, i) => ({ numero: i + 1, reciclavel: 0, organico: 0 })),
  };
}

function estadoOnline() {
  return { versao: on.versao, atualizadoEm: on.atualizadoEm, andares: on.contagens, historico: on.historico };
}

function eventoDaLinha(linha) {
  return {
    id: String(linha.id),
    tipo: 'descarte',
    andar: Number(linha.andar),
    descarte: linha.tipo,
    pontos: config.pontosPorDescarte[linha.tipo] ?? 10,
    origem: linha.origem,
    em: linha.criado_em,
  };
}

/** Guarda o último placar online no aparelho: sem internet, a tela abre com ele. */
function guardarFoto() {
  gravar(`${PREFIXO}:online:${on.codigo}`, {
    predio: on.predio,
    contagens: on.contagens,
    historico: on.historico,
    atualizadoEm: on.atualizadoEm,
  });
}

function lerFila() {
  const fila = ler(CHAVE_FILA);
  return Array.isArray(fila) ? fila : [];
}

function gravarFila(fila) {
  gravar(CHAVE_FILA, fila.slice(-LIMITE_FILA));
  avisarConexao();
}

function conexaoAtual() {
  const pendentes = on ? lerFila().filter((p) => p.codigo === on.codigo).length : 0;
  return {
    online: Boolean(on),
    conectado: on ? !on.semRede && navigator.onLine !== false : true,
    aoVivo: Boolean(on?.aoVivo),
    pendentes,
  };
}

function avisarConexao() {
  avisar(ouvintesConexao, conexaoAtual());
}

/** Aplica um descarte que veio do servidor (resposta do toque ou Realtime). Sem repetir. */
function aplicarLinha(linha) {
  if (!on || !linha) return null;
  const id = String(linha.id);
  if (on.vistos.has(id)) return null;
  if (on.predio.mes_inicio && new Date(linha.criado_em) < new Date(on.predio.mes_inicio)) return null;
  const contagem = on.contagens[Number(linha.andar)];
  if (!contagem || !TIPOS.includes(linha.tipo)) return null;
  on.vistos.add(id);
  contagem[linha.tipo] += 1;
  const evento = eventoDaLinha(linha);
  on.historico.unshift(evento);
  on.historico.length = Math.min(on.historico.length, LIMITE_HISTORICO);
  on.versao += 1;
  on.atualizadoEm = evento.em ?? new Date().toISOString();
  guardarFoto();
  const placar = { ...montarPlacar(estadoOnline()), evento };
  avisar(ouvintesPlacar, placar);
  return placar;
}

function contagensIguais(a, b) {
  return Object.keys(a).every((andar) => a[andar].reciclavel === b[andar]?.reciclavel && a[andar].organico === b[andar]?.organico);
}

/**
 * Relê o prédio, o placar e os últimos descartes do servidor. Avisa as telas se algo
 * mudou (com o evento dado, ou 'sincronizado'). Lança ErroRemoto('rede') sem conexão.
 */
async function recarregarOnline(motivo = 'sincronizado') {
  const predio = await on.api.buscarPredio(on.codigo);
  if (!predio) throw new ErroDados('predio-nao-encontrado', `O prédio ${on.codigo} não existe mais.`);
  const [linhas, recentes] = await Promise.all([
    on.api.buscarPlacar(on.codigo),
    on.api.buscarHistorico(predio.id, predio.mes_inicio, LIMITE_HISTORICO),
  ]);
  const anterior = on.predio;
  const novoConfig = configDoPredio(predio);
  const contagens = Object.fromEntries(novoConfig.andares.map((a) => [a.numero, { reciclavel: 0, organico: 0 }]));
  for (const linha of linhas ?? []) {
    if (contagens[linha.andar]) contagens[linha.andar] = { reciclavel: Number(linha.reciclavel) || 0, organico: Number(linha.organico) || 0 };
  }
  const historico = (recentes ?? []).map(eventoDaLinha);
  const mudouMes = anterior.mes_inicio !== predio.mes_inicio;
  const mudouPremio = anterior.premio_titulo !== predio.premio_titulo || anterior.premio_patrocinador !== predio.premio_patrocinador;
  const mudouPlacar = mudouMes || !contagensIguais(contagens, on.contagens) || Object.keys(contagens).length !== Object.keys(on.contagens).length;

  on.semRede = false;
  on.predio = predio;
  config = novoConfig;
  on.contagens = contagens;
  on.historico = historico;
  on.vistos = new Set(historico.map((e) => e.id));
  if (Number(predio.participantes) !== on.participantes) {
    on.participantes = Number(predio.participantes) || 0;
    avisar(ouvintesParticipantes, on.participantes);
  }
  guardarFoto();
  avisarConexao();
  if (mudouPlacar || mudouPremio || motivo !== 'sincronizado') {
    on.versao += 1;
    on.atualizadoEm = new Date().toISOString();
    const tipo = mudouMes ? 'zerado' : motivo;
    const placar = { ...montarPlacar(estadoOnline()), evento: { id: novoId(), tipo, em: on.atualizadoEm } };
    avisar(ouvintesPlacar, placar);
    return placar;
  }
  return null;
}

/** Sincroniza em segundo plano: relê o servidor e manda os toques da fila. */
async function sincronizar(motivo) {
  if (!on || on.sincronizando) return;
  on.sincronizando = true;
  try {
    await recarregarOnline(motivo);
    await esvaziarFila();
  } catch (erro) {
    if (erro?.codigo === 'rede') {
      on.semRede = true;
      avisarConexao();
    } else console.warn('[Recicla Slide] não sincronizou:', erro);
  } finally {
    on.sincronizando = false;
  }
}

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function argumentosDoToque(pedido) {
  return {
    p_codigo: pedido.codigo,
    p_andar: pedido.andar,
    p_tipo: pedido.tipo,
    p_origem: pedido.origem,
    p_aparelho: aparelho(),
  };
}

/** Manda, em ordem, os toques guardados sem internet (com 2 s entre os toques do app). */
async function esvaziarFila() {
  if (!on || on.esvaziando || navigator.onLine === false) return;
  on.esvaziando = true;
  try {
    for (;;) {
      const pedido = lerFila().find((p) => p.codigo === on.codigo);
      if (!pedido) break;
      try {
        aplicarLinha(await on.api.rpc('registrar_descarte', argumentosDoToque(pedido)));
      } catch (erro) {
        if (erro?.codigo === 'rede') {
          on.semRede = true;
          avisarConexao();
          break;
        }
        if (erro?.codigo === 'devagar') {
          await esperar(ESPERA_TOQUE_MS);
          continue;
        }
        console.warn('[Recicla Slide] toque guardado recusado pelo servidor:', erro);
      }
      gravarFila(lerFila().filter((p) => p.id !== pedido.id));
      if (pedido.origem === 'app' && lerFila().some((p) => p.codigo === on.codigo)) await esperar(ESPERA_TOQUE_MS);
    }
  } finally {
    on.esvaziando = false;
  }
}

async function iniciarOnline(codigo) {
  const { conectar } = await import('./remoto.js');
  const foto = ler(`${PREFIXO}:online:${codigo}`);
  let api = null;
  let predio = null;
  try {
    api = await conectar({ url: SUPABASE_URL, chave: SUPABASE_ANON_KEY });
    predio = await api.buscarPredio(codigo);
    if (!predio) throw new ErroDados('predio-nao-encontrado', `Não achei o prédio ${codigo}. Confira o código.`);
  } catch (erro) {
    // Sem internet, mas com um placar guardado deste prédio: abre com ele e tenta de novo depois.
    if (erro?.codigo !== 'rede' || !foto?.predio) throw erro;
  }
  const base = predio ?? foto.predio;
  config = configDoPredio(base);
  on = {
    api,
    codigo,
    predio: base,
    contagens: Object.fromEntries(config.andares.map((a) => [a.numero, { reciclavel: 0, organico: 0 }])),
    historico: [],
    vistos: new Set(),
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    participantes: Number(base.participantes) || 0,
    semRede: !predio,
    aoVivo: false,
    sincronizando: false,
    esvaziando: false,
  };
  if (foto?.contagens && !predio) {
    for (const [andar, c] of Object.entries(foto.contagens)) if (on.contagens[andar]) on.contagens[andar] = c;
    on.historico = Array.isArray(foto.historico) ? foto.historico : [];
    on.vistos = new Set(on.historico.map((e) => e.id));
    on.atualizadoEm = foto.atualizadoEm ?? on.atualizadoEm;
  }
  if (predio) {
    try {
      await recarregarOnline();
    } catch (erro) {
      if (erro?.codigo !== 'rede') throw erro;
      on.semRede = true;
    }
  }
  ligarOnline();
}

/** Realtime, reconexão, fila e conferência periódica. */
function ligarOnline() {
  const assinar = async () => {
    if (!on.api) {
      // a biblioteca não carregou (primeira visita sem internet): tenta de novo
      try {
        const { conectar } = await import('./remoto.js');
        on.api = await conectar({ url: SUPABASE_URL, chave: SUPABASE_ANON_KEY });
      } catch {
        return;
      }
    }
    if (on.pararAssinatura) return;
    on.pararAssinatura = on.api.assinar(on.predio.id, {
      aoDescarte: (linha) => aplicarLinha(linha),
      aoParticipante: () => {
        on.participantes += 1;
        avisar(ouvintesParticipantes, on.participantes);
      },
      aoEvento: (linha) => {
        const motivo = linha?.tipo === 'desfeito' ? 'desfeito' : linha?.tipo === 'mes_fechado' ? 'zerado' : 'premio';
        sincronizar(motivo);
      },
      aoEstado: (situacao) => {
        const antes = on.aoVivo;
        on.aoVivo = situacao === 'ao-vivo';
        avisarConexao();
        // voltou ao vivo: confere o que pode ter passado e manda a fila
        if (on.aoVivo && !antes) sincronizar();
      },
    });
  };
  assinar();

  addEventListener('online', () => {
    avisarConexao();
    assinar().then(() => sincronizar());
  });
  addEventListener('offline', avisarConexao);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sincronizar();
  });

  // Conferência periódica: a cada 3 s sem o Realtime, a cada 20 s com ele.
  let ultima = Date.now();
  setInterval(() => {
    if (document.hidden) return;
    if (on.aoVivo && Date.now() - ultima < 20_000) return;
    ultima = Date.now();
    if (!on.api) assinar();
    sincronizar();
  }, 3000);
}

function chaveMeuAndar() {
  return on ? `${CHAVE_MEU_ANDAR}:${on.codigo}` : CHAVE_MEU_ANDAR;
}

function lerPin() {
  try {
    return sessionStorage.getItem(`${PREFIXO}:pin:${on?.codigo}`) || '';
  } catch {
    return '';
  }
}

async function comPin(funcao, argumentos) {
  const pin = lerPin();
  if (!pin) throw new ErroDados('precisa-pin', 'Digite o PIN do síndico.');
  const resposta = await on.api.rpc(funcao, { p_codigo: on.codigo, p_pin: pin, ...argumentos });
  if (!resposta?.ok) {
    if (resposta?.erro === 'pin_errado') {
      definirPinSindico('');
      throw new ErroDados('pin-errado', 'PIN errado.');
    }
    if (resposta?.erro === 'muitas_tentativas') throw new ErroDados('muitas-tentativas', 'Muitas tentativas de PIN. Espere 10 minutos.');
    throw new ErroDados(resposta?.erro || 'servidor', 'O servidor recusou o pedido.');
  }
  return resposta;
}

/* ------------------------------------------------------------------ */
/* API pública: modo online, palco, conexão                            */
/* ------------------------------------------------------------------ */

/**
 * Como esta tela está funcionando: { online, codigo, configurado, codigoSemConfig }.
 * codigoSemConfig: a tela pediu um prédio (?predio=) mas js/config.js está vazio.
 */
export async function modo() {
  try {
    await iniciar();
  } catch {
    /* o erro de carregamento aparece pelas outras funções */
  }
  return { online: Boolean(on), codigo: on?.codigo ?? null, configurado: configurado(), codigoSemConfig };
}

/** Palco: coloca este aparelho num andar (sempre o que tem menos gente) e guarda o andar. */
export async function entrarNoPredio() {
  await iniciar();
  if (!on) throw new ErroDados('so-online', 'O modo palco precisa do placar online.');
  if (!on.api) throw new ErroDados('rede', 'Sem conexão. Tente de novo quando a internet voltar.');
  const andar = Number(await on.api.rpc('entrar', { p_codigo: on.codigo, p_aparelho: aparelho() }));
  if (!existeAndar(andar)) throw new ErroDados('servidor', 'O servidor devolveu um andar que não existe.');
  gravar(chaveMeuAndar(), andar);
  return andar;
}

/** Quantas pessoas entraram no prédio (modo palco). No modo local, 0. */
export async function obterParticipantes() {
  await iniciar();
  return on ? on.participantes : 0;
}

export function aoMudarParticipantes(callback) {
  ouvintesParticipantes.add(callback);
  iniciar().catch(() => {});
  return () => ouvintesParticipantes.delete(callback);
}

/** Situação da conexão: { online, conectado, aoVivo, pendentes } (pendentes = toques na fila). */
export async function obterConexao() {
  await iniciar();
  return conexaoAtual();
}

export function aoMudarConexao(callback) {
  ouvintesConexao.add(callback);
  iniciar()
    .then(() => callback(conexaoAtual()))
    .catch(() => {});
  return () => ouvintesConexao.delete(callback);
}

/** PIN do síndico para desfazer e fechar o mês no prédio online (fica só nesta aba). */
export function definirPinSindico(pin) {
  try {
    const chave = `${PREFIXO}:pin:${on?.codigo}`;
    if (pin) sessionStorage.setItem(chave, String(pin));
    else sessionStorage.removeItem(chave);
  } catch {
    /* sem sessionStorage: o PIN precisa ser digitado de novo */
  }
}

/* ------------------------------------------------------------------ */
/* API pública: prédio e placar                                        */
/* ------------------------------------------------------------------ */

/** Nome do prédio, prêmio do mês, pontos por descarte e lista de andares. */
export async function obterEdificio() {
  await iniciar();
  return {
    id: config.edificio.id,
    nome: config.edificio.nome,
    apartamentosPorAndar: config.edificio.apartamentosPorAndar,
    premio: { ...config.premio },
    pontosPorDescarte: { ...config.pontosPorDescarte },
    andares: config.andares.map((a) => a.numero),
  };
}

export async function obterPlacar() {
  await iniciar();
  if (on) return montarPlacar(estadoOnline());
  const estado = garantirEstado();
  marcarVisto(estado);
  return montarPlacar(estado);
}

export async function andarExiste(numero) {
  await iniciar();
  return existeAndar(Number(numero));
}

/**
 * Registra um descarte no andar. tipo: 'reciclavel' | 'organico'.
 * origem: 'demo' (painel), 'sensor' (porta serial) ou 'app'.
 */
export async function registrarDescarte(andar, tipo, origem = 'demo') {
  await iniciar();
  const numero = Number(andar);
  if (!existeAndar(numero)) throw new RangeError(`O andar ${andar} não existe neste prédio.`);
  if (!TIPOS.includes(tipo)) throw new TypeError(`Tipo de descarte inválido: ${tipo}`);
  if (on) return registrarDescarteOnline(numero, tipo, origem);
  return alterar((estado) => {
    estado.andares[numero][tipo] += 1;
    const evento = {
      id: novoId(),
      tipo: 'descarte',
      andar: numero,
      descarte: tipo,
      pontos: config.pontosPorDescarte[tipo],
      origem: ORIGENS.includes(origem) ? origem : 'demo',
      em: new Date().toISOString(),
    };
    estado.historico.unshift(evento);
    estado.historico.length = Math.min(estado.historico.length, LIMITE_HISTORICO);
    return evento;
  });
}

/**
 * Toque online: vai direto ao servidor; sem internet, entra na fila e vai depois.
 * Toques do app com menos de 2 s entre si são recusados (ErroDados 'devagar').
 */
async function registrarDescarteOnline(andar, tipo, origem) {
  const pedido = {
    id: novoId(),
    codigo: on.codigo,
    andar,
    tipo,
    origem: ORIGENS.includes(origem) ? origem : 'demo',
    em: new Date().toISOString(),
  };
  const naFila = () => {
    gravarFila([...lerFila(), pedido]);
    return { ...montarPlacar(estadoOnline()), evento: { id: pedido.id, tipo: 'na-fila', andar, descarte: tipo, em: pedido.em } };
  };
  if (navigator.onLine === false || !on.api) return naFila();
  try {
    const linha = await on.api.rpc('registrar_descarte', argumentosDoToque(pedido));
    if (on.semRede) {
      on.semRede = false;
      avisarConexao();
      esvaziarFila();
    }
    return aplicarLinha(linha) ?? { ...montarPlacar(estadoOnline()), evento: eventoDaLinha(linha) };
  } catch (erro) {
    if (erro?.codigo === 'rede') {
      on.semRede = true;
      return naFila();
    }
    if (erro?.codigo === 'devagar') throw new ErroDados('devagar', 'Espere 2 segundos entre um toque e outro.');
    throw erro;
  }
}

/** Desfaz o descarte mais recente do histórico. Devolve null se não houver. */
export async function desfazerUltimo() {
  await iniciar();
  if (on) {
    const resposta = await comPin('desfazer_ultimo');
    if (resposta.nada) return null;
    const placar = (await recarregarOnline('desfeito')) ?? { ...montarPlacar(estadoOnline()), evento: { id: novoId(), tipo: 'desfeito' } };
    Object.assign(placar.evento, { andar: resposta.andar, descarte: resposta.tipo, pontos: -10 });
    return placar;
  }
  const estado = lerEstado();
  if (!estado?.historico.length) return null;
  return alterar((atual) => {
    const ultimo = atual.historico.shift();
    if (!ultimo) return { id: novoId(), tipo: 'nada', em: new Date().toISOString() };
    const contagem = atual.andares[ultimo.andar];
    if (contagem) contagem[ultimo.descarte] = Math.max(0, contagem[ultimo.descarte] - 1);
    return {
      id: novoId(),
      tipo: 'desfeito',
      andar: ultimo.andar,
      descarte: ultimo.descarte,
      pontos: -ultimo.pontos,
      origem: ultimo.origem,
      em: new Date().toISOString(),
    };
  });
}

/** Zera todos os andares. No prédio online, fecha o mês (guarda o campeão e zera; pede o PIN). */
export async function zerarPlacar() {
  await iniciar();
  if (on) {
    await comPin('fechar_mes');
    return (await recarregarOnline('zerado')) ?? { ...montarPlacar(estadoOnline()), evento: { id: novoId(), tipo: 'zerado' } };
  }
  return alterar((estado) => {
    estado.andares = contagensZeradas();
    estado.historico = [];
    return { id: novoId(), tipo: 'zerado', em: new Date().toISOString() };
  });
}

/** Volta às contagens do JSON de exemplo (só no prédio de exemplo). */
export async function restaurarExemplo() {
  await iniciar();
  if (on) throw new ErroDados('so-no-exemplo', 'O prédio online não tem dados de exemplo para voltar. Para zerar, feche o mês.');
  return alterar((estado) => {
    estado.andares = contagensDoExemplo();
    estado.historico = [];
    return { id: novoId(), tipo: 'restaurado', em: new Date().toISOString() };
  });
}

/**
 * Placar de faz de conta, só na memória desta página. Serve à demonstração da
 * página inicial: usa os mesmos dados de exemplo e o mesmo cálculo de ranking,
 * mas não grava nada e não mexe no placar das outras telas.
 */
export async function criarSimulacao() {
  await iniciar();
  const estado = {
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    andares: contagensDoExemplo(),
    historico: [],
  };
  const ouvintes = new Set();
  const mudar = (evento) => {
    estado.versao += 1;
    estado.atualizadoEm = evento.em;
    const placar = { ...montarPlacar(estado), evento };
    avisar(ouvintes, placar);
    return placar;
  };
  return {
    pontosPorDescarte: { ...config.pontosPorDescarte },
    async obterPlacar() {
      return montarPlacar(estado);
    },
    async registrarDescarte(andar, tipo) {
      const numero = Number(andar);
      if (!existeAndar(numero)) throw new RangeError(`O andar ${andar} não existe neste prédio.`);
      if (!TIPOS.includes(tipo)) throw new TypeError(`Tipo de descarte inválido: ${tipo}`);
      estado.andares[numero][tipo] += 1;
      const evento = {
        id: novoId(),
        tipo: 'descarte',
        andar: numero,
        descarte: tipo,
        pontos: config.pontosPorDescarte[tipo],
        origem: 'simulacao',
        em: new Date().toISOString(),
      };
      estado.historico.unshift(evento);
      estado.historico.length = Math.min(estado.historico.length, LIMITE_HISTORICO);
      return mudar(evento);
    },
    async restaurar() {
      estado.andares = contagensDoExemplo();
      estado.historico = [];
      return mudar({ id: novoId(), tipo: 'restaurado', em: new Date().toISOString() });
    },
    aoMudar(callback) {
      ouvintes.add(callback);
      return () => ouvintes.delete(callback);
    },
  };
}

/**
 * Avisa sempre que o placar mudar, nesta aba ou em outra do mesmo navegador.
 * Devolve uma função para parar de ouvir.
 */
export function aoMudar(callback) {
  ouvintesPlacar.add(callback);
  iniciar().catch(() => {});
  return () => ouvintesPlacar.delete(callback);
}

/* ------------------------------------------------------------------ */
/* API pública: andar do morador (preferência deste aparelho)          */
/* ------------------------------------------------------------------ */

export async function obterMeuAndar() {
  await iniciar();
  const guardado = ler(chaveMeuAndar());
  const numero = Number(guardado);
  return guardado !== null && existeAndar(numero) ? numero : null;
}

export async function definirMeuAndar(andar) {
  await iniciar();
  const numero = Number(andar);
  if (!existeAndar(numero)) throw new RangeError(`O andar ${andar} não existe neste prédio.`);
  gravar(chaveMeuAndar(), numero);
  return numero;
}

/* ------------------------------------------------------------------ */
/* API pública: contador pessoal (só neste aparelho, sem conta)        */
/* ------------------------------------------------------------------ */

function chaveMes(data = new Date()) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

function lerPessoal() {
  const p = ler(CHAVE_PESSOAL);
  return {
    nome: typeof p?.nome === 'string' ? p.nome : '',
    meses: p?.meses && typeof p.meses === 'object' ? p.meses : {},
    historico: Array.isArray(p?.historico) ? p.historico : [],
  };
}

function resumirPessoal(p) {
  const pp = config.pontosPorDescarte;
  const resumo = (c = {}) => {
    const reciclavel = Number(c.reciclavel) || 0;
    const organico = Number(c.organico) || 0;
    return {
      reciclavel,
      organico,
      descartes: reciclavel + organico,
      pontos: reciclavel * pp.reciclavel + organico * pp.organico,
    };
  };
  const total = Object.values(p.meses).reduce(
    (t, c) => ({
      reciclavel: t.reciclavel + (Number(c.reciclavel) || 0),
      organico: t.organico + (Number(c.organico) || 0),
    }),
    { reciclavel: 0, organico: 0 },
  );
  return {
    nome: p.nome,
    mes: { chave: chaveMes(), ...resumo(p.meses[chaveMes()]) },
    total: resumo(total),
    historico: structuredClone(p.historico),
  };
}

function avisarPessoal() {
  if (!config || !ouvintesPessoal.size) return;
  avisar(ouvintesPessoal, resumirPessoal(lerPessoal()));
}

function gravarPessoal(p) {
  gravar(CHAVE_PESSOAL, p);
  canal?.postMessage({ tipo: 'pessoal' });
  const resumo = resumirPessoal(p);
  avisar(ouvintesPessoal, resumo);
  return resumo;
}

/** Nome opcional e pontos deste aparelho: { nome, mes, total, historico }. */
export async function obterPessoal() {
  await iniciar();
  return resumirPessoal(lerPessoal());
}

/**
 * Registra um descarte no nome do morador, só neste aparelho.
 * Não soma pontos ao andar: quem conta para o andar é o sensor da lixeira.
 */
export async function registrarDescartePessoal(tipo, andar) {
  await iniciar();
  if (!TIPOS.includes(tipo)) throw new TypeError(`Tipo de descarte inválido: ${tipo}`);
  const p = lerPessoal();
  const mes = chaveMes();
  const atual = p.meses[mes] ?? { reciclavel: 0, organico: 0 };
  atual[tipo] = (Number(atual[tipo]) || 0) + 1;
  p.meses[mes] = atual;
  const numero = Number(andar);
  p.historico.unshift({
    id: novoId(),
    descarte: tipo,
    andar: existeAndar(numero) ? numero : null,
    pontos: config.pontosPorDescarte[tipo],
    em: new Date().toISOString(),
  });
  p.historico.length = Math.min(p.historico.length, LIMITE_HISTORICO_PESSOAL);
  return gravarPessoal(p);
}

export async function definirNomePessoal(nome) {
  await iniciar();
  const p = lerPessoal();
  p.nome = String(nome ?? '').trim().slice(0, 40);
  return gravarPessoal(p);
}

/** Apaga os pontos pessoais deste aparelho (mantém o nome). */
export async function zerarPessoal() {
  await iniciar();
  const p = lerPessoal();
  return gravarPessoal({ nome: p.nome, meses: {}, historico: [] });
}

export function aoMudarPessoal(callback) {
  ouvintesPessoal.add(callback);
  iniciar().catch(() => {});
  return () => ouvintesPessoal.delete(callback);
}
