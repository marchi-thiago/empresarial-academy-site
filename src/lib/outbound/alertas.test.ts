import { describe, expect, it, vi } from "vitest";
import {
  avaliarAlertas,
  emHorarioComercial,
  verificarAlertas,
  type DadosAvaliacaoAlertas,
} from "./alertas";
import type { Deps, LeadCandidato, OutboundDb } from "./orquestrador";
import { emBrasilia } from "./tempo";
import { PESOS_PADRAO } from "@/lib/crm/pesos";

describe("emHorarioComercial", () => {
  it("reconhece dia útil em horário comercial (segunda a sexta, 8h às 18h)", () => {
    // 2026-10-05 é segunda-feira
    expect(emHorarioComercial(emBrasilia("2026-10-05", "08:00"))).toBe(true);
    expect(emHorarioComercial(emBrasilia("2026-10-05", "14:30"))).toBe(true);
    expect(emHorarioComercial(emBrasilia("2026-10-05", "17:59"))).toBe(true);
  });

  it("rejeita fora do horário ou fim de semana", () => {
    // Segunda-feira fora do horário
    expect(emHorarioComercial(emBrasilia("2026-10-05", "07:59"))).toBe(false);
    expect(emHorarioComercial(emBrasilia("2026-10-05", "18:00"))).toBe(false);
    expect(emHorarioComercial(emBrasilia("2026-10-05", "23:00"))).toBe(false);

    // 2026-10-03 é sábado, 2026-10-04 é domingo
    expect(emHorarioComercial(emBrasilia("2026-10-03", "14:00"))).toBe(false);
    expect(emHorarioComercial(emBrasilia("2026-10-04", "14:00"))).toBe(false);
  });
});

describe("avaliarAlertas (regras puras)", () => {
  const baseDados = (agora: Date): DadosAvaliacaoAlertas => ({
    agora,
    emHorarioComercial: true,
    ultimoHeartbeat: new Date(agora.getTime() - 10 * 60_000), // 10 min atrás (ok)
    ultimaSync: new Date(agora.getTime() - 60 * 60_000), // 1h atrás (ok)
    enviosHoje: 20,
    bouncesHoje: 0,
    leadsTravados: 0,
    tetoIaAtingido: false,
  });

  it("não dispara alertas quando tudo está saudável", () => {
    const agora = emBrasilia("2026-10-05", "10:00");
    const alertas = avaliarAlertas(baseDados(agora));
    expect(alertas).toEqual([]);
  });

  it("dispara alerta de sem sinal de vida se heartbeat > 30 min em horário comercial", () => {
    const agora = emBrasilia("2026-10-05", "10:00");
    const dados = {
      ...baseDados(agora),
      ultimoHeartbeat: new Date(agora.getTime() - 35 * 60_000), // 35 min atrás
    };

    const alertas = avaliarAlertas(dados);
    expect(alertas.some((a) => a.tipo === "sem_sinal_hunter")).toBe(true);
    expect(alertas.find((a) => a.tipo === "sem_sinal_hunter")?.severidade).toBe("critica");
  });

  it("não dispara alerta de sem sinal de vida fora do horário comercial", () => {
    const agora = emBrasilia("2026-10-05", "20:00");
    const dados = {
      ...baseDados(agora),
      emHorarioComercial: false,
      ultimoHeartbeat: new Date(agora.getTime() - 120 * 60_000),
    };

    const alertas = avaliarAlertas(dados);
    expect(alertas.some((a) => a.tipo === "sem_sinal_hunter")).toBe(false);
  });

  it("dispara alerta de falha de sincronização se sync > 3h em horário comercial", () => {
    const agora = emBrasilia("2026-10-05", "14:00");
    const dados = {
      ...baseDados(agora),
      ultimaSync: new Date(agora.getTime() - 4 * 3_600_000), // 4h atrás
    };

    const alertas = avaliarAlertas(dados);
    expect(alertas.some((a) => a.tipo === "falha_sync_hunter")).toBe(true);
  });

  it("sem nenhum dado de sincronização não alarma (o Hunter ainda não informou)", () => {
    const agora = emBrasilia("2026-10-05", "14:00");
    const alertas = avaliarAlertas({ ...baseDados(agora), ultimaSync: null });
    expect(alertas.some((a) => a.tipo === "falha_sync_hunter")).toBe(false);
  });

  it("dispara alerta de bounce se >= 2 bounces e taxa > 3%", () => {
    const agora = emBrasilia("2026-10-05", "11:00");
    // 50 envios, 3 bounces = 6% (> 3%)
    const dados = {
      ...baseDados(agora),
      enviosHoje: 50,
      bouncesHoje: 3,
    };

    const alertas = avaliarAlertas(dados);
    const a = alertas.find((x) => x.tipo === "bounce_alto");
    expect(a).toBeDefined();
    expect(a?.mensagem).toContain("Taxa de bounce de e-mail em 6.0%");
  });

  it("o alerta de bounce usa a mesma regra que pausa o envio do dia (acima de 3% com 10 envios ou mais)", () => {
    const agora = emBrasilia("2026-10-05", "11:00");
    expect(avaliarAlertas({ ...baseDados(agora), enviosHoje: 100, bouncesHoje: 3 }).some((x) => x.tipo === "bounce_alto")).toBe(false); // 3% exato não passa
    expect(avaliarAlertas({ ...baseDados(agora), enviosHoje: 100, bouncesHoje: 4 }).some((x) => x.tipo === "bounce_alto")).toBe(true);
    expect(avaliarAlertas({ ...baseDados(agora), enviosHoje: 10, bouncesHoje: 1 }).some((x) => x.tipo === "bounce_alto")).toBe(true);
  });

  it("não dispara alerta de bounce se houve apenas 1 bounce isolado", () => {
    const agora = emBrasilia("2026-10-05", "11:00");
    const dados = {
      ...baseDados(agora),
      enviosHoje: 5,
      bouncesHoje: 1, // 20%, mas só 1 bounce
    };

    const alertas = avaliarAlertas(dados);
    expect(alertas.some((x) => x.tipo === "bounce_alto")).toBe(false);
  });

  it("dispara alerta de fila travada quando há leads atrasados > 48h", () => {
    const agora = emBrasilia("2026-10-05", "11:00");
    const dados = {
      ...baseDados(agora),
      leadsTravados: 5,
    };

    const alertas = avaliarAlertas(dados);
    const a = alertas.find((x) => x.tipo === "fila_travada");
    expect(a).toBeDefined();
    expect(a?.mensagem).toContain("5 lead(s) em cadência estão com o e-mail atrasado há mais de 48 horas");
  });

  it("dispara alerta de teto de IA atingido", () => {
    const agora = emBrasilia("2026-10-05", "11:00");
    const dados = {
      ...baseDados(agora),
      tetoIaAtingido: true,
      chamadasIa: 300,
      tetoIa: 300,
    };

    const alertas = avaliarAlertas(dados);
    const a = alertas.find((x) => x.tipo === "teto_ia_hunter");
    expect(a).toBeDefined();
    expect(a?.mensagem).toContain("300 de 300");
  });
});

