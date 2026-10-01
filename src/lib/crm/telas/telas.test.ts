import { describe, expect, it } from "vitest";
import { planejarAcao, motivosPara, pedeMotivo } from "./acoes";
import { agruparPorEtapa, cartaoDe, filtrarCartoes, opcoesDeFiltro } from "./cartao";
import { linkBuscaLinkedin, linkLigar, linkWhatsapp, telefoneInternacional } from "./contato";
import { decisorDoDossie, dossieParaLeitura, kitParaBlocos, linkedinDoDossie, notaLinkedinDoKit, roteiroDoKit, textoParaCopiar } from "./dossie";
import { montarFila, motivoEngajamento, type InteracaoFila, type LeadFila } from "./fila";
import { METAS_PADRAO, resolverMetas } from "./metas";
import { montarPainel, type AgregadoInteracao } from "./painel";
import { deInputLocal, fimDoDia, haQuanto, inicioDoDia, paraInputLocal } from "./tempo";
import type { Etapa } from "../tipos";

// 05/10/2026 14:00 em Brasília.
const AGORA = new Date("2026-10-05T17:00:00Z");
const iso = (h: number) => new Date(AGORA.getTime() + h * 3_600_000).toISOString();

let seq = 0;
function lead(over: Partial<LeadFila> = {}): LeadFila {
  seq++;
  return {
    id: seq,
    nome: `Lead ${seq}`,
    empresa: `Empresa ${seq}`,
    segmento: null,
    campanha: null,
    origem: "EA Hunter",
    etapa: "qualificado",
    temperatura: "frio",
    pontos: 0,
    entrega: { email: "nao_enviado", whatsapp: "nao_enviado", dm: "nao_enviada", linkedin: "nao_enviado" },
    proximoPasso: null,
    proximoPassoEm: null,
    proximoCanal: null,
    proximoToqueEm: null,
    pausada: false,
    canaisEncerrados: [],
    whatsapp: "11933400264",
    instagram: "@empresa",
    email: null,
    primeiroToqueEm: null,
    ultimoToqueCanal: null,
    reuniaoCanal: null,
    reuniaoToque: null,
    vendaCanal: null,
    vendaToque: null,
    atualizadoEm: null,
    ...over,
  };
}
const inter = (leadId: number, o: Partial<InteracaoFila>): InteracaoFila => ({
  leadId,
  canal: "dm",
  direcao: "saida",
  tipo: "enviado",
  data: iso(-1),
  pontos: 0,
  ...o,
});

describe("tempo", () => {
  it("dia de Brasília: 21h de Brasília ainda é o mesmo dia, e vira à meia-noite local", () => {
    const tarde = new Date("2026-10-06T00:30:00Z"); // 21:30 do dia 05 em Brasília
    expect(inicioDoDia(tarde).toISOString()).toBe("2026-10-05T03:00:00.000Z");
    expect(fimDoDia(tarde).toISOString()).toBe("2026-10-06T03:00:00.000Z");
  });
  it("ida e volta do campo datetime-local", () => {
    expect(paraInputLocal(AGORA)).toBe("2026-10-05T14:00");
    expect(deInputLocal("2026-10-05T14:00")?.toISOString()).toBe(AGORA.toISOString());
    expect(deInputLocal("lixo")).toBeNull();
  });
  it("tempo decorrido em texto curto", () => {
    expect(haQuanto(new Date(AGORA.getTime() - 5 * 60_000), AGORA)).toBe("há 5 min");
    expect(haQuanto(new Date(AGORA.getTime() - 3 * 3_600_000), AGORA)).toBe("há 3 h");
    expect(haQuanto(new Date(AGORA.getTime() - 26 * 3_600_000), AGORA)).toBe("há 1 dia");
  });
});

describe("contato", () => {
  it("telefone sem DDI ganha 55; com DDI fica como está", () => {
    expect(telefoneInternacional("(11) 93340-0264")).toBe("5511933400264");
    expect(telefoneInternacional("+55 11 93340-0264")).toBe("5511933400264");
    expect(telefoneInternacional("123")).toBeNull();
    expect(linkLigar("11933400264")).toBe("tel:+5511933400264");
    expect(linkWhatsapp("11933400264")).toBe("https://wa.me/5511933400264");
    expect(linkWhatsapp(null)).toBeNull();
  });
  it("busca do LinkedIn por nome e empresa", () => {
    expect(linkBuscaLinkedin("Maria Souza", "JM Metalúrgica")).toBe(
      "https://www.linkedin.com/search/results/people/?keywords=Maria+Souza+JM+Metal%C3%BArgica",
    );
  });
});

