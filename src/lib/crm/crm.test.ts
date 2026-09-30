import { describe, expect, it } from "vitest";
import { PESOS_PADRAO, resolverPesos } from "./pesos";
import { aplicarEvento, temperaturaDe, type EstadoLead, type EventoCrm } from "./regras";
import { registrarInteracao, type CrmDb } from "./registrar";
import { etapaDe } from "./tipos";

const AGORA = new Date("2026-10-05T12:00:00Z");
const hora = (h: number) => new Date(AGORA.getTime() + h * 3_600_000);

function leadVazio(over: Partial<EstadoLead> = {}): EstadoLead {
  return {
    etapa: "qualificado",
    temperatura: "frio",
    pontos: 0,
    cadencia: { pausada: false, motivoPausa: null, proximoCanal: null, canaisEncerrados: [], movidoManualEm: null },
    statusEntrega: { email: "nao_enviado", whatsapp: "nao_enviado", dm: "nao_enviada", linkedin: "nao_enviado" },
    origem: {
      primeiroToqueCanal: null,
      primeiroToqueEm: null,
      ultimoToqueCanal: null,
      ultimoToqueRotulo: null,
      reuniaoCanal: null,
      reuniaoToque: null,
      vendaCanal: null,
      vendaToque: null,
    },
    optOut: false,
    ...over,
  };
}

/** Banco em memória: um lead e a lista de interações. */
function bancoFake(lead: EstadoLead) {
  const estado = { lead, interacoes: [] as { tipo: string; pontos: number; data: Date; chave?: string }[] };
  const db: CrmDb = {
    carregarLead: async (id) => (id === 1 ? estado.lead : null),
    pesos: async () => PESOS_PADRAO,
    interacoesDesde: async (_id, desde) => estado.interacoes.filter((i) => i.data >= desde),
    existeChave: async (c) => estado.interacoes.some((i) => i.chave === c),
    criarInteracao: async (d) => {
      estado.interacoes.push({ tipo: d.tipo, pontos: d.pontos, data: d.data, chave: d.chave });
      return estado.interacoes.length;
    },
    salvarLead: async (_id, l) => {
      estado.lead = l;
    },
  };
  return { db, estado };
}

const ev = (over: Partial<EventoCrm>): EventoCrm => ({
  canal: "email",
  direcao: "saida",
  tipo: "enviado",
  data: AGORA,
  ...over,
});
const ctx = (over = {}) => ({ pesos: PESOS_PADRAO, aberturasNaJanela: 0, pontosNaJanela: 0, agora: AGORA, ...over });

describe("pontos e temperatura", () => {
  it("usa os pesos do plano", () => {
    const p = (tipo: EventoCrm["tipo"], canal: EventoCrm["canal"] = "email", metadados?: Record<string, unknown>) =>
      aplicarEvento(leadVazio(), ev({ tipo, canal, direcao: "entrada", metadados }), ctx()).pontos;
    expect(p("aberto")).toBe(1);
    expect(p("clicado")).toBe(3);
    expect(p("deu_play")).toBe(4);
    expect(p("abriu_pagina", "sistema", { destino: "material" })).toBe(3);
    expect(p("abriu_pagina", "sistema", { destino: "blog" })).toBe(3);
    expect(p("abriu_pagina", "sistema", { destino: "diagnostico" })).toBe(5);
    expect(p("abriu_pagina", "sistema", { destino: "conversa" })).toBe(0);
    expect(p("lido", "whatsapp")).toBe(1);
    expect(p("lido", "dm")).toBe(0);
    expect(p("respondido")).toBe(0);
  });

  it("conta no máximo 2 aberturas na janela", () => {
    const r = aplicarEvento(leadVazio({ pontos: 2 }), ev({ tipo: "aberto", direcao: "entrada" }), ctx({ aberturasNaJanela: 2, pontosNaJanela: 2 }));
    expect(r.pontos).toBe(0);
    expect(r.lead.pontos).toBe(2);
  });

  it("evento fora da janela de 7 dias não pontua", () => {
    const velho = ev({ tipo: "clicado", direcao: "entrada", data: hora(-24 * 8) });
    expect(aplicarEvento(leadVazio(), velho, ctx()).pontos).toBe(0);
  });

  it("temperatura: frio, morno, engajado a partir de 5", () => {
    expect(temperaturaDe(0, PESOS_PADRAO)).toBe("frio");
    expect(temperaturaDe(4, PESOS_PADRAO)).toBe("morno");
    expect(temperaturaDe(5, PESOS_PADRAO)).toBe("engajado");
  });

  it("pesos editados no admin valem, valor nulo cai no padrão", () => {
    const p = resolverPesos({ clique: 10, video: null, janelaDias: 0 });
    expect(p.clique).toBe(10);
    expect(p.video).toBe(4);
    expect(p.janelaDias).toBe(7);
  });
});

