import { describe, expect, it } from "vitest";
import { HORA_MS, contarCores } from "./estado";
import { atrasoComercial, montarAutomacoesDoSite, type DadosDoSite, type LinhaAgregada } from "./site";

// Sexta-feira, 2 de outubro de 2026, 11h em Brasília (14h UTC): dentro do horário comercial.
const agora = new Date("2026-10-02T14:00:00.000Z");
const haMin = (m: number): Date => new Date(agora.getTime() - m * 60_000);
const haHoras = (h: number): Date => new Date(agora.getTime() - h * HORA_MS);

const REAL = { CRON_SECRET: "x", OUTBOUND_ENVIO_REAL: "email", OUTBOUND_LER_CAIXA: "1", MICROSOFT_CLIENT_ID: "a", MICROSOFT_CLIENT_SECRET: "b", MICROSOFT_REFRESH_TOKEN: "c" };

function linha(parcial: Partial<LinhaAgregada>): LinhaAgregada {
  return { canal: "email", direcao: "saida", tipo: "enviado", simulado: false, p1: "", p2: "", hoje: 0, semana: 0, ultimas24h: 0, ultima: null, ...parcial };
}

function dados(parcial: Partial<DadosDoSite> = {}): DadosDoSite {
  return {
    linhas: [],
    leadsEmCadencia: 0,
    leadsEngajados: 0,
    emailsAtrasados48h: 0,
    ligacoesNaFila: 0,
    ligacoesAtrasadas48h: 0,
    linkedinNaFila: 0,
    linkedinAtrasados48h: 0,
    rodada: { em: haMin(3), modo: "real", contagem: { "2026-10-02": 20, "2026-10-01": 100, "2026-09-20": 999 }, rotinas: ["temperatura", "caixa", "lembretes", "followUps", "alertas", "revisaoSemanal"], erros: {} },
    ...parcial,
  };
}

const por = (lista: ReturnType<typeof montarAutomacoesDoSite>, id: string) => lista.find((a) => a.id === id)!;
const montar = (d: DadosDoSite, env: Record<string, string | undefined> = REAL) => montarAutomacoesDoSite(d, agora, env);

describe("automações do site: formato", () => {
  it("traz as dez automações do site, todas no grupo Cadência e CRM", () => {
    const lista = montar(dados());
    expect(lista.map((a) => a.id)).toEqual([
      "site-orquestrador",
      "site-email-frio",
      "site-caixa",
      "site-fila-ligacao",
      "site-fila-linkedin",
      "site-rastreio",
      "site-temperatura",
      "site-lembretes-followup",
      "site-ficha-pre-reuniao",
      "site-revisao-semanal",
    ]);
    for (const a of lista) {
      expect(a.sistema).toBe("site");
      expect(a.grupo).toBe("Cadência e CRM");
      expect(a.numeros.length).toBeGreaterThan(0);
      if (a.estado !== "ligado") expect(a.motivo).toBeTruthy();
    }
  });
});