describe("Kanban: filtros e colunas", () => {
  const a = lead({ etapa: "engajado", temperatura: "engajado", pontos: 6, segmento: "Indústria", campanha: "#metalurgica", entrega: { email: "aberto", whatsapp: "nao_enviado", dm: "enviada", linkedin: "nao_enviado" }, proximoPassoEm: iso(-2) });
  const b = lead({ etapa: "engajado", pontos: 2, segmento: "Escola", campanha: "#escola", entrega: { email: "nao_enviado", whatsapp: "entregue", dm: "nao_enviada", linkedin: "nao_enviado" }, proximoPassoEm: iso(1) });
  const c = lead({ etapa: "qualificado", origem: "Diagnóstico", segmento: "Indústria", nome: "Zé Comércio" });
  const cartoes = [a, b, c].map(cartaoDe);

  it("cartão só leva o que é diferente do inicial", () => {
    expect(cartoes[0].entrega).toEqual({ email: "aberto", dm: "enviada" });
    expect(cartoes[2].entrega).toEqual({});
    expect(cartoes[2].proximoPasso).toBeUndefined();
  });
  it("filtra por etapa, segmento, campanha, temperatura e origem", () => {
    expect(filtrarCartoes(cartoes, { etapa: "engajado" }, AGORA)).toHaveLength(2);
    expect(filtrarCartoes(cartoes, { segmento: "Indústria" }, AGORA)).toHaveLength(2);
    expect(filtrarCartoes(cartoes, { campanha: "#escola" }, AGORA).map((x) => x.id)).toEqual([b.id]);
    expect(filtrarCartoes(cartoes, { temperatura: "engajado" }, AGORA).map((x) => x.id)).toEqual([a.id]);
    expect(filtrarCartoes(cartoes, { origem: "Diagnóstico" }, AGORA).map((x) => x.id)).toEqual([c.id]);
  });
  it("canal = já houve toque; status = estado exato", () => {
    expect(filtrarCartoes(cartoes, { canal: "email" }, AGORA).map((x) => x.id)).toEqual([a.id]);
    expect(filtrarCartoes(cartoes, { canal: "whatsapp" }, AGORA).map((x) => x.id)).toEqual([b.id]);
    expect(filtrarCartoes(cartoes, { entrega: "email:aberto" }, AGORA).map((x) => x.id)).toEqual([a.id]);
    expect(filtrarCartoes(cartoes, { entrega: "dm:enviada" }, AGORA)).toHaveLength(1);
    expect(filtrarCartoes(cartoes, { entrega: "email:clicado" }, AGORA)).toHaveLength(0);
  });
  it("data do próximo passo: vencido, hoje, 7 dias, sem data", () => {
    const vencido = cartaoDe(lead({ proximoPassoEm: iso(-48) }));
    const todos = [...cartoes, vencido];
    expect(filtrarCartoes(todos, { proximoPasso: "vencido" }, AGORA).map((x) => x.id)).toEqual([vencido.id]);
    expect(filtrarCartoes(todos, { proximoPasso: "hoje" }, AGORA).map((x) => x.id)).toEqual([a.id, b.id]);
    expect(filtrarCartoes(todos, { proximoPasso: "7dias" }, AGORA)).toHaveLength(2);
    expect(filtrarCartoes(todos, { proximoPasso: "sem_data" }, AGORA).map((x) => x.id)).toEqual([c.id]);
  });
  it("busca ignora acento e caixa", () => {
    expect(filtrarCartoes(cartoes, { busca: "ze comercio" }, AGORA).map((x) => x.id)).toEqual([c.id]);
  });
  it("colunas: todas as etapas existem; mais quente primeiro", () => {
    const col = agruparPorEtapa(cartoes);
    expect(Object.keys(col)).toHaveLength(11);
    expect(col.engajado.map((x) => x.id)).toEqual([a.id, b.id]);
    expect(col.ganho).toEqual([]);
  });
  it("opções de filtro sem repetição", () => {
    expect(opcoesDeFiltro(cartoes).segmentos).toEqual(["Escola", "Indústria"]);
  });
});

