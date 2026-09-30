/**
 * Datas do CRM em horário de Brasília. O Brasil não tem horário de verão desde
 * 2019, então o deslocamento é fixo em UTC-3. ponytail: se o horário de verão
 * voltar, trocar por Intl com timeZone "America/Sao_Paulo".
 */
const OFFSET_MS = -3 * 3_600_000;
const DIA_MS = 86_400_000;

/** 00:00 de Brasília do dia de `d`, como instante UTC. */
export function inicioDoDia(d: Date): Date {
  const local = d.getTime() + OFFSET_MS;
  return new Date(Math.floor(local / DIA_MS) * DIA_MS - OFFSET_MS);
}

/** Primeiro instante do dia seguinte (exclusivo). */
export function fimDoDia(d: Date): Date {
  return new Date(inicioDoDia(d).getTime() + DIA_MS);
}

export function mesmoDia(a: Date, b: Date): boolean {
  return inicioDoDia(a).getTime() === inicioDoDia(b).getTime();
}

/** "5 min", "3 h", "2 dias": tempo decorrido em texto curto. */
export function haQuanto(de: Date, agora: Date): string {
  const min = Math.max(0, Math.round((agora.getTime() - de.getTime()) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/** Texto de data e hora em Brasília: "05/10 14:30". */
export function dataHoraBr(d: Date): string {
  const l = new Date(d.getTime() + OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(l.getUTCDate())}/${p(l.getUTCMonth() + 1)} ${p(l.getUTCHours())}:${p(l.getUTCMinutes())}`;
}

export function horaBr(d: Date): string {
  return dataHoraBr(d).slice(6);
}

/** Valor para <input type="datetime-local"> em Brasília e o caminho de volta. */
export function paraInputLocal(d: Date): string {
  const l = new Date(d.getTime() + OFFSET_MS);
  return l.toISOString().slice(0, 16);
}
export function deInputLocal(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() - OFFSET_MS);
}
