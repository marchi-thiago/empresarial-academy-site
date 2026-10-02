import { describe, expect, it } from "vitest";
import { chaveDoDia, faixaDaCota, projetosDoGrafico, registrosValidos, serieDaMetrica, ultimosDias, type DiaDeCotas } from "./cotas";

const metrica = (chave: string, dia: number | null, pct: number | null = null) => ({ chave, rotulo: chave, unidade: "u", dia, mes: dia, limite: 100, pct, estimativa: false });
const projeto = (id: string, sistema: "neon" | "vercel", dia: number) => ({ id, sistema, nome: id, plano: "free", metricas: [metrica("compute", dia, 10)] });
const registro = (dia: string, projetos = [projeto("neon-a", "neon", 1)]): DiaDeCotas => ({ dia, geradoEm: `${dia}T09:00:00.000Z`, projetos });

describe("validação do corpo do Hunter", () => {
  it("aceita o formato", () => {
    const r = registrosValidos({ registros: [registro("2026-10-02")] });
    expect(r).toHaveLength(1);
    expect(r[0]!.projetos[0]!.metricas[0]).toMatchObject({ chave: "compute", dia: 1, pct: 10, estimativa: false });
  });

  it.each([
    ["sem registros", {}],
    ["dia fora do padrão", { registros: [{ ...registro("02/10/2026") }] }],
    ["sistema inventado", { registros: [registro("2026-10-02", [{ ...projeto("x", "neon", 1), sistema: "outro" as never }])] }],
    ["dia sem projeto válido", { registros: [{ dia: "2026-10-02", projetos: [{ lixo: true }] }] }],
    ["não é objeto", "texto"],
  ])("descarta %s", (_nome, corpo) => {
    expect(registrosValidos(corpo)).toEqual([]);
  });

  it("limita o envio a 40 dias e as métricas a 12 por projeto", () => {
    const muitos = Array.from({ length: 50 }, (_, i) => registro(`2026-09-${String((i % 28) + 1).padStart(2, "0")}`));
    expect(registrosValidos({ registros: muitos })).toHaveLength(40);
    const metricas = Array.from({ length: 20 }, (_, i) => metrica(`m${i}`, 1));
    expect(registrosValidos({ registros: [registro("2026-10-02", [{ ...projeto("a", "neon", 1), metricas }])] })[0]!.projetos[0]!.metricas).toHaveLength(12);
  });

  it("número que não é finito vira null", () => {
    const r = registrosValidos({ registros: [registro("2026-10-02", [{ ...projeto("a", "neon", 1), metricas: [{ ...metrica("c", 1), dia: "1" as never, mes: Infinity }] }])] });
    expect(r[0]!.projetos[0]!.metricas[0]).toMatchObject({ dia: null, mes: null });
  });
});

describe("gráfico", () => {
  it("a chave do registro do dia é estável", () => {
    expect(chaveDoDia("2026-10-02")).toBe("infra:cotas:2026-10-02");
  });

  it("os últimos 30 dias terminam no dia pedido", () => {
    const d = ultimosDias(new Date("2026-10-02T15:00:00Z"));
    expect(d).toHaveLength(30);
    expect(d.at(-1)).toBe("2026-10-02");
    expect(d[0]).toBe("2026-09-03");
  });

  it("a série tem um valor por dia, com zero onde não houve registro", () => {
    const dias = ultimosDias(new Date("2026-10-04T00:00:00Z"), 4);
    const s = serieDaMetrica([registro("2026-10-02", [projeto("neon-a", "neon", 3)]), registro("2026-10-04", [projeto("neon-a", "neon", 5)])], "neon-a", "compute", dias);
    expect(s).toEqual([0, 3, 0, 5]);
  });

  it("lista os projetos pelo retrato mais recente, Neon antes da Vercel", () => {
    const lista = projetosDoGrafico([registro("2026-10-01", [projeto("vercel-x", "vercel", 1), projeto("neon-a", "neon", 1)]), registro("2026-10-02", [projeto("neon-a", "neon", 7)])]);
    expect(lista.map((p) => p.atual.id)).toEqual(["neon-a", "vercel-x"]);
    expect(lista[0]!.atual.metricas[0]!.dia).toBe(7);
    expect(lista[0]!.dia).toBe("2026-10-02");
  });

  it("as faixas seguem a regra do painel: 70 e 90", () => {
    expect([null, 0, 69.9].map(faixaDaCota)).toEqual(["ok", "ok", "ok"]);
    expect([70, 89.9].map(faixaDaCota)).toEqual(["atencao", "atencao"]);
    expect([90, 140].map(faixaDaCota)).toEqual(["critico", "critico"]);
  });
});