describe("transições de etapa", () => {
  it("envio move Qualificado para Em cadência e marca o primeiro toque", () => {
    const r = aplicarEvento(leadVazio(), ev({ canal: "dm", tipo: "enviado", metadados: { toque: "dm1" } }), ctx());
    expect(r.lead.etapa).toBe("em_cadencia");
    expect(r.lead.statusEntrega.dm).toBe("enviada");
    expect(r.lead.origem.primeiroToqueCanal).toBe("dm");
    expect(r.lead.origem.ultimoToqueRotulo).toBe("dm1");
    expect(r.movimento).toEqual({ de: "qualificado", para: "em_cadencia", automatico: true });
  });

  it("valor legado em_andamento conta como Qualificado", () => {
    expect(etapaDe("em_andamento")).toBe("qualificado");
    expect(etapaDe("perdido")).toBe("nutricao_continua");
    expect(etapaDe(null)).toBe("qualificado");
  });

  it("5 pontos movem para Engajado", () => {
    const lead = leadVazio({ etapa: "em_cadencia", pontos: 2 });
    const r = aplicarEvento(lead, ev({ tipo: "clicado", direcao: "entrada" }), ctx({ pontosNaJanela: 2 }));
    expect(r.lead.temperatura).toBe("engajado");
    expect(r.lead.etapa).toBe("engajado");
  });

  it("engajamento não puxa para trás quem já respondeu", () => {
    const lead = leadVazio({ etapa: "respondeu" });
    const r = aplicarEvento(lead, ev({ tipo: "deu_play", direcao: "entrada", canal: "sistema" }), ctx({ pontosNaJanela: 3 }));
    expect(r.lead.etapa).toBe("respondeu");
  });

  it("resposta move para Respondeu e pausa a cadência em todos os canais", () => {
    const lead = leadVazio({ etapa: "em_cadencia" });
    const r = aplicarEvento(lead, ev({ canal: "dm", direcao: "entrada", tipo: "respondido" }), ctx());
    expect(r.lead.etapa).toBe("respondeu");
    expect(r.lead.cadencia.pausada).toBe(true);
    expect(r.lead.cadencia.motivoPausa).toBe("resposta");
  });

  it("agendou move para Reunião marcada e guarda o toque de origem", () => {
    const lead = leadVazio({ etapa: "engajado", origem: { ...leadVazio().origem, ultimoToqueCanal: "email", ultimoToqueRotulo: "email1" } });
    const r = aplicarEvento(lead, ev({ canal: "sistema", direcao: "entrada", tipo: "agendou" }), ctx());
    expect(r.lead.etapa).toBe("reuniao_marcada");
    expect(r.lead.origem.reuniaoCanal).toBe("email");
    expect(r.lead.origem.reuniaoToque).toBe("email1");
    expect(r.lead.cadencia.pausada).toBe(true);
  });

  it("descadastro move para Saiu da lista e marca opt-out", () => {
    const r = aplicarEvento(leadVazio({ etapa: "engajado" }), ev({ direcao: "entrada", tipo: "descadastro" }), ctx());
    expect(r.lead.etapa).toBe("saiu_da_lista");
    expect(r.lead.optOut).toBe(true);
    expect(r.lead.cadencia.pausada).toBe(true);
  });

  it("descadastro por resposta classificada sai da lista; quem já é Ganho não muda de etapa", () => {
    const a = aplicarEvento(leadVazio(), ev({ direcao: "entrada", tipo: "respondido", metadados: { intencao: "descadastro" } }), ctx());
    expect(a.lead.etapa).toBe("saiu_da_lista");
    const g = aplicarEvento(leadVazio({ etapa: "ganho" }), ev({ direcao: "entrada", tipo: "respondido" }), ctx());
    expect(g.lead.etapa).toBe("ganho");
  });

  it("'não é o momento' vai para Nutrição contínua, nunca Perdido", () => {
    const r = aplicarEvento(leadVazio({ etapa: "em_cadencia" }), ev({ direcao: "entrada", tipo: "respondido", metadados: { intencao: "nao_agora" } }), ctx());
    expect(r.lead.etapa).toBe("nutricao_continua");
    expect(r.lead.cadencia.pausada).toBe(true);
  });

  it("quem está em Nutrição contínua volta a Respondeu se responder", () => {
    const r = aplicarEvento(leadVazio({ etapa: "nutricao_continua" }), ev({ direcao: "entrada", tipo: "respondido" }), ctx());
    expect(r.lead.etapa).toBe("respondeu");
  });
});

