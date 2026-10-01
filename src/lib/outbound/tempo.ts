import { inicioDoDia } from "@/lib/crm/telas/tempo";

/**
 * Relógio do orquestrador em horário de Brasília (UTC-3 fixo, ver crm/telas/tempo.ts).
 * Dia útil = segunda a sexta. ponytail: feriado nacional não entra; passa a valer se virar problema.
 */
const OFFSET_MS = -3 * 3_600_000;
const DIA_MS = 86_400_000;

export { inicioDoDia };

export type PartesBr = { ano: number; mes: number; dia: number; hora: number; min: number; diaSemana: number };

export function partesBr(d: Date): PartesBr {
  const l = new Date(d.getTime() + OFFSET_MS);
  return {
    ano: l.getUTCFullYear(),
    mes: l.getUTCMonth() + 1,
    dia: l.getUTCDate(),
    hora: l.getUTCHours(),
    min: l.getUTCMinutes(),
    diaSemana: l.getUTCDay(),
  };
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** "2026-10-05" do dia de Brasília. */
export function dataIso(d: Date): string {
  const p = partesBr(d);
  return `${p.ano}-${p2(p.mes)}-${p2(p.dia)}`;
}

/** Instante UTC de "YYYY-MM-DD" + "HH:MM" em Brasília. */
export function emBrasilia(dia: string, hora = "00:00"): Date {
  return new Date(new Date(`${dia}T${hora}:00.000Z`).getTime() - OFFSET_MS);
}

export const somarDias = (d: Date, n: number) => new Date(d.getTime() + n * DIA_MS);

export function ehDiaUtil(d: Date): boolean {
  const s = partesBr(d).diaSemana;
  return s >= 1 && s <= 5;
}

/** Primeiro dia útil depois de `d` (sempre estritamente depois), à 00:00 de Brasília. */
export function proximoDiaUtil(d: Date): Date {
  let x = somarDias(inicioDoDia(d), 1);
  while (!ehDiaUtil(x)) x = somarDias(x, 1);
  return x;
}

const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "terça-feira, 6 de outubro, às 15h" (ou "às 15h30"). */
export function textoDoDia(dia: string, hora: string): string {
  const d = emBrasilia(dia, hora);
  const p = partesBr(d);
  const h = p.min === 0 ? `${p.hora}h` : `${p.hora}h${p2(p.min)}`;
  return `${DIAS_SEMANA[p.diaSemana]}, ${p.dia} de ${MESES[p.mes - 1]}, às ${h}`;
}