describe("ações", () => {
  it("mover depois de reunião para Nutrição exige motivo da lista certa", () => {
    expect(pedeMotivo("reuniao_feita", "nutricao_continua")).toBe(true);
    expect(pedeMotivo("em_cadencia", "nutricao_continua")).toBe(false);
    expect(planejarAcao({ acao: "mover", leadId: 1, para: "nutricao_continua" }, "reuniao_feita")).toEqual({ ok: false, erro: "Escolha o motivo." });
    expect(planejarAcao({ acao: "mover", leadId: 1, para: "ganho", motivo: "momento" }, "proposta_enviada")).toMatchObject({ ok: false });
    const ok = planejarAcao({ acao: "mover", leadId: 1, para: "ganho", motivo: "valor_percebido", detalhe: "Fechou Implantação" }, "proposta_enviada");
    expect(ok.ok && ok.interacoes[0]).toMatchObject({ tipo: "movimento_manual", canal: "sistema", metadados: { para: "ganho", motivo: "valor_percebido" } });
    expect(ok.ok && ok.lead.motivoResultado).toEqual({ motivo: "valor_percebido", detalhe: "Fechou Implantação" });
  });
  it("mover sem reunião não pede motivo; etapa igual ou inválida é recusada", () => {
    const r = planejarAcao({ acao: "mover", leadId: 1, para: "respondeu" }, "em_cadencia");
    expect(r.ok && r.interacoes[0].conteudo).toBe("Movido de Em cadência para Respondeu");
    expect(planejarAcao({ acao: "mover", leadId: 1, para: "respondeu" }, "respondeu")).toMatchObject({ ok: false });
    expect(planejarAcao({ acao: "mover", leadId: 1, para: "perdido" }, "respondeu")).toMatchObject({ ok: false });
  });
  it("Ganho oferece só motivos de ganho; Nutrição não oferece os de ganho", () => {
    expect(motivosPara("ganho").map((m) => m.value)).toContain("valor_percebido");
    expect(motivosPara("nutricao_continua").map((m) => m.value)).not.toContain("valor_percebido");
    expect(motivosPara("nutricao_continua").map((m) => m.value)).toContain("momento");
  });
  it("atendeu e sem resposta gravam resultado_ligacao", () => {
    const r = planejarAcao({ acao: "resultado", leadId: 1, resultado: "sem_resposta" }, "engajado");
    expect(r.ok && r.interacoes).toEqual([expect.objectContaining({ tipo: "resultado_ligacao", canal: "ligacao", direcao: "saida", metadados: { resultado: "sem_resposta" } })]);
  });
  it("reunião marcada pela ligação: resultado + agendou com origem ligação, e guarda o horário", () => {
    expect(planejarAcao({ acao: "resultado", leadId: 1, resultado: "reuniao_marcada" }, "engajado")).toMatchObject({ ok: false });
    const r = planejarAcao({ acao: "resultado", leadId: 1, resultado: "reuniao_marcada", canal: "ligacao", reuniaoEm: iso(24) }, "engajado");
    expect(r.ok && r.interacoes.map((i) => i.tipo)).toEqual(["resultado_ligacao", "agendou"]);
    expect(r.ok && r.interacoes[1].metadados).toMatchObject({ canalOrigem: "ligacao" });
    expect(r.ok && r.lead).toMatchObject({ proximoPasso: "Reunião de 20 min", proximoPassoEm: iso(24) });
  });
  it("sem interesse exige motivo e leva para Nutrição contínua, nunca perdido", () => {
    expect(planejarAcao({ acao: "resultado", leadId: 1, resultado: "sem_interesse" }, "engajado")).toMatchObject({ ok: false });
    const r = planejarAcao({ acao: "resultado", leadId: 1, resultado: "sem_interesse", canal: "ligacao", motivo: "momento" }, "engajado");
    expect(r.ok && r.interacoes.map((i) => i.tipo)).toEqual(["resultado_ligacao", "movimento_manual"]);
    expect(r.ok && r.interacoes[1].metadados).toMatchObject({ para: "nutricao_continua", motivo: "momento" });
    expect(JSON.stringify(r)).not.toContain("perdido");
  });
  it("LinkedIn enviado e resposta manual", () => {
    const l = planejarAcao({ acao: "resultado", leadId: 1, resultado: "enviado_linkedin" }, "em_cadencia");
    expect(l.ok && l.interacoes[0]).toMatchObject({ canal: "linkedin", tipo: "enviado" });
    const r = planejarAcao({ acao: "resultado", leadId: 1, resultado: "respondi", canal: "whatsapp" }, "respondeu");
    expect(r.ok && r.interacoes[0]).toMatchObject({ canal: "whatsapp", tipo: "enviado", direcao: "saida" });
  });
  it("próximo passo: texto vazio limpa a data", () => {
    expect(planejarAcao({ acao: "proximo_passo", leadId: 1, texto: "  ", em: iso(5) }, "respondeu")).toMatchObject({ ok: true, lead: { proximoPasso: null } });
    const r = planejarAcao({ acao: "proximo_passo", leadId: 1, texto: "Ligar sexta", em: iso(48) }, "respondeu");
    expect(r.ok && r.lead).toEqual({ proximoPasso: "Ligar sexta", proximoPassoEm: iso(48) });
    expect(planejarAcao({ acao: "proximo_passo", leadId: 1, texto: "x", em: "não é data" }, "respondeu")).toMatchObject({ ok: false });
  });
});

