/**
 * Recicla Slide: módulo de dados.
 *
 * Toda leitura e escrita das telas passa por este arquivo. Por enquanto o
 * placar vive no localStorage deste navegador, e as abas abertas se avisam
 * pelo BroadcastChannel. Para usar um banco online depois, reescreva só este
 * módulo mantendo as mesmas funções exportadas e o formato do que elas
 * devolvem. Todas já são assíncronas, como seriam com um servidor.
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

const URL_DADOS = new URL('../data/edificio-exemplo.json', import.meta.url);

const PREFIXO = 'recicla-slide';
const CHAVE_PLACAR = `${PREFIXO}:placar:v1`;
const CHAVE_PESSOAL = `${PREFIXO}:pessoal:v1`;
const CHAVE_MEU_ANDAR = `${PREFIXO}:meu-andar:v1`;
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
/* API pública: prédio e placar                                        */
/* ------------------------------------------------------------------ */

/** Nome do prédio, prêmio do mês, pontos por descarte e lista de andares. */
export async function obterEdificio() {
  await iniciar();
  return {
    id: config.edificio.id,
    nome: config.edificio.nome,
    premio: { ...config.premio },
    pontosPorDescarte: { ...config.pontosPorDescarte },
    andares: config.andares.map((a) => a.numero),
  };
}

export async function obterPlacar() {
  await iniciar();
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

/** Desfaz o descarte mais recente do histórico. Devolve null se não houver. */
export async function desfazerUltimo() {
  await iniciar();
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

/** Zera todos os andares. */
export async function zerarPlacar() {
  return alterar((estado) => {
    estado.andares = contagensZeradas();
    estado.historico = [];
    return { id: novoId(), tipo: 'zerado', em: new Date().toISOString() };
  });
}

/** Volta às contagens do JSON de exemplo. */
export async function restaurarExemplo() {
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
  const numero = Number(ler(CHAVE_MEU_ANDAR));
  return ler(CHAVE_MEU_ANDAR) !== null && existeAndar(numero) ? numero : null;
}

export async function definirMeuAndar(andar) {
  await iniciar();
  const numero = Number(andar);
  if (!existeAndar(numero)) throw new RangeError(`O andar ${andar} não existe neste prédio.`);
  gravar(CHAVE_MEU_ANDAR, numero);
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
