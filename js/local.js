/**
 * Recicla Slide: o "servidor" deste navegador.
 *
 * Com o js/config.js vazio, o prédio cadastrado no painel do síndico vive aqui, no
 * localStorage, com as mesmas funções e as mesmas regras do supabase/schema.sql:
 *  - trava de 2 s entre toques do mesmo aparelho;
 *  - PIN guardado só como hash;
 *  - 10 tentativas de PIN em 10 minutos;
 *  - o andar com menos gente no palco.
 * As abas deste navegador se avisam pelo evento "storage", como o Realtime faz entre
 * aparelhos. Só este navegador vê esses prédios. Para vários celulares, o placar
 * precisa estar online (PENDENCIAS.md, item 8).
 *
 * conectarLocal() devolve as mesmas operações do js/remoto.js, e o js/dados.js usa
 * as duas do mesmo jeito.
 */

const PREFIXO = 'recicla-slide:local';
const CHAVE_LISTA = `${PREFIXO}:predios:v1`;
const chaveDoPredio = (codigo) => `${PREFIXO}:predio:${codigo}:v1`;
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0, O, 1 e I, que confundem
const LIMITE_DESCARTES = 20000;
const DEZ_MINUTOS = 10 * 60 * 1000;
const ITENS_MANUTENCAO = ['limpeza', 'inspecao', 'pilhas'];

export class ErroLocal extends Error {
  constructor(codigo, mensagem) {
    super(mensagem || codigo);
    this.name = 'ErroLocal';
    this.codigo = codigo;
  }
}

/* ------------------------------------------------------------------ */
/* Armazenamento                                                       */
/* ------------------------------------------------------------------ */

const memoria = new Map();

function ler(chave) {
  try {
    const bruto = localStorage.getItem(chave);
    if (bruto !== null) return JSON.parse(bruto);
  } catch {
    /* sem localStorage: usa a memória */
  }
  return memoria.has(chave) ? structuredClone(memoria.get(chave)) : null;
}

function gravar(chave, valor) {
  memoria.set(chave, structuredClone(valor));
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem localStorage: fica só na memória desta aba */
  }
}

const normalizarCodigo = (codigo) => String(codigo ?? '').trim().toUpperCase();
const codigoDoId = (predioId) => String(predioId ?? '').replace(/^local-/, '');

/** Códigos dos prédios cadastrados neste navegador. */
export function prediosLocais() {
  const lista = ler(CHAVE_LISTA);
  return Array.isArray(lista) ? lista : [];
}

export function existePredioLocal(codigo) {
  return prediosLocais().includes(normalizarCodigo(codigo));
}

/** O prédio de exemplo do painel do síndico, se já foi criado neste navegador. */
export function codigoDoExemploLocal() {
  return prediosLocais().find((codigo) => lerBanco(codigo)?.predio?.exemplo) ?? null;
}

function lerBanco(codigo) {
  const banco = ler(chaveDoPredio(normalizarCodigo(codigo)));
  return banco?.predio ? banco : null;
}

function gravarBanco(banco) {
  if (banco.descartes.length > LIMITE_DESCARTES) banco.descartes = banco.descartes.slice(-LIMITE_DESCARTES);
  gravar(chaveDoPredio(banco.predio.codigo), banco);
}

/** Um de cada vez, também entre abas (Web Locks, quando existir). */
function comTrava(fn) {
  if (navigator.locks?.request) return navigator.locks.request(`${PREFIXO}:escrita`, fn);
  return Promise.resolve().then(fn);
}

/* ------------------------------------------------------------------ */
/* PIN (só o hash fica guardado)                                       */
/* ------------------------------------------------------------------ */

