import { describe, expect, it } from "vitest";
import { registrarRodada, type OutboundDb } from "@/lib/outbound/orquestrador";
import { CHAVE_RODADA } from "./chaves";

const agora = new Date("2026-10-02T14:00:00.000Z");

function bancoFalso() {
  const guardado = new Map<string, Record<string, unknown>>();
  const db = {
    lerMarcador: async (chave: string) => guardado.get(chave) ?? null,
    gravarMarcador: async (chave: string, meta: Record<string, unknown>, data?: Date) => void guardado.set(chave, { ...meta, data }),
  } as unknown as OutboundDb;
  return { db, guardado };
}

describe("registrarRodada (marcador do Painel de Automações)", () => {
  it("grava modo, rotinas que rodaram, erros e a contagem de rodadas do dia", async () => {
    const { db, guardado } = bancoFalso();
    await registrarRodada(db, agora, "simulacao", { temperatura: 5, caixa: { erro: "Graph 401" }, alertas: {} });
    expect(guardado.get(CHAVE_RODADA)).toMatchObject({ modo: "simulacao", rotinas: ["temperatura", "caixa", "alertas"], erros: { caixa: "Graph 401" }, contagem: { "2026-10-02": 1 } });
  });

  it("soma uma rodada por chamada no mesmo dia e guarda só 8 dias", async () => {
    const { db, guardado } = bancoFalso();
    const antigos = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`2026-09-${String(20 + i).padStart(2, "0")}`, 10]));
    guardado.set(CHAVE_RODADA, { contagem: { ...antigos, "2026-10-02": 4 } });
    await registrarRodada(db, agora, "real", {});
    const contagem = guardado.get(CHAVE_RODADA)?.contagem as Record<string, number>;
    expect(contagem["2026-10-02"]).toBe(5);
    expect(Object.keys(contagem)).toHaveLength(8);
    expect(contagem["2026-09-20"]).toBeUndefined();
  });

  it("banco sem gravarMarcador ou que falha não derruba a rodada", async () => {
    await expect(registrarRodada({ lerMarcador: async () => null } as unknown as OutboundDb, agora, "real", {})).resolves.toBeUndefined();
    const quebrado = { lerMarcador: async () => { throw new Error("neon fora"); }, gravarMarcador: async () => {} } as unknown as OutboundDb;
    await expect(registrarRodada(quebrado, agora, "real", {})).resolves.toBeUndefined();
  });
});
