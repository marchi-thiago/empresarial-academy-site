import { describe, expect, it } from "vitest";
import { camposDoPeriodo, dentroDoPeriodo, intervaloDoPeriodo } from "./periodo";

// Quarta, 04/11/2026, 10h de Brasília (13h UTC).
const agora = new Date("2026-11-04T13:00:00.000Z");
const iso = (n: number) => new Date(n).toISOString();

describe("período do CRM", () => {
  it("hoje, semana (segunda a domingo) e mês em horário de Brasília", () => {
    const hoje = intervaloDoPeriodo({ periodo: "hoje" }, agora)!;
    expect([iso(hoje.ini), iso(hoje.fim)]).toEqual(["2026-11-04T03:00:00.000Z", "2026-11-05T03:00:00.000Z"]);
    const semana = intervaloDoPeriodo({ periodo: "semana" }, agora)!;
    expect([iso(semana.ini), iso(semana.fim)]).toEqual(["2026-11-02T03:00:00.000Z", "2026-11-09T03:00:00.000Z"]);
    const mes = intervaloDoPeriodo({ periodo: "mes" }, agora)!;
    expect([iso(mes.ini), iso(mes.fim)]).toEqual(["2026-11-01T03:00:00.000Z", "2026-12-01T03:00:00.000Z"]);
  });

  it("últimos N dias contam o dia de hoje inteiro", () => {
    const r = intervaloDoPeriodo({ periodo: "7d" }, agora)!;
    expect([iso(r.ini), iso(r.fim)]).toEqual(["2026-10-29T03:00:00.000Z", "2026-11-05T03:00:00.000Z"]);
    expect(iso(intervaloDoPeriodo({ periodo: "6m" }, agora)!.ini)).toBe("2026-05-04T03:00:00.000Z");
  });

  it("personalizado inclui o dia final inteiro e aceita só um dos lados", () => {
    const r = intervaloDoPeriodo({ periodo: "personalizado", de: "2026-10-01", ate: "2026-10-15" }, agora)!;
    expect([iso(r.ini), iso(r.fim)]).toEqual(["2026-10-01T03:00:00.000Z", "2026-10-16T03:00:00.000Z"]);
    expect(intervaloDoPeriodo({ periodo: "personalizado", de: "2026-10-01" }, agora)!.fim).toBe(Infinity);
    expect(intervaloDoPeriodo({ periodo: "personalizado" }, agora)).toBeNull();
    expect(intervaloDoPeriodo({ periodo: "" }, agora)).toBeNull();
  });

  it("filtra pela data escolhida; lead sem essa data fica de fora", () => {
    const lead = { entradaEm: "2026-11-04T12:00:00.000Z", ultimoContatoEm: "2026-09-01T12:00:00.000Z", proximoPassoEm: null };
    expect(dentroDoPeriodo(lead, {}, agora)).toBe(true);
    expect(dentroDoPeriodo(lead, { periodo: "hoje" }, agora)).toBe(true);
    expect(dentroDoPeriodo(lead, { periodo: "hoje", dataBase: "ultimo_contato" }, agora)).toBe(false);
    expect(dentroDoPeriodo(lead, { periodo: "6m", dataBase: "ultimo_contato" }, agora)).toBe(true);
    expect(dentroDoPeriodo(lead, { periodo: "mes", dataBase: "proxima_tarefa" }, agora)).toBe(false);
  });

  it("guarda só o que vale do filtro", () => {
    expect(camposDoPeriodo({ periodo: "", dataBase: "ultimo_contato" })).toEqual({});
    expect(camposDoPeriodo({ periodo: "7d", dataBase: "entrada", de: "2026-10-01" })).toEqual({ periodo: "7d" });
    expect(camposDoPeriodo({ periodo: "personalizado", dataBase: "ultimo_contato", de: "2026-10-01", ate: "" })).toEqual({
      periodo: "personalizado",
      dataBase: "ultimo_contato",
      de: "2026-10-01",
    });
  });
});