describe("e-mail frio", () => {
  it("em simulação fica VERMELHO com o motivo, e mostra o que só foi simulado", () => {
    const lista = montar(dados({ linhas: [linha({ simulado: true, hoje: 12, semana: 30, p1: "sim", p2: "email" })] }), { ...REAL, OUTBOUND_ENVIO_REAL: "" });
    const a = por(lista, "site-email-frio");
    expect(a.estado).toBe("parado");
    expect(a.motivo).toBe("em simulação: o envio real de e-mail está desligado (OUTBOUND_ENVIO_REAL)");
    expect(a.numeros.find((n) => n.rotulo === "Simulados (não saíram)")).toEqual({ rotulo: "Simulados (não saíram)", hoje: 12, semana: 30 });
    expect(a.numeros.find((n) => n.rotulo === "Enviados")).toEqual({ rotulo: "Enviados", hoje: 0, semana: 0 });
  });

  it("com envio real, sem erro, fica verde e conta enviados, abertos, cliques, respostas e bounces", () => {
    const lista = montar(
      dados({
        linhas: [
          linha({ hoje: 10, semana: 40, ultima: haMin(20) }),
          linha({ tipo: "entregue", hoje: 9, semana: 38 }),
          linha({ tipo: "aberto", direcao: "entrada", hoje: 4, semana: 12 }),
          linha({ tipo: "clicado", direcao: "entrada", hoje: 1, semana: 3 }),
          linha({ tipo: "respondido", direcao: "entrada", hoje: 1, semana: 2 }),
          linha({ tipo: "bounce", direcao: "entrada", hoje: 0, semana: 1 }),
        ],
      }),
    );
    const a = por(lista, "site-email-frio");
    expect(a.estado).toBe("ligado");
    expect(a.numeros.slice(0, 6).map((n) => [n.rotulo, n.hoje, n.semana])).toEqual([
      ["Enviados", 10, 40],
      ["Entregues", 9, 38],
      ["Abertos", 4, 12],
      ["Cliques", 1, 3],
      ["Respostas", 1, 2],
      ["Bounces", 0, 1],
    ]);
    expect(a.ultimaExecucao).toBe(haMin(20).toISOString());
  });

  it("bounce acima de 3% hoje deixa AMARELO (o envio do dia foi pausado)", () => {
    const lista = montar(dados({ linhas: [linha({ hoje: 20, semana: 20 }), linha({ tipo: "bounce", direcao: "entrada", hoje: 2, semana: 2 })] }));
    const a = por(lista, "site-email-frio");
    expect(a.estado).toBe("erro");
    expect(a.motivo).toContain("bounce alto hoje (2 de 20)");
  });

  it("e-mail que falhou nas últimas 24 h deixa AMARELO", () => {
    const lista = montar(dados({ linhas: [linha({ hoje: 5, semana: 5 }), linha({ tipo: "falha", ultimas24h: 3, semana: 3 })] }));
    expect(por(lista, "site-email-frio")).toMatchObject({ estado: "erro", motivo: "3 e-mails falharam nas últimas 24 h" });
  });

  it("e-mail de cadência atrasado há mais de 48 h (fila travada) deixa AMARELO", () => {
    const lista = montar(dados({ emailsAtrasados48h: 4 }));
    expect(por(lista, "site-email-frio")).toMatchObject({ estado: "erro", motivo: "4 leads com e-mail atrasado há mais de 48 h" });
  });

  it("envio real ligado sem a conexão do Outlook fica VERMELHO", () => {
    const lista = montar(dados(), { ...REAL, MICROSOFT_REFRESH_TOKEN: undefined });
    expect(por(lista, "site-email-frio").estado).toBe("parado");
    expect(por(lista, "site-email-frio").motivo).toContain("MICROSOFT_REFRESH_TOKEN");
  });
});

