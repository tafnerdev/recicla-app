/**
 * Recicla Slide: conversa com o placar online (Supabase). Só js/dados.js usa
 * este arquivo, e só quando js/config.js está preenchido e a tela abriu um
 * prédio (?predio=CODIGO).
 *
 * Tudo o que sai daqui é simples: objetos com os nomes das colunas do banco
 * (supabase/schema.sql). Erros viram ErroRemoto com um código curto:
 *   'rede'      sem conexão ou servidor fora do ar (o toque vai para a fila)
 *   'devagar'   toque antes de 2 s do anterior (trava do servidor)
 *   outros      o código que a função do banco levantou (predio_nao_encontrado...)
 *
 * Para os testes automáticos, uma implementação falsa pode ser injetada em
 * globalThis.__reciclaRemotoFalso (mesmas funções). Nada no site define isso.
 */

export class ErroRemoto extends Error {
  constructor(codigo, mensagem) {
    super(mensagem || codigo);
    this.name = 'ErroRemoto';
    this.codigo = codigo;
  }
}

const CODIGOS_CONHECIDOS = [
  'devagar',
  'predio_nao_encontrado',
  'andar_invalido',
  'tipo_invalido',
  'origem_invalida',
  'aparelho_invalido',
  'nome_invalido',
  'andares_invalido',
  'aptos_invalido',
  'pin_invalido',
];

function traduzirErro(erro) {
  if (!erro) return null;
  const texto = `${erro.message ?? ''} ${erro.details ?? ''} ${erro.hint ?? ''}`;
  const conhecido = CODIGOS_CONHECIDOS.find((c) => texto.includes(c));
  if (conhecido) return new ErroRemoto(conhecido, erro.hint || erro.message);
  // fetch que nem chegou ao servidor
  if (/Failed to fetch|NetworkError|Load failed|fetch failed|network/i.test(texto) || erro.code === '' || erro.status === 0) {
    return new ErroRemoto('rede', 'Sem conexão com o placar online.');
  }
  return new ErroRemoto(erro.code || 'servidor', erro.message);
}

/**
 * Conecta e devolve as operações. Lança ErroRemoto('rede') se não der para
 * carregar a biblioteca (primeira visita sem internet).
 */
export async function conectar({ url, chave }) {
  if (globalThis.__reciclaRemotoFalso) return globalThis.__reciclaRemotoFalso({ url, chave });

  let supabase;
  try {
    ({ createClient: supabase } = await import('./vendor/supabase.esm.js'));
  } catch {
    throw new ErroRemoto('rede', 'Não deu para carregar a conexão com o placar online.');
  }
  const cliente = supabase(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });

  const resultado = async (promessa) => {
    let resposta;
    try {
      resposta = await promessa;
    } catch (erro) {
      throw traduzirErro(erro) ?? new ErroRemoto('rede');
    }
    if (resposta.error) throw traduzirErro(resposta.error);
    return resposta.data;
  };

  return {
    /** Prédio pelo código (view sem o hash do PIN), ou null. */
    buscarPredio: (codigo) => resultado(cliente.from('predios_publicos').select('*').eq('codigo', codigo).maybeSingle()),

    /** Contagens do mês por andar: [{ andar, reciclavel, organico }]. */
    buscarPlacar: (codigo) => resultado(cliente.from('placar_publico').select('andar, reciclavel, organico').eq('codigo', codigo)),

    /** Descartes mais recentes do mês (para "último descarte" e o histórico). */
    buscarHistorico: (predioId, desde, limite = 30) =>
      resultado(
        cliente
          .from('descartes')
          .select('id, andar, tipo, origem, criado_em')
          .eq('predio_id', predioId)
          .gte('criado_em', desde)
          .order('criado_em', { ascending: false })
          .limit(limite),
      ),

    /** Chama uma função do banco (criar_predio, entrar, registrar_descarte...). */
    rpc: (nome, argumentos) => resultado(cliente.rpc(nome, argumentos)),

    /**
     * Ouve o prédio ao vivo. retornos: { aoDescarte(linha), aoParticipante(linha),
     * aoEvento(linha), aoEstado('ao-vivo' | 'caiu') }. Devolve uma função para parar.
     */
    assinar(predioId, retornos) {
      const filtro = `predio_id=eq.${predioId}`;
      const canal = cliente
        .channel(`predio-${predioId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'descartes', filter: filtro }, ({ new: linha }) =>
          retornos.aoDescarte?.(linha),
        )
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'participantes', filter: filtro }, ({ new: linha }) =>
          retornos.aoParticipante?.(linha),
        )
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'eventos_predio', filter: filtro }, ({ new: linha }) =>
          retornos.aoEvento?.(linha),
        )
        .subscribe((situacao) => {
          if (situacao === 'SUBSCRIBED') retornos.aoEstado?.('ao-vivo');
          else if (situacao === 'CHANNEL_ERROR' || situacao === 'TIMED_OUT' || situacao === 'CLOSED') retornos.aoEstado?.('caiu');
        });
      return () => cliente.removeChannel(canal);
    },
  };
}
