import { OFFSET_MS, fimDoDia, inicioDoDia } from "./tempo";

/**
 * Filtro de período do CRM (Kanban e Fila do dia usam o mesmo). Atalhos iguais aos do RD Station e
 * um período personalizado; a data que o período olha é escolhida no próprio filtro.
 * Tudo em horário de Brasília (ver tempo.ts).
 */

export const PERIODOS = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "semana", rotulo: "Esta semana" },
  { id: "mes", rotulo: "Este mês" },
  { id: "7d", rotulo: "Últimos 7 dias" },
  { id: "14d", rotulo: "Últimos 14 dias" },
  { id: "30d", rotulo: "Últimos 30 dias" },
  { id: "6m", rotulo: "Últimos 6 meses" },
  { id: "personalizado", rotulo: "Período personalizado" },
] as const;

export const DATAS_BASE = [
  { id: "entrada", rotulo: "Entrada no CRM" },
  { id: "ultimo_contato", rotulo: "Último contato" },
  { id: "proxima_tarefa", rotulo: "Próxima tarefa" },
] as const;
export type DataBase = (typeof DATAS_BASE)[number]["id"];

/** Campos do filtro como ficam na URL. `dataBase` vazio = entrada. `de`/`ate` = "AAAA-MM-DD", só no personalizado. */
export type FiltroPeriodo = { periodo?: string; de?: string; ate?: string; dataBase?: string };

/** As datas de um lead que o período pode olhar (ISO). */
export type DatasDoLead = { entradaEm?: string | null; ultimoContatoEm?: string | null; proximoPassoEm?: string | null };

const DIA_MS = 86_400_000;

/** Meia-noite de Brasília do dia (ano, mês 0-11, dia), como instante UTC. Aceita mês e dia fora da faixa (Date.UTC normaliza). */
const meiaNoite = (ano: number, mes: number, dia: number) => Date.UTC(ano, mes, dia) - OFFSET_MS;

function diaDoInput(v: string | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? "");
  return m ? meiaNoite(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** Intervalo [ini, fim) do período em ms. Null = sem filtro (período vazio, desconhecido ou personalizado sem datas). */
export function intervaloDoPeriodo(f: FiltroPeriodo, agora: Date): { ini: number; fim: number } | null {
  const hoje = inicioDoDia(agora).getTime();
  const amanha = fimDoDia(agora).getTime();
  // Campos do calendário em Brasília: a data UTC deslocada tem os números de Brasília.
  const l = new Date(agora.getTime() + OFFSET_MS);
  const [ano, mes, dia] = [l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()];
  switch (f.periodo) {
    case "hoje":
      return { ini: hoje, fim: amanha };
    case "semana": {
      // Semana de segunda a domingo.
      const segunda = hoje - ((l.getUTCDay() + 6) % 7) * DIA_MS;
      return { ini: segunda, fim: segunda + 7 * DIA_MS };
    }
    case "mes":
      return { ini: meiaNoite(ano, mes, 1), fim: meiaNoite(ano, mes + 1, 1) };
    case "7d":
    case "14d":
    case "30d":
      return { ini: amanha - Number(f.periodo.slice(0, -1)) * DIA_MS, fim: amanha };
    case "6m":
      return { ini: meiaNoite(ano, mes - 6, dia), fim: amanha };
    case "personalizado": {
      const de = diaDoInput(f.de);
      const ate = diaDoInput(f.ate);
      if (de === null && ate === null) return null;
      return { ini: de ?? -Infinity, fim: ate === null ? Infinity : ate + DIA_MS };
    }
    default:
      return null;
  }
}

export function dataBaseDe(f: FiltroPeriodo): DataBase {
  return DATAS_BASE.some((d) => d.id === f.dataBase) ? (f.dataBase as DataBase) : "entrada";
}

/** O lead passa no filtro? Sem filtro, sempre; com filtro, lead sem a data escolhida fica de fora. */
export function dentroDoPeriodo(datas: DatasDoLead, f: FiltroPeriodo, agora: Date): boolean {
  const intervalo = intervaloDoPeriodo(f, agora);
  if (!intervalo) return true;
  const base = dataBaseDe(f);
  const valor = base === "entrada" ? datas.entradaEm : base === "ultimo_contato" ? datas.ultimoContatoEm : datas.proximoPassoEm;
  const t = valor ? Date.parse(valor) : NaN;
  return !Number.isNaN(t) && t >= intervalo.ini && t < intervalo.fim;
}

/** Só os campos do período, sem os vazios: o que vai para a URL e para a memória do navegador. */
export function camposDoPeriodo(f: FiltroPeriodo): FiltroPeriodo {
  if (!f.periodo) return {};
  const out: FiltroPeriodo = { periodo: f.periodo };
  if (f.dataBase && f.dataBase !== "entrada") out.dataBase = f.dataBase;
  if (f.periodo === "personalizado") {
    if (f.de) out.de = f.de;
    if (f.ate) out.ate = f.ate;
  }
  return out;
}