describe("orquestrador da cadência", () => {
  it("rodou há 3 min em horário comercial: verde, com rodadas de hoje e da semana", () => {
    const a = por(montar(dados({ leadsEmCadencia: 14 })), "site-orquestrador");
    expect(a.estado).toBe("ligado");
    expect(a.numeros).toEqual([
      { rotulo: "Rodadas", hoje: 20, semana: 120 },
      { rotulo: "Leads em cadência (agora)", hoje: 14, semana: null },
    ]);
  });

  it("sem rodar há 1 h em horário comercial: VERMELHO (o chamador do Hunter não chamou)", () => {
    const d = dados();
    d.rodada = { ...d.rodada!, em: haMin(60) };
    const a = por(montar(d), "site-orquestrador");
    expect(a.estado).toBe("parado");
    expect(a.motivo).toContain("sem rodar há 1 h");
  });

  it("fora do horário comercial, a última rodada de ontem à tarde ainda é normal (verde)", () => {
    // Sábado 3/10, 11h em Brasília. Última rodada: sexta 17h55.
    const sabado = new Date("2026-10-03T14:00:00.000Z");
    const d = dados();
    d.rodada = { ...d.rodada!, em: new Date("2026-10-02T20:55:00.000Z") };
    expect(por(montarAutomacoesDoSite(d, sabado, REAL), "site-orquestrador").estado).toBe("ligado");
  });

  it("nunca rodou: VERMELHO; sem CRON_SECRET: VERMELHO com a chave que falta", () => {
    expect(por(montar(dados({ rodada: null })), "site-orquestrador")).toMatchObject({ estado: "parado", motivo: expect.stringContaining("ainda não rodou") });
    expect(por(montar(dados(), { ...REAL, CRON_SECRET: undefined }), "site-orquestrador").motivo).toBe("falta a chave CRON_SECRET no site");
  });

  it("rotina que falhou na última rodada deixa AMARELO com o nome e o erro", () => {
    const d = dados();
    d.rodada = { ...d.rodada!, erros: { lembretes: "timeout no Outlook" } };
    const lista = montar(d);
    expect(por(lista, "site-orquestrador")).toMatchObject({ estado: "erro", motivo: expect.stringContaining("timeout no Outlook") });
  });
});

describe("leitura da caixa comercial@", () => {
  it("desligada (sem OUTBOUND_LER_CAIXA) fica VERMELHA", () => {
    const a = por(montar(dados(), { ...REAL, OUTBOUND_LER_CAIXA: "" }), "site-caixa");
    expect(a.estado).toBe("parado");
    expect(a.motivo).toContain("OUTBOUND_LER_CAIXA");
  });

  it("ligada, rodando e com respostas lidas: verde com números", () => {
    const a = por(montar(dados({ linhas: [linha({ tipo: "respondido", direcao: "entrada", p1: "caixa", hoje: 2, semana: 5 })] })), "site-caixa");
    expect(a.estado).toBe("ligado");
    expect(a.numeros[0]).toEqual({ rotulo: "Respostas lidas", hoje: 2, semana: 5 });
  });

  it("erro na leitura da última rodada deixa AMARELA", () => {
    const d = dados();
    d.rodada = { ...d.rodada!, erros: { caixa: "Graph 401" } };
    expect(por(montar(d), "site-caixa").estado).toBe("erro");
  });
});

