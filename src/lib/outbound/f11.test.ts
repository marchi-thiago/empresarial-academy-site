import { describe, expect, it, vi } from "vitest";
import type { Painel } from "@/lib/crm/telas/painel";
import { PALAVRAS_PROIBIDAS_NO_ASSUNTO, palavrasProibidasEm } from "./email/render";
import {
  AMOSTRA_MINIMA_AB,
  confirmarVariantes,
  escolherVariantes,
  indiceDaVariante,
  medirVariantes,
  type EventoAB,
  type Experimento,
} from "./experimentos";
import {
  elegivelParaNutricao,
  ehToqueDeNutricao,
  escolherPost,
  planejarNutricao,
  recorteDoResumo,
  textoDaNutricao,
  tipoDeNutricao,
  toqueDaNutricao,
  type LeadNutricao,
  type PostNutricao,
} from "./nutricao";
import { chaveDaRevisao, montarRevisao, periodoDaRevisao, resumoDaSemana, revisaoDevida, rodarRevisaoSemanal } from "./revisao-semanal";
import { emBrasilia } from "./tempo";
import { problemaDoTexto } from "./texto";

const hora = (dia: string, hm: string) => emBrasilia(dia, hm);
const SEM_TRAVESSAO = /[—–]/;

/* ---------------------------------------------------------------- A/B */

describe("A/B: atribuição", () => {
  it("é estável: o mesmo lead cai sempre na mesma variante, em qualquer rodada", () => {
    for (let id = 1; id <= 50; id++) {
      const a = escolherVariantes("email", id, { nome: "Ana", empresa: "Alfa" });
      const b = escolherVariantes("email", id, { nome: "Ana", empresa: "Alfa" });
      expect(a).toEqual(b);
    }
  });

  it("divide perto de 50/50 entre as duas variantes", () => {
    const n = 2000;
    let convite = 0;
    for (let id = 1; id <= n; id++) if (escolherVariantes("email", id, { nome: "Ana", empresa: "Alfa" }).ids.assunto === "convite_20min") convite++;
    expect(convite / n).toBeGreaterThan(0.45);
    expect(convite / n).toBeLessThan(0.55);
  });

  it("variante nova (id novo do experimento) reembaralha sem tocar na medição antiga", () => {
    const iguais = Array.from({ length: 200 }, (_, i) => indiceDaVariante(i + 1, "email-assunto-v1", 2) === indiceDaVariante(i + 1, "email-assunto-v2", 2)).filter(Boolean).length;
    expect(iguais).toBeGreaterThan(60);
    expect(iguais).toBeLessThan(140);
  });

  it("canal sem experimento não recebe variante", () => {
    expect(escolherVariantes("whatsapp", 1, { nome: "Ana", empresa: "Alfa" })).toEqual({ ids: {} });
  });

  it("variante que depende da empresa cai no controle quando o lead não tem empresa (e a medição fica honesta)", () => {
    for (let id = 1; id <= 40; id++) {
      const r = escolherVariantes("email", id, { nome: "Ana", empresa: null });
      expect(r.ids.assunto).toBe("kit");
      expect(r.assunto).toBeUndefined();
    }
  });

  it("o texto da variante sai preenchido, sem travessão nem termo proibido de assunto", () => {
    const exp = escolherVariantes("email", 1, { nome: "Ana", empresa: "Souza Metais" }, [
      { id: "t", canal: "email", variavel: "assunto", variantes: [{ id: "so", descricao: "x", modelo: "{{empresa}}: uma conversa de 20 minutos" }] },
    ]);
    expect(exp.assunto).toBe("Souza Metais: uma conversa de 20 minutos");
    for (const e of [exp.assunto!]) {
      expect(e).not.toMatch(SEM_TRAVESSAO);
      expect(palavrasProibidasEm(e)).toEqual([]);
    }
    expect(PALAVRAS_PROIBIDAS_NO_ASSUNTO.length).toBeGreaterThan(0);
  });

  it("confirmarVariantes tira da medição a variante que o render trocou por assunto neutro", () => {
    const esc = { ids: { assunto: "convite_20min" }, assunto: "Alfa: uma conversa de 20 minutos" };
    expect(confirmarVariantes(esc, "Alfa: uma conversa de 20 minutos")).toEqual({ assunto: "convite_20min" });
    expect(confirmarVariantes(esc, "Ana, uma ideia para a gestão da Alfa")).toBeUndefined();
    expect(confirmarVariantes({ ids: { assunto: "kit" } }, "qualquer coisa")).toEqual({ assunto: "kit" });
  });
});