describe("verificarAlertas (fluxo de orquestração e cooldown)", () => {
  function fakeDb(
    overrides: Partial<OutboundDb> = {},
    marcadoresIniciais: Record<string, Record<string, unknown>> = {}
  ): OutboundDb {
    const marcadores = new Map<string, Record<string, unknown>>(Object.entries(marcadoresIniciais));

    return {
      candidatos: async () => [],
      historico: async () => new Map(),
      suprimidos: async () => new Set(),
      enviosDeEmail: async () => [],
      bouncesDeEmail: async () => 0,
      conteudoDoLead: async () => null,
      gravarAgenda: async () => {},
      lerMarcador: async (chave: string) => marcadores.get(chave) ?? null,
      criarMarcador: async (chave: string, meta: Record<string, unknown>) => {
        if (marcadores.has(chave)) return false;
        marcadores.set(chave, meta);
        return true;
      },
      gravarMarcador: async (chave: string, meta: Record<string, unknown>, data?: Date) => {
        marcadores.set(chave, { ...meta, data: (data ?? new Date()).toISOString() });
      },
      gravarSimulado: async () => true,
      registrarBloqueio: async () => {},
      logEmail: async () => {},
      recalcularTemperaturas: async () => 0,
      pesos: async () => ({ ...PESOS_PADRAO }),
      partesFixas: async () => ({ assinatura: "", rodape: "", material: "" }),
      leadsParaAgenda: async () => [],
      definirReuniao: async () => {},
      ...overrides,
    };
  }

  function fakeDeps(db: OutboundDb, agora: Date, avisarFn: (t: string) => Promise<boolean>, env: Record<string, string | undefined> = {}): Deps {
    return {
      db,
      crm: {} as never,
      enviar: async () => ({}),
      agenda: async () => null,
      lerCaixa: async () => [],
      urlDescadastro: () => "",
      agora,
      rand: () => 0.5,
      env,
      avisar: avisarFn,
    };
  }

  it("notifica o Thiago no primeiro disparo e respeita o cooldown no ciclo seguinte", async () => {
    const agora = emBrasilia("2026-10-05", "10:00");
    const avisos: string[] = [];
    const avisarFn = vi.fn(async (t: string) => {
      avisos.push(t);
      return true;
    });

    const db = fakeDb(
      {},
      {
        "sistema:heartbeat:hunter": {
          recebidoEm: new Date(agora.getTime() - 40 * 60_000).toISOString(),
        },
        "sistema:sync:hunter": {
          ultimaSincronizacao: agora.toISOString(),
        },
      }
    );

    const deps = fakeDeps(db, agora, avisarFn);

    // 1º ciclo: dispara e envia o aviso
    const r1 = await verificarAlertas(deps, { avisarFn });
    expect(r1.disparados.some((d) => d.tipo === "sem_sinal_hunter")).toBe(true);
    expect(r1.notificados).toContain("sem_sinal_hunter");
    expect(avisarFn).toHaveBeenCalledTimes(1);

    // 2º ciclo (10 min depois, ainda sem sinal): continua disparando mas NÃO envia outro WhatsApp (cooldown)
    const agora10mDepois = new Date(agora.getTime() + 10 * 60_000);
    const deps2 = fakeDeps(db, agora10mDepois, avisarFn);
    const r2 = await verificarAlertas(deps2, { avisarFn });

    expect(r2.disparados.some((d) => d.tipo === "sem_sinal_hunter")).toBe(true);
    expect(r2.notificados).toHaveLength(0); // Cooldown barrou
    expect(avisarFn).toHaveBeenCalledTimes(1); // Manteve 1 chamada
  });

  it("detecta leads travados a partir da lista de candidatos", async () => {
    const agora = emBrasilia("2026-10-05", "10:00");
    const avisarFn = vi.fn(async () => true);

    const leadTravado: LeadCandidato = {
      id: 101,
      nome: "Lead Travado",
      empresa: "Empresa X",
      email: "x@empresa.com",
      instagram: "empresax",
      whatsapp: "11999999999",
      etapa: "em_cadencia",
      temperatura: "frio",
      pausada: false,
      optOut: false,
      canaisEncerrados: [],
      statusEntrega: { email: "nao_enviado", whatsapp: "nao_enviado", dm: "nao_enviada", linkedin: "nao_enviado" },
      primeiroToqueEm: new Date(agora.getTime() - 72 * 3_600_000),
      linkedinDecisor: false,
      agendaGravada: {
        canal: "email",
        em: new Date(agora.getTime() - 50 * 3_600_000), // Atrasado há 50h (> 48h)
        etapaAtual: "d1_email1",
      },
    };

    const db = fakeDb(
      {
        candidatos: async () => [leadTravado],
      },
      {
        "sistema:heartbeat:hunter": { recebidoEm: agora.toISOString() },
        "sistema:sync:hunter": { ultimaSincronizacao: agora.toISOString() },
      }
    );

    // Em simulação (envio real desligado) o e-mail nunca sai: não é fila travada.
    const simulando = await verificarAlertas(fakeDeps(db, agora, avisarFn), { avisarFn });
    expect(simulando.disparados.some((d) => d.tipo === "fila_travada")).toBe(false);

    const deps = fakeDeps(db, agora, avisarFn, { OUTBOUND_ENVIO_REAL: "email" });
    const r = await verificarAlertas(deps, { avisarFn });

    expect(r.disparados.some((d) => d.tipo === "fila_travada")).toBe(true);
    expect(r.notificados).toContain("fila_travada");
  });

  it("o cooldown vale por tipo: depois de 4h volta a avisar o sinal de vida", async () => {
    const agora = emBrasilia("2026-10-05", "09:00");
    const avisarFn = vi.fn(async () => true);
    const db = fakeDb({}, { "sistema:heartbeat:hunter": { recebidoEm: new Date(agora.getTime() - 3_600_000).toISOString() } });
    await verificarAlertas(fakeDeps(db, agora, avisarFn), { avisarFn });
    await verificarAlertas(fakeDeps(db, new Date(agora.getTime() + 3 * 3_600_000), avisarFn), { avisarFn });
    expect(avisarFn).toHaveBeenCalledTimes(1);
    await verificarAlertas(fakeDeps(db, new Date(agora.getTime() + 4.5 * 3_600_000), avisarFn), { avisarFn });
    expect(avisarFn).toHaveBeenCalledTimes(2);
  });

  it("aviso que falhou não grava cooldown (tenta de novo na rodada seguinte)", async () => {
    const agora = emBrasilia("2026-10-05", "10:00");
    const avisarFn = vi.fn(async () => false);
    const db = fakeDb({}, { "sistema:heartbeat:hunter": { recebidoEm: new Date(agora.getTime() - 3_600_000).toISOString() } });
    const r = await verificarAlertas(fakeDeps(db, agora, avisarFn), { avisarFn });
    expect(r.notificados).toHaveLength(0);
    expect(await db.lerMarcador("alerta:notificado:sem_sinal_hunter")).toBeNull();
  });
});
