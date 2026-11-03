import { describe, expect, it } from "vitest";
import { agruparTarefas, filtrarTarefas, situacaoDe, tarefasDoDia, tarefasDoLead, tipoDoTexto, type ItemTarefa } from "./tarefas";
import { planejarAcao } from "./acoes";

// Quarta, 04/11/2026, 10h de Brasília.
const agora = new Date("2026-11-04T13:00:00.000Z");

const item = (chave: string, over: Partial<ItemTarefa> = {}): ItemTarefa => ({
  chave,
  leadId: 1,
  lead: "Ana Souza",
  empresa: "Padaria Sol",
  tipo: "tarefa",
  titulo: "Ligar de novo",
  venceEm: null,
  concluidaEm: null,
  origem: "manual",
  ...over,
});

describe("tarefas do CRM", () => {
  it("situação: concluída, atrasada (vencida antes de agora) ou pendente", () => {
    expect(situacaoDe({ venceEm: "2026-11-04T12:00:00.000Z", concluidaEm: null }, agora)).toBe("atrasada");
    expect(situacaoDe({ venceEm: "2026-11-04T14:00:00.000Z", concluidaEm: null }, agora)).toBe("pendente");
    expect(situacaoDe({ venceEm: null, concluidaEm: null }, agora)).toBe("pendente");
    expect(situacaoDe({ venceEm: "2026-11-01T12:00:00.000Z", concluidaEm: "2026-11-02T12:00:00.000Z" }, agora)).toBe("concluida");
  });

  it("tipo pelo texto do próximo passo", () => {
    expect(tipoDoTexto("Reunião de 20 min")).toBe("reuniao");
    expect(tipoDoTexto("Enviar resumo e proposta")).toBe("email");
    expect(tipoDoTexto("ligar na sexta")).toBe("ligacao");
    expect(tipoDoTexto("Follow-up da proposta (D2, D5 e D10)")).toBe("email");
    expect(tipoDoTexto(null)).toBe("tarefa");
  });

  it("lê o próximo passo e o toque da cadência do lead; cadência pausada não entra", () => {
    const lead = { id: 7, nome: "Bia", empresa: null, proximoPasso: "Reunião de 20 min", proximoPassoEm: "2026-11-05T13:00:00.000Z", proximoCanal: "ligacao", proximoToqueEm: "2026-11-04T12:00:00.000Z", pausada: false };
    const [pp, cad] = tarefasDoLead(lead);
    expect(pp).toMatchObject({ chave: "pp7", tipo: "reuniao", origem: "proximo_passo" });
    expect(cad).toMatchObject({ chave: "c7", tipo: "ligacao", origem: "cadencia" });
    expect(tarefasDoLead({ ...lead, proximoPasso: null, proximoPassoEm: null, pausada: true })).toEqual([]);
  });

  it("filtra por situação, tipo, período (vencimento), busca e toques automáticos", () => {
    const lista = [
      item("a", { venceEm: "2026-11-03T13:00:00.000Z", tipo: "ligacao" }),
      item("b", { venceEm: "2026-11-06T13:00:00.000Z", tipo: "email", lead: "Carlos" }),
      item("c", { venceEm: "2026-11-01T13:00:00.000Z", concluidaEm: "2026-11-02T13:00:00.000Z" }),
      item("d", { venceEm: "2026-11-04T15:00:00.000Z", origem: "cadencia", tipo: "dm" }),
    ];
    const chaves = (f: Parameters<typeof filtrarTarefas>[1]) => filtrarTarefas(lista, f, agora).map((t) => t.chave);
    expect(chaves({})).toEqual(["a", "b", "d"]);
    expect(chaves({ situacao: "atrasadas" })).toEqual(["a"]);
    expect(chaves({ situacao: "concluidas" })).toEqual(["c"]);
    expect(chaves({ situacao: "todas", tipos: ["email", "ligacao"] })).toEqual(["a", "b"]);
    expect(chaves({ periodo: "hoje" })).toEqual(["d"]);
    expect(chaves({ automaticos: false })).toEqual(["a", "b"]);
    expect(chaves({ busca: "carlos" })).toEqual(["b"]);
  });

  it("Fila do dia: pendentes até o fim de hoje, sem cadência nem reunião do próximo passo", () => {
    const lista = [
      item("amanha", { venceEm: "2026-11-05T13:00:00.000Z" }),
      item("hoje", { venceEm: "2026-11-04T22:00:00.000Z" }),
      item("velha", { venceEm: "2026-11-01T13:00:00.000Z" }),
      item("feita", { venceEm: "2026-11-01T13:00:00.000Z", concluidaEm: "2026-11-02T13:00:00.000Z" }),
      item("cad", { venceEm: "2026-11-04T12:00:00.000Z", origem: "cadencia" }),
      item("reuniao", { venceEm: "2026-11-04T17:00:00.000Z", origem: "proximo_passo", tipo: "reuniao" }),
      item("proposta", { venceEm: "2026-11-04T17:00:00.000Z", origem: "proximo_passo", tipo: "email" }),
      item("sem"),
    ];
    expect(tarefasDoDia(lista, agora).map((t) => t.chave)).toEqual(["velha", "proposta", "hoje"]);
  });

  it("agrupa em Atrasadas, Hoje, Amanhã, data, Sem data e Concluídas", () => {
    const grupos = agruparTarefas(
      [
        item("sem"),
        item("amanha", { venceEm: "2026-11-05T13:00:00.000Z" }),
        item("feita", { concluidaEm: "2026-11-02T13:00:00.000Z" }),
        item("hoje", { venceEm: "2026-11-04T20:00:00.000Z" }),
        item("velha", { venceEm: "2026-11-01T13:00:00.000Z" }),
        item("depois", { venceEm: "2026-11-10T13:00:00.000Z" }),
      ],
      agora,
    );
    expect(grupos.map((g) => [g.rotulo, g.itens.map((i) => i.chave)])).toEqual([
      ["Atrasadas", ["velha"]],
      ["Hoje", ["hoje"]],
      ["Amanhã", ["amanha"]],
      ["10/11", ["depois"]],
      ["Sem data", ["sem"]],
      ["Concluídas", ["feita"]],
    ]);
  });
});

