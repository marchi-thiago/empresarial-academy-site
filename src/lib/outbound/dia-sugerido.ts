import { dataIso, ehDiaUtil, emBrasilia, inicioDoDia, proximoDiaUtil, somarDias, textoDoDia } from "./tempo";

/**
 * Dia e horário sugeridos no convite (um por dia de envio). Com a agenda do Outlook, é o primeiro horário
 * livre perto das 15h num dos próximos dias úteis; sem ela, regra fixa: próximo dia útil às 15h.
 * O Calendly resolve qualquer conflito que sobrar.
 */

export type Ocupado = { inicio: Date; fim: Date };

export type DiaSugerido = { dia: string; hora: string; texto: string; origem: "agenda" | "regra" };

const DURACAO_MIN = 20;
const FOLGA_MIN = 10;
/** Ordem de preferência: perto das 15h, depois manhã. */
const HORAS = ["15:00", "15:30", "14:30", "14:00", "16:00", "16:30", "11:00", "11:30", "10:00", "10:30"];
const DIAS_A_OLHAR = 7;

export function regraFixa(hoje: Date): DiaSugerido {
  const dia = dataIso(proximoDiaUtil(hoje));
  return { dia, hora: "15:00", texto: textoDoDia(dia, "15:00"), origem: "regra" };
}

export function sugerirDia(hoje: Date, ocupados: Ocupado[] | null): DiaSugerido {
  if (!ocupados) return regraFixa(hoje);
  let dia = proximoDiaUtil(hoje);
  for (let i = 0; i < DIAS_A_OLHAR; i++) {
    if (ehDiaUtil(dia)) {
      const iso = dataIso(dia);
      for (const hora of HORAS) {
        const ini = emBrasilia(iso, hora).getTime();
        const fim = ini + (DURACAO_MIN + FOLGA_MIN) * 60_000;
        const livre = !ocupados.some((o) => o.inicio.getTime() < fim && o.fim.getTime() > ini);
        if (livre) return { dia: iso, hora, texto: textoDoDia(iso, hora), origem: "agenda" };
      }
    }
    dia = somarDias(dia, 1);
  }
  return regraFixa(hoje);
}

/** Dia para abrir o Calendly: o sugerido no último e-mail, se ainda não passou; senão a regra fixa. */
export function diaParaConversa(agora: Date, ultimoSugerido: string | null): { dia: string; hora: string } {
  if (ultimoSugerido && /^\d{4}-\d{2}-\d{2}$/.test(ultimoSugerido) && emBrasilia(ultimoSugerido).getTime() >= inicioDoDia(agora).getTime()) {
    return { dia: ultimoSugerido, hora: "15:00" };
  }
  const r = regraFixa(agora);
  return { dia: r.dia, hora: r.hora };
}

/** Evento do Outlook em hora local de Brasília ("2026-10-06T14:00:00.0000000", sem fuso) para instante. */
export function eventoOutlookParaOcupado(inicioLocal?: string, fimLocal?: string): Ocupado | null {
  if (!inicioLocal || !fimLocal) return null;
  const f = (s: string) => emBrasilia(s.slice(0, 10), s.slice(11, 16));
  const a = f(inicioLocal);
  const b = f(fimLocal);
  return Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) ? null : { inicio: a, fim: b };
}
