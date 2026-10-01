import { describe, expect, it, vi } from "vitest";
import { PESOS_PADRAO } from "@/lib/crm/pesos";
import type { CrmDb } from "@/lib/crm/registrar";
import type { EstadoLead } from "@/lib/crm/regras";
import { avaliarRegua, faixaPorOferta, lerFaturamentoAnual, montarFicha, perguntasSpin, sinaisDeEngajamento } from "./ficha-pre-reuniao";
import { diasDesde, passoVigente, textoFollowUp } from "./follow-up";
import { lembretesDevidos, naJanelaComercial, processarFollowUps, processarLembretes, textoLembrete, type PropostaEmAberto, type ReuniaoAgendada, type TipoLembrete } from "./lembretes";
import type { Deps } from "./orquestrador";
import { emBrasilia } from "./tempo";
import { temTravessao } from "./texto";

const hora = (dia: string, hm: string) => emBrasilia(dia, hm);
const dossie = { decisor: { nome: "Ana Lima" }, segmento: "Metalurgia", dor_provavel: "Vendas dependem só do dono", faturamento: "R$ 1,5 milhão por ano", gancho: "Vi o trabalho da empresa no Instagram" };

/* ------------------------------------------------------------------ regras puras */

describe("lembretesDevidos", () => {
  const nenhum = new Set<TipoLembrete>();
  it("longe da reunião só confirma", () => {
    expect(lembretesDevidos(72, nenhum)).toEqual({ enviar: ["confirmacao"], cobertos: [] });
    expect(lembretesDevidos(72, new Set(["confirmacao"]))).toEqual({ enviar: [], cobertos: [] });
  });
  it("24h e 1h saem uma vez cada, na ordem", () => {
    const f = new Set<TipoLembrete>(["confirmacao"]);
    expect(lembretesDevidos(24, f).enviar).toEqual(["24h"]);
    expect(lembretesDevidos(23.5, new Set<TipoLembrete>(["confirmacao", "24h"])).enviar).toEqual([]);
    expect(lembretesDevidos(1, new Set<TipoLembrete>(["confirmacao", "24h"])).enviar).toEqual(["1h"]);
    expect(lembretesDevidos(0.5, new Set<TipoLembrete>(["confirmacao", "24h", "1h"])).enviar).toEqual([]);
  });
  it("agendou de véspera: só a confirmação sai e os outros ficam cobertos", () => {
    expect(lembretesDevidos(10, nenhum)).toEqual({ enviar: ["confirmacao"], cobertos: ["24h"] });
    expect(lembretesDevidos(0.8, nenhum)).toEqual({ enviar: ["confirmacao"], cobertos: ["24h", "1h"] });
  });
  it("rotina parada por horas: só o lembrete mais próximo sai", () => {
    expect(lembretesDevidos(0.5, new Set<TipoLembrete>(["confirmacao"]))).toEqual({ enviar: ["1h"], cobertos: ["24h"] });
  });
  it("reunião que já começou não recebe nada", () => {
    expect(lembretesDevidos(0, nenhum)).toEqual({ enviar: [], cobertos: [] });
    expect(lembretesDevidos(-2, nenhum)).toEqual({ enviar: [], cobertos: [] });
  });
});