describe("Fila do dia", () => {
  it("resposta pendente: só enquanto não há saída depois da última entrada; a mais antiga vem primeiro", () => {
    const velha = lead({ etapa: "respondeu" });
    const nova = lead({ etapa: "respondeu" });
    const respondida = lead({ etapa: "respondeu" });
    const fila = montarFila(
      [nova, velha, respondida],
      [
        inter(velha.id, { direcao: "entrada", tipo: "respondido", data: iso(-20), conteudo: "Pode ser terça" }),
        inter(nova.id, { direcao: "entrada", tipo: "respondido", data: iso(-2), canal: "whatsapp" }),
        inter(respondida.id, { direcao: "entrada", tipo: "respondido", data: iso(-5) }),
        inter(respondida.id, { direcao: "saida", tipo: "enviado", data: iso(-4) }),
      ],
      AGORA,
    );
    expect(fila.respostas.map((i) => i.leadId)).toEqual([velha.id, nova.id]);
    expect(fila.respostas[0]).toMatchObject({ mensagem: "Pode ser terça", desdeTexto: "há 20 h" });
    expect(fila.respostas[1].motivo).toContain("WhatsApp");
  });
  it("nova resposta depois da nossa volta a ser pendente", () => {
    const l = lead({ etapa: "respondeu" });
    const fila = montarFila(
      [l],
      [inter(l.id, { direcao: "saida", tipo: "enviado", data: iso(-6) }), inter(l.id, { direcao: "entrada", tipo: "respondido", data: iso(-1) })],
      AGORA,
    );
    expect(fila.respostas).toHaveLength(1);
  });
  it("engajado traz o motivo e some depois de um resultado de ligação posterior ao último sinal", () => {
    const e1 = lead({ etapa: "engajado", pontos: 4 });
    const e2 = lead({ etapa: "engajado", pontos: 8 });
    const tratado = lead({ etapa: "engajado", pontos: 6 });
    const fila = montarFila(
      [e1, e2, tratado],
      [
        inter(e1.id, { direcao: "entrada", tipo: "clicado", canal: "email", data: iso(-3), pontos: 3 }),
        inter(e1.id, { direcao: "entrada", tipo: "aberto", canal: "email", data: iso(-4), pontos: 1 }),
        inter(e2.id, { direcao: "entrada", tipo: "deu_play", canal: "sistema", data: iso(-2), pontos: 4 }),
        inter(tratado.id, { direcao: "entrada", tipo: "clicado", canal: "email", data: iso(-10), pontos: 3 }),
        inter(tratado.id, { tipo: "resultado_ligacao", canal: "ligacao", data: iso(-1) }),
      ],
      AGORA,
    );
    expect(fila.engajados.map((i) => i.leadId)).toEqual([e2.id, e1.id]);
    expect(fila.engajados[1].motivo).toBe("Clicou no link (3 pontos), abriu o e-mail (1 ponto)");
  });
  it("motivo do engajamento ignora sinais fora da janela de 7 dias", () => {
    const m = motivoEngajamento([inter(1, { tipo: "clicado", direcao: "entrada", data: iso(-24 * 9), pontos: 3 })], AGORA);
    expect(m).toBe("Passou dos pontos de engajamento da semana");
  });
  it("ligação devida: só com telefone, próximo canal ligação, data até hoje e sem resultado posterior; traz o roteiro", () => {
    const kit = { ligacao: { roteiro: "Oi, aqui é o Thiago...", objecoes: ["Sem tempo"] } };
    const devida = lead({ proximoCanal: "ligacao", proximoToqueEm: iso(-2), kit });
    const amanha = lead({ proximoCanal: "ligacao", proximoToqueEm: iso(20) });
    const semTel = lead({ proximoCanal: "ligacao", proximoToqueEm: iso(-2), whatsapp: null });
    const pausada = lead({ proximoCanal: "ligacao", proximoToqueEm: iso(-2), pausada: true });
    const feita = lead({ proximoCanal: "ligacao", proximoToqueEm: iso(-5) });
    const atrasada = lead({ proximoCanal: "ligacao", proximoToqueEm: iso(-50) });
    const fila = montarFila(
      [amanha, semTel, pausada, feita, devida, atrasada],
      [inter(feita.id, { tipo: "resultado_ligacao", canal: "ligacao", data: iso(-1) })],
      AGORA,
    );
    expect(fila.ligacoes.map((i) => i.leadId)).toEqual([atrasada.id, devida.id]);
    expect(fila.ligacoes[0].motivo).toContain("atrasada");
    expect(fila.ligacoes[1].roteiro).toContain("Oi, aqui é o Thiago");
    expect(fila.ligacoes[1].ligar).toBe("tel:+5511933400264");
  });
  it("reuniões do dia: etapa Reunião marcada com data de hoje, por horário", () => {
    const cedo = lead({ etapa: "reuniao_marcada", proximoPassoEm: iso(-2) });
    const tarde = lead({ etapa: "reuniao_marcada", proximoPassoEm: iso(3) });
    const amanha = lead({ etapa: "reuniao_marcada", proximoPassoEm: iso(24) });
    const fila = montarFila([tarde, amanha, cedo], [], AGORA);
    expect(fila.reunioes.map((i) => i.leadId)).toEqual([cedo.id, tarde.id]);
  });
  it("reunião de dias atrás sem resultado continua na fila, mais antiga primeiro", () => {
    const antiga = lead({ etapa: "reuniao_marcada", proximoPassoEm: iso(-50) });
    const hoje = lead({ etapa: "reuniao_marcada", proximoPassoEm: iso(1) });
    const semData = lead({ etapa: "reuniao_marcada", proximoPassoEm: null });
    const fila = montarFila([hoje, semData, antiga], [], AGORA);
    expect(fila.reunioes.map((i) => i.leadId)).toEqual([antiga.id, hoje.id]);
    expect(fila.reunioes[0].motivo).toContain("sem resultado registrado");
    expect(fila.reunioes[1].motivo).toBe("Reunião de 20 minutos hoje");
  });
  it("LinkedIn: link direto do dossiê ou busca por nome e empresa, com a nota do kit; some depois de enviado", () => {
    const direto = lead({ proximoCanal: "linkedin", proximoToqueEm: iso(-1), dossie: { decisor: { nome: "Ana Lima", linkedin: "https://www.linkedin.com/in/ana-lima/" } }, kit: { linkedin: { nota: "Oi Ana, vi o trabalho da empresa." } } });
    const busca = lead({ proximoCanal: "linkedin", proximoToqueEm: iso(-1), nome: "Carlos", empresa: "Metal SA", dossie: { decisor: "Carlos Dias" } });
    const enviado = lead({ proximoCanal: "linkedin", proximoToqueEm: iso(-5) });
    const fila = montarFila([direto, busca, enviado], [inter(enviado.id, { canal: "linkedin", tipo: "enviado", data: iso(-1) })], AGORA);
    expect(fila.linkedin).toHaveLength(2);
    const d = fila.linkedin.find((i) => i.leadId === direto.id)!;
    expect(d).toMatchObject({ linkedinUrl: "https://www.linkedin.com/in/ana-lima/", linkedinDireto: true, notaLinkedin: "Oi Ana, vi o trabalho da empresa." });
    const b = fila.linkedin.find((i) => i.leadId === busca.id)!;
    expect(b.linkedinUrl).toBe("https://www.linkedin.com/search/results/people/?keywords=Carlos+Dias+Metal+SA");
    expect(b.linkedinDireto).toBe(false);
  });
  it("um lead aparece uma vez só, na seção de maior prioridade", () => {
    const l = lead({ etapa: "engajado", pontos: 6, proximoCanal: "ligacao", proximoToqueEm: iso(-1) });
    const fila = montarFila([l], [inter(l.id, { direcao: "entrada", tipo: "clicado", data: iso(-1), pontos: 3 })], AGORA);
    expect(fila.engajados).toHaveLength(1);
    expect(fila.engajados[0].ligacaoDevida).toBe(true);
    expect(fila.ligacoes).toHaveLength(0);
  });
});