describe("ações de tarefa (planejarAcao)", () => {
  it("criar valida texto, tipo e data", () => {
    expect(planejarAcao({ acao: "tarefa_criar", leadId: 1, tipo: "ligacao", titulo: "  Ligar  ", venceEm: "2026-11-05T13:00:00.000Z" }, "qualificado")).toMatchObject({
      ok: true,
      tarefa: { op: "criar", tipo: "ligacao", titulo: "Ligar", venceEm: "2026-11-05T13:00:00.000Z" },
    });
    expect(planejarAcao({ acao: "tarefa_criar", leadId: 1, tipo: "ligacao", titulo: " " }, "qualificado").ok).toBe(false);
    expect(planejarAcao({ acao: "tarefa_criar", leadId: 1, tipo: "fax", titulo: "x" }, "qualificado").ok).toBe(false);
    expect(planejarAcao({ acao: "tarefa_criar", leadId: 1, tipo: "email", titulo: "x", venceEm: "amanhã" }, "qualificado").ok).toBe(false);
  });

  it("concluir e reagendar: tarefa da coleção ou o próximo passo do lead", () => {
    expect(planejarAcao({ acao: "tarefa_concluir", leadId: 1, tarefaId: 9 }, "qualificado")).toMatchObject({ ok: true, lead: {}, tarefa: { op: "concluir", tarefaId: 9 } });
    expect(planejarAcao({ acao: "tarefa_concluir", leadId: 1 }, "qualificado")).toMatchObject({
      ok: true,
      lead: { proximoPasso: null, proximoPassoEm: null },
      tarefa: { op: "historico_proximo_passo" },
    });
    expect(planejarAcao({ acao: "tarefa_reagendar", leadId: 1, venceEm: "2026-11-06T13:00:00.000Z" }, "qualificado")).toEqual({
      ok: true,
      interacoes: [],
      lead: { proximoPassoEm: "2026-11-06T13:00:00.000Z" },
    });
    expect(planejarAcao({ acao: "tarefa_reagendar", leadId: 1, tarefaId: -1, venceEm: "2026-11-06T13:00:00.000Z" }, "qualificado").ok).toBe(false);
  });
});
