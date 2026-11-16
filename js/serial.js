/**
 * Recicla Slide: leitura do sensor pela porta serial (Web Serial API).
 *
 * Protocolo: uma linha de texto por descarte, terminada em \n.
 *   R,7   → descarte reciclável no 7º andar
 *   O,7   → descarte orgânico no 7º andar
 * Linhas vazias e linhas que começam com # (comentários do ESP32) são ignoradas.
 * Aceita minúsculas e espaços ("r, 7"). Velocidade padrão: 115200 baud.
 *
 * Funciona no Chrome e no Edge do computador, em https ou localhost.
 * Veja docs/sensor-serial.md e docs/esp32/recicla_sensor.ino.
 */

const TIPO_POR_LETRA = Object.freeze({ R: 'reciclavel', O: 'organico' });
const LIMITE_LINHA = 200;

export const BAUD_PADRAO = 115200;

/**
 * Interpreta uma linha recebida do sensor.
 * Devolve { ok: true, tipo, andar }, { ok: false, ignorada: true } ou { ok: false, erro }.
 */
export function interpretarLinha(linha, andaresValidos = null) {
  const texto = String(linha ?? '').trim();
  if (!texto || texto.startsWith('#')) return { ok: false, ignorada: true };
  const partes = /^([A-Za-z])\s*[,;]\s*(-?\d{1,3})$/.exec(texto);
  if (!partes) return { ok: false, erro: `Linha fora do formato "R,7" ou "O,7": ${texto.slice(0, 40)}` };
  const tipo = TIPO_POR_LETRA[partes[1].toUpperCase()];
  if (!tipo) return { ok: false, erro: `Tipo desconhecido "${partes[1]}". Use R (reciclável) ou O (orgânico).` };
  const andar = Number(partes[2]);
  if (andaresValidos && !andaresValidos.includes(andar)) {
    return { ok: false, erro: `O andar ${andar} não existe neste prédio.` };
  }
  return { ok: true, tipo, andar };
}

export function serialDisponivel() {
  return 'serial' in navigator && window.isSecureContext;
}

/**
 * Lê linhas de uma porta serial e entrega cada uma a aoLinha(texto).
 * aoEstado(estado, detalhe) recebe: 'desconectado' | 'conectando' | 'conectado' | 'erro'.
 */
export class LeitorSerial {
  constructor({ aoLinha, aoEstado, baud = BAUD_PADRAO } = {}) {
    this.aoLinha = aoLinha ?? (() => {});
    this.aoEstado = aoEstado ?? (() => {});
    this.baud = baud;
    this.porta = null;
    this.leitor = null;
    this.lendo = null;
    this.parar = false;
    this.estado = 'desconectado';
    this.aoDesconectarPorta = (e) => {
      if (e.target === this.porta) this.#mudarEstado('desconectado', 'O cabo do sensor foi desconectado.');
    };
  }

  #mudarEstado(estado, detalhe = '') {
    this.estado = estado;
    this.aoEstado(estado, detalhe);
  }

  /** Abre a janela do navegador para escolher a porta (precisa de um clique do usuário). */
  async conectar() {
    if (!serialDisponivel()) throw new Error('Este navegador não lê a porta serial. Use Chrome ou Edge no computador.');
    const porta = await navigator.serial.requestPort();
    await this.#abrir(porta);
  }

  /** Reabre, sem perguntar, uma porta já autorizada antes neste navegador. */
  async reconectar() {
    if (!serialDisponivel()) return false;
    const [porta] = await navigator.serial.getPorts();
    if (!porta) return false;
    await this.#abrir(porta);
    return true;
  }

  async #abrir(porta) {
    await this.desconectar();
    this.#mudarEstado('conectando');
    try {
      await porta.open({ baudRate: this.baud });
    } catch (erro) {
      this.#mudarEstado('erro', `Não abriu a porta: ${erro.message}`);
      throw erro;
    }
    this.porta = porta;
    this.parar = false;
    navigator.serial.addEventListener('disconnect', this.aoDesconectarPorta);
    this.#mudarEstado('conectado');
    this.lendo = this.#ler();
  }

  async #ler() {
    const decodificador = new TextDecoderStream();
    const fechado = this.porta.readable.pipeTo(decodificador.writable).catch(() => {});
    this.leitor = decodificador.readable.getReader();
    let resto = '';
    try {
      while (!this.parar) {
        const { value, done } = await this.leitor.read();
        if (done) break;
        resto += value;
        const linhas = resto.split(/\r?\n/);
        resto = linhas.pop() ?? '';
        if (resto.length > LIMITE_LINHA) resto = ''; // lixo sem quebra de linha
        for (const linha of linhas) this.aoLinha(linha);
      }
    } catch (erro) {
      if (!this.parar) this.#mudarEstado('erro', `Leitura interrompida: ${erro.message}`);
    } finally {
      this.leitor?.releaseLock();
      this.leitor = null;
      await fechado;
    }
  }

  async desconectar() {
    this.parar = true;
    navigator.serial?.removeEventListener('disconnect', this.aoDesconectarPorta);
    try {
      await this.leitor?.cancel();
    } catch {
      /* já fechado */
    }
    await this.lendo; // espera o laço de leitura soltar a porta
    this.lendo = null;
    try {
      await this.porta?.close();
    } catch {
      /* já fechado */
    }
    const tinhaPorta = Boolean(this.porta);
    this.porta = null;
    if (tinhaPorta) this.#mudarEstado('desconectado');
  }
}