describe("movimento manual", () => {
  it("registra a etapa, o instante e pausa a cadência", () => {
    const r = aplicarEvento(leadVazio({ etapa: "em_cadencia" }), ev({ canal: "nota", tipo: "movimento_manual", metadados: { para: "reuniao_feita" } }), ctx());
    expect(r.lead.etapa).toBe("reuniao_feita");
    expect(r.lead.cadencia.movidoManualEm).toEqual(AGORA);
    expect(r.lead.cadencia.pausada).toBe(true);
    expect(r.movimento?.automatico).toBe(false);
  });

  it("arrastar para Ganho grava o toque que gerou a venda", () => {
    const lead = leadVazio({ etapa: "proposta_enviada", origem: { ...leadVazio().origem, reuniaoCanal: "dm", reuniaoToque: "dm2" } });
    const r = aplicarEvento(lead, ev({ canal: "nota", tipo: "movimento_manual", metadados: { para: "ganho" } }), ctx());
    expect(r.lead.origem.vendaCanal).toBe("dm");
    expect(r.lead.origem.vendaToque).toBe("dm2");
  });

  it("etapa inválida é ignorada", () => {
    const r = aplicarEvento(leadVazio(), ev({ canal: "nota", tipo: "movimento_manual", metadados: { para: "xpto" } }), ctx());
    expect(r.lead.etapa).toBe("qualificado");
    expect(r.lead.cadencia.movidoManualEm).toBeNull();
  });

  it("evento fraco não desfaz o arraste manual (envio e pontos)", () => {
    const lead = leadVazio({ etapa: "qualificado", cadencia: { ...leadVazio().cadencia, movidoManualEm: hora(-1) } });
    const envio = aplicarEvento(lead, ev({ canal: "dm", tipo: "enviado" }), ctx());
    expect(envio.lead.etapa).toBe("qualificado");
    const pontos = aplicarEvento(lead, ev({ tipo: "clicado", direcao: "entrada" }), ctx({ pontosNaJanela: 4 }));
    expect(pontos.lead.etapa).toBe("qualificado");
  });

  it("fato novo depois do arraste (resposta) vale; fato mais antigo que o arraste não", () => {
    const lead = leadVazio({ etapa: "qualificado", cadencia: { ...leadVazio().cadencia, movidoManualEm: AGORA } });
    const velho = aplicarEvento(lead, ev({ direcao: "entrada", tipo: "respondido", data: hora(-2) }), ctx());
    expect(velho.lead.etapa).toBe("qualificado");
    const novo = aplicarEvento(lead, ev({ direcao: "entrada", tipo: "respondido", data: hora(1) }), ctx());
    expect(novo.lead.etapa).toBe("respondeu");
  });
});

describe("falha definitiva de canal", () => {
  it("número sem WhatsApp sai da cadência do WhatsApp", () => {
    const lead = leadVazio({ cadencia: { ...leadVazio().cadencia, proximoCanal: "whatsapp" } });
    const r = aplicarEvento(lead, ev({ canal: "whatsapp", tipo: "falha", metadados: { motivo: "sem_whatsapp" } }), ctx());
    expect(r.lead.statusEntrega.whatsapp).toBe("sem_whatsapp");
    expect(r.lead.cadencia.canaisEncerrados).toEqual(["whatsapp"]);
    expect(r.lead.cadencia.proximoCanal).toBeNull();
  });

  it("bounce permanente encerra o e-mail; bounce temporário não", () => {
    const perm = aplicarEvento(leadVazio(), ev({ tipo: "bounce" }), ctx());
    expect(perm.lead.statusEntrega.email).toBe("devolvido");
    expect(perm.lead.cadencia.canaisEncerrados).toContain("email");
    const temp = aplicarEvento(leadVazio(), ev({ tipo: "bounce", metadados: { temporario: true } }), ctx());
    expect(temp.lead.cadencia.canaisEncerrados).toEqual([]);
  });

  it("DM sem botão de mensagem encerra a DM; falha comum só marca", () => {
    const sem = aplicarEvento(leadVazio(), ev({ canal: "dm", tipo: "falha", metadados: { motivo: "sem_botao_mensagem" } }), ctx());
    expect(sem.lead.statusEntrega.dm).toBe("falhou");
    expect(sem.lead.cadencia.canaisEncerrados).toEqual(["dm"]);
    const comum = aplicarEvento(leadVazio(), ev({ canal: "dm", tipo: "falha" }), ctx());
    expect(comum.lead.cadencia.canaisEncerrados).toEqual([]);
  });

  it("falha definitiva não é desfeita por evento posterior", () => {
    const lead = leadVazio({ statusEntrega: { ...leadVazio().statusEntrega, email: "devolvido" } });
    const r = aplicarEvento(lead, ev({ tipo: "entregue" }), ctx());
    expect(r.lead.statusEntrega.email).toBe("devolvido");
  });
});

