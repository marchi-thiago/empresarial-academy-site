import type { RefLead } from "./tipos";

/** Instagram é gravado como "@handle" em minúsculas (sync do Hunter). */
export function normalizarHandle(v: string): string {
  return v
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@/, "")
    .toLowerCase();
}

export const normalizarEmail = (v: string) => v.trim().toLowerCase();

/** Últimos 11 dígitos (DDD + número): bate com "+55 (11) 93340-0264" e "11933400264". */
export function finalDoWhatsapp(v: string): string | null {
  const d = v.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-11) : null;
}

/** Ao menos uma referência utilizável? */
export function temReferencia(r: RefLead): boolean {
  return Boolean(
    (r.leadId != null && r.leadId !== "") ||
      (r.hunterId != null && r.hunterId !== "") ||
      (r.instagram && normalizarHandle(r.instagram)) ||
      (r.email && r.email.includes("@")) ||
      (r.whatsapp && finalDoWhatsapp(r.whatsapp)),
  );
}