function aleatorio(bytes) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashDoPin(pin, sal) {
  const bytes = new TextEncoder().encode(`${sal}:${pin}`);
  if (globalThis.crypto?.subtle) {
    const resumo = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(resumo), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // fora de https não há crypto.subtle: um hash simples basta para um prédio que só existe aqui
  let h = 2166136261;
  for (const b of bytes) h = Math.imul(h ^ b, 16777619) >>> 0;
  return h.toString(16);
}

async function conferirPin(banco, pin) {
  const limite = Date.now() - DEZ_MINUTOS;
  banco.tentativas = banco.tentativas.filter((t) => Date.parse(t) > limite);
  if (banco.tentativas.length >= 10) return 'muitas_tentativas';
  const certo = /^[0-9]{4,6}$/.test(String(pin ?? '')) && (await hashDoPin(pin, banco.predio.pin_sal)) === banco.predio.pin_hash;
  if (!certo) {
    banco.tentativas.push(new Date().toISOString());
    gravarBanco(banco);
    return 'pin_errado';
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* "Realtime" entre as abas deste navegador                            */
/* ------------------------------------------------------------------ */

const assinantes = new Set();
const entregues = new Map(); // último aviso entregue, por prédio
let escutando = false;

function entregar(mensagem) {
  for (const { predioId, retornos } of assinantes) {
    if (mensagem?.predio_id !== predioId) continue;
    if (mensagem.tipo === 'descarte') retornos.aoDescarte?.(mensagem.linha);
    if (mensagem.tipo === 'participante') retornos.aoParticipante?.(mensagem.linha);
    if (mensagem.tipo === 'evento') retornos.aoEvento?.(mensagem.linha);
  }
}

/**
 * As outras abas ficam sabendo pelo evento "storage", que só dispara quando a gravação
 * já está visível nelas. (Um BroadcastChannel pode chegar antes, e a aba releria o
 * prédio sem a mudança.) O aviso vai junto, no campo "ultima" do próprio prédio.
 */
function escutarOutrasAbas() {
  if (escutando) return;
  escutando = true;
  addEventListener('storage', (e) => {
    if (!e.key?.startsWith(`${PREFIXO}:predio:`) || !e.newValue) return;
    let banco;
    try {
      banco = JSON.parse(e.newValue);
    } catch {
      return;
    }
    const ultima = banco?.ultima;
    if (!ultima || !banco.predio) return;
    memoria.set(e.key, banco);
    if ((entregues.get(banco.predio.codigo) ?? 0) >= ultima.n) return;
    entregues.set(banco.predio.codigo, ultima.n);
    entregar(ultima);
  });
}

/** Grava o prédio com o aviso e avisa esta aba (as outras recebem pelo "storage"). */
function emitir(banco, mensagem) {
  const n = (banco.ultima?.n ?? 0) + 1;
  banco.ultima = { ...mensagem, n };
  entregues.set(banco.predio.codigo, n);
  gravarBanco(banco);
  queueMicrotask(() => entregar(mensagem));
}

function evento(banco, tipo) {
  emitir(banco, { tipo: 'evento', predio_id: banco.predio.id, linha: { tipo, criado_em: new Date().toISOString() } });
}

/* ------------------------------------------------------------------ */
/* Funções (as mesmas do schema.sql)                                   */
/* ------------------------------------------------------------------ */

function inicioDoMes(data = new Date()) {
  return new Date(data.getFullYear(), data.getMonth(), 1).toISOString();
}

function doMes(banco) {
  const inicio = Date.parse(banco.predio.mes_inicio);
  return banco.descartes.filter((d) => Date.parse(d.criado_em) >= inicio);
}

function bancoOuErro(codigo) {
  const banco = lerBanco(codigo);
  if (!banco) throw new ErroLocal('predio_nao_encontrado', 'Este prédio não existe neste navegador.');
  return banco;
}

function validarAparelho(aparelho, obrigatorio) {
  if (aparelho == null && !obrigatorio) return;
  const texto = String(aparelho ?? '');
  if (texto.length < 8 || texto.length > 64) throw new ErroLocal('aparelho_invalido');
}

/** Funções do síndico: conferem o PIN e devolvem { ok, ... } ou { ok: false, erro }. */
function doSindico(fn) {
  return async (argumentos) => {
    const banco = bancoOuErro(argumentos.p_codigo);
    const erro = await conferirPin(banco, argumentos.p_pin);
    if (erro) return { ok: false, erro };
    return fn(banco, argumentos);
  };
}

const funcoes = {
  async criar_predio({ p_nome, p_andares, p_aptos_por_andar, p_pin }) {
    const nome = String(p_nome ?? '').trim();
    if (nome.length < 2 || nome.length > 60) throw new ErroLocal('nome_invalido');
    const andares = Number(p_andares);
    if (!Number.isInteger(andares) || andares < 2 || andares > 60) throw new ErroLocal('andares_invalido');
    const aptos = Number(p_aptos_por_andar);
    if (!Number.isInteger(aptos) || aptos < 1 || aptos > 20) throw new ErroLocal('aptos_invalido');
    if (!/^[0-9]{4,6}$/.test(String(p_pin ?? ''))) throw new ErroLocal('pin_invalido');
    let codigo;
    do {
      codigo = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => LETRAS[b % 32]).join('');
    } while (existePredioLocal(codigo));
    const agora = new Date().toISOString();
    const sal = aleatorio(12);
    gravarBanco({
      seq: 1,
      predio: {
        id: `local-${codigo}`,
        codigo,
        nome,
        andares,
        aptos_por_andar: aptos,
        premio_titulo: null,
        premio_patrocinador: null,
        premio_exemplo: true,
        mes_inicio: inicioDoMes(),
        criado_em: agora,
        atualizado_em: agora,
        limpeza_em: agora,
        inspecao_em: agora,
        pilhas_em: agora,
        pin_sal: sal,
        pin_hash: await hashDoPin(p_pin, sal),
      },
      descartes: [],
      participantes: [],
      alertas: [],
      campeoes: [],
      tentativas: [],
    });
    gravar(CHAVE_LISTA, [...prediosLocais(), codigo]);
    return codigo;
  },

  async entrar({ p_codigo, p_aparelho }) {
    const banco = bancoOuErro(p_codigo);
    validarAparelho(p_aparelho, true);
    const ja = banco.participantes.find((p) => p.aparelho === p_aparelho);
    if (ja) return ja.andar;
    const contagem = Array.from({ length: banco.predio.andares }, (_, i) => ({
      andar: i + 1,
      n: banco.participantes.filter((p) => p.andar === i + 1).length,
      sorte: Math.random(),
    }));
    contagem.sort((a, b) => a.n - b.n || a.sorte - b.sorte);
    const linha = { predio_id: banco.predio.id, aparelho: p_aparelho, andar: contagem[0].andar, criado_em: new Date().toISOString() };
    banco.participantes.push(linha);
    emitir(banco, { tipo: 'participante', predio_id: banco.predio.id, linha });
    return linha.andar;
  },

  async registrar_descarte({ p_codigo, p_andar, p_tipo, p_origem, p_aparelho }) {
    const banco = bancoOuErro(p_codigo);
    const andar = Number(p_andar);
    if (!Number.isInteger(andar) || andar < 1 || andar > banco.predio.andares) throw new ErroLocal('andar_invalido');
    if (!['reciclavel', 'organico'].includes(p_tipo)) throw new ErroLocal('tipo_invalido');
    if (!['sensor', 'app', 'demo'].includes(p_origem)) throw new ErroLocal('origem_invalida');
    validarAparelho(p_aparelho, p_origem === 'app');
    if (p_origem === 'app') {
      const limite = Date.now() - 2000;
      const recente = banco.descartes.some((d) => d.aparelho === p_aparelho && d.origem === 'app' && Date.parse(d.criado_em) > limite);
      if (recente) throw new ErroLocal('devagar', 'Espere 2 segundos entre um toque e outro.');
    }
    const linha = {
      id: banco.seq++,
      predio_id: banco.predio.id,
      andar,
      tipo: p_tipo,
      origem: p_origem,
      aparelho: p_aparelho ?? null,
      criado_em: new Date().toISOString(),
    };
    banco.descartes.push(linha);
    emitir(banco, { tipo: 'descarte', predio_id: banco.predio.id, linha });
    return linha;
  },

  verificar_pin: doSindico((banco) => ({ ok: true, codigo: banco.predio.codigo, nome: banco.predio.nome })),

  definir_premio: doSindico((banco, { p_titulo, p_patrocinador, p_exemplo }) => {
    const limpar = (texto, max) => String(texto ?? '').trim().slice(0, max) || null;
    Object.assign(banco.predio, {
      premio_titulo: limpar(p_titulo, 80),
      premio_patrocinador: limpar(p_patrocinador, 60),
      premio_exemplo: p_exemplo !== false,
      atualizado_em: new Date().toISOString(),
    });
    evento(banco, 'premio');
    return { ok: true };
  }),

  desfazer_ultimo: doSindico((banco) => {
    const ultimo = doMes(banco).sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em) || b.id - a.id)[0];
    if (!ultimo) return { ok: true, nada: true };
    banco.descartes = banco.descartes.filter((d) => d.id !== ultimo.id);
    evento(banco, 'desfeito');
    return { ok: true, andar: ultimo.andar, tipo: ultimo.tipo };
  }),

  fechar_mes: doSindico((banco) => {
    const contagem = new Map();
    for (const d of doMes(banco)) {
      const c = contagem.get(d.andar) ?? { andar: d.andar, reciclavel: 0, organico: 0 };
      c[d.tipo] += 1;
      contagem.set(d.andar, c);
    }
    const campeao = [...contagem.values()].sort((a, b) => b.reciclavel + b.organico - (a.reciclavel + a.organico) || a.andar - b.andar)[0];
    const agora = new Date().toISOString();
    banco.campeoes.push({
      id: banco.seq++,
      mes_inicio: banco.predio.mes_inicio,
      mes_fim: agora,
      andar: campeao?.andar ?? null,
      reciclavel: campeao?.reciclavel ?? 0,
      organico: campeao?.organico ?? 0,
      pontos: campeao ? (campeao.reciclavel + campeao.organico) * 10 : 0,
    });
    banco.predio.mes_inicio = agora;
    banco.predio.atualizado_em = agora;
    evento(banco, 'mes_fechado');
    return { ok: true, andar: campeao?.andar ?? null, pontos: campeao ? (campeao.reciclavel + campeao.organico) * 10 : 0 };
  }),

  simular_entupimento: doSindico((banco, { p_andar, p_tipo }) => {
    const andar = Number(p_andar);
    if (!Number.isInteger(andar) || andar < 1 || andar > banco.predio.andares) throw new ErroLocal('andar_invalido');
    if (!['reciclavel', 'organico'].includes(p_tipo)) throw new ErroLocal('tipo_invalido');
    const alerta = { id: banco.seq++, andar, tipo: p_tipo, criado_em: new Date().toISOString(), resolvido_em: null };
    banco.alertas.push(alerta);
    evento(banco, 'alerta');
    return { ok: true, id: alerta.id };
  }),

  resolver_alerta: doSindico((banco, { p_id }) => {
    const alerta = banco.alertas.find((a) => a.id === Number(p_id) && !a.resolvido_em);
    if (alerta) {
      alerta.resolvido_em = new Date().toISOString();
      evento(banco, 'alerta');
    }
    return { ok: true };
  }),

  registrar_manutencao: doSindico((banco, { p_item }) => {
    if (!ITENS_MANUTENCAO.includes(p_item)) return { ok: false, erro: 'item_invalido' };
    const agora = new Date().toISOString();
    banco.predio[`${p_item}_em`] = agora;
    banco.predio.atualizado_em = agora;
    evento(banco, 'manutencao');
    return { ok: true, em: agora };
  }),
};