describe("status de entrega", () => {
  it("nunca anda para trás", () => {
    const lead = leadVazio({ statusEntrega: { ...leadVazio().statusEntrega, email: "clicado" } });
    const r = aplicarEvento(lead, ev({ tipo: "aberto", direcao: "entrada" }), ctx());
    expect(r.lead.statusEntrega.email).toBe("clicado");
  });

  it("DM vista e WhatsApp lido", () => {
    expect(aplicarEvento(leadVazio(), ev({ canal: "dm", tipo: "lido", direcao: "entrada" }), ctx()).lead.statusEntrega.dm).toBe("vista");
    expect(aplicarEvento(leadVazio(), ev({ canal: "whatsapp", tipo: "lido", direcao: "entrada" }), ctx()).lead.statusEntrega.whatsapp).toBe("lido");
  });

  it("não muta o estado de entrada", () => {
    const lead = leadVazio();
    aplicarEvento(lead, ev({ canal: "dm", tipo: "enviado" }), ctx());
    expect(lead.etapa).toBe("qualificado");
    expect(lead.statusEntrega.dm).toBe("nao_enviada");
  });
});

describe("registrarInteracao", () => {
  it("grava a interação com os pontos e atualiza o lead", async () => {
    const { db, estado } = bancoFake(leadVazio({ etapa: "em_cadencia" }));
    const r = await registrarInteracao(db, { leadId: 1, canal: "email", direcao: "entrada", tipo: "clicado", data: AGORA }, AGORA);
    expect(r).toMatchObject({ ok: true, pontos: 3 });
    expect(estado.interacoes).toHaveLength(1);
    expect(estado.lead.pontos).toBe(3);
    expect(estado.lead.temperatura).toBe("morno");
  });

  it("soma na janela de 7 dias e vira Engajado; interação velha sai da soma", async () => {
    const { db, estado } = bancoFake(leadVazio({ etapa: "em_cadencia" }));
    estado.interacoes.push({ tipo: "clicado", pontos: 3, data: hora(-24 * 10) }); // fora da janela
    estado.interacoes.push({ tipo: "deu_play", pontos: 4, data: hora(-24 * 2) });
    const r = await registrarInteracao(db, { leadId: 1, canal: "email", direcao: "entrada", tipo: "aberto", data: AGORA }, AGORA);
    expect(r.ok && r.pontos).toBe(1);
    expect(estado.lead.pontos).toBe(5);
    expect(estado.lead.etapa).toBe("engajado");
  });

  it("teto de 2 aberturas vale entre chamadas", async () => {
    const { db, estado } = bancoFake(leadVazio({ etapa: "em_cadencia" }));
    for (let i = 0; i < 4; i++) {
      await registrarInteracao(db, { leadId: 1, canal: "email", direcao: "entrada", tipo: "aberto", data: hora(i) }, AGORA);
    }
    expect(estado.lead.pontos).toBe(2);
  });

  it("resposta pausa a cadência", async () => {
    const { db, estado } = bancoFake(leadVazio({ etapa: "em_cadencia" }));
    await registrarInteracao(db, { leadId: 1, canal: "dm", direcao: "entrada", tipo: "respondido", conteudo: "Oi, pode ser terça" }, AGORA);
    expect(estado.lead.etapa).toBe("respondeu");
    expect(estado.lead.cadencia.pausada).toBe(true);
  });

  it("chave repetida não grava de novo; lead inexistente é recusado", async () => {
    const { db, estado } = bancoFake(leadVazio());
    const a = await registrarInteracao(db, { leadId: 1, canal: "dm", direcao: "saida", tipo: "enviado", chave: "m1" }, AGORA);
    const b = await registrarInteracao(db, { leadId: 1, canal: "dm", direcao: "saida", tipo: "enviado", chave: "m1" }, AGORA);
    expect(a.ok).toBe(true);
    expect(b).toEqual({ ok: false, motivo: "duplicado" });
    expect(estado.interacoes).toHaveLength(1);
    expect(await registrarInteracao(db, { leadId: 99, canal: "dm", direcao: "saida", tipo: "enviado" }, AGORA)).toEqual({ ok: false, motivo: "lead_nao_encontrado" });
  });

  it("movimento manual registrado vale contra automático posterior fraco", async () => {
    const { db, estado } = bancoFake(leadVazio({ etapa: "em_cadencia" }));
    await registrarInteracao(db, { leadId: 1, canal: "nota", direcao: "saida", tipo: "movimento_manual", metadados: { para: "qualificado" }, data: AGORA }, AGORA);
    await registrarInteracao(db, { leadId: 1, canal: "dm", direcao: "saida", tipo: "enviado", data: hora(1) }, hora(1));
    expect(estado.lead.etapa).toBe("qualificado");
  });
});