describe("Painel", () => {
  const vazioAgg: AgregadoInteracao[] = [];
  const ag = (leadId: number, canal: string, tipo: string, direcao = "saida", intencao: string | null = null): AgregadoInteracao => ({ leadId, canal, tipo, direcao, intencao, n: 1 });

  it("base vazia: tudo zero e metas sem dados, nada estimado", () => {
    const p = montarPainel([lead(), lead()], vazioAgg, METAS_PADRAO);
    expect(p.totais).toMatchObject({ leads: 2, contatados: 0, respostas: 0, reunioes: 0, vendas: 0 });
    expect(p.metas.every((m) => m.situacao === "sem_dados" && m.real === null)).toBe(true);
    expect(p.funil[0]).toMatchObject({ rotulo: "Captado", chegaram: 2, conversao: null });
    expect(p.funil[1]).toMatchObject({ chegaram: 2 });
    expect(p.funil[2]).toMatchObject({ chegaram: 0, conversao: 0 });
  });

  // Base conhecida, contada à mão:
  //  A: DM enviada, respondeu por DM, reunião marcada (veio da DM, toque dm1)
  //  B: DM enviada, sem resposta
  //  C: e-mail enviado e entregue, aberto, clicado, etapa Engajado
  //  D: e-mail devolvido (bounce)
  //  E: ganho (veio do e-mail, toque email1), passou por reunião feita
  //  F: só captado
  const A = lead({ etapa: "reuniao_marcada", segmento: "Indústria", campanha: "#metal", reuniaoCanal: "dm", reuniaoToque: "dm1", entrega: { email: "nao_enviado", whatsapp: "nao_enviado", dm: "enviada", linkedin: "nao_enviado" } });
  const B = lead({ etapa: "em_cadencia", segmento: "Indústria", campanha: "#metal", entrega: { email: "nao_enviado", whatsapp: "nao_enviado", dm: "enviada", linkedin: "nao_enviado" } });
  const C = lead({ etapa: "engajado", temperatura: "engajado", segmento: "Escola", entrega: { email: "clicado", whatsapp: "nao_enviado", dm: "nao_enviada", linkedin: "nao_enviado" } });
  const D = lead({ etapa: "em_cadencia", segmento: "Escola", entrega: { email: "devolvido", whatsapp: "nao_enviado", dm: "nao_enviada", linkedin: "nao_enviado" } });
  const E = lead({ etapa: "ganho", segmento: "Indústria", reuniaoCanal: "email", reuniaoToque: "email1", vendaCanal: "email", vendaToque: "email1", entrega: { email: "aberto", whatsapp: "nao_enviado", dm: "nao_enviada", linkedin: "nao_enviado" } });
  const F = lead({ etapa: "captado" });
  const leads = [A, B, C, D, E, F];
  const agg: AgregadoInteracao[] = [
    ag(A.id, "dm", "enviado"),
    ag(B.id, "dm", "enviado"),
    ag(A.id, "dm", "respondido", "entrada", "positiva"),
    ag(A.id, "dm", "agendou", "entrada"),
    ag(C.id, "email", "enviado"),
    ag(C.id, "email", "entregue"),
    ag(C.id, "email", "aberto"),
    ag(C.id, "email", "clicado"),
    ag(D.id, "email", "enviado"),
    ag(D.id, "email", "bounce"),
    ag(E.id, "email", "enviado"),
    ag(E.id, "email", "respondido", "entrada", "duvida"),
  ];
  const p = montarPainel(leads, agg, METAS_PADRAO);

  it("totais e funil batem com a contagem manual", () => {
    // contatados: A, B, C, D, E = 5. Respostas: A (DM) e E (e-mail, e etapa ganho) = 2. Reuniões: A e E = 2. Vendas: E = 1.
    expect(p.totais).toEqual({ leads: 6, contatados: 5, respostas: 2, reunioes: 2, vendas: 1 });
    expect(p.funil.map((x) => x.chegaram)).toEqual([6, 5, 5, 2, 2, 1, 1, 1]);
    expect(p.funil[3].conversao).toBeCloseTo(40); // 2 de 5 responderam
    expect(p.funil[5].conversao).toBeCloseTo(50); // 1 de 2 reuniões chegou a reunião feita
    expect(p.porEtapa.find((x) => x.etapa === "engajado")?.agora).toBe(1);
    expect(p.temperaturas).toEqual({ frio: 5, morno: 0, engajado: 1 });
  });
  it("por canal conta leads distintos", () => {
    const dm = p.canais.find((c) => c.canal === "dm")!;
    expect(dm).toMatchObject({ enviados: 2, respostas: 1, reunioes: 1, entregues: null });
    const email = p.canais.find((c) => c.canal === "email")!;
    // e-mail enviado: C, D, E (por evento) + os de estado: C, D, E. Entregues: C e E (aberto). Abertos: C e E. Cliques: C.
    expect(email).toMatchObject({ enviados: 3, entregues: 2, abertos: 2, cliques: 1, respostas: 1, reunioes: 1 });
  });
  it("por segmento e campanha", () => {
    const ind = p.segmentos.find((s) => s.nome === "Indústria")!;
    expect(ind).toMatchObject({ leads: 3, contatados: 3, respostas: 2, reunioes: 2, vendas: 1 });
    expect(p.segmentos.find((s) => s.nome === "Sem segmento")?.leads).toBe(1);
    expect(p.campanhas.find((s) => s.nome === "#metal")).toMatchObject({ leads: 2, respostas: 1 });
  });
  it("origem das reuniões e das vendas", () => {
    expect(p.origemReunioes).toEqual(expect.arrayContaining([{ canal: "dm", toque: "dm1", total: 1 }, { canal: "email", toque: "email1", total: 1 }]));
    expect(p.origemVendas).toEqual([{ canal: "email", toque: "email1", total: 1 }]);
  });
  it("metas: só com dado real; e-mail entregue = enviados menos devolvidos", () => {
    const m = (k: string) => p.metas.find((x) => x.chave === k)!;
    expect(m("entregaEmail")).toMatchObject({ numerador: 2, denominador: 3, situacao: "abaixo" }); // 66,7% contra 95%
    expect(m("entregaEmail").real).toBeCloseTo(66.67, 1);
    expect(m("respostaDm")).toMatchObject({ numerador: 1, denominador: 2, real: 50, situacao: "na_meta" });
    expect(m("respostaEmail")).toMatchObject({ numerador: 1, denominador: 3 });
    expect(m("respostaWhatsapp").situacao).toBe("sem_dados");
    expect(m("respostasPositivas")).toMatchObject({ numerador: 2, denominador: 2, real: 100 });
    expect(m("reuniaoMarcada")).toMatchObject({ numerador: 2, denominador: 5, real: 40 });
    expect(m("comparecimento").situacao).toBe("sem_dados");
    expect(m("respostaDm").amostraPequena).toBe(true);
  });
  it("comparecimento e reunião com próximo passo vêm do botão Reunião feita", () => {
    const desf = (id: number, desfecho: string) => ({ ...ag(id, "sistema", "movimento_manual", "saida"), desfecho });
    const q = montarPainel(leads, [...agg, desf(A.id, "proposta_a_enviar"), desf(C.id, "nutricao_continua"), desf(D.id, "reagendou"), desf(E.id, "ganho")], METAS_PADRAO);
    const mm = (c: string) => q.metas.find((x) => x.chave === c)!;
    // 4 reuniões com resultado, 3 aconteceram (D reagendou); das 3, A e E saíram com próximo passo.
    expect(mm("comparecimento")).toMatchObject({ numerador: 3, denominador: 4, real: 75, situacao: "na_meta" });
    expect(mm("reuniaoComProximoPasso")).toMatchObject({ numerador: 2, denominador: 3 });
  });
  it("metas editáveis: valor inválido volta ao padrão do plano", () => {
    expect(resolverMetas({ respostaDm: 12, entregaEmail: 400, respostaEmail: null })).toMatchObject({ respostaDm: 12, entregaEmail: 95, respostaEmail: 3 });
    const q = montarPainel(leads, agg, resolverMetas({ respostaDm: 60 }));
    expect(q.metas.find((x) => x.chave === "respostaDm")?.situacao).toBe("abaixo");
  });
});

