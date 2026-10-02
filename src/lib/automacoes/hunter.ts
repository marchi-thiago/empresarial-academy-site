import { formatarDuracao, type Automacao, type GrupoDaAutomacao } from "./estado";

/**
 * As automações do EA Hunter no Painel de Automações.
 *
 * O Hunter (worker no PC do Thiago) manda o status das automações dele junto do sinal de vida
 * (`POST /api/outbound/heartbeat`, campo `automacoes`). O site guarda o último status num registro único,
 * sobrescrito (`sistema:status:hunter`), e o repassa ao painel do EA Flow. Sem sinal do PC, o painel não pode mostrar
 * número velho como se fosse de hoje: todas as automações do Hunter aparecem paradas, com o motivo.
 */

/** Sinal de vida do Hunter sem chegar há mais disto: o PC está sem sinal. */
export const LIMITE_SEM_SINAL_DO_HUNTER_MS = 45 * 60_000;

/** Nomes e grupos das automações do Hunter, para mostrar o painel mesmo sem sinal. Mesma lista do `status.ts` do Hunter. */
export const CATALOGO_DO_HUNTER: ReadonlyArray<{ id: string; nome: string; grupo: GrupoDaAutomacao }> = [
  { id: "hunter-descoberta", nome: "Descoberta de perfis", grupo: "Prospecção" },
  { id: "hunter-qualificacao", nome: "Qualificação com IA", grupo: "Prospecção" },
  { id: "hunter-dossie", nome: "Dossiê e kit de mensagens", grupo: "Prospecção" },
  { id: "hunter-dms", nome: "Envio de DMs no Instagram", grupo: "Prospecção" },
  { id: "hunter-saude", nome: "Checagem de saúde e avisos", grupo: "Prospecção" },
  { id: "hunter-sync-crm", nome: "Sincronização de leads com o CRM", grupo: "Cadência e CRM" },
  { id: "hunter-eventos-crm", nome: "Eventos de DM para o CRM", grupo: "Cadência e CRM" },
  { id: "hunter-orquestrador", nome: "Chamador da cadência do site", grupo: "Cadência e CRM" },
  { id: "hunter-sdr", nome: "SDR local (respostas pela assinatura)", grupo: "Atendimento" },
];

export interface StatusGuardadoDoHunter {
  geradoEm: string;
  automacoes: Automacao[];
}

const ESTADOS = new Set(["ligado", "erro", "parado"]);
const GRUPOS = new Set(["Prospecção", "Cadência e CRM", "Atendimento"]);

const ehNumeroOuNulo = (v: unknown): v is number | null => v === null || (typeof v === "number" && Number.isFinite(v));

/** Aceita só o que tem o formato padrão; o resto é descartado (o corpo vem do PC, por rede). */
export function automacaoValida(x: unknown): Automacao | null {
  if (typeof x !== "object" || x === null) return null;
  const a = x as Record<string, unknown>;
  if (typeof a.id !== "string" || !a.id.startsWith("hunter-") || a.id.length > 60) return null;
  if (typeof a.nome !== "string" || a.nome.length === 0 || a.nome.length > 120) return null;
  if (typeof a.estado !== "string" || !ESTADOS.has(a.estado)) return null;
  if (typeof a.grupo !== "string" || !GRUPOS.has(a.grupo)) return null;
  if (!Array.isArray(a.numeros)) return null;
  const numeros = [];
  for (const n of a.numeros.slice(0, 12)) {
    const o = n as Record<string, unknown> | null;
    if (!o || typeof o.rotulo !== "string" || !ehNumeroOuNulo(o.hoje) || !ehNumeroOuNulo(o.semana)) return null;
    numeros.push({ rotulo: o.rotulo.slice(0, 120), hoje: o.hoje, semana: o.semana });
  }
  const ultima = typeof a.ultimaExecucao === "string" && !Number.isNaN(Date.parse(a.ultimaExecucao)) ? a.ultimaExecucao : undefined;
  return {
    id: a.id,
    nome: a.nome,
    sistema: "hunter",
    grupo: a.grupo as GrupoDaAutomacao,
    estado: a.estado as Automacao["estado"],
    ...(typeof a.motivo === "string" && a.motivo ? { motivo: a.motivo.slice(0, 300) } : {}),
    numeros,
    ...(ultima ? { ultimaExecucao: ultima } : {}),
  };
}

/** Lista de automações válidas do corpo do heartbeat (`[]` se não veio nada aproveitável). */
export function automacoesDoCorpo(bruto: unknown): Automacao[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.slice(0, 40).map(automacaoValida).filter((a): a is Automacao => a !== null);
}

function paradas(motivo: string): Automacao[] {
  return CATALOGO_DO_HUNTER.map((c) => ({ ...c, sistema: "hunter" as const, estado: "parado" as const, motivo, numeros: [] }));
}

export interface EntradaDoHunter {
  agora: Date;
  /** Quando o último sinal de vida chegou (null = nunca chegou). */
  ultimoSinal: Date | null;
  status: StatusGuardadoDoHunter | null;
}

/**
 * As automações do Hunter que o painel mostra. Nunca chegou sinal: parado, "falta a chave do heartbeat". Sinal velho
 * (mais de 45 min): parado, "PC sem sinal". Sinal novo sem status (Hunter antigo): parado, pedindo para atualizar.
 */
export function automacoesDoHunter(e: EntradaDoHunter): { automacoes: Automacao[]; semSinal: string | null } {
  if (!e.ultimoSinal) {
    const motivo = "sem sinal do PC; falta a chave do heartbeat (OUTBOUND_TICK_SECRET no PC do Hunter)";
    return { automacoes: paradas(motivo), semSinal: motivo };
  }
  const idade = e.agora.getTime() - e.ultimoSinal.getTime();
  if (idade > LIMITE_SEM_SINAL_DO_HUNTER_MS) {
    const motivo = `PC sem sinal há ${formatarDuracao(idade)}`;
    return { automacoes: paradas(motivo), semSinal: motivo };
  }
  if (!e.status || e.status.automacoes.length === 0) {
    return { automacoes: paradas("o PC está no ar, mas ainda não enviou o status das automações (atualizar o Hunter)"), semSinal: null };
  }
  // Só vale o status que chegou junto do sinal vivo; o que faltar no envio aparece parado.
  const enviados = new Map(e.status.automacoes.map((a) => [a.id, a]));
  const lista = CATALOGO_DO_HUNTER.map(
    (c) => enviados.get(c.id) ?? { ...c, sistema: "hunter" as const, estado: "parado" as const, motivo: "o Hunter não enviou o status desta automação (atualizar o Hunter)", numeros: [] },
  );
  const extras = e.status.automacoes.filter((a) => !CATALOGO_DO_HUNTER.some((c) => c.id === a.id));
  return { automacoes: [...lista, ...extras], semSinal: null };
}