/* ------------------------------------------------------------------ */
/* Leituras (as mesmas views do schema.sql)                            */
/* ------------------------------------------------------------------ */

function publico(banco) {
  const { pin_hash: _hash, pin_sal: _sal, ...resto } = banco.predio;
  return { ...resto, participantes: banco.participantes.length };
}

function diaLocal(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** As mesmas operações do js/remoto.js, guardadas neste navegador. */
export function conectarLocal() {
  escutarOutrasAbas();
  return {
    local: true,

    async buscarPredio(codigo) {
      const banco = lerBanco(codigo);
      return banco ? publico(banco) : null;
    },

    async buscarPlacar(codigo) {
      const banco = bancoOuErro(codigo);
      const linhas = new Map();
      for (const d of doMes(banco)) {
        const linha = linhas.get(d.andar) ?? { andar: d.andar, reciclavel: 0, organico: 0, ultimo_em: null };
        linha[d.tipo] += 1;
        if (!linha.ultimo_em || d.criado_em > linha.ultimo_em) linha.ultimo_em = d.criado_em;
        linhas.set(d.andar, linha);
      }
      return [...linhas.values()];
    },

    async buscarHistorico(predioId, desde, limite = 30) {
      const banco = bancoOuErro(codigoDoId(predioId));
      const inicio = Date.parse(desde);
      return banco.descartes
        .filter((d) => Date.parse(d.criado_em) >= inicio)
        .sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em) || b.id - a.id)
        .slice(0, limite)
        .map(({ id, andar, tipo, origem, criado_em }) => ({ id, andar, tipo, origem, criado_em }));
    },

    /** Descartes do mês por dia: [{ dia: 'AAAA-MM-DD', reciclavel, organico }]. */
    async buscarResumo(codigo) {
      const banco = bancoOuErro(codigo);
      const dias = new Map();
      for (const d of doMes(banco)) {
        const dia = diaLocal(d.criado_em);
        const linha = dias.get(dia) ?? { dia, reciclavel: 0, organico: 0 };
        linha[d.tipo] += 1;
        dias.set(dia, linha);
      }
      return [...dias.values()].sort((a, b) => a.dia.localeCompare(b.dia));
    },

    /** Alertas em aberto (entupimento), o mais novo primeiro. */
    async buscarAlertas(predioId) {
      const banco = bancoOuErro(codigoDoId(predioId));
      return banco.alertas.filter((a) => !a.resolvido_em).sort((a, b) => b.id - a.id);
    },

    /** Campeões dos meses fechados, o mais recente primeiro. */
    async buscarCampeoes(predioId) {
      const banco = bancoOuErro(codigoDoId(predioId));
      return [...banco.campeoes].sort((a, b) => b.id - a.id).slice(0, 12);
    },

    async rpc(nome, argumentos = {}) {
      const funcao = funcoes[nome];
      if (!funcao) throw new ErroLocal('funcao_desconhecida', `Função ${nome} não existe.`);
      return comTrava(() => funcao(argumentos));
    },

    assinar(predioId, retornos) {
      const assinante = { predioId, retornos };
      assinantes.add(assinante);
      setTimeout(() => retornos.aoEstado?.('ao-vivo'), 0);
      return () => assinantes.delete(assinante);
    },
  };
}

