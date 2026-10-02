import { describe, expect, it } from "vitest";

import { contarCores, decidirEstado, formatarDuracao, montarAutomacao, HORA_MS } from "./estado";

const agora = new Date("2026-10-02T15:00:00.000Z");
const haHoras = (h: number): Date => new Date(agora.getTime() - h * HORA_MS);

describe("cores do Painel de Automações", () => {
  it("verde: ligada, sem erro, rodou dentro do prazo", () => {
    expect(decidirEstado({ agora, ultimaExecucao: haHoras(1), prazoMs: 6 * HORA_MS })).toEqual({ estado: "ligado" });
  });

  it("verde: automação por evento (sem prazo) que nunca rodou continua verde", () => {
    expect(decidirEstado({ agora })).toEqual({ estado: "ligado" });
  });

  it.each([
    ["desligada", { desligada: "desligada no painel" }],
    ["semChave", { semChave: "falta a chave CRM_INGEST_SECRET" }],
    ["simulacao", { simulacao: "em simulação" }],
    ["semSinal", { semSinal: "PC sem sinal" }],
  ] as const)("vermelho: %s", (_nome, parte) => {
    const r = decidirEstado({ agora, ...parte });
    expect(r.estado).toBe("parado");
    expect(r.motivo).toBe(Object.values(parte)[0]);
  });

  it("vermelho vence o amarelo: desligada com erro recente continua vermelha", () => {
    const r = decidirEstado({ agora, desligada: "desligada", erroRecente: "deu erro", filaTravada: "fila parada" });
    expect(r).toEqual({ estado: "parado", motivo: "desligada" });
  });

  it("vermelho: passou do prazo sem rodar, com o tempo no motivo", () => {
    const r = decidirEstado({ agora, ultimaExecucao: haHoras(10), prazoMs: 6 * HORA_MS });
    expect(r.estado).toBe("parado");
    expect(r.motivo).toBe("sem rodar há 10 h (o normal é a cada 6 h ou menos)");
  });

  it("vermelho: tem prazo e nunca rodou", () => {
    expect(decidirEstado({ agora, prazoMs: HORA_MS })).toEqual({ estado: "parado", motivo: "ainda não rodou" });
  });

  it("amarelo: ligada com erro recente", () => {
    expect(decidirEstado({ agora, ultimaExecucao: haHoras(1), prazoMs: 6 * HORA_MS, erroRecente: "2 erros nas últimas 24 h" })).toEqual({
      estado: "erro",
      motivo: "2 erros nas últimas 24 h",
    });
  });

  it("amarelo: fila travada", () => {
    expect(decidirEstado({ agora, filaTravada: "5 eventos esperam há 8 h" }).estado).toBe("erro");
  });

  it("o prazo estourado vence o erro recente (vermelho, não amarelo)", () => {
    expect(decidirEstado({ agora, ultimaExecucao: haHoras(80), prazoMs: 72 * HORA_MS, erroRecente: "erro" }).estado).toBe("parado");
  });

  it("montarAutomacao leva o estado, o motivo e a última execução em ISO", () => {
    const a = montarAutomacao(
      { id: "x", nome: "X", sistema: "hunter", grupo: "Prospecção", numeros: [{ rotulo: "Itens", hoje: 1, semana: 4 }] },
      { agora, ultimaExecucao: haHoras(2), erroRecente: "erro" },
    );
    expect(a).toMatchObject({ id: "x", estado: "erro", motivo: "erro", ultimaExecucao: "2026-10-02T13:00:00.000Z" });
  });

  it("automação verde não leva motivo", () => {
    const a = montarAutomacao({ id: "x", nome: "X", sistema: "flow", grupo: "Atendimento", numeros: [] }, { agora });
    expect("motivo" in a).toBe(false);
  });

  it("contarCores soma verdes, amarelas e vermelhas", () => {
    expect(contarCores([{ estado: "ligado" }, { estado: "ligado" }, { estado: "erro" }, { estado: "parado" }])).toEqual({ verdes: 2, amarelas: 1, vermelhas: 1 });
  });

  it("formatarDuracao fala em minutos, horas e dias", () => {
    expect(formatarDuracao(20 * 60_000)).toBe("20 min");
    expect(formatarDuracao(5 * HORA_MS)).toBe("5 h");
    expect(formatarDuracao(72 * HORA_MS)).toBe("3 dias");
  });
});