describe("filas manuais, rastreio e rotinas diárias e semanais", () => {
  it("fila de ligação com atraso de mais de 48 h fica AMARELA; sem atraso, verde", () => {
    expect(por(montar(dados({ ligacoesAtrasadas48h: 3, ligacoesNaFila: 5 })), "site-fila-ligacao")).toMatchObject({ estado: "erro", motivo: "3 ligações esperando há mais de 48 h na Fila do dia" });
    expect(por(montar(dados({ linkedinNaFila: 2 })), "site-fila-linkedin").estado).toBe("ligado");
    expect(por(montar(dados({ linkedinAtrasados48h: 1 })), "site-fila-linkedin").estado).toBe("erro");
  });

  it("rastreio conta aberturas, plays e agendamentos", () => {
    const a = por(
      montar(dados({ linhas: [linha({ canal: "sistema", tipo: "abriu_pagina", p1: "conversa", p2: "abriu", hoje: 3, semana: 9 }), linha({ canal: "sistema", tipo: "deu_play", hoje: 1, semana: 4 }), linha({ canal: "sistema", tipo: "agendou", hoje: 0, semana: 2 })] })),
      "site-rastreio",
    );
    expect(a.numeros.map((n) => [n.hoje, n.semana])).toEqual([[3, 9], [1, 4], [0, 2]]);
  });

  it("temperatura: recalculada ontem é verde; sem recalcular há 5 dias é VERMELHO", () => {
    const ok = por(montar(dados({ leadsEngajados: 7, linhas: [linha({ canal: "sistema", tipo: "lembrete", p1: "rotina", p2: "temperatura", ultima: haHoras(20), semana: 1 })] })), "site-temperatura");
    expect(ok.estado).toBe("ligado");
    expect(ok.numeros[0]).toEqual({ rotulo: "Leads engajados (agora)", hoje: 7, semana: null });
    const velha = por(montar(dados({ linhas: [linha({ canal: "sistema", tipo: "lembrete", p1: "rotina", p2: "temperatura", ultima: haHoras(120) })] })), "site-temperatura");
    expect(velha.estado).toBe("parado");
  });

  it("lembretes e follow-up: em simulação VERMELHO; com envio real, verde", () => {
    const l = [linha({ canal: "whatsapp", tipo: "lembrete", p1: "lembrete", simulado: true, hoje: 2, semana: 2 })];
    expect(por(montar(dados({ linhas: l }), { ...REAL, OUTBOUND_ENVIO_REAL: "" }), "site-lembretes-followup").estado).toBe("parado");
    expect(por(montar(dados({ linhas: l })), "site-lembretes-followup").estado).toBe("ligado");
  });

  it("ficha pré-reunião não depende do envio real", () => {
    const a = por(montar(dados({ linhas: [linha({ canal: "nota", tipo: "lembrete", p1: "ficha", hoje: 1, semana: 1, ultima: haHoras(2) })] }), { ...REAL, OUTBOUND_ENVIO_REAL: "" }), "site-ficha-pre-reuniao");
    expect(a.estado).toBe("ligado");
    expect(a.numeros[0]).toEqual({ rotulo: "Fichas geradas", hoje: 1, semana: 1 });
  });

  it("revisão semanal: nunca gerada é VERMELHA e avisa quando vem a primeira; de 3 dias atrás é verde; de 10 dias, VERMELHA", () => {
    const nunca = por(montar(dados()), "site-revisao-semanal");
    expect(nunca.estado).toBe("parado");
    expect(nunca.motivo).toContain("a primeira sai na segunda-feira");
    const rev = (h: number) => dados({ linhas: [linha({ canal: "sistema", tipo: "lembrete", p1: "revisao", p2: "semanal", ultima: haHoras(h), semana: 1 })] });
    expect(por(montar(rev(72)), "site-revisao-semanal").estado).toBe("ligado");
    expect(por(montar(rev(240)), "site-revisao-semanal").estado).toBe("parado");
  });

  it("o total de cores fecha com as dez automações", () => {
    const c = contarCores(montar(dados()));
    expect(c.verdes + c.amarelas + c.vermelhas).toBe(10);
  });
});

describe("atrasoComercial", () => {
  it("dentro da janela: conta desde a última rodada, com folga de 30 min", () => {
    expect(atrasoComercial(agora, haMin(10))).toBe(0);
    expect(atrasoComercial(agora, haMin(45))).toBe(15 * 60_000);
  });

  it("no começo da janela, a rodada de sexta anterior não atrasa antes das 8h30", () => {
    const seg = new Date("2026-10-05T11:10:00.000Z"); // segunda 8h10 em Brasília
    expect(atrasoComercial(seg, new Date("2026-10-02T20:55:00.000Z"))).toBe(0);
    const seg2 = new Date("2026-10-05T11:50:00.000Z"); // segunda 8h50
    expect(atrasoComercial(seg2, new Date("2026-10-02T20:55:00.000Z"))).toBeGreaterThan(0);
  });

  it("fora da janela: só atrasa se a última rodada ficou antes do fim da janela anterior", () => {
    const noite = new Date("2026-10-02T23:00:00.000Z"); // sexta 20h
    expect(atrasoComercial(noite, new Date("2026-10-02T20:50:00.000Z"))).toBe(0);
    expect(atrasoComercial(noite, new Date("2026-10-02T15:00:00.000Z"))).toBeGreaterThan(0);
  });

  it("sem última rodada, não calcula atraso (quem trata é o 'ainda não rodou')", () => {
    expect(atrasoComercial(agora, null)).toBe(0);
  });
});
