import { describe, expect, it } from "vitest";
import { agregarInteracoesEmMemoria, janelas, lerMarcadores, rodadaDoMarcador } from "./dados";
import { CHAVE_HEARTBEAT_HUNTER, CHAVE_RODADA, CHAVE_STATUS_HUNTER } from "./chaves";

// Sexta, 11h em Brasília.
const agora = new Date("2026-10-02T14:00:00.000Z");
const j = janelas(agora);

describe("janelas", () => {
  it("hoje começa à meia-noite de Brasília e a semana tem 7 dias contando hoje", () => {
    expect(j.hoje.toISOString()).toBe("2026-10-02T03:00:00.000Z");
    expect(j.semana.toISOString()).toBe("2026-09-26T03:00:00.000Z");
    expect(j.ultimas24h.toISOString()).toBe("2026-10-01T14:00:00.000Z");
  });
});

describe("agregarInteracoesEmMemoria", () => {
  const doc = (o: Record<string, unknown>) => ({ canal: "email", direcao: "saida", tipo: "enviado", data: agora.toISOString(), ...o });

  it("agrupa por canal, direção, tipo, simulado e partes da chave, contando hoje, semana e 24 h", () => {
    const linhas = agregarInteracoesEmMemoria(
      [
        doc({ chave: "out:email:1:d1_a:2026-10-02" }),
        doc({ chave: "out:email:2:d1_a:2026-10-02", data: "2026-10-01T20:00:00.000Z" }),
        doc({ chave: "out:email:3:d1_a:2026-09-27", data: "2026-09-27T20:00:00.000Z" }),
        doc({ chave: "out:email:4:d1_a:2026-09-01", data: "2026-09-01T20:00:00.000Z" }),
        doc({ chave: "sim:email:5:d1_a:2026-10-02", metadados: { simulado: true } }),
        doc({ canal: "sistema", tipo: "lembrete", chave: "rotina:temperatura:2026-10-02" }),
      ],
      j,
    );
    const real = linhas.find((l) => l.p1 === "out")!;
    expect(real).toMatchObject({ canal: "email", direcao: "saida", tipo: "enviado", simulado: false, p2: "email", hoje: 1, semana: 3, ultimas24h: 2 });
    expect(real.ultima?.toISOString()).toBe(agora.toISOString());
    expect(linhas.find((l) => l.p1 === "sim")).toMatchObject({ simulado: true, hoje: 1, semana: 1 });
    expect(linhas.find((l) => l.p1 === "rotina")).toMatchObject({ p2: "temperatura", canal: "sistema" });
  });

  it("ignora interação sem data válida", () => {
    expect(agregarInteracoesEmMemoria([{ canal: "email", direcao: "saida", tipo: "enviado", data: "lixo" }], j)).toEqual([]);
  });
});

describe("marcadores do painel", () => {
  it("rodadaDoMarcador lê hora, modo, rotinas, erros e contagem; sem marcador devolve null", () => {
    expect(rodadaDoMarcador(undefined)).toBeNull();
    const r = rodadaDoMarcador({
      data: agora.toISOString(),
      metadados: { modo: "simulacao", rotinas: ["caixa", 3], erros: { caixa: "x" }, contagem: { "2026-10-02": 4, ruim: "a" } },
    })!;
    expect(r).toEqual({ em: agora, modo: "simulacao", rotinas: ["caixa"], erros: { caixa: "x" }, contagem: { "2026-10-02": 4 } });
  });

  it("lerMarcadores separa rodada, sinal do Hunter e status das automações", () => {
    const m = lerMarcadores([
      { chave: CHAVE_RODADA, data: agora.toISOString(), metadados: { rotinas: [], erros: {}, contagem: {} } },
      { chave: CHAVE_HEARTBEAT_HUNTER, data: "2026-10-02T13:59:00.000Z", metadados: { recebidoEm: "2026-10-02T13:58:00.000Z" } },
      {
        chave: CHAVE_STATUS_HUNTER,
        data: "2026-10-02T13:58:00.000Z",
        metadados: {
          geradoEm: "2026-10-02T13:57:00.000Z",
          automacoes: [{ id: "hunter-dms", nome: "DMs", grupo: "Prospecção", estado: "ligado", numeros: [] }, { lixo: 1 }],
        },
      },
    ]);
    expect(m.rodada?.em).toEqual(agora);
    expect(m.ultimoSinalDoHunter?.toISOString()).toBe("2026-10-02T13:58:00.000Z");
    expect(m.statusDoHunter?.automacoes.map((a) => a.id)).toEqual(["hunter-dms"]);
    expect(m.statusDoHunter?.geradoEm).toBe("2026-10-02T13:57:00.000Z");
  });

  it("sem marcadores: tudo vazio", () => {
    expect(lerMarcadores([])).toEqual({ rodada: null, ultimoSinalDoHunter: null, statusDoHunter: null });
  });
});