/**
 * Preenche um prédio deste navegador com descartes de exemplo, espalhados do começo
 * do mês até agora (prédio de exemplo do painel do síndico). Sorteio fixo: os mesmos
 * dados a cada vez.
 */
export async function semearPredio(codigo, { andares, premio }) {
  return comTrava(() => {
    const banco = bancoOuErro(codigo);
    let semente = 7;
    const sorte = () => {
      semente = (semente + 0x6d2b79f5) | 0;
      let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const inicio = Date.parse(banco.predio.mes_inicio);
    const fim = Date.now() - 60_000;
    const linhas = [];
    for (const { numero, reciclavel, organico } of andares) {
      for (const [tipo, quantos] of [['reciclavel', reciclavel], ['organico', organico]]) {
        for (let i = 0; i < quantos; i += 1) {
          linhas.push({ andar: numero, tipo, quando: inicio + sorte() * Math.max(0, fim - inicio) });
        }
      }
    }
    linhas.sort((a, b) => a.quando - b.quando);
    for (const l of linhas) {
      banco.descartes.push({
        id: banco.seq++,
        predio_id: banco.predio.id,
        andar: l.andar,
        tipo: l.tipo,
        origem: 'demo',
        aparelho: null,
        criado_em: new Date(l.quando).toISOString(),
      });
    }
    if (premio) {
      Object.assign(banco.predio, {
        premio_titulo: premio.titulo || null,
        premio_patrocinador: premio.patrocinador || null,
        premio_exemplo: true,
      });
    }
    banco.predio.exemplo = true;
    gravarBanco(banco);
    return linhas.length;
  });
}