describe("A/B: medição", () => {
  const t = (d: string) => new Date(`2026-10-${d}T12:00:00Z`);
  const envio = (leadId: number, variante: string, dia: string, canal = "email"): EventoAB => ({ leadId, canal, direcao: "saida", tipo: "enviado", data: t(dia), variantes: { assunto: variante } });
  const resposta = (leadId: number, dia: string, canal = "email"): EventoAB => ({ leadId, canal, direcao: "entrada", tipo: "respondido", data: t(dia) });
  const reuniao = (leadId: number, dia: string): EventoAB => ({ leadId, canal: "sistema", direcao: "entrada", tipo: "agendou", data: t(dia) });

  it("conta por lead distinto: resposta e reunião depois do envio, no canal certo", () => {
    const ev: EventoAB[] = [
      envio(1, "kit", "01"), envio(1, "kit", "08"), // 2 envios, 1 lead
      envio(2, "kit", "01"),
      envio(3, "convite_20min", "01"),
      envio(4, "convite_20min", "01"),
      resposta(1, "02"), resposta(1, "03"), // 2 respostas, 1 lead
      resposta(3, "02"), resposta(4, "02", "dm"), // a resposta do 4 foi na DM: não conta para o e-mail
      reuniao(3, "05"),
      resposta(2, "30", "email"), // depois, ainda conta (depois do envio)
    ];
    const [teste] = medirVariantes(ev);
    const kit = teste.linhas.find((l) => l.variante === "kit")!;
    const convite = teste.linhas.find((l) => l.variante === "convite_20min")!;
    expect(kit).toMatchObject({ envios: 2, respostas: 2, reunioes: 0 });
    expect(convite).toMatchObject({ envios: 2, respostas: 1, reunioes: 1 });
    expect(convite.taxaResposta).toBe(0.5);
  });

  it("resposta anterior ao envio não conta", () => {
    const [teste] = medirVariantes([resposta(1, "01"), envio(1, "kit", "05")]);
    expect(teste.linhas[0]).toMatchObject({ envios: 1, respostas: 0 });
  });

  it("sem amostra mínima nenhuma variante vence; com amostra, vence a maior taxa de resposta", () => {
    const poucos: EventoAB[] = [envio(1, "kit", "01"), envio(2, "convite_20min", "01"), resposta(2, "02")];
    expect(medirVariantes(poucos)[0]).toMatchObject({ status: "em_teste", vencedora: null });

    const ev: EventoAB[] = [];
    for (let i = 1; i <= AMOSTRA_MINIMA_AB; i++) {
      ev.push(envio(i, "kit", "01"));
      ev.push(envio(1000 + i, "convite_20min", "01"));
      if (i <= 3) ev.push(resposta(i, "02"));
      if (i <= 6) ev.push(resposta(1000 + i, "02"));
    }
    expect(medirVariantes(ev)[0]).toMatchObject({ status: "vencedora", vencedora: "convite_20min" });
  });

  it("empate com amostra suficiente não escolhe ninguém", () => {
    const ev: EventoAB[] = [];
    for (let i = 1; i <= AMOSTRA_MINIMA_AB; i++) {
      ev.push(envio(i, "kit", "01"), envio(1000 + i, "convite_20min", "01"));
      if (i <= 3) ev.push(resposta(i, "02"), resposta(1000 + i, "02"));
    }
    expect(medirVariantes(ev)[0]).toMatchObject({ status: "empate", vencedora: null });
  });

  it("separa por canal e variável (um teste por vez)", () => {
    const ev: EventoAB[] = [envio(1, "kit", "01"), { ...envio(2, "v1", "01", "dm"), variantes: { gancho: "g1" } }];
    const testes = medirVariantes(ev);
    expect(testes.map((x) => `${x.canal}/${x.variavel}`)).toEqual(["dm/gancho", "email/assunto"]);
  });

  it("evento sem variantes e envio simulado (sem variantes gravadas) não entram", () => {
    expect(medirVariantes([{ leadId: 1, canal: "email", direcao: "saida", tipo: "enviado", data: t("01") }])).toEqual([]);
  });

  it("aceita um experimento de outro formato (futuro: gancho/convite em DM e WhatsApp) sem mudar a conta", () => {
    const exp: Experimento = { id: "dm-gancho-v1", canal: "dm", variavel: "gancho", variantes: [{ id: "a", descricao: "a" }, { id: "b", descricao: "b" }] };
    expect(escolherVariantes("dm", 7, { nome: "Ana", empresa: "Alfa" }, [exp]).ids.gancho).toMatch(/^[ab]$/);
  });
});

