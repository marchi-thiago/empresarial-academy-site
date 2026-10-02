import type { Payload } from "payload";
import { outboundDb } from "@/lib/outbound/payload-outbound";
import { chaveDoDia, DIAS_DO_GRAFICO, projetoValido, ultimosDias, type DiaDeCotas, type ProjetoDeCota } from "./cotas";

/** Leitura e gravação dos registros diários de cotas em `interacoes` (marcadores `infra:cotas:AAAA-MM-DD`, sem migração). */

const DIA = /^d{4}-d{2}-d{2}$/u;
const obj = (v: unknown): Record<string, unknown> | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const iso = (v: unknown): string | undefined => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : undefined);

/** Grava um marcador por dia (substitui o do mesmo dia). Só escreve se o conteúdo mudou. */
export async function guardarRegistros(payload: Payload, registros: readonly DiaDeCotas[]): Promise<number> {
  const db = outboundDb(payload);
  let gravados = 0;
  for (const r of registros) {
    const chave = chaveDoDia(r.dia);
    const atual = await db.lerMarcador?.(chave);
    const igual = atual && JSON.stringify(atual.projetos) === JSON.stringify(r.projetos);
    if (igual) continue;
    await db.gravarMarcador?.(chave, { dia: r.dia, geradoEm: r.geradoEm, projetos: r.projetos }, new Date(`${r.dia}T12:00:00Z`));
    gravados++;
  }
  return gravados;
}

export async function lerUltimosDias(payload: Payload, agora: Date = new Date(), quantos = DIAS_DO_GRAFICO): Promise<DiaDeCotas[]> {
  // A janela vai um dia além de hoje: o fuso do Hunter pode estar um dia à frente do UTC.
  const dias = ultimosDias(new Date(agora.getTime() + 86_400_000), quantos + 1);
  const { docs } = await payload.find({
    collection: "interacoes",
    where: { chave: { in: dias.map(chaveDoDia) } },
    limit: quantos + 2,
    depth: 0,
    overrideAccess: true,
  });
  return docs
    .map((d) => {
      const m = obj((d as { metadados?: unknown }).metadados);
      const dia = typeof m?.dia === "string" ? m.dia : null;
      const projetos = Array.isArray(m?.projetos) ? m.projetos.map(projetoValido).filter((p): p is ProjetoDeCota => p !== null) : [];
      return dia && DIA.test(dia) ? ({ dia, geradoEm: iso(m?.geradoEm) ?? "", projetos } satisfies DiaDeCotas) : null;
    })
    .filter((r): r is DiaDeCotas => r !== null)
    .sort((a, b) => (a.dia < b.dia ? -1 : 1));
}