describe("textos de lembrete e follow-up", () => {
  const v = { nome: "Ana", inicio: hora("2026-10-06", "15:00"), linkReuniao: "https://teams.microsoft.com/l/meetup-join/abc", linkConversa: "https://empresarialacademy.com/conversa?t=tok" };
  it("sem travessão, sem marcador sobrando, com o horário de Brasília", () => {
    for (const t of ["confirmacao", "24h", "1h"] as const) {
      const x = textoLembrete(t, v);
      expect(temTravessao(x.assunto + x.texto)).toBe(false);
      expect(x.texto).not.toMatch(/\{\{/);
      expect(x.texto).toContain("Ana");
    }
    expect(textoLembrete("confirmacao", v).texto).toContain("terça-feira, 6 de outubro, às 15h");
    expect(textoLembrete("confirmacao", v).texto).toContain("https://teams.microsoft.com/l/meetup-join/abc");
  });
  it("sem link de acesso, manda ver o convite e o link para remarcar", () => {
    const x = textoLembrete("confirmacao", { ...v, linkReuniao: undefined });
    expect(x.texto).toContain("convite que chegou no seu e-mail");
    expect(x.texto).toContain("/conversa?t=tok");
  });
  it("follow-up: D10 deixa a porta aberta com o link do diagnóstico e não encerra o contato", () => {
    for (const p of [2, 5, 10] as const) {
      const x = textoFollowUp(p, { nome: "Ana", empresa: "Metal SA", linkDiagnostico: "https://empresarialacademy.com/diagnostico-maturidade-empresarial.html" });
      expect(temTravessao(x.assunto + x.texto)).toBe(false);
      expect(x.texto).toContain("Ana");
    }
    const d10 = textoFollowUp(10, { nome: "Ana", empresa: null, linkDiagnostico: "https://x.com/d" });
    expect(d10.texto).toContain("https://x.com/d");
    expect(d10.texto).toContain("porta aberta");
  });
});

describe("follow-up: D2, D5 e D10", () => {
  const proposta = hora("2026-10-05", "16:00");
  it("conta dias de calendário de Brasília", () => {
    expect(diasDesde(proposta, hora("2026-10-05", "23:00"))).toBe(0);
    expect(diasDesde(proposta, hora("2026-10-07", "08:00"))).toBe(2);
  });
  it("passo vigente é o maior que já chegou", () => {
    expect(passoVigente(proposta, hora("2026-10-06", "10:00"))).toBeNull();
    expect(passoVigente(proposta, hora("2026-10-07", "10:00"))).toBe(2);
    expect(passoVigente(proposta, hora("2026-10-09", "10:00"))).toBe(2);
    expect(passoVigente(proposta, hora("2026-10-10", "10:00"))).toBe(5);
    expect(passoVigente(proposta, hora("2026-10-15", "10:00"))).toBe(10);
    expect(passoVigente(proposta, hora("2026-11-30", "10:00"))).toBe(10);
  });
  it("janela comercial: segunda a sexta, 8h às 18h", () => {
    expect(naJanelaComercial(hora("2026-10-07", "09:00"))).toBe(true);
    expect(naJanelaComercial(hora("2026-10-07", "18:00"))).toBe(false);
    expect(naJanelaComercial(hora("2026-10-07", "07:59"))).toBe(false);
    expect(naJanelaComercial(hora("2026-10-10", "10:00"))).toBe(false); // sábado
  });
});

/* ------------------------------------------------------------------ ficha pré-reunião */

describe("ficha pré-reunião (sem IA)", () => {
  it("lê faturamento de texto livre", () => {
    expect(lerFaturamentoAnual("R$ 1,5 milhão por ano")).toBe(1_500_000);
    expect(lerFaturamentoAnual("R$ 800 mil")).toBe(800_000);
    expect(lerFaturamentoAnual("R$ 100 mil por mês")).toBe(1_200_000);
    expect(lerFaturamentoAnual("1.200.000")).toBe(1_200_000);
    expect(lerFaturamentoAnual("R$ 500 mil a R$ 1 mi")).toBe(750_000);
    expect(lerFaturamentoAnual("500 a 700 mil")).toBe(600_000);
    expect(lerFaturamentoAnual("não informado")).toBeNull();
    expect(lerFaturamentoAnual(null)).toBeNull();
  });

  it("régua de 0,5% a 2,5% por oferta", () => {
    const [alvo, recuo] = faixaPorOferta();
    expect(alvo).toMatchObject({ papel: "alvo", fatMin: 828_000, fatMax: 4_140_000 });
    expect(recuo).toMatchObject({ papel: "recuo", fatMin: 236_000, fatMax: 1_180_000 });
    expect(avaliarRegua(1_500_000).sugestao).toContain("Dentro da régua da oferta alvo");
    expect(avaliarRegua(500_000).sugestao).toContain("recuo");
    expect(avaliarRegua(100_000).sugestao).toContain("Abaixo da régua das duas ofertas");
    expect(avaliarRegua(null).sugestao).toContain("não informado");
  });

  it("sinais: só entrada dos últimos 14 dias, agrupados", () => {
    const agora = hora("2026-10-10", "10:00");
    const i = (tipo: string, canal: string, dias: number, direcao: "entrada" | "saida" = "entrada") => ({ leadId: 1, canal, direcao, tipo, data: new Date(agora.getTime() - dias * 86_400_000).toISOString(), conteudo: null, pontos: 0 });
    const sinais = sinaisDeEngajamento([i("aberto", "email", 1), i("aberto", "email", 2), i("clicado", "email", 3), i("respondido", "dm", 1), i("aberto", "email", 20), i("enviado", "email", 1, "saida")], agora);
    expect(sinais).toEqual(["abriu o e-mail (2x)", "clicou no link", "respondeu por DM"]);
  });

  it("monta a ficha com dossiê, engajamento, régua e perguntas, sem travessão", () => {
    const agora = hora("2026-10-10", "10:00");
    const f = montarFicha({
      nome: "Ana Lima",
      empresa: "Metal SA",
      dossie,
      temperatura: "engajado",
      pontos: 6,
      interacoes: [{ leadId: 1, canal: "email", direcao: "entrada", tipo: "clicado", data: agora.toISOString(), conteudo: null, pontos: 3 }],
      reuniaoEm: hora("2026-10-11", "15:00"),
      agora,
    });
    expect(f.titulo).toContain("Metal SA");
    for (const trecho of ["Ana Lima", "Vendas dependem só do dono", "Metalurgia", "engajado (6 pontos", "clicou no link", "0,5% a 2,5%", "Dentro da régua", "Perguntas sugeridas (SPIN)", "ROTEIRO-REUNIAO.md"]) {
      expect(f.texto).toContain(trecho);
    }
    expect(f.texto.match(/^\d\. /gm)).toHaveLength(4);
    expect(temTravessao(f.texto)).toBe(false);
  });

  it("dossiê vazio não quebra e não inventa fato", () => {
    const f = montarFicha({ nome: "Carlos", empresa: null, dossie: null, temperatura: "frio", pontos: 0, interacoes: [], reuniaoEm: null, agora: hora("2026-10-10", "10:00") });
    expect(f.texto).toContain("O dossiê não traz dor provável");
    expect(f.texto).toContain("Sem sinal de engajamento");
    expect(f.texto).toContain("Faturamento não informado");
    expect(perguntasSpin(null)).toHaveLength(4);
  });
});

/* ------------------------------------------------------------------ rotinas */

const estadoLead = (): EstadoLead => ({
  etapa: "reuniao_marcada",
  temperatura: "frio",
  pontos: 0,
  cadencia: { pausada: true, motivoPausa: "reuniao_marcada", proximoCanal: null, canaisEncerrados: [], movidoManualEm: null },
  statusEntrega: { email: "enviado", whatsapp: "nao_enviado", dm: "enviada", linkedin: "nao_enviado" },
  origem: { primeiroToqueCanal: "dm", primeiroToqueEm: hora("2026-10-01", "10:00"), ultimoToqueCanal: "email", ultimoToqueRotulo: "email1", reuniaoCanal: null, reuniaoToque: null, vendaCanal: null, vendaToque: null },
  optOut: false,
});

function mundo(reunioes: ReuniaoAgendada[], propostas: PropostaEmAberto[], agora: Date, env: Record<string, string> = {}, suprimidos: string[] = []) {
  const linhas: { lead: number | string; canal: string; tipo: string; conteudo?: string; chave?: string; metadados?: Record<string, unknown> | null }[] = [];
  const crm: CrmDb = {
    carregarLead: async () => estadoLead(),
    pesos: async () => PESOS_PADRAO,
    interacoesDesde: async () => [],
    existeChave: async (c) => linhas.some((l) => l.chave === c),
    criarInteracao: async (d) => {
      linhas.push({ lead: d.lead, canal: d.canal, tipo: d.tipo, conteudo: d.conteudo, chave: d.chave, metadados: d.metadados });
      return linhas.length;
    },
    salvarLead: async () => {},
  };
  const marcadores = new Set<string>();
  const enviar = vi.fn(async () => ({ ok: true }));
  const avisar = vi.fn(async () => true);
  const d = {
    db: {
      suprimidos: async () => new Set(suprimidos),
      criarMarcador: async (c: string) => (marcadores.has(c) ? false : (marcadores.add(c), true)),
      logEmail: async () => {},
    },
    crm,
    reunioes: { reunioesFuturas: async () => reunioes, propostasEmAberto: async () => propostas },
    enviar,
    agenda: async () => null,
    urlDescadastro: (id: number) => `https://empresarialacademy.com/sair?l=${id}`,
    avisar,
    agora,
    rand: () => 0,
    env,
  } as unknown as Deps;
  return { d, linhas, enviar, avisar };
}

const reuniao = (inicio: Date, over: Partial<ReuniaoAgendada> = {}): ReuniaoAgendada => ({
  leadId: 7,
  nome: "Ana Lima",
  empresa: "Metal SA",
  segmento: null,
  email: "ana@metal.com.br",
  whatsapp: "11999990000",
  inicio,
  temperatura: "engajado",
  pontos: 6,
  dossie,
  tokenConversa: "tok7",
  interacoes: [],
  ...over,
});

describe("processarLembretes", () => {
  const inicio = hora("2026-10-07", "15:00");

  it("simulação (padrão): grava confirmação nos dois canais, avisa o Thiago com a ficha e não envia nada", async () => {
    const agora = hora("2026-10-06", "10:00"); // 29h antes: só confirmação
    const m = mundo([reuniao(inicio)], [], agora);
    expect(await processarLembretes(m.d)).toEqual({ reunioes: 1, lembretes: 1, fichas: 0 });
    expect(m.enviar).not.toHaveBeenCalled();
    expect(m.linhas.map((l) => l.canal).sort()).toEqual(["email", "whatsapp"]);
    expect(m.linhas.every((l) => l.tipo === "lembrete" && l.metadados?.simulado === true)).toBe(true);
    expect(m.linhas[0].conteudo).toContain("quarta-feira, 7 de outubro, às 15h");
    // idempotente
    expect(await processarLembretes(m.d)).toMatchObject({ lembretes: 0 });
    expect(m.linhas).toHaveLength(2);
  });

  it("24h antes: lembrete e ficha ao Thiago (uma vez); aviso falho com tempo de sobra tenta de novo", async () => {
    const agora = hora("2026-10-06", "15:30"); // 23h30 antes
    const m = mundo([reuniao(inicio)], [], agora);
    m.avisar.mockResolvedValueOnce(false);
    const r1 = await processarLembretes(m.d);
    expect(r1.fichas).toBe(0); // aviso falhou, nada gravado para a ficha
    expect(m.linhas.filter((l) => l.metadados?.ficha)).toHaveLength(0);
    const r2 = await processarLembretes(m.d);
    expect(r2.fichas).toBe(1);
    const ficha = m.linhas.find((l) => l.metadados?.ficha)!;
    expect(ficha.canal).toBe("nota");
    expect(ficha.conteudo).toContain("Vendas dependem só do dono");
    expect(ficha.metadados?.avisoEnviado).toBe(true);
    expect(m.avisar).toHaveBeenLastCalledWith(expect.stringContaining("Ficha pré-reunião: Metal SA"));
    expect((await processarLembretes(m.d)).fichas).toBe(0);
  });

  it("ficha não sai de madrugada, mas sai ao amanhecer", async () => {
    const m = mundo([reuniao(hora("2026-10-07", "09:00"))], [], hora("2026-10-07", "03:00"));
    await processarLembretes(m.d);
    expect(m.avisar).not.toHaveBeenCalled();
    m.d.agora = hora("2026-10-07", "07:10");
    await processarLembretes(m.d);
    expect(m.avisar).toHaveBeenCalledTimes(1);
  });

  it("envio real do e-mail só com a chave ligada; WhatsApp continua simulado", async () => {
    const m = mundo([reuniao(inicio)], [], hora("2026-10-06", "10:00"), { OUTBOUND_ENVIO_REAL: "email" });
    await processarLembretes(m.d);
    expect(m.enviar).toHaveBeenCalledTimes(1);
    expect(m.enviar).toHaveBeenCalledWith(expect.objectContaining({ to: "ana@metal.com.br", from: "comercial@empresarialacademy.com" }));
    const wa = m.linhas.find((l) => l.canal === "whatsapp")!;
    expect(wa.metadados?.simulado).toBe(true);
    const em = m.linhas.find((l) => l.canal === "email")!;
    expect(em.metadados?.simulado).toBe(false);
    await processarLembretes(m.d);
    expect(m.enviar).toHaveBeenCalledTimes(1);
  });

  it("e-mail suprimido não recebe, nem em simulação", async () => {
    const m = mundo([reuniao(inicio)], [], hora("2026-10-06", "10:00"), {}, ["ana@metal.com.br"]);
    await processarLembretes(m.d);
    expect(m.linhas.map((l) => l.canal)).toEqual(["whatsapp"]);
  });

  it("agendou de véspera: confirmação sai e o 24h não repete", async () => {
    const m = mundo([reuniao(inicio)], [], hora("2026-10-06", "20:00")); // 19h antes
    await processarLembretes(m.d);
    const tipos = m.linhas.filter((l) => !l.metadados?.dispensado).map((l) => l.metadados?.lembrete).filter(Boolean);
    expect(tipos.filter((t) => t === "confirmacao")).toHaveLength(2);
    expect(tipos).not.toContain("24h");
    expect(m.linhas.some((l) => l.metadados?.dispensado)).toBe(true);
    m.d.agora = hora("2026-10-06", "21:00");
    expect((await processarLembretes(m.d)).lembretes).toBe(0);
    m.d.agora = hora("2026-10-07", "14:05"); // 55 min antes
    expect((await processarLembretes(m.d)).lembretes).toBe(1);
    expect(m.linhas.filter((l) => l.metadados?.lembrete === "1h")).toHaveLength(2);
  });

  it("sem reunião ou sem a dependência, não faz nada", async () => {
    expect(await processarLembretes(mundo([], [], hora("2026-10-06", "10:00")).d)).toEqual({ reunioes: 0, lembretes: 0, fichas: 0 });
    const m = mundo([], [], hora("2026-10-06", "10:00"));
    m.d.reunioes = undefined;
    expect(await processarLembretes(m.d)).toEqual({ reunioes: 0, lembretes: 0, fichas: 0 });
  });
});

describe("processarFollowUps", () => {
  const proposta = (propostaEm: Date): PropostaEmAberto => ({ leadId: 9, nome: "Carlos Dias", empresa: "Indústria Dias", email: "carlos@dias.com.br", whatsapp: "11988887777", dossie: null, propostaEm });

  it("D2 sai uma vez, em simulação, e avisa o Thiago com o texto", async () => {
    const m = mundo([], [proposta(hora("2026-10-05", "16:00"))], hora("2026-10-07", "09:00"));
    expect(await processarFollowUps(m.d)).toEqual({ propostas: 1, followUps: 1 });
    expect(m.enviar).not.toHaveBeenCalled();
    expect(m.linhas.filter((l) => l.metadados?.followUp === "D2")).toHaveLength(3); // mestre + whatsapp + e-mail
    expect(m.avisar).toHaveBeenCalledWith(expect.stringContaining("Follow-up D2 da proposta: Indústria Dias"));
    expect((await processarFollowUps(m.d)).followUps).toBe(0);
    expect(m.linhas).toHaveLength(3);
  });

  it("D5 e D10 saem nos dias certos e o D10 lembra de registrar o motivo", async () => {
    const m = mundo([], [proposta(hora("2026-10-05", "16:00"))], hora("2026-10-07", "09:00"));
    await processarFollowUps(m.d);
    m.d.agora = hora("2026-10-08", "09:00");
    expect((await processarFollowUps(m.d)).followUps).toBe(0); // D3: nada
    m.d.agora = hora("2026-10-12", "09:00");
    expect((await processarFollowUps(m.d)).followUps).toBe(1); // D7: vigente é o D5
    expect(m.linhas.some((l) => l.metadados?.followUp === "D5")).toBe(true);
    m.d.agora = hora("2026-10-15", "09:00");
    await processarFollowUps(m.d);
    expect(m.avisar).toHaveBeenLastCalledWith(expect.stringContaining("registre Ganho ou Nutrição contínua com o motivo"));
  });

  it("fora da janela comercial não envia nada", async () => {
    const m = mundo([], [proposta(hora("2026-10-05", "16:00"))], hora("2026-10-07", "19:00"));
    expect(await processarFollowUps(m.d)).toEqual({ propostas: 0, followUps: 0 });
    m.d.agora = hora("2026-10-10", "10:00"); // sábado
    expect((await processarFollowUps(m.d)).followUps).toBe(0);
  });

  it("e-mail real só com a chave ligada", async () => {
    const m = mundo([], [proposta(hora("2026-10-05", "16:00"))], hora("2026-10-07", "09:00"), { OUTBOUND_ENVIO_REAL: "email" });
    await processarFollowUps(m.d);
    expect(m.enviar).toHaveBeenCalledTimes(1);
    expect(m.enviar).toHaveBeenCalledWith(expect.objectContaining({ to: "carlos@dias.com.br" }));
  });
});