/* ---------------------------------------------------------------- nutrição */

describe("nutrição mensal e indicação", () => {
  const agora = hora("2026-10-06", "10:00");
  const lead = (over: Partial<LeadNutricao> = {}): LeadNutricao => ({
    id: 1,
    nome: "Ana Souza",
    empresa: "Souza Metais",
    segmento: "Indústria metalúrgica",
    email: "ana@souzametais.com.br",
    etapa: "nutricao_continua",
    pausada: true,
    optOut: false,
    emailSuprimido: false,
    naoAgora: false,
    indicacaoPedida: false,
    ultimoEnvioEm: null,
    primeiroToqueEm: hora("2026-08-01", "10:00"),
    ...over,
  });
  const post = (over: Partial<PostNutricao> = {}): PostNutricao => ({
    titulo: "Como destravar a gestão de uma metalúrgica",
    slug: "destravar-gestao-metalurgica",
    resumo: "Um roteiro curto para o dono sair da operação. Passo a passo prático.",
    temas: ["Indústria", "Gestão"],
    publicadoEm: hora("2026-09-20", "10:00"),
    ...over,
  });

  it("só recebe quem não pediu para sair: opt-out, Saiu da lista, e-mail suprimido ou inválido ficam de fora", () => {
    expect(elegivelParaNutricao(lead(), agora)).toBe(true);
    expect(elegivelParaNutricao(lead({ optOut: true }), agora)).toBe(false);
    expect(elegivelParaNutricao(lead({ etapa: "saiu_da_lista" }), agora)).toBe(false);
    expect(elegivelParaNutricao(lead({ emailSuprimido: true }), agora)).toBe(false);
    expect(elegivelParaNutricao(lead({ email: null }), agora)).toBe(false);
    expect(elegivelParaNutricao(lead({ email: "sem-arroba" }), agora)).toBe(false);
  });

  it("etapas: Nutrição contínua sim; reunião, resposta e engajado não; cadência encerrada sem resposta sim", () => {
    for (const etapa of ["respondeu", "reuniao_marcada", "reuniao_feita", "proposta_enviada", "ganho", "engajado", "qualificado"] as const) {
      expect(elegivelParaNutricao(lead({ etapa }), agora)).toBe(false);
    }
    // em cadência há 30 dias, sem pausa: terminou a cadência (21 dias) sem responder
    expect(elegivelParaNutricao(lead({ etapa: "em_cadencia", pausada: false, primeiroToqueEm: hora("2026-09-06", "10:00") }), agora)).toBe(true);
    // em cadência há 10 dias: ainda é cadência
    expect(elegivelParaNutricao(lead({ etapa: "em_cadencia", pausada: false, primeiroToqueEm: hora("2026-09-26", "10:00") }), agora)).toBe(false);
    expect(elegivelParaNutricao(lead({ etapa: "em_cadencia", pausada: true, primeiroToqueEm: hora("2026-09-06", "10:00") }), agora)).toBe(false);
  });

  it("no máximo 1 por mês", () => {
    expect(elegivelParaNutricao(lead({ ultimoEnvioEm: hora("2026-09-20", "10:00") }), agora)).toBe(false); // 16 dias
    expect(elegivelParaNutricao(lead({ ultimoEnvioEm: hora("2026-09-05", "10:00") }), agora)).toBe(true); // 31 dias
  });

  it("'não é o momento' recebe o pedido de indicação uma vez; depois, só o material do mês", () => {
    expect(tipoDeNutricao(lead({ naoAgora: true }))).toBe("indicacao");
    expect(tipoDeNutricao(lead({ naoAgora: true, indicacaoPedida: true }))).toBe("material");
    expect(tipoDeNutricao(lead())).toBe("material");
  });

  it("o id do toque é válido para o rastreio e único por mês (material) ou por lead (indicação)", () => {
    expect(toqueDaNutricao("material", agora)).toBe("nutr_2026_10");
    expect(toqueDaNutricao("material", hora("2026-11-03", "10:00"))).toBe("nutr_2026_11");
    expect(toqueDaNutricao("indicacao", agora)).toBe("indicacao");
    for (const t of ["nutr_2026_10", "indicacao"]) {
      expect(t).toMatch(/^[a-z0-9_]{1,24}$/); // regra de rastreio.ts
      expect(ehToqueDeNutricao(t)).toBe(true);
    }
    expect(ehToqueDeNutricao("email1")).toBe(false);
  });

  it("escolhe o post mais recente que combina com o segmento; senão o mais recente do blog; sem posts, nada", () => {
    const posts = [
      post({ titulo: "Vendas em escolas", slug: "escolas", temas: ["Educação"], publicadoEm: hora("2026-09-30", "10:00") }),
      post({ slug: "industria-antigo", titulo: "Indústria: custos", temas: ["Indústria"], publicadoEm: hora("2026-08-01", "10:00") }),
      post({ slug: "industria-novo", titulo: "Indústria: gargalos", temas: ["Indústria"], publicadoEm: hora("2026-09-15", "10:00") }),
    ];
    expect(escolherPost(posts, "Indústria metalúrgica")).toMatchObject({ post: { slug: "industria-novo" }, combina: true });
    expect(escolherPost(posts, "Serviços jurídicos")).toMatchObject({ post: { slug: "escolas" }, combina: false });
    expect(escolherPost(posts, null)).toMatchObject({ post: { slug: "escolas" }, combina: false });
    expect(escolherPost([], "Indústria")).toBeNull();
  });

  it("textos: sem travessão, sem emoji, sem termo proibido no assunto, com a identidade e o convite do bate-papo rápido", () => {
    const material = textoDaNutricao("material", { nome: "Ana", empresa: "Souza Metais", post: post({ resumo: "Roteiro curto — para o dono sair da operação. Passo a passo." }), combina: true, linkDoPost: "https://empresarialacademy.com/blog/x" })!;
    const indicacao = textoDaNutricao("indicacao", { nome: "Ana", empresa: "Souza Metais", post: null, combina: false, linkDoPost: null })!;
    for (const t of [material, indicacao]) {
      const corpo = Object.values(t.kit).join("\n");
      expect(problemaDoTexto(t.assunto, corpo)).toBeNull();
      expect(corpo).not.toMatch(SEM_TRAVESSAO);
      expect(corpo).not.toMatch(/[\p{Extended_Pictographic}]/u);
      expect(palavrasProibidasEm(t.assunto)).toEqual([]);
      expect(corpo).toContain("bate-papo rápido");
      expect(corpo).not.toMatch(/\b20 min/);
    }
    expect(material.kit.insight).not.toMatch(SEM_TRAVESSAO);
    expect(material.leitura).toEqual({ titulo: "Como destravar a gestão de uma metalúrgica", link: "https://empresarialacademy.com/blog/x" });
    expect(indicacao.kit.insight).toContain("só faço contato se a pessoa autorizar");
    expect(indicacao.leitura).toBeUndefined();
    // material sem post ou sem link não existe: nada é inventado
    expect(textoDaNutricao("material", { nome: "Ana", empresa: null, post: null, combina: false, linkDoPost: null })).toBeNull();
  });

  it("recorte do resumo: até 220 caracteres, sem cortar frase e sem travessão", () => {
    const longo = `${"Primeira frase completa. ".repeat(3)}${"Outra frase bem comprida para estourar o limite de caracteres do recorte. ".repeat(4)}`;
    const r = recorteDoResumo(longo);
    expect(r.length).toBeLessThanOrEqual(220);
    expect(r.endsWith(".")).toBe(true);
    expect(recorteDoResumo("Antes — depois.")).toBe("Antes, depois.");
    expect(recorteDoResumo(null)).toBe("");
  });

  it("planejarNutricao: pula quem não é elegível, põe indicação primeiro e material sem post fica de fora", () => {
    const leads = [
      lead({ id: 1, ultimoEnvioEm: hora("2026-08-01", "10:00") }),
      lead({ id: 2, naoAgora: true }),
      lead({ id: 3, optOut: true }),
      lead({ id: 4, ultimoEnvioEm: hora("2026-07-01", "10:00") }),
    ];
    const itens = planejarNutricao(leads, [post()], agora);
    expect(itens.map((i) => [i.lead.id, i.tipo])).toEqual([[2, "indicacao"], [4, "material"], [1, "material"]]);
    expect(planejarNutricao([lead({ id: 1 })], [], agora)).toEqual([]);
    expect(planejarNutricao([lead({ id: 2, naoAgora: true })], [], agora).map((i) => i.tipo)).toEqual(["indicacao"]);
  });
});

