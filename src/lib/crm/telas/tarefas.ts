import { dataHoraBr, fimDoDia, inicioDoDia } from "./tempo";
import { intervaloDoPeriodo, type FiltroPeriodo } from "./periodo";

/**
 * Tarefas do CRM (painel /eahub/crm/tarefas, ficha e Fila do dia). Três origens, uma lista só:
 * - manual: coleção `tarefas`, criada pelo Thiago; concluir grava a data.
 * - proximo_passo: o "próximo passo" do lead (campo do lead, gravado à mão e pelas ações da Fila e do
 *   outbound). Não é copiado para a coleção: lido direto do lead, nunca fica fora de sincronia.
 *   Concluir limpa o campo e guarda uma tarefa concluída na coleção, para o histórico.
 * - cadencia: o próximo toque automático da cadência. Só leitura.
 */

export const TIPOS_TAREFA = [
  { id: "ligacao", rotulo: "Ligação" },
  { id: "email", rotulo: "E-mail" },
  { id: "whatsapp", rotulo: "WhatsApp" },
  { id: "reuniao", rotulo: "Reunião" },
  { id: "visita", rotulo: "Visita" },
  { id: "linkedin", rotulo: "LinkedIn" },
  { id: "dm", rotulo: "DM" },
  { id: "tarefa", rotulo: "Tarefa" },
] as const;
export type TipoTarefa = (typeof TIPOS_TAREFA)[number]["id"];
export const ROTULO_TIPO_TAREFA = Object.fromEntries(TIPOS_TAREFA.map((t) => [t.id, t.rotulo])) as Record<TipoTarefa, string>;
export const tipoValido = (v: unknown): v is TipoTarefa => TIPOS_TAREFA.some((t) => t.id === v);

export type OrigemTarefa = "manual" | "proximo_passo" | "cadencia";

export type ItemTarefa = {
  /** Único na lista: "t<id>" (coleção), "pp<leadId>" (próximo passo), "c<leadId>" (cadência). */
  chave: string;
  /** Id na coleção `tarefas` (só manual). */
  tarefaId?: number;
  leadId: number;
  lead: string;
  empresa: string | null;
  tipo: TipoTarefa;
  titulo: string;
  /** ISO. */
  venceEm: string | null;
  concluidaEm: string | null;
  origem: OrigemTarefa;
};

export type Situacao = "pendente" | "atrasada" | "concluida";

export function situacaoDe(t: Pick<ItemTarefa, "venceEm" | "concluidaEm">, agora: Date): Situacao {
  if (t.concluidaEm) return "concluida";
  return t.venceEm && Date.parse(t.venceEm) < agora.getTime() ? "atrasada" : "pendente";
}

/** Tipo do próximo passo pelo texto ("Reunião de 20 min" vira Reunião). Sem pista, Tarefa. */
export function tipoDoTexto(texto: string | null | undefined): TipoTarefa {
  const t = (texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/reuniao|call|videochamada/.test(t)) return "reuniao";
  if (/ligar|ligacao|telefon/.test(t)) return "ligacao";
  if (/whats/.test(t)) return "whatsapp";
  if (/linkedin/.test(t)) return "linkedin";
  if (/\bdm\b|direct|instagram/.test(t)) return "dm";
  if (/visita/.test(t)) return "visita";
  if (/e-?mail|proposta|resumo/.test(t)) return "email";
  return "tarefa";
}

const CANAL_PARA_TIPO: Record<string, TipoTarefa> = { dm: "dm", email: "email", whatsapp: "whatsapp", ligacao: "ligacao", linkedin: "linkedin" };

/** O que o painel precisa do lead para montar o próximo passo e o toque da cadência. */
export type LeadDeTarefa = {
  id: number;
  nome: string;
  empresa: string | null;
  proximoPasso: string | null;
  proximoPassoEm: string | null;
  proximoCanal: string | null;
  proximoToqueEm: string | null;
  pausada: boolean;
};

export function tarefasDoLead(l: LeadDeTarefa): ItemTarefa[] {
  const base = { leadId: l.id, lead: l.nome, empresa: l.empresa, concluidaEm: null };
  const out: ItemTarefa[] = [];
  if (l.proximoPasso || l.proximoPassoEm) {
    out.push({ ...base, chave: `pp${l.id}`, tipo: tipoDoTexto(l.proximoPasso), titulo: l.proximoPasso ?? "Próximo passo sem descrição", venceEm: l.proximoPassoEm, origem: "proximo_passo" });
  }
  const tipo = l.proximoCanal ? CANAL_PARA_TIPO[l.proximoCanal] : undefined;
  if (tipo && l.proximoToqueEm && !l.pausada) {
    out.push({ ...base, chave: `c${l.id}`, tipo, titulo: `Toque da cadência: ${ROTULO_TIPO_TAREFA[tipo]}`, venceEm: l.proximoToqueEm, origem: "cadencia" });
  }
  return out;
}

