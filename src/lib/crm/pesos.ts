/** Pesos do plano (seção 5). Editáveis no admin pelo global `crm-config`. */
export type Pesos = {
  abertura: number;
  /** Quantas aberturas contam na janela (abertura é aproximada). */
  aberturasContadas: number;
  clique: number;
  video: number;
  material: number;
  diagnostico: number;
  leitura: number;
  engajadoA: number;
  janelaDias: number;
};

export const PESOS_PADRAO: Pesos = {
  abertura: 1,
  aberturasContadas: 2,
  clique: 3,
  video: 4,
  material: 3,
  diagnostico: 5,
  leitura: 1,
  engajadoA: 5,
  janelaDias: 7,
};

/** Aceita o documento do global (campos nulos ou ausentes) e completa com o padrão. */
export function resolverPesos(doc?: Partial<Record<keyof Pesos, number | null>> | null): Pesos {
  const out = { ...PESOS_PADRAO };
  if (!doc) return out;
  for (const k of Object.keys(out) as (keyof Pesos)[]) {
    const v = doc[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  if (out.janelaDias < 1) out.janelaDias = PESOS_PADRAO.janelaDias;
  return out;
}
