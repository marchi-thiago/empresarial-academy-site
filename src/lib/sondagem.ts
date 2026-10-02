/**
 * Sondagem segura para telas que consultam o servidor de tempos em tempos (painel do EA Assessor).
 *
 * Regras (auditoria de 01/10/2026: cerca de 2.100 chamadas em 23 min mantinham o Neon acordado o dia todo):
 *  - intervalo mínimo de 60 s, mesmo que quem chama peça menos;
 *  - para de vez ao receber 401 ou 403 (a chamada devolve "parar"): insistir sem login só gasta cota;
 *  - pausa com a aba oculta (`document.visibilityState`) e volta ao reaparecer, sem esperar o intervalo inteiro
 *    (mas sem repetir a busca se a última é mais nova que o intervalo);
 *  - pausa depois de 15 min sem mouse, teclado ou toque (aba visível e esquecida também gasta);
 *  - uma busca por vez: se a anterior ainda não voltou, a seguinte espera.
 * Sem React aqui: o hook `useSondagem` só liga isto à tela, e o controlador se testa com relógio falso.
 */

export const INTERVALO_MINIMO_MS = 60_000;
export const INATIVIDADE_PADRAO_MS = 15 * 60_000;

export type ResultadoDaBusca = "parar" | void;

export interface OpcoesDaSondagem {
  buscar: () => Promise<ResultadoDaBusca>;
  intervaloMs: number;
  inatividadeMs?: number;
  /** `document.visibilityState === "visible"` na tela; injetável para teste. */
  visivel: () => boolean;
  agora?: () => number;
}

export function criarSondagem(o: OpcoesDaSondagem) {
  const intervalo = Math.max(o.intervaloMs, INTERVALO_MINIMO_MS);
  const inatividade = o.inatividadeMs ?? INATIVIDADE_PADRAO_MS;
  const agora = o.agora ?? Date.now;
  let timer: ReturnType<typeof setInterval> | null = null;
  let parado = false;
  let buscando = false;
  let ultimaBusca = -Infinity;
  let ultimoUso = agora();

  const pausar = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const parar = () => {
    parado = true;
    pausar();
  };

  async function buscar(): Promise<void> {
    if (parado || buscando) return;
    buscando = true;
    ultimaBusca = agora();
    try {
      if ((await o.buscar()) === "parar") parar();
    } catch {
      // Falha de rede não é motivo para parar: a próxima rodada tenta de novo.
    } finally {
      buscando = false;
    }
  }

  const iniciar = () => {
    if (parado || timer || !o.visivel()) return;
    timer = setInterval(() => {
      if (!o.visivel() || agora() - ultimoUso > inatividade) return;
      void buscar();
    }, intervalo);
  };

  return {
    /** Primeira busca na hora e o relógio do intervalo. */
    comecar() {
      void buscar();
      iniciar();
    },
    /** Desmontar a tela. */
    parar,
    aoMudarVisibilidade() {
      if (!o.visivel()) {
        pausar();
        return;
      }
      if (parado) return;
      if (agora() - ultimaBusca >= intervalo) void buscar();
      iniciar();
    },
    /** Mouse, teclado ou toque: depois de uma pausa por inatividade, atualiza uma vez. */
    aoUsar() {
      const estavaParada = agora() - ultimoUso > inatividade;
      ultimoUso = agora();
      if (estavaParada && !parado && o.visivel() && agora() - ultimaBusca >= intervalo) void buscar();
    },
    get parado() {
      return parado;
    },
    get intervaloMs() {
      return intervalo;
    },
  };
}