describe("Dossiê e kit", () => {
  it("dossiê vira pares legíveis, sem JSON cru", () => {
    const pares = dossieParaLeitura({ decisor: { nome: "Ana Lima", cargo: "Sócia" }, dorProvavel: "Gestão depende do dono", noPerfil: true, faltam: ["e-mail", "site"], vazio: "", nulo: null });
    expect(pares).toEqual([
      { rotulo: "Decisor: Nome", valor: "Ana Lima" },
      { rotulo: "Decisor: Cargo", valor: "Sócia" },
      { rotulo: "Dor provável", valor: "Gestão depende do dono" },
      { rotulo: "Está no perfil", valor: "Sim" },
      { rotulo: "Dados que faltam", valor: "e-mail\nsite" },
    ]);
    expect(dossieParaLeitura(null)).toEqual([]);
    expect(dossieParaLeitura("texto solto")).toEqual([{ rotulo: "Dossiê", valor: "texto solto" }]);
    expect(dossieParaLeitura('{"gancho":"Vi o post sobre a expansão"}')).toEqual([{ rotulo: "Gancho", valor: "Vi o post sobre a expansão" }]);
  });
  it("acha o decisor e o LinkedIn em qualquer forma", () => {
    expect(decisorDoDossie({ decisor: { nome: "Ana" } })).toBe("Ana");
    expect(decisorDoDossie({ decisor: "Bia" })).toBe("Bia");
    expect(decisorDoDossie({})).toBeNull();
    expect(linkedinDoDossie({ contatos: ["linkedin.com/in/bia-souza"] })).toBe("https://linkedin.com/in/bia-souza");
    expect(linkedinDoDossie({ decisor: "Bia" })).toBeNull();
  });
  const kit = {
    dm1: "Oi, tudo bem?",
    dm2: ["Dica prática 1", "Dica prática 2"],
    email1: { corpo: "Corpo do e-mail", assunto: "Assunto curto" },
    whatsapp1: "Posso te mandar um áudio?",
    ligacao: { roteiro: "Abertura de 30 s", objecoes: [{ objecao: "Sem tempo", resposta: "São 20 minutos" }] },
    notaLinkedin: "Oi, vi seu trabalho.",
  };
  it("kit vira blocos por canal, com assunto primeiro", () => {
    const b = kitParaBlocos(kit);
    expect(b.find((x) => x.titulo === "DM 1")).toMatchObject({ canal: "dm", partes: [{ texto: "Oi, tudo bem?" }] });
    expect(b.filter((x) => x.canal === "dm")).toHaveLength(3);
    const email = b.find((x) => x.canal === "email")!;
    expect(email.titulo).toBe("E-mail 1");
    expect(textoParaCopiar(email)).toBe("Assunto: Assunto curto\n\nCorpo do e-mail");
    expect(b.find((x) => x.canal === "whatsapp")?.titulo).toBe("WhatsApp 1");
    expect(b.filter((x) => x.canal === "ligacao").length).toBeGreaterThanOrEqual(2);
  });
  it("roteiro de ligação e nota do LinkedIn saem do kit; sem kit, null", () => {
    expect(roteiroDoKit(kit)).toContain("Abertura de 30 s");
    expect(roteiroDoKit(kit)).toContain("Sem tempo");
    expect(notaLinkedinDoKit(kit)).toBe("Oi, vi seu trabalho.");
    expect(roteiroDoKit(null)).toBeNull();
    expect(notaLinkedinDoKit(undefined)).toBeNull();
    expect(kitParaBlocos("não é json")).toEqual([]);
  });
});

