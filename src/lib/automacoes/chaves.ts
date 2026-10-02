/**
 * Marcadores (linhas únicas em `interacoes`, sobrescritas) que o Painel de Automações grava e lê.
 * Moram aqui, sem dependências, para o orquestrador, a rota do heartbeat e o painel usarem os mesmos nomes.
 */

/** Última rodada do orquestrador (`/api/cron/outbound`): hora, modo, rotinas que rodaram, erros e rodadas por dia. */
export const CHAVE_RODADA = "sistema:orquestrador:rodada";
/** Último sinal de vida do Hunter (gravado pela rota do heartbeat). */
export const CHAVE_HEARTBEAT_HUNTER = "sistema:heartbeat:hunter";
/** Último status das automações do Hunter (vem no corpo do heartbeat). */
export const CHAVE_STATUS_HUNTER = "sistema:status:hunter";
