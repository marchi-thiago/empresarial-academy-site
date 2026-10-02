/**
 * Memória curta, por instância do servidor, para as rotas que repassam ao EA Flow (`whatsapp-status`, `antigravity-tasks`).
 * Duas abas do painel (ou dois aparelhos) no mesmo intervalo viram uma só ida ao EA Flow, e uma resposta 401 ou 403 do
 * EA Flow (chave de serviço errada) fica guardada por mais tempo: insistir a cada poucos segundos só gasta cota
 * do Neon e da Vercel sem adiantar (auditoria de 01/10/2026).
 */

export interface RespostaGuardada {
  status: number;
  corpo: unknown;
}

export const TTL_OK_MS = 30_000;
export const TTL_NEGADO_MS = 5 * 60_000;
export const TTL_ERRO_MS = 10_000;

const guardadas = new Map<string, { ate: number; resposta: RespostaGuardada }>();
const emVoo = new Map<string, Promise<RespostaGuardada>>();

function ttlDe(status: number): number {
  if (status >= 200 && status < 300) return TTL_OK_MS;
  if (status === 401 || status === 403) return TTL_NEGADO_MS;
  return TTL_ERRO_MS;
}

export async function comCache(chave: string, buscar: () => Promise<RespostaGuardada>, agora: () => number = Date.now): Promise<RespostaGuardada> {
  const g = guardadas.get(chave);
  if (g && g.ate > agora()) return g.resposta;
  const andando = emVoo.get(chave);
  if (andando) return andando;
  const p = buscar()
    .then((resposta) => {
      guardadas.set(chave, { ate: agora() + ttlDe(resposta.status), resposta });
      return resposta;
    })
    .finally(() => emVoo.delete(chave));
  emVoo.set(chave, p);
  return p;
}

/** Depois de uma escrita (marcar ordem como feita), a próxima leitura precisa ir ao EA Flow. */
export function esquecer(chave: string): void {
  guardadas.delete(chave);
}

export function limparTudo(): void {
  guardadas.clear();
  emVoo.clear();
}