describe("Reunião feita (F8)", () => {
  const agora = new Date("2026-10-05T18:00:00Z");
  const feita = (desfecho: string, extra: Record<string, unknown> = {}, etapa: Etapa = "reuniao_marcada") =>
    planejarAcao({ acao: "resultado", leadId: 1, resultado: "reuniao_feita", desfecho, ...extra }, etapa, agora);

  it("exige resultado válido e lead em etapa de reunião", () => {
    expect(feita("")).toEqual({ ok: false, erro: "Informe o resultado da reunião." });
    expect(feita("qualquer")).toMatchObject({ ok: false });
    expect(feita("ganho", { motivo: "valor_percebido" }, "engajado")).toEqual({ ok: false, erro: "Este lead não está em reunião." });
  });

  it("proposta a enviar: vai para Reunião feita com prazo de 24h", () => {
    const r = feita("proposta_a_enviar");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.interacoes).toHaveLength(1);
    expect(r.interacoes[0]).toMatchObject({ tipo: "movimento_manual", metadados: { para: "reuniao_feita" } });
    expect(r.lead).toMatchObject({ proximoPasso: "Enviar resumo e proposta", proximoPassoEm: "2026-10-06T18:00:00.000Z" });
  });

  it("proposta enviada: vai para Proposta enviada e agenda o D2", () => {
    const r = feita("proposta_enviada");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.interacoes[0].metadados).toMatchObject({ para: "proposta_enviada" });
  });

  it("ganho e nutrição pedem motivo da lista certa", () => {
    expect(feita("ganho")).toEqual({ ok: false, erro: "Escolha o motivo." });
    expect(feita("ganho", { motivo: "momento" })).toMatchObject({ ok: false });
    expect(feita("nutricao_continua", { motivo: "valor_percebido" })).toMatchObject({ ok: false });
    const g = feita("ganho", { motivo: "valor_percebido", detalhe: "Fechou Implantação" });
    expect(g.ok && g.lead.motivoResultado).toEqual({ motivo: "valor_percebido", detalhe: "Fechou Implantação" });
    const n = feita("nutricao_continua", { motivo: "preco" });
    expect(n.ok && n.interacoes[0].metadados).toMatchObject({ para: "nutricao_continua", motivo: "preco" });
  });

  it("reagendar exige a nova data e mantém Reunião marcada", () => {
    expect(feita("reagendou")).toMatchObject({ ok: false });
    const r = feita("reagendou", { reuniaoEm: "2026-10-09T17:00:00Z" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.interacoes[0]).toMatchObject({ tipo: "agendou" });
      expect(r.lead.proximoPassoEm).toBe("2026-10-09T17:00:00.000Z");
    }
  });
});