/**
 * Seção "Tarefas" da Fila do dia: pendentes que vencem até o fim de hoje (atrasadas incluídas).
 * Fora: toques da cadência (já estão em Ligações e LinkedIn) e o próximo passo de reunião (já está
 * em Reuniões de hoje).
 */
export function tarefasDoDia<T extends ItemTarefa>(itens: T[], agora: Date): T[] {
  const fim = fimDoDia(agora).getTime();
  return ordenarTarefas(
    itens.filter((t) => !t.concluidaEm && t.venceEm && Date.parse(t.venceEm) < fim && t.origem !== "cadencia" && !(t.origem === "proximo_passo" && t.tipo === "reuniao")),
  ) as T[];
}

export const SITUACOES_FILTRO = [
  { id: "pendentes", rotulo: "Pendentes" },
  { id: "atrasadas", rotulo: "Atrasadas" },
  { id: "concluidas", rotulo: "Concluídas" },
  { id: "todas", rotulo: "Todas" },
] as const;

export type FiltroTarefas = Pick<FiltroPeriodo, "periodo" | "de" | "ate"> & {
  busca?: string;
  /** Vazio = todos os tipos. */
  tipos?: string[];
  situacao?: string;
  /** Mostrar os toques automáticos da cadência. */
  automaticos?: boolean;
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const quando = (t: ItemTarefa) => t.concluidaEm ?? t.venceEm;

export function filtrarTarefas(itens: ItemTarefa[], f: FiltroTarefas, agora: Date): ItemTarefa[] {
  const intervalo = intervaloDoPeriodo(f, agora);
  const busca = semAcento((f.busca ?? "").trim());
  const situacao = f.situacao || "pendentes";
  return itens.filter((t) => {
    if (t.origem === "cadencia" && f.automaticos === false) return false;
    if (f.tipos?.length && !f.tipos.includes(t.tipo)) return false;
    const s = situacaoDe(t, agora);
    if (situacao === "pendentes" && s === "concluida") return false;
    if (situacao === "atrasadas" && s !== "atrasada") return false;
    if (situacao === "concluidas" && s !== "concluida") return false;
    if (intervalo) {
      const d = quando(t);
      const ms = d ? Date.parse(d) : NaN;
      if (Number.isNaN(ms) || ms < intervalo.ini || ms >= intervalo.fim) return false;
    }
    if (busca && !semAcento([t.titulo, t.lead, t.empresa].filter(Boolean).join(" ")).includes(busca)) return false;
    return true;
  });
}

/** Pendentes primeiro, da mais antiga para a mais nova (sem data no fim); depois concluídas, da mais recente. */
export function ordenarTarefas(itens: ItemTarefa[]): ItemTarefa[] {
  const ms = (v: string | null) => (v ? Date.parse(v) : Infinity);
  return [...itens].sort((a, b) => {
    if (Boolean(a.concluidaEm) !== Boolean(b.concluidaEm)) return a.concluidaEm ? 1 : -1;
    if (a.concluidaEm && b.concluidaEm) return ms(b.concluidaEm) - ms(a.concluidaEm);
    return ms(a.venceEm) - ms(b.venceEm) || a.lead.localeCompare(b.lead, "pt-BR");
  });
}

/** Grupos por dia (na ordem de `ordenarTarefas`): "Atrasadas", "Hoje", "Amanhã", "05/11", "Sem data", "Concluídas". */
export function agruparTarefas(itens: ItemTarefa[], agora: Date): { rotulo: string; itens: ItemTarefa[] }[] {
  const hoje0 = inicioDoDia(agora).getTime();
  const grupos: { rotulo: string; itens: ItemTarefa[] }[] = [];
  for (const t of ordenarTarefas(itens)) {
    let rotulo: string;
    if (t.concluidaEm) rotulo = "Concluídas";
    else if (!t.venceEm) rotulo = "Sem data";
    else if (situacaoDe(t, agora) === "atrasada" && Date.parse(t.venceEm) < hoje0) rotulo = "Atrasadas";
    else {
      const dias = Math.round((inicioDoDia(new Date(t.venceEm)).getTime() - hoje0) / 86_400_000);
      rotulo = dias === 0 ? "Hoje" : dias === 1 ? "Amanhã" : dataHoraBr(new Date(t.venceEm)).slice(0, 5);
    }
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.rotulo === rotulo) ultimo.itens.push(t);
    else grupos.push({ rotulo, itens: [t] });
  }
  return grupos;
}