/* ---------------------------------------------------------------- revisão semanal */

describe("revisão semanal", () => {
  const painel = (over: Partial<Painel> = {}): Painel =>
    ({
      totais: { leads: 100, contatados: 80, respostas: 10, reunioes: 2, vendas: 0 },
      temperaturas: { frio: 1, morno: 1, engajado: 1 },
      porEtapa: [],
      funil: [],
      canais: [],
      segmentos: [
        { nome: "Indústria", leads: 40, contatados: 30, respostas: 6, reunioes: 2, vendas: 0 },
        { nome: "Escolas", leads: 20, contatados: 10, respostas: 0, reunioes: 0, vendas: 0 },
      ],
      campanhas: [],
      origemReunioes: [],
      origemVendas: [],
      metas: [
        { chave: "respostaEmail", rotulo: "Resposta ao e-mail", meta: 3, real: 1.5, numerador: 3, denominador: 200, situacao: "abaixo", regra: "Trocar assunto e gancho (teste A/B).", amostraPequena: false },
        { chave: "entregaEmail", rotulo: "Entrega de e-mail", meta: 95, real: 97, numerador: 194, denominador: 200, situacao: "na_meta", regra: "Parar o e-mail.", amostraPequena: false },
        { chave: "comparecimento", rotulo: "Comparecimento", meta: 70, real: null, numerador: 0, denominador: 0, situacao: "sem_dados", faltando: "nenhuma reunião ainda", regra: "Reforçar lembretes.", amostraPequena: true },
      ],
      ...over,
    }) as unknown as Painel;

  it("período: a semana anterior fechada, de segunda a domingo, pela segunda da semana de agora", () => {
    const p = periodoDaRevisao(hora("2026-10-05", "09:00")); // segunda
    expect(p.segunda).toBe("2026-10-05");
    expect(p.inicio.toISOString()).toBe(hora("2026-09-28", "00:00").toISOString());
    expect(p.fim.toISOString()).toBe(hora("2026-10-05", "00:00").toISOString());
    // quarta e domingo da mesma semana apontam para o mesmo período (a chave é a mesma)
    expect(chaveDaRevisao(hora("2026-10-07", "15:00"))).toBe("revisao:semanal:2026-10-05");
    expect(chaveDaRevisao(hora("2026-10-11", "15:00"))).toBe("revisao:semanal:2026-10-05");
    expect(chaveDaRevisao(hora("2026-10-12", "09:00"))).toBe("revisao:semanal:2026-10-12");
  });

  it("só é devida em dia útil, a partir das 8h", () => {
    expect(revisaoDevida(hora("2026-10-05", "07:59"))).toBe(false);
    expect(revisaoDevida(hora("2026-10-05", "08:00"))).toBe(true);
    expect(revisaoDevida(hora("2026-10-09", "17:00"))).toBe(true); // sexta: recupera a segunda perdida
    expect(revisaoDevida(hora("2026-10-10", "10:00"))).toBe(false); // sábado
  });

  it("o resumo da semana conta só o período e só fatos de saída, resposta e reunião", () => {
    const p = periodoDaRevisao(hora("2026-10-05", "09:00"));
    const ev: EventoAB[] = [
      { leadId: 1, canal: "email", direcao: "saida", tipo: "enviado", data: hora("2026-09-29", "10:00") },
      { leadId: 2, canal: "email", direcao: "saida", tipo: "enviado", data: hora("2026-09-27", "10:00") }, // semana anterior
      { leadId: 3, canal: "email", direcao: "saida", tipo: "enviado", data: hora("2026-10-05", "00:00") }, // já é a semana nova
      { leadId: 1, canal: "email", direcao: "entrada", tipo: "respondido", data: hora("2026-09-30", "10:00") },
      { leadId: 1, canal: "sistema", direcao: "entrada", tipo: "agendou", data: hora("2026-10-02", "10:00") },
    ];
    expect(resumoDaSemana(ev, p)).toEqual([
      { canal: "email", enviados: 1, respostas: 1, reunioes: 0 },
      { canal: "sistema", enviados: 0, respostas: 0, reunioes: 1 },
    ]);
  });

  it("monta a revisão com dados reais, sem travessão e com a decisão da primeira meta abaixo", () => {
    const periodo = periodoDaRevisao(hora("2026-10-05", "09:00"));
    const r = montarRevisao({
      periodo,
      painel: painel(),
      eventos: [{ leadId: 1, canal: "email", direcao: "saida", tipo: "enviado", data: hora("2026-09-30", "10:00") }],
      motivos: [{ motivo: "momento", etapa: "nutricao_continua", n: 3 }, { motivo: "valor_percebido", etapa: "ganho", n: 1 }],
    });
    expect(r.semana).toBe("28/09 a 04/10");
    expect(r.texto).toContain("- E-mail: envios 1, respostas 0, reuniões marcadas 0");
    expect(r.texto).toContain("- Resposta ao e-mail: 1,5% contra meta de 3,0%, abaixo");
    expect(r.texto).toContain("- Entrega de e-mail: 97,0% contra meta de 95,0%, na meta");
    expect(r.texto).toContain("- Comparecimento: sem dados (nenhuma reunião ainda)");
    expect(r.texto).toContain("- Indústria: 30 contatados, 6 respostas, 2 reuniões");
    expect(r.texto).not.toContain("Escolas");
    expect(r.texto).toContain("- não é o momento: 3");
    expect(r.texto).toContain("- viu valor e fechou: 1 (ganho)");
    expect(r.texto).toContain("Resposta ao e-mail está abaixo da meta. Trocar assunto e gancho (teste A/B). Mude uma variável por vez.");
    expect(r.texto).toContain("Tempo de resposta: ainda não medido");
    expect(r.texto).not.toMatch(SEM_TRAVESSAO);
    expect(r.texto).not.toMatch(/perdid/i);
    expect(r.resumo).toContain("envios 1, respostas 0, reuniões marcadas 0");
    expect(r.resumo.length).toBeLessThan(400);
    expect(montarRevisao({ periodo, painel: painel(), eventos: [], motivos: [] }).texto).toContain("Nenhum envio, resposta ou reunião registrados.");
  });

  it("sem dados nenhum, diz que não há dado em vez de inventar", () => {
    const p = painel({ metas: [], segmentos: [] });
    const r = montarRevisao({ periodo: periodoDaRevisao(hora("2026-10-05", "09:00")), painel: p, eventos: [], motivos: [] });
    expect(r.texto).toContain("Ainda sem resposta ou reunião por segmento.");
    expect(r.texto).toContain("Nenhuma variante com envio registrado ainda.");
    expect(r.texto).toContain("Nenhum motivo registrado ainda.");
    expect(r.texto).toContain("Nenhuma meta abaixo com dado suficiente.");
  });

  it("gera uma vez por semana, avisa o Thiago uma vez e não repete na rodada seguinte", async () => {
    const marcadores = new Map<string, Record<string, unknown>>();
    const db = {
      lerMarcador: async (c: string) => marcadores.get(c) ?? null,
      criarMarcador: async (c: string, m: Record<string, unknown>) => {
        if (marcadores.has(c)) return false;
        marcadores.set(c, m);
        return true;
      },
    };
    const avisar = vi.fn(async () => true);
    const carregar = vi.fn(async () => ({ painel: painel(), eventos: [] as EventoAB[], motivos: [] }));
    const base = { db, avisar, carregar };

    expect((await rodarRevisaoSemanal({ ...base, agora: hora("2026-10-05", "07:00") })).status).toBe("fora_do_horario");
    expect(carregar).not.toHaveBeenCalled();

    const r1 = await rodarRevisaoSemanal({ ...base, agora: hora("2026-10-05", "08:05") });
    expect(r1).toMatchObject({ status: "gerada", chave: "revisao:semanal:2026-10-05", avisou: true });
    expect(marcadores.get("revisao:semanal:2026-10-05")).toMatchObject({ revisao: true, semana: "28/09 a 04/10" });
    expect(String(marcadores.get("revisao:semanal:2026-10-05")?.texto)).toContain("Revisão semanal do outbound");

    expect((await rodarRevisaoSemanal({ ...base, agora: hora("2026-10-05", "08:10") })).status).toBe("ja_gerada");
    expect((await rodarRevisaoSemanal({ ...base, agora: hora("2026-10-07", "10:00") })).status).toBe("ja_gerada");
    expect(avisar).toHaveBeenCalledTimes(1);
    expect(carregar).toHaveBeenCalledTimes(1);

    // semana seguinte: gera outra
    expect((await rodarRevisaoSemanal({ ...base, agora: hora("2026-10-12", "09:00") })).status).toBe("gerada");
    expect(avisar).toHaveBeenCalledTimes(2);
  });

  it("falha ao carregar os dados não grava nada (tenta de novo na próxima rodada)", async () => {
    const criar = vi.fn(async () => true);
    const falha = rodarRevisaoSemanal({
      agora: hora("2026-10-05", "09:00"),
      db: { lerMarcador: async () => null, criarMarcador: criar },
      carregar: async () => {
        throw new Error("banco fora");
      },
    });
    await expect(falha).rejects.toThrow("banco fora");
    expect(criar).not.toHaveBeenCalled();
  });
});
