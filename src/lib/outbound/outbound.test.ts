import { beforeAll, describe, expect, it, vi } from "vitest";
import { PESOS_PADRAO } from "@/lib/crm/pesos";
import type { CrmDb } from "@/lib/crm/registrar";
import type { EstadoLead } from "@/lib/crm/regras";
import { montarMensagemOutlook } from "@/lib/assessor/microsoft-graph";
import { agendamentoDoLead, canaisDisponiveis, emailDevido, pendentes, type Historico, type LeadCadencia } from "./cadencia";
import { classificarMensagem, pediuDescadastro, type MensagemCaixa } from "./caixa";
import { canaisComEnvioReal, envioRealLigado, lerCaixaLigado, REMETENTE, tetoEmailPorDia } from "./config";
import { interacaoDoGesto, provaDoDossie, resolverProva, urlDoCalendly } from "./conversa";
import { diaParaConversa, eventoOutlookParaOcupado, regraFixa, sugerirDia } from "./dia-sugerido";
import { partesDoKit } from "./kit";
import { renderEmailOutbound as renderF7, REMETENTE_OUTBOUND, REMETENTE_OUTBOUND_ENDERECO, type DadosEmailOutbound } from "./email/render";
import { processarCaixa, reconciliarAgenda, rodar, type Deps, type EventoDeAgenda, type LeadCandidato, type OutboundDb } from "./orquestrador";
import { pausaPorBounce, planejarEmails, referenciaDoPlano, type CandidatoEmail } from "./plano";
import { codigoDeClique, lerCodigoDeClique, lerCodigoDoPixel, rastreadorDoLead, urlDeClique, urlDoPixel } from "./rastreio";
import { tratarAbertura, tratarClique } from "./rastreio-registro";
import { recalcularTemperatura } from "./recalcular";
import { dataIso, emBrasilia, textoDoDia } from "./tempo";
import { preencher, problemaDoTexto } from "./texto";
import { tratarGesto } from "./conversa-servidor";

beforeAll(() => {
  process.env.PAYLOAD_SECRET = "segredo-de-teste";
});

/* ---------------------------------------------------------------- fixtures */

const sempre0 = () => 0; // intervalo sempre de 5 min

const hora = (dia: string, hm: string) => emBrasilia(dia, hm);

function lead(over: Partial<LeadCadencia> & { id: number }): LeadCadencia {
  return {
    etapa: "em_cadencia",
    temperatura: "frio",
    pausada: false,
    optOut: false,
    email: `lead${over.id}@gmail.com`,
    instagram: `@lead${over.id}`,
    whatsapp: "+55 11 93340-0001",
    canaisEncerrados: [],
    statusEntrega: { email: "nao_enviado", whatsapp: "nao_enviado", dm: "enviada", linkedin: "nao_enviado" },
    primeiroToqueEm: hora("2026-10-05", "10:00"),
    linkedinDecisor: false,
    ...over,
  };
}

const dm1: Historico = { canal: "dm", tipo: "enviado", data: hora("2026-10-05", "10:00"), toque: "dm1" };

/* ---------------------------------------------------------------- cadência */

describe("cadência adaptativa", () => {
  it("só conta os canais que o lead tem", () => {
    const completo = canaisDisponiveis(lead({ id: 1, linkedinDecisor: true }));
    expect([...completo].sort()).toEqual(["dm", "email", "ligacao", "linkedin", "whatsapp"]);
    const soInstagram = canaisDisponiveis(lead({ id: 2, email: null, whatsapp: null }));
    expect([...soInstagram]).toEqual(["dm"]);
  });

  it("canal encerrado, devolvido, sem WhatsApp e e-mail suprimido saem da cadência", () => {
    const l = lead({
      id: 3,
      canaisEncerrados: ["whatsapp"],
      statusEntrega: { email: "devolvido", whatsapp: "nao_enviado", dm: "falhou", linkedin: "nao_enviado" },
    });
    expect([...canaisDisponiveis(l)]).toEqual(["ligacao"]);
    expect(canaisDisponiveis(lead({ id: 4, emailSuprimido: true })).has("email")).toBe(false);
  });

  it("segue a tabela de dias do plano: D1 e-mail 1, D3 DM 2, D4 WhatsApp 1, D6 e-mail 2, D14 último", () => {
    const p = pendentes(lead({ id: 5 }), [dm1]);
    const por = Object.fromEntries(p.map((x) => [x.toque, x.dia]));
    expect(por).toMatchObject({ email1: 1, dm2: 3, whatsapp1: 4, ligacao: 8, ultimo: 14 });
    expect(por.dm1).toBeUndefined(); // já feito
    expect(por.email2).toBeUndefined(); // o 2º e-mail só vence depois do 1º
  });

  it("sem WhatsApp, o D4 vira DM extra; sem e-mail, o e-mail é pulado", () => {
    const p = pendentes(lead({ id: 6, whatsapp: null, email: null }), [dm1]);
    const ids = p.map((x) => x.toque);
    expect(ids).toContain("dm2");
    expect(ids).not.toContain("email1");
    expect(ids).not.toContain("whatsapp1");
    // dm2 e dm_extra são os 2º e 3º toques de DM; só o primeiro pendente do canal aparece
    expect(p.filter((x) => x.canal === "dm" && x.toque !== "ultimo")).toHaveLength(1);
  });

  it("depois do e-mail 1 feito, o e-mail 2 vence no D6", () => {
    const email1: Historico = { canal: "email", tipo: "enviado", data: hora("2026-10-06", "09:00"), toque: "email1" };
    const e = pendentes(lead({ id: 7 }), [dm1, email1]).find((x) => x.canal === "email");
    expect(e).toMatchObject({ toque: "email2", dia: 6 });
  });

  it("último toque vai ao canal com mais sinal de vida", () => {
    const l = lead({ id: 8, statusEntrega: { email: "nao_enviado", whatsapp: "lido", dm: "enviada", linkedin: "nao_enviado" } });
    expect(pendentes(l, [dm1]).find((x) => x.toque === "ultimo")?.canal).toBe("whatsapp");
    const clicou = lead({ id: 9, statusEntrega: { email: "clicado", whatsapp: "lido", dm: "enviada", linkedin: "nao_enviado" } });
    expect(pendentes(clicou, [dm1]).find((x) => x.toque === "ultimo")?.canal).toBe("email");
  });

  it("agenda o próximo toque (canal e dia) e manda o engajado para a fila de ligação no mesmo dia", () => {
    const hoje = hora("2026-10-06", "08:00");
    const ag = agendamentoDoLead(lead({ id: 10 }), [dm1], hoje);
    expect(ag).toMatchObject({ toque: "email1", canal: "email" });
    expect(dataIso(ag!.em)).toBe("2026-10-06");
    const eng = agendamentoDoLead(lead({ id: 11, etapa: "engajado" }), [dm1], hoje);
    expect(eng).toMatchObject({ canal: "ligacao", toque: "ligacao" });
    expect(dataIso(eng!.em)).toBe("2026-10-06");
    // já ligou: volta ao calendário normal
    const ligou: Historico = { canal: "ligacao", tipo: "resultado_ligacao", data: hora("2026-10-06", "07:00") };
    expect(agendamentoDoLead(lead({ id: 12, etapa: "engajado" }), [dm1, ligou], hoje)?.canal).not.toBe("ligacao");
  });

  it("e-mail devido: só depois de vencer, no máximo 1 toque por dia por lead e 2 dias entre e-mails", () => {
    const l = lead({ id: 13 });
    expect(emailDevido(l, [dm1], hora("2026-10-05", "15:00"))).toBeNull(); // D0, ainda não venceu
    expect(emailDevido(l, [dm1], hora("2026-10-06", "09:00"))).toMatchObject({ toque: "email1" });
    const dmHoje: Historico = { canal: "dm", tipo: "enviado", data: hora("2026-10-06", "08:30"), toque: "dm2" };
    expect(emailDevido(l, [dm1, dmHoje], hora("2026-10-06", "09:00"))).toBeNull();
    const email1: Historico = { canal: "email", tipo: "enviado", data: hora("2026-10-10", "09:00"), toque: "email1" };
    expect(emailDevido(l, [dm1, email1], hora("2026-10-11", "09:00"))).toBeNull(); // menos de 2 dias
    expect(emailDevido(l, [dm1, email1], hora("2026-10-12", "09:00"))).toMatchObject({ toque: "email2" });
  });

  it("resposta pausa tudo; opt-out, etapa de fora e 1º toque antigo nunca recebem", () => {
    const hoje = hora("2026-10-06", "09:00");
    expect(emailDevido(lead({ id: 14, pausada: true }), [dm1], hoje)).toBeNull();
    expect(emailDevido(lead({ id: 15, etapa: "respondeu" }), [dm1], hoje)).toBeNull();
    expect(emailDevido(lead({ id: 16, etapa: "saiu_da_lista", optOut: true }), [dm1], hoje)).toBeNull();
    expect(emailDevido(lead({ id: 17, optOut: true }), [dm1], hoje)).toBeNull();
    expect(emailDevido(lead({ id: 18, primeiroToqueEm: hora("2026-08-01", "10:00") }), [dm1], hoje)).toBeNull();
    expect(emailDevido(lead({ id: 19, primeiroToqueEm: null }), [], hoje)).toBeNull(); // espera o D0 do Hunter
  });

  it("DM impossível: a cadência começa no dia da falha, sem DM", () => {
    const falha: Historico = { canal: "dm", tipo: "falha", data: hora("2026-10-05", "10:00") };
    const l = lead({ id: 20, primeiroToqueEm: null, statusEntrega: { email: "nao_enviado", whatsapp: "nao_enviado", dm: "falhou", linkedin: "nao_enviado" } });
    expect(emailDevido(l, [falha], hora("2026-10-06", "09:00"))).toMatchObject({ toque: "email1" });
  });
});

/* ------------------------------------------------------------ plano do dia */

const cand = (id: number, over: Partial<CandidatoEmail> = {}): CandidatoEmail => ({
  leadId: id,
  toque: "email1",
  para: `x${id}@gmail.com`,
  prioridade: 2,
  devidoEm: hora("2026-10-06", "00:00"),
  ...over,
});

const planejar = (candidatos: CandidatoEmail[], over: Record<string, unknown> = {}) =>
  planejarEmails({ candidatos, enviadosHoje: [], bouncesHoje: 0, agora: hora("2026-10-06", "09:00"), teto: 50, rand: sempre0, ...over });

describe("regras do dia de e-mail", () => {
  it("fora do horário o plano vale para a próxima janela (seg a sex, 8h às 18h)", () => {
    const sabado = referenciaDoPlano(hora("2026-10-10", "11:00"));
    expect(sabado.naJanela).toBe(false);
    expect(sabado.inicio.getTime()).toBe(hora("2026-10-12", "08:00").getTime());
    expect(referenciaDoPlano(hora("2026-10-06", "07:00")).inicio.getTime()).toBe(hora("2026-10-06", "08:00").getTime());
    expect(referenciaDoPlano(hora("2026-10-06", "18:00")).inicio.getTime()).toBe(hora("2026-10-07", "08:00").getTime());
    expect(referenciaDoPlano(hora("2026-10-09", "19:00")).inicio.getTime()).toBe(hora("2026-10-12", "08:00").getTime());
    expect(referenciaDoPlano(hora("2026-10-06", "17:59")).naJanela).toBe(true);
  });

  it("intervalo aleatório de 5 a 15 minutos entre e-mails", () => {
    const min = planejar([cand(1), cand(2), cand(3)], { rand: sempre0 });
    expect(min.itens.map((i) => (i.horarioPrevisto.getTime() - min.itens[0].horarioPrevisto.getTime()) / 60_000)).toEqual([0, 5, 10]);
    const max = planejar([cand(1), cand(2), cand(3)], { rand: () => 0.999 });
    expect(max.itens.map((i) => (i.horarioPrevisto.getTime() - max.itens[0].horarioPrevisto.getTime()) / 60_000)).toEqual([0, 15, 30]);
  });

  it("teto diário: o que passa do teto fica de fora, descontando o que já saiu hoje", () => {
    const p = planejar([cand(1), cand(2), cand(3), cand(4)], { teto: 2 });
    expect(p.itens).toHaveLength(2);
    expect(p.descartados.map((d) => d.motivo)).toEqual(["teto", "teto"]);
    const jaSaiu = planejar([cand(1), cand(2)], { teto: 2, enviadosHoje: [{ dominio: "gmail.com", em: hora("2026-10-06", "08:10") }] });
    expect(jaSaiu.itens).toHaveLength(1);
    const cheio = planejar([cand(1)], { teto: 1, enviadosHoje: [{ dominio: "gmail.com", em: hora("2026-10-06", "08:10") }] });
    expect(cheio.pausa).toBe("teto");
  });

  it("1 por domínio corporativo por dia; provedor gratuito não entra na regra", () => {
    const p = planejar([
      cand(1, { para: "a@empresa.com.br" }),
      cand(2, { para: "b@empresa.com.br" }),
      cand(3, { para: "c@gmail.com" }),
      cand(4, { para: "d@gmail.com" }),
    ]);
    expect(p.itens.map((i) => i.leadId)).toEqual([1, 3, 4]);
    expect(p.descartados).toEqual([{ leadId: 2, motivo: "dominio_no_dia" }]);
    const jaRecebeu = planejar([cand(5, { para: "e@empresa.com.br" })], { enviadosHoje: [{ dominio: "empresa.com.br", em: hora("2026-10-06", "08:10") }] });
    expect(jaRecebeu.itens).toHaveLength(0);
  });

  it("respeita o intervalo desde o último envio real e engajado vai primeiro", () => {
    const ultimo = { dominio: "x.com", em: hora("2026-10-06", "08:55"), proximoEnvioApos: hora("2026-10-06", "09:08") };
    const p = planejar([cand(1), cand(2, { prioridade: 0 })], { enviadosHoje: [ultimo] });
    expect(p.liberadoEm.getTime()).toBe(hora("2026-10-06", "09:08").getTime());
    expect(p.itens[0].leadId).toBe(2);
  });

  it("pausa automática quando o bounce do dia passa de 3%", () => {
    expect(pausaPorBounce(100, 3)).toBe(false);
    expect(pausaPorBounce(100, 4)).toBe(true);
    expect(pausaPorBounce(20, 1)).toBe(true); // 5%
    expect(pausaPorBounce(5, 1)).toBe(false); // amostra pequena: 1 não pausa
    expect(pausaPorBounce(5, 2)).toBe(true);
    const envios = Array.from({ length: 20 }, (_, i) => ({ dominio: `d${i}.com`, em: hora("2026-10-06", "08:30") }));
    const p = planejar([cand(1)], { enviadosHoje: envios, bouncesHoje: 1 });
    expect(p.pausa).toBe("bounce");
    expect(p.itens).toHaveLength(0);
  });

  it("a janela fecha às 18h: o que não cabe fica para amanhã", () => {
    const p = planejar([cand(1), cand(2), cand(3)], { agora: hora("2026-10-06", "17:50"), rand: sempre0 });
    expect(p.itens.map((i) => i.leadId)).toEqual([1, 2]);
    expect(p.descartados).toEqual([{ leadId: 3, motivo: "fora_da_janela" }]);
  });
});

/* ------------------------------------------------------------------ chaves */

describe("chaves de envio por canal", () => {
  it("tudo desligado por padrão; liga só o canal listado", () => {
    expect(canaisComEnvioReal({}).size).toBe(0);
    expect(envioRealLigado("email", {})).toBe(false);
    expect(envioRealLigado("email", { OUTBOUND_ENVIO_REAL: "email" })).toBe(true);
    expect(envioRealLigado("whatsapp", { OUTBOUND_ENVIO_REAL: "email" })).toBe(false);
    expect(envioRealLigado("email", { OUTBOUND_ENVIO_REAL: "Email, dm" })).toBe(true);
    expect(envioRealLigado("email", { OUTBOUND_ENVIO_REAL: "tudo" })).toBe(false);
    expect(lerCaixaLigado({})).toBe(false);
    expect(lerCaixaLigado({ OUTBOUND_LER_CAIXA: "1" })).toBe(true);
    expect(tetoEmailPorDia({})).toBe(50);
    expect(tetoEmailPorDia({ OUTBOUND_EMAIL_TETO_DIA: "30" })).toBe(30);
    expect(tetoEmailPorDia({ OUTBOUND_EMAIL_TETO_DIA: "abc" })).toBe(50);
  });
});

/* ------------------------------------------------------------------ textos */

describe("textos", () => {
  it("preenche os marcadores e barra o que sobrou ou tem travessão", () => {
    expect(preencher("Dia: {{dia_sugerido}} {{ link_conversa }}", { dia_sugerido: "terça", link_conversa: "L" })).toBe("Dia: terça L");
    expect(problemaDoTexto("A", "oi {{nome}}")).toBe("marcador_sobrando");
    expect(problemaDoTexto("A", "oi — tudo")).toBe("travessao");
    expect(problemaDoTexto("", "oi")).toBe("vazio");
    expect(problemaDoTexto("A", "oi")).toBeNull();
  });

  it("lê as partes do e-mail do kit em formatos diferentes", () => {
    const direto = { email1: { assunto: "A1", gancho: "G1", dor: "D1" }, ultimoToque: { assunto: "AU", dica: "dica" } };
    expect(partesDoKit(direto, "email1")).toEqual({ assunto: "A1", gancho: "G1", dor: "D1" });
    expect(partesDoKit(direto, "ultimo")).toEqual({ assunto: "AU", dica: "dica" });
    expect(partesDoKit(direto, "email2")).toBeNull();
    expect(partesDoKit({ emails: [{ gancho: "X" }, { Dor_Provavel: "Z" }] }, "email2")).toEqual({ Dor_Provavel: "Z" });
    expect(partesDoKit(JSON.stringify({ aninhado: { Email_1: { Assunto: "S", Gancho: "B" } } }), "email1")).toEqual({ Assunto: "S", Gancho: "B" });
    expect(partesDoKit({ email1: { assunto: "só assunto" } }, "email1")).toBeNull(); // sem gancho nem dor a F7 recusa
    expect(partesDoKit(null, "email1")).toBeNull();
  });

  it("escreve o dia por extenso", () => {
    expect(textoDoDia("2026-10-06", "15:00")).toBe("terça-feira, 6 de outubro, às 15h");
    expect(textoDoDia("2026-10-07", "14:30")).toBe("quarta-feira, 7 de outubro, às 14h30");
  });
});

/* -------------------------------------------------------------- dia sugerido */

describe("dia sugerido", () => {
  it("sem agenda: próximo dia útil às 15h", () => {
    expect(regraFixa(hora("2026-10-06", "09:00"))).toMatchObject({ dia: "2026-10-07", hora: "15:00", origem: "regra" });
    expect(regraFixa(hora("2026-10-09", "09:00")).dia).toBe("2026-10-12"); // sexta -> segunda
    expect(sugerirDia(hora("2026-10-06", "09:00"), null).origem).toBe("regra");
  });

  it("com agenda: primeiro horário livre perto das 15h, pulando o ocupado", () => {
    const ocupados = [{ inicio: hora("2026-10-07", "14:45"), fim: hora("2026-10-07", "15:45") }];
    const s = sugerirDia(hora("2026-10-06", "09:00"), ocupados);
    expect(s.origem).toBe("agenda");
    expect(s.dia).toBe("2026-10-07");
    expect(s.hora).toBe("14:00");
    // dia inteiro ocupado: vai para o dia seguinte
    const cheio = [{ inicio: hora("2026-10-07", "00:00"), fim: hora("2026-10-08", "00:00") }];
    expect(sugerirDia(hora("2026-10-06", "09:00"), cheio)).toMatchObject({ dia: "2026-10-08", hora: "15:00" });
  });

  it("converte o evento do Outlook (hora local) e escolhe o dia da /conversa", () => {
    const o = eventoOutlookParaOcupado("2026-10-07T14:00:00.0000000", "2026-10-07T15:00:00.0000000");
    expect(o?.inicio.getTime()).toBe(hora("2026-10-07", "14:00").getTime());
    expect(diaParaConversa(hora("2026-10-06", "09:00"), "2026-10-08")).toEqual({ dia: "2026-10-08", hora: "15:00" });
    expect(diaParaConversa(hora("2026-10-09", "09:00"), "2026-10-08").dia).toBe("2026-10-12"); // já passou
    expect(diaParaConversa(hora("2026-10-06", "09:00"), null).dia).toBe("2026-10-07");
  });
});

/* ---------------------------------------------------------------- recalcular */

describe("recálculo diário da temperatura", () => {
  it("soma só o que ainda está na janela de 7 dias", () => {
    const agora = hora("2026-10-13", "12:00");
    const r = recalcularTemperatura(
      [
        { pontos: 3, data: hora("2026-10-02", "10:00") }, // fora
        { pontos: 3, data: hora("2026-10-08", "10:00") },
        { pontos: 1, data: hora("2026-10-12", "10:00") },
      ],
      agora,
      PESOS_PADRAO,
    );
    expect(r).toEqual({ pontos: 4, temperatura: "morno" });
    expect(recalcularTemperatura([{ pontos: 3, data: hora("2026-10-02", "10:00") }], agora, PESOS_PADRAO)).toEqual({ pontos: 0, temperatura: "frio" });
    expect(recalcularTemperatura([{ pontos: 5, data: hora("2026-10-12", "10:00") }], agora, PESOS_PADRAO).temperatura).toBe("engajado");
  });
});

/* ----------------------------------------------------------------- Graph */

describe("sendOutlookMail (corpo do Graph)", () => {
  it("compatível com quem chamava só com texto", () => {
    expect(montarMensagemOutlook({ to: "a@b.com", subject: "S", bodyText: "oi" })).toEqual({
      message: { subject: "S", body: { contentType: "Text", content: "oi" }, toRecipients: [{ emailAddress: { address: "a@b.com" } }] },
    });
  });

  it("aceita html, from e replyTo", () => {
    const { message } = montarMensagemOutlook({
      to: "a@b.com",
      subject: "S",
      html: "<p>oi</p>",
      texto: "oi",
      from: "comercial@empresarialacademy.com",
      fromName: "Thiago Marchi | Empresarial Academy",
      replyTo: "comercial@empresarialacademy.com",
    });
    expect(message.body).toEqual({ contentType: "HTML", content: "<p>oi</p>" });
    expect(message.from).toEqual({ emailAddress: { address: "comercial@empresarialacademy.com", name: "Thiago Marchi | Empresarial Academy" } });
    expect(message.replyTo).toEqual([{ emailAddress: { address: "comercial@empresarialacademy.com" } }]);
  });
});

/* ----------------------------------------------------------------- rastreio */

/** CRM em memória para vários leads. */
function mundoCrm(leads: Record<number, EstadoLead>) {
  const interacoes: { lead: number | string; tipo: string; canal: string; pontos: number; data: Date; chave?: string; metadados?: Record<string, unknown> | null }[] = [];
  const crm: CrmDb = {
    carregarLead: async (id) => leads[Number(id)] ?? null,
    pesos: async () => PESOS_PADRAO,
    interacoesDesde: async (id, desde) => interacoes.filter((i) => i.lead === id && i.data >= desde),
    existeChave: async (c) => interacoes.some((i) => i.chave === c),
    criarInteracao: async (d) => {
      interacoes.push({ lead: d.lead, tipo: d.tipo, canal: d.canal, pontos: d.pontos, data: d.data, chave: d.chave, metadados: d.metadados });
      return interacoes.length;
    },
    salvarLead: async (id, e) => {
      leads[Number(id)] = e;
    },
  };
  return { crm, interacoes, leads };
}

const estado = (over: Partial<EstadoLead> = {}): EstadoLead => ({
  etapa: "em_cadencia",
  temperatura: "frio",
  pontos: 0,
  cadencia: { pausada: false, motivoPausa: null, proximoCanal: null, canaisEncerrados: [], movidoManualEm: null },
  statusEntrega: { email: "enviado", whatsapp: "nao_enviado", dm: "enviada", linkedin: "nao_enviado" },
  origem: { primeiroToqueCanal: "dm", primeiroToqueEm: hora("2026-10-05", "10:00"), ultimoToqueCanal: "email", ultimoToqueRotulo: "email1", reuniaoCanal: null, reuniaoToque: null, vendaCanal: null, vendaToque: null },
  optOut: false,
  ...over,
});

describe("rastreio de clique e abertura", () => {
  it("o código é assinado: adulterar qualquer parte invalida", () => {
    const c = codigoDeClique(812, "email1", "conversa");
    expect(lerCodigoDeClique(c)).toEqual({ leadId: 812, toque: "email1", destino: "conversa" });
    expect(lerCodigoDeClique(c.replace("812", "813"))).toBeNull();
    expect(lerCodigoDeClique(c.replace("conversa", "blog"))).toBeNull();
    expect(lerCodigoDeClique(`${c}x`)).toBeNull();
    expect(lerCodigoDeClique("lixo")).toBeNull();
  });

  it("destino por caminho do próprio site, nunca de fora", () => {
    const c = codigoDeClique(5, "email2", { caminho: "/materiais/checklist-de-gestao" });
    expect(lerCodigoDeClique(c)?.destino).toEqual({ caminho: "/materiais/checklist-de-gestao" });
    expect(() => codigoDeClique(5, "email2", { caminho: "https://golpe.com" })).toThrow();
    expect(() => codigoDeClique(5, "email2", { caminho: "//golpe.com" })).toThrow();
    expect(urlDeClique(5, "email1", "blog")).toMatch(/^https:\/\/empresarialacademy\.com\/r\/5\.email1\.blog\./);
  });

  it("pixel assinado", () => {
    const url = urlDoPixel(812, "email1");
    expect(url).toMatch(/\/o\/812\.email1\.[A-Za-z0-9_-]{22}\.gif$/);
    const arquivo = url.split("/o/")[1];
    expect(lerCodigoDoPixel(arquivo)).toEqual({ leadId: 812, toque: "email1" });
    expect(lerCodigoDoPixel(arquivo.replace("812", "999"))).toBeNull();
  });

  it("clique registra `clicado` com 3 pontos e redireciona para a /conversa do lead", async () => {
    const m = mundoCrm({ 812: estado() });
    const agora = hora("2026-10-06", "10:00");
    const r = await tratarClique({ crm: m.crm, tokenDoLead: async () => "TOKEN123", agora }, codigoDeClique(812, "email1", "conversa"), "Mozilla/5.0 (iPhone)");
    expect(r.location).toBe("https://empresarialacademy.com/conversa?t=TOKEN123");
    expect(r.registrado).toBe(true);
    expect(m.interacoes[0]).toMatchObject({ tipo: "clicado", canal: "email", pontos: 3 });
    expect(m.leads[812].statusEntrega.email).toBe("clicado");
    expect(m.leads[812].pontos).toBe(3);
    // o mesmo clique no mesmo dia não pontua de novo
    const de_novo = await tratarClique({ crm: m.crm, tokenDoLead: async () => "TOKEN123", agora }, codigoDeClique(812, "email1", "conversa"), "Mozilla/5.0 (iPhone)");
    expect(de_novo.registrado).toBe(false);
    expect(m.interacoes).toHaveLength(1);
  });

  it("robô e código inválido não registram, mas o redirecionamento funciona", async () => {
    const m = mundoCrm({ 812: estado() });
    const robo = await tratarClique({ crm: m.crm, tokenDoLead: async () => null }, codigoDeClique(812, "email1", "blog"), "Mozilla/5.0 (compatible; Googlebot/2.1)");
    expect(robo).toEqual({ location: "https://empresarialacademy.com/blog", registrado: false });
    const ruim = await tratarClique({ crm: m.crm, tokenDoLead: async () => null }, "812.email1.blog.assinaturafalsa", "Mozilla/5.0");
    expect(ruim).toEqual({ location: "https://empresarialacademy.com", registrado: false });
    expect(m.interacoes).toHaveLength(0);
  });

  it("abertura registra `aberto` com 1 ponto, no máximo 2 aberturas contadas", async () => {
    const m = mundoCrm({ 7: estado() });
    const dia = (n: number) => hora(`2026-10-0${n}`, "10:00");
    for (const n of [6, 7, 8]) {
      await tratarAbertura({ crm: m.crm, tokenDoLead: async () => null, agora: dia(n) }, `${urlDoPixel(7, "email1").split("/o/")[1]}`, "Mozilla/5.0 (Windows NT 10.0) Chrome/120 GoogleImageProxy");
    }
    expect(m.interacoes.map((i) => i.pontos)).toEqual([1, 1, 0]);
    expect(m.leads[7].pontos).toBe(2);
    expect(m.leads[7].statusEntrega.email).toBe("aberto");
  });
});

/* ------------------------------------------------------------- /conversa */

describe("página /conversa", () => {
  it("escolhe o vídeo pelo dossiê, com fallback no Fábio", () => {
    expect(resolverProva({ prova: "erik" })).toBe("erik");
    expect(resolverProva({ provaEscolhida: "Daniella Higa (comercial)" })).toBe("daniella");
    expect(resolverProva({ Prova: { caso: "fabio" } })).toBe("fabio");
    expect(resolverProva({ prova: "demo de 60 s da indústria" })).toBe("fabio"); // a página ainda não tem vídeo de demo
    expect(provaDoDossie({ prova: "demo de 60 s da indústria" })).toBe("demo_segmento"); // o e-mail usa o cartão da demo
    expect(provaDoDossie({ prova: "Fábio" })).toBe("fabio");
    expect(resolverProva(null)).toBe("fabio");
    expect(resolverProva("{ quebrado")).toBe("fabio");
    expect(resolverProva(JSON.stringify({ prova: "erik" }))).toBe("erik");
  });

  it("URL do Calendly com nome, e-mail e dia pré-preenchidos", () => {
    const u = new URL(urlDoCalendly({ nome: "Ana Souza", email: "ana@empresa.com", dia: "2026-10-07" }));
    expect(u.origin + u.pathname).toBe("https://calendly.com/thiago-empresarialacademy/new-meeting");
    expect(u.searchParams.get("name")).toBe("Ana Souza");
    expect(u.searchParams.get("email")).toBe("ana@empresa.com");
    expect(u.searchParams.get("month")).toBe("2026-10");
    expect(u.searchParams.get("date")).toBe("2026-10-07");
    const generico = new URL(urlDoCalendly());
    expect(generico.searchParams.has("name")).toBe(false);
    expect(generico.searchParams.has("date")).toBe(false);
  });

  it("cada gesto vira a interação certa, com chave de idempotência", () => {
    const agora = hora("2026-10-06", "10:00");
    expect(interacaoDoGesto(1, "abriu", agora)).toMatchObject({ tipo: "abriu_pagina", metadados: { destino: "conversa" }, chave: "conversa:abriu:1:2026-10-06" });
    expect(interacaoDoGesto(1, "play", agora)).toMatchObject({ tipo: "deu_play", chave: "conversa:play:1:2026-10-06" });
    expect(interacaoDoGesto(1, "agendou", agora, "https://api.calendly.com/scheduled_events/ABC")).toMatchObject({ tipo: "agendou", chave: "conversa:agendou:1:https://api.calendly.com/scheduled_events/ABC" });
  });

  function depsConversa(leads: Record<number, EstadoLead>, tokens: Record<string, number>) {
    const m = mundoCrm(leads);
    const proximoPasso: number[] = [];
    return {
      m,
      proximoPasso,
      deps: {
        crm: m.crm,
        leadPorToken: async (t: string) => (tokens[t] ? { id: tokens[t] } : null),
        marcarProximoPasso: async (id: number) => void proximoPasso.push(id),
        agora: hora("2026-10-06", "10:00"),
      },
    };
  }
  const TOKEN = "tokenValido1234567890";

  it("token válido: abre (0 pontos), dá play (4 pontos) e agenda (Reunião marcada e cadência pausada)", async () => {
    const { m, proximoPasso, deps } = depsConversa({ 1: estado() }, { [TOKEN]: 1 });
    expect(await tratarGesto(deps, { t: TOKEN, gesto: "abriu" })).toEqual({ status: 204 });
    expect(await tratarGesto(deps, { t: TOKEN, gesto: "play" })).toEqual({ status: 204 });
    expect(m.leads[1].pontos).toBe(4);
    expect(await tratarGesto(deps, { t: TOKEN, gesto: "agendou", evento: "https://api.calendly.com/scheduled_events/ABC" })).toEqual({ status: 204 });
    expect(m.leads[1].etapa).toBe("reuniao_marcada");
    expect(m.leads[1].cadencia.pausada).toBe(true);
    expect(m.leads[1].origem.reuniaoCanal).toBe("email"); // o último toque
    expect(proximoPasso).toEqual([1]);
    // repetir não duplica
    await tratarGesto(deps, { t: TOKEN, gesto: "play" });
    expect(m.interacoes.filter((i) => i.tipo === "deu_play")).toHaveLength(1);
  });

  it("token inválido ou desconhecido: nada é gravado", async () => {
    const { m, deps } = depsConversa({ 1: estado() }, { [TOKEN]: 1 });
    expect(await tratarGesto(deps, { t: "curto", gesto: "abriu" })).toEqual({ status: 400 });
    expect(await tratarGesto(deps, { t: "desconhecido1234567890", gesto: "abriu" })).toEqual({ status: 404 });
    expect(await tratarGesto(deps, { t: TOKEN, gesto: "apagar" })).toEqual({ status: 400 });
    expect(await tratarGesto(deps, "texto")).toEqual({ status: 400 });
    expect(m.interacoes).toHaveLength(0);
  });
});

/* ------------------------------------------------------------- caixa comercial@ */

describe("leitura da caixa comercial@ (mock)", () => {
  const conhecidos = new Set(["ana@empresa.com", "bia@gmail.com"]);
  const msg = (over: Partial<MensagemCaixa>): MensagemCaixa => ({ id: "m1", assunto: "Re: contato", de: "ana@empresa.com", recebidoEm: hora("2026-10-06", "10:00"), texto: "Vamos sim.", ...over });

  it("classifica bounce, resposta, resposta automática e estranho", () => {
    const ndr = classificarMensagem(msg({ de: "postmaster@outlook.com", assunto: "Undeliverable: contato", texto: "Final-Recipient: rfc822; bia@gmail.com\nStatus: 5.1.1" }), conhecidos);
    expect(ndr).toMatchObject({ tipo: "bounce", email: "bia@gmail.com", temporario: false });
    const cheia = classificarMensagem(msg({ de: "mailer-daemon@x.com", texto: "mailbox full, try again later para ana@empresa.com" }), conhecidos);
    expect(cheia).toMatchObject({ tipo: "bounce", email: "ana@empresa.com", temporario: true });
    expect(classificarMensagem(msg({}), conhecidos)).toMatchObject({ tipo: "resposta", email: "ana@empresa.com", descadastro: false });
    expect(classificarMensagem(msg({ assunto: "Resposta automática: férias" }), conhecidos)).toBeNull();
    expect(classificarMensagem(msg({ de: "estranho@spam.com" }), conhecidos)).toBeNull();
    expect(classificarMensagem(msg({ de: "postmaster@x.com", texto: "falha para outro@lugar.com" }), conhecidos)).toBeNull();
  });

  it("reconhece pedido de descadastro só na parte nova da resposta", () => {
    expect(pediuDescadastro("Por favor, me tire da lista.")).toBe(true);
    expect(pediuDescadastro("SAIR")).toBe(true);
    expect(pediuDescadastro("Quero descadastrar meu e-mail")).toBe(true);
    expect(pediuDescadastro("Não quero mais receber")).toBe(true);
    expect(pediuDescadastro("Vou sair de férias, falamos na volta")).toBe(false);
    expect(pediuDescadastro("Pode ser terça.\n\nEm seg, 5 de out de 2026 escreveu:\n> para sair da lista clique aqui")).toBe(false);
  });

  it("registra bounce (encerra o e-mail) e resposta (pausa a cadência) e não duplica", async () => {
    const m = mundoCrm({ 1: estado(), 2: estado() });
    const { db } = fakeDb({ leads: [], envios: [{ leadId: 1, para: "ana@empresa.com", dominio: "empresa.com", em: hora("2026-10-05", "09:00") }, { leadId: 2, para: "bia@gmail.com", dominio: "gmail.com", em: hora("2026-10-05", "09:10") }] });
    const caixa = [
      msg({ id: "r1", texto: "Pode ser terça às 10h." }),
      msg({ id: "b1", de: "postmaster@outlook.com", assunto: "Undeliverable", texto: "Final-Recipient: rfc822; bia@gmail.com\nStatus: 5.1.1" }),
      msg({ id: "x1", de: "estranho@x.com" }),
    ];
    const deps = depsDe(db, m.crm, { lerCaixa: async () => caixa });
    const r1 = await processarCaixa(deps);
    expect(r1).toEqual({ lidas: 3, bounces: 1, respostas: 1 });
    expect(m.leads[1].etapa).toBe("respondeu");
    expect(m.leads[1].cadencia.pausada).toBe(true);
    expect(m.leads[2].statusEntrega.email).toBe("devolvido");
    expect(m.leads[2].cadencia.canaisEncerrados).toContain("email");
    const r2 = await processarCaixa(deps);
    expect(r2).toEqual({ lidas: 3, bounces: 0, respostas: 0 });
  });

  it("descadastro por resposta leva a Saiu da lista", async () => {
    const m = mundoCrm({ 1: estado() });
    const { db } = fakeDb({ leads: [], envios: [{ leadId: 1, para: "ana@empresa.com", dominio: "empresa.com", em: hora("2026-10-05", "09:00") }] });
    const deps = depsDe(db, m.crm, { lerCaixa: async () => [msg({ texto: "Me tire da lista, por favor." })] });
    await processarCaixa(deps);
    expect(m.leads[1].etapa).toBe("saiu_da_lista");
    expect(m.leads[1].optOut).toBe(true);
  });
});

/* ---------------------------------------------------------------- orquestrador */

type Mundo = {
  leads: LeadCandidato[];
  kits?: Record<number, unknown>;
  dossies?: Record<number, unknown>;
  envios?: { leadId: number; para: string; dominio: string; em: Date; proximoEnvioApos?: Date | null }[];
  bounces?: number;
  historico?: Record<number, Historico[]>;
  suprimidos?: string[];
  reunioes?: { id: number; email: string; etapa: EstadoLead["etapa"]; temData: boolean }[];
};

function fakeDb(m: Mundo) {
  const s = {
    marcadores: new Map<string, Record<string, unknown>>(),
    simulados: [] as { leadId: number; chave: string; conteudo: string; metadados: Record<string, unknown> }[],
    agenda: [] as { id: number; canal: string | null; em: Date | null; etapaAtual: string | null }[],
    bloqueios: [] as { leadId: number; toque: string; motivo: string }[],
    logs: [] as { leadId: number; para: string; assunto: string; ok: boolean }[],
    temperaturas: 0,
    reunioesDefinidas: [] as { leadId: number; inicio: Date | null }[],
    envios: [...(m.envios ?? [])],
  };
  const db: OutboundDb = {
    candidatos: async () => m.leads,
    historico: async (ids) => new Map(ids.map((id) => [id, m.historico?.[id] ?? [dm1]])),
    suprimidos: async () => new Set(m.suprimidos ?? []),
    enviosDeEmail: async () => s.envios,
    bouncesDeEmail: async () => m.bounces ?? 0,
    conteudoDoLead: async (id) => {
      const l = m.leads.find((x) => x.id === id);
      return l ? { id, nome: l.nome, empresa: l.empresa, email: l.email, kit: m.kits?.[id] ?? kitPadrao(l.nome), dossie: m.dossies?.[id] ?? { prova: "erik" }, tokenConversa: `tok${id}` } : null;
    },
    gravarAgenda: async (id, a) => void s.agenda.push({ id, ...a }),
    lerMarcador: async (c) => s.marcadores.get(c) ?? null,
    criarMarcador: async (c, meta) => {
      if (s.marcadores.has(c)) return false;
      s.marcadores.set(c, meta);
      return true;
    },
    gravarSimulado: async (i) => {
      if (s.simulados.some((x) => x.chave === i.chave)) return false;
      s.simulados.push(i);
      return true;
    },
    registrarBloqueio: async (leadId, toque, motivo) => void s.bloqueios.push({ leadId, toque, motivo }),
    logEmail: async (i) => void s.logs.push(i),
    recalcularTemperaturas: async () => ++s.temperaturas,
    pesos: async () => PESOS_PADRAO,
    partesFixas: async () => ({}),
    leadsParaAgenda: async () => m.reunioes ?? [],
    definirReuniao: async (leadId, inicio) => void s.reunioesDefinidas.push({ leadId, inicio }),
  };
  return { db, s };
}

const kitPadrao = (nome: string) => ({
  email1: {
    assunto: `${nome}: um ponto sobre a gestão`,
    gancho: "Vi o perfil da empresa no Instagram.",
    dor: "Muito dono acaba como gargalo da própria operação.",
    convite: "Tenho {{dia_sugerido}} livre. Escolha o horário aqui: {{link_conversa}}",
  },
});

/** Formato do e-mail substituído por um texto plano: os testes do orquestrador não dependem do MJML. */
const renderFalso = async (d: DadosEmailOutbound) => {
  const kit = d.kit as Record<string, string>;
  const texto = [kit.gancho, kit.dor, kit.convite].filter(Boolean).join("\n\n");
  return { assunto: kit.assunto ?? "Assunto padrão", html: `<p>${texto}</p><a href="${d.linkOptOut}">sair</a><img src="${d.pixelUrl}">`, texto, avisos: [] };
};

const candidato = (id: number, over: Partial<LeadCandidato> = {}): LeadCandidato => ({
  ...lead({ id }),
  nome: `Lead ${id}`,
  empresa: `Empresa ${id}`,
  agendaGravada: { canal: null, em: null, etapaAtual: null },
  ...over,
});

function depsDe(db: OutboundDb, crm: CrmDb, over: Partial<Deps> = {}): Deps {
  return {
    db,
    crm,
    enviar: vi.fn(async () => ({ ok: true })),
    agenda: async () => null,
    lerCaixa: async () => [],
    urlDescadastro: (id, email) => `https://empresarialacademy.com/api/marketing/sair?l=${id}&t=${email.length}`,
    render: renderFalso,
    agora: hora("2026-10-06", "08:00"),
    rand: sempre0,
    env: {},
    ...over,
  };
}

describe("orquestrador: simulação (padrão)", () => {
  const leads = [
    candidato(1, { email: "a@empresa.com.br", temperatura: "morno" }),
    candidato(2, { email: "b@empresa.com.br" }), // mesmo domínio do 1: fica para outro dia
    candidato(3, { email: "c@gmail.com" }),
    candidato(4, { email: null }), // sem e-mail: só os outros canais
    candidato(5, { email: "e@gmail.com", pausada: true }),
    candidato(6, { email: "f@gmail.com", etapa: "respondeu" }),
    candidato(7, { email: "g@gmail.com", primeiroToqueEm: null }), // espera a DM 1 do Hunter
    candidato(8, { email: "h@gmail.com", emailSuprimido: false }),
  ];
  const mundo = (): Mundo => ({ leads, suprimidos: ["h@gmail.com"] });

  it("lista o que sairia hoje, grava como simulado e não envia nem mexe no lead", async () => {
    const { db, s } = fakeDb(mundo());
    const crm = mundoCrm({});
    const d = depsDe(db, crm.crm);
    const r = await rodar(d);

    expect(r.modo).toBe("simulacao");
    expect(d.enviar).not.toHaveBeenCalled();
    expect(r.sairiaHoje.map((x) => x.leadId)).toEqual([1, 3]); // 2: domínio repetido; 4: sem e-mail; 5-8: pausado, respondeu, sem D0, suprimido
    expect(r.sairiaHoje.map((x) => x.horarioPrevisto)).toEqual([hora("2026-10-06", "08:00").toISOString(), hora("2026-10-06", "08:05").toISOString()]);
    expect(r.sairiaHoje[0]).toMatchObject({ para: "a@empresa.com.br", toque: "email1", diaSugerido: "na quarta, às 15h" });
    expect(r.descartados).toContainEqual({ leadId: 2, motivo: "dominio_no_dia" });
    expect(r.devidosDeEmail).toBe(3);

    expect(s.simulados).toHaveLength(2);
    expect(s.simulados[0].metadados).toMatchObject({ simulado: true, toque: "email1", para: "a@empresa.com.br" });
    expect(s.simulados[0].conteudo).toContain("[simulação] Assunto: Lead 1: um ponto sobre a gestão");
    expect(s.simulados[0].conteudo).toContain("na quarta, às 15h");
    expect(s.simulados[0].conteudo).toMatch(/https:\/\/empresarialacademy\.com\/r\/1\.email1\.conversa\./);
    expect(s.simulados[0].conteudo).not.toContain("{{");
    expect(s.logs).toHaveLength(0);
    expect(crm.interacoes).toHaveLength(0); // nada de `enviado` real: o lead não muda
    expect(r.rotinas.temperatura).toBe(1);
  });

  it("rodar de novo no mesmo dia não duplica o simulado nem repete as rotinas diárias", async () => {
    const { db, s } = fakeDb(mundo());
    const d = depsDe(db, mundoCrm({}).crm);
    await rodar(d);
    const r2 = await rodar(d);
    expect(s.simulados).toHaveLength(2);
    expect(s.temperaturas).toBe(1);
    expect(r2.rotinas.temperatura).toBe("ja_rodou");
  });

  it("agenda o próximo toque dos leads (canal e dia) para o Hunter, o EA Flow e a Fila", async () => {
    const { db, s } = fakeDb({ leads: [candidato(1), candidato(2, { etapa: "engajado" })] });
    const r = await rodar(depsDe(db, mundoCrm({}).crm));
    expect(r.agendados).toBe(2);
    expect(s.agenda.find((a) => a.id === 1)).toMatchObject({ canal: "email", etapaAtual: "d1_email1" });
    expect(dataIso(s.agenda.find((a) => a.id === 1)!.em!)).toBe("2026-10-06");
    expect(s.agenda.find((a) => a.id === 2)).toMatchObject({ canal: "ligacao" });
    // já gravado: não escreve de novo
    const gravada = { canal: "email", em: hora("2026-10-06", "00:00"), etapaAtual: "d1_email1" };
    const { db: db2, s: s2 } = fakeDb({ leads: [candidato(1, { agendaGravada: gravada })] });
    expect((await rodar(depsDe(db2, mundoCrm({}).crm))).agendados).toBe(0);
    expect(s2.agenda).toHaveLength(0);
  });

  it("dry não grava nada", async () => {
    const { db, s } = fakeDb(mundo());
    const r = await rodar(depsDe(db, mundoCrm({}).crm), { dry: true });
    expect(r.modo).toBe("dry");
    expect(r.sairiaHoje).toHaveLength(2);
    expect(s.simulados).toHaveLength(0);
    expect(s.marcadores.size).toBe(0);
    expect(s.agenda).toHaveLength(0);
  });

  it("texto que não pode sair é excluído e o dia é replanejado", async () => {
    const m = mundo();
    m.kits = { 1: { email1: { assunto: "Oi", gancho: "Texto com {{marcador_novo}} sobrando" } }, 3: undefined };
    const { db } = fakeDb(m);
    const r = await rodar(depsDe(db, mundoCrm({}).crm));
    expect(r.descartados).toContainEqual({ leadId: 1, motivo: "texto_marcador_sobrando" });
    expect(r.sairiaHoje.map((x) => x.leadId)).toEqual([2, 3]); // o 2 ocupa o lugar do domínio do 1
  });

  it("sem kit (F2 ainda não gerou) não sai nada e o motivo aparece", async () => {
    const m: Mundo = { leads: [candidato(1)], kits: { 1: { dm1: "só DM" } } };
    const { db } = fakeDb(m);
    const r = await rodar(depsDe(db, mundoCrm({}).crm));
    expect(r.sairiaHoje).toHaveLength(0);
    expect(r.descartados).toEqual([{ leadId: 1, motivo: "sem_texto_de_email_no_kit" }]);
  });

  it("fim de semana: o plano vale para segunda às 8h", async () => {
    const { db } = fakeDb({ leads: [candidato(1)] });
    const r = await rodar(depsDe(db, mundoCrm({}).crm, { agora: hora("2026-10-10", "11:00") }));
    expect(r.janela.naJanela).toBe(false);
    expect(r.sairiaHoje[0].horarioPrevisto).toBe(hora("2026-10-12", "08:00").toISOString());
  });

  it("usa a agenda do Outlook para o dia sugerido, uma vez por dia", async () => {
    const { db, s } = fakeDb({ leads: [candidato(1)] });
    const agenda = vi.fn(async (): Promise<EventoDeAgenda[]> => [{ id: "e", inicio: hora("2026-10-07", "14:45"), fim: hora("2026-10-07", "15:45"), emails: [] }]);
    const d = depsDe(db, mundoCrm({}).crm, { agenda });
    const r = await rodar(d);
    expect(r.sairiaHoje[0].diaSugerido).toBe("na quarta, às 14h");
    expect(s.marcadores.get("rotina:dia-sugerido:2026-10-06")).toMatchObject({ dia: "2026-10-07", hora: "14:00", origem: "agenda" });
    await rodar(d);
    expect(agenda).toHaveBeenCalledTimes(1);
  });

  it("pausa do dia quando o bounce passa de 3%", async () => {
    const envios = Array.from({ length: 20 }, (_, i) => ({ leadId: 100 + i, para: `z${i}@d${i}.com`, dominio: `d${i}.com`, em: hora("2026-10-06", "08:00") }));
    const { db } = fakeDb({ leads: [candidato(1)], envios, bounces: 1 });
    const r = await rodar(depsDe(db, mundoCrm({}).crm, { agora: hora("2026-10-06", "10:00") }));
    expect(r.pausa).toBe("bounce");
    expect(r.sairiaHoje).toHaveLength(0);
  });
});

describe("orquestrador: envio real (chave ligada)", () => {
  const env = { OUTBOUND_ENVIO_REAL: "email" };
  const montar = () => {
    const leads = [candidato(1, { email: "a@gmail.com", temperatura: "morno" }), candidato(2, { email: "b@gmail.com" }), candidato(3, { email: "c@gmail.com" })];
    const f = fakeDb({ leads });
    const crm = mundoCrm({ 1: estado({ etapa: "qualificado" }), 2: estado({ etapa: "qualificado" }), 3: estado({ etapa: "qualificado" }) });
    // quando o CRM grava um `enviado` de e-mail, o "banco" do orquestrador passa a enxergá-lo
    const criar = crm.crm.criarInteracao;
    crm.crm.criarInteracao = async (dd) => {
      if (dd.tipo === "enviado" && dd.canal === "email") {
        f.s.envios.push({ leadId: Number(dd.lead), para: String(dd.metadados?.para), dominio: "gmail.com", em: dd.data, proximoEnvioApos: new Date(String(dd.metadados?.proximoEnvioApos)) } as never);
      }
      return criar(dd);
    };
    return { ...f, crm };
  };

  it("envia no máximo 1 por chamada, como comercial@, e respeita o intervalo até a próxima", async () => {
    const { db, s, crm } = montar();
    const enviar = vi.fn(async () => ({ ok: true }));
    const r1 = await rodar(depsDe(db, crm.crm, { env, enviar, agora: hora("2026-10-06", "09:00") }));
    expect(r1.modo).toBe("real");
    expect(enviar).toHaveBeenCalledTimes(1);
    const params = enviar.mock.calls[0] as unknown as [Record<string, string>];
    expect(params[0]).toMatchObject({ to: "a@gmail.com", from: "comercial@empresarialacademy.com", replyTo: "comercial@empresarialacademy.com" });
    expect(params[0].fromName).toBe("Thiago Marchi | Empresarial Academy");
    expect(params[0].html).toContain("/o/1.email1.");
    expect(params[0].html).toContain("api/marketing/sair");
    expect(r1.enviados).toHaveLength(1);
    expect(r1.sairiaHoje).toHaveLength(0);
    expect(s.simulados).toHaveLength(0);

    // registrou em interacoes, email-logs e statusEntrega.email
    expect(crm.interacoes.find((i) => i.tipo === "enviado")).toMatchObject({ canal: "email", chave: "out:email:1:email1" });
    expect(s.logs).toEqual([{ leadId: 1, para: "a@gmail.com", assunto: "Lead 1: um ponto sobre a gestão", ok: true }]);
    expect(crm.leads[1].statusEntrega.email).toBe("enviado");
    expect(crm.leads[1].etapa).toBe("em_cadencia");

    // 2 minutos depois: ainda no intervalo (5 a 15 min), nada sai
    await rodar(depsDe(db, crm.crm, { env, enviar, agora: hora("2026-10-06", "09:02") }));
    expect(enviar).toHaveBeenCalledTimes(1);
    // 6 minutos depois (intervalo sorteado = 5): sai o próximo
    await rodar(depsDe(db, crm.crm, { env, enviar, agora: hora("2026-10-06", "09:06") }));
    expect(enviar).toHaveBeenCalledTimes(2);
    expect((enviar.mock.calls[1] as unknown as [Record<string, string>])[0].to).toBe("b@gmail.com");
  });

  it("fora do horário não envia", async () => {
    const { db, crm } = montar();
    const enviar = vi.fn(async () => ({ ok: true }));
    const noite = await rodar(depsDe(db, crm.crm, { env, enviar, agora: hora("2026-10-06", "19:00") }));
    const sabado = await rodar(depsDe(db, crm.crm, { env, enviar, agora: hora("2026-10-10", "10:00") }));
    expect(enviar).not.toHaveBeenCalled();
    expect(noite.enviados).toHaveLength(0);
    expect(sabado.enviados).toHaveLength(0);
  });

  it("falha do Graph vira interação `falha` e não repete no mesmo dia", async () => {
    const { db, s, crm } = montar();
    const enviar = vi.fn(async () => {
      throw new Error("Microsoft Graph (e-mail): 403 ErrorSendAsDenied");
    });
    const r = await rodar(depsDe(db, crm.crm, { env, enviar, agora: hora("2026-10-06", "09:00") }));
    expect(r.enviados).toHaveLength(0);
    expect(crm.interacoes.find((i) => i.tipo === "falha")).toBeDefined();
    expect(s.logs[0]).toMatchObject({ ok: false });
    await rodar(depsDe(db, crm.crm, { env, enviar, agora: hora("2026-10-06", "09:30") }));
    // o lead 1 não é tentado de novo hoje; o próximo da fila (lead 2) é
    expect((enviar.mock.calls.map((c: unknown) => (c as [{ to: string }])[0].to))).toEqual(["a@gmail.com", "b@gmail.com"]);
  });

  it("texto bloqueado vira registro de bloqueio e a fila segue", async () => {
    const f = fakeDb({ leads: [candidato(1, { email: "a@gmail.com" }), candidato(2, { email: "b@gmail.com" })], kits: { 1: { email1: { assunto: "Oi", gancho: "ok {{marcador_novo}}" } } } });
    const crm = mundoCrm({ 1: estado({ etapa: "qualificado" }), 2: estado({ etapa: "qualificado" }) });
    const enviar = vi.fn(async () => ({ ok: true }));
    await rodar(depsDe(f.db, crm.crm, { env, enviar, agora: hora("2026-10-06", "09:00") }));
    expect(f.s.bloqueios).toEqual([{ leadId: 1, toque: "email1", motivo: "texto_marcador_sobrando" }]);
    expect((enviar.mock.calls[0] as unknown as [{ to: string }])[0].to).toBe("b@gmail.com");
  });

  it("sem a chave, mesmo com tudo pronto, nada é enviado", async () => {
    const { db, crm } = montar();
    const enviar = vi.fn(async () => ({ ok: true }));
    const r = await rodar(depsDe(db, crm.crm, { env: { OUTBOUND_ENVIO_REAL: "whatsapp" }, enviar, agora: hora("2026-10-06", "09:00") }));
    expect(r.modo).toBe("simulacao");
    expect(enviar).not.toHaveBeenCalled();
  });
});

describe("garantia pela agenda do Outlook", () => {
  it("reunião marcada fora da /conversa entra no CRM e preenche o horário", async () => {
    const m = mundoCrm({ 1: estado(), 2: estado({ etapa: "reuniao_marcada" }) });
    const { db, s } = fakeDb({
      leads: [],
      reunioes: [
        { id: 1, email: "ana@empresa.com", etapa: "em_cadencia", temData: false },
        { id: 2, email: "bia@gmail.com", etapa: "reuniao_marcada", temData: false },
        { id: 3, email: "cris@gmail.com", etapa: "em_cadencia", temData: false },
      ],
    });
    const eventos: EventoDeAgenda[] = [
      { id: "ev1", inicio: hora("2026-10-08", "15:00"), fim: hora("2026-10-08", "15:20"), emails: ["thiago@empresarialacademy.com", "Ana@Empresa.com"] },
      { id: "ev2", inicio: hora("2026-10-09", "10:00"), fim: hora("2026-10-09", "10:20"), emails: ["bia@gmail.com"] },
      { id: "ev3", inicio: hora("2026-10-01", "10:00"), fim: hora("2026-10-01", "10:20"), emails: ["cris@gmail.com"] }, // passada
    ];
    const r = await reconciliarAgenda(depsDe(db, m.crm, { agenda: async () => eventos }));
    expect(r).toEqual({ reunioes: 2, registradas: 1 });
    expect(m.leads[1].etapa).toBe("reuniao_marcada");
    expect(s.reunioesDefinidas).toEqual([
      { leadId: 1, inicio: hora("2026-10-08", "15:00") },
      { leadId: 2, inicio: hora("2026-10-09", "10:00") },
    ]);
  });

  it("sem agenda disponível não faz nada", async () => {
    const { db } = fakeDb({ leads: [], reunioes: [{ id: 1, email: "a@b.com", etapa: "em_cadencia", temData: false }] });
    expect(await reconciliarAgenda(depsDe(db, mundoCrm({}).crm))).toEqual({ reunioes: 0, registradas: 0 });
  });
});

describe("ligação com o formato da F7 (MJML de verdade)", () => {
  it("o remetente é o mesmo nas duas frentes", () => {
    expect(REMETENTE.address).toBe(REMETENTE_OUTBOUND_ENDERECO);
    expect(REMETENTE.name).toBe(REMETENTE_OUTBOUND);
  });

  it("rastreia só links do próprio site e leva a conversa pelo código assinado", () => {
    const r = rastreadorDoLead(9, "email1");
    expect(r("https://empresarialacademy.com/conversa?t=ABC")).toMatch(/\/r\/9\.email1\.conversa\./);
    expect(r("https://empresarialacademy.com/blog/artigo")).toMatch(/\/r\/9\.email1\.x/);
    expect(r("https://empresarialacademy.com/privacidade?x=1")).toBe("https://empresarialacademy.com/privacidade?x=1");
    expect(r("https://outro.com/pagina")).toBe("https://outro.com/pagina");
    const lido = lerCodigoDeClique(r("https://empresarialacademy.com/blog/artigo").split("/r/")[1]);
    expect(lido?.destino).toEqual({ caminho: "/blog/artigo" });
  });

  it("a simulação com o render real gera e-mail com links rastreados, pixel, descadastro e o dia sugerido", async () => {
    const f = fakeDb({ leads: [candidato(1, { email: "a@gmail.com", nome: "Ana Souza", empresa: "Souza Metais" })] });
    const d = depsDe(f.db, mundoCrm({}).crm, { render: renderF7 });
    const r = await rodar(d);
    expect(r.descartados).toEqual([]);
    expect(r.sairiaHoje).toHaveLength(1);
    // Teste A/B do assunto (F11): o lead cai no assunto do kit (controle) ou no convite do bate-papo rápido, e a variante fica gravada.
    const assunto = r.sairiaHoje[0].assunto;
    expect(["Ana Souza: um ponto sobre a gestão", "Souza Metais: um bate-papo rápido"]).toContain(assunto);
    expect(f.s.simulados[0].metadados.variantes).toEqual({ assunto: assunto.startsWith("Souza Metais") ? "convite_20min" : "kit" });
    const texto = f.s.simulados[0].conteudo;
    expect(texto).toContain("quarta, às 15h");
    expect(texto).toMatch(/https:\/\/empresarialacademy\.com\/r\/1\.email1\.conversa\./);
    expect(texto).toContain("api/marketing/sair?l=1");
    expect(texto).not.toContain("{{");
    expect(texto).not.toMatch(/[—–]/);
  });
});

/* ---------------------------------------------------------------- piloto de 01/10/2026: kit real do Hunter no orquestrador */

describe("orquestrador com o kit real do Hunter (correções do piloto)", () => {
  // Kit no formato gravado pelo Hunter, com lead fictício: email1 objeto, email2 e dm3 texto.
  const kitHunter = {
    dm3: "Oi, Carla! Vou deixar a porta aberta. Se fizer sentido, o diagnóstico gratuito mostra onde a gestão está mais frágil: {{link_diagnostico}}",
    email1: {
      assunto: "Distribuidora Modelo: gestão do pedido ao caixa",
      gancho: "Vi que a Distribuidora Modelo atende lojas em três estados.",
      dor: "Em distribuidoras, o pedido que chega solto costuma travar o financeiro.",
      ponte_video: "Separei uma demonstração de 1 minuto.",
      convite: "Gostaria de propor uma conversa. Consegue {{dia_sugerido}} pelo link {{link_conversa}}?",
    },
    email2: "Um ponto que vejo muito em distribuidoras: a tabela de preços demora a acompanhar o mercado. Se quiser olhar isso comigo, escolha um horário aqui: {{link_conversa}}",
  };
  const email1Feito: Historico = { canal: "email", tipo: "enviado", data: hora("2026-09-30", "09:00"), toque: "email1" };
  const dm1Antigo: Historico = { canal: "dm", tipo: "enviado", data: hora("2026-09-29", "10:00"), toque: "dm1" };
  const agoraD7 = hora("2026-10-06", "08:00");

  const sair = async (l: LeadCandidato, kit: unknown, historico: Historico[], dossie?: unknown) => {
    const f = fakeDb({ leads: [l], kits: { [l.id]: kit }, historico: { [l.id]: historico }, dossies: dossie === undefined ? undefined : { [l.id]: dossie } });
    const r = await rodar(depsDe(f.db, mundoCrm({}).crm, { render: renderF7, agora: agoraD7 }));
    return { r, f };
  };

  it("o e-mail 2 sai com o kit em texto, com o link inteiro e o dia com preposição", async () => {
    const l = candidato(1, { email: "carla@distribuidora-modelo.com.br", nome: "Distribuidora Modelo", empresa: "Distribuidora Modelo", primeiroToqueEm: hora("2026-09-29", "10:00") });
    const { r, f } = await sair(l, kitHunter, [dm1Antigo, email1Feito]);
    expect(r.descartados).toEqual([]);
    expect(r.sairiaHoje).toHaveLength(1);
    expect(r.sairiaHoje[0]).toMatchObject({ toque: "email2", diaSugerido: "na quarta, às 15h" });
    const texto = f.s.simulados[0].conteudo;
    expect(texto).toMatch(/escolha um horário aqui: https:\/\/empresarialacademy\.com\/r\/1\.email2\.conversa\.[\w-]+\n/);
    expect(texto).not.toMatch(/empresarialacademy\. com/);
    expect(texto).toContain("Olá,\n\n"); // só a empresa no nome: saudação sem nome
    expect(texto).not.toContain("Olá, Distribuidora");
  });

  it("o último toque por e-mail sai do dm3, com o diagnóstico e sem pedir reunião", async () => {
    const email2Feito: Historico = { canal: "email", tipo: "enviado", data: hora("2026-10-03", "09:00"), toque: "email2" };
    const l = candidato(2, { email: "carla@distribuidora-modelo.com.br", nome: "Carla Menezes", empresa: "Distribuidora Modelo", primeiroToqueEm: hora("2026-09-22", "10:00"), statusEntrega: { email: "enviado", whatsapp: "nao_enviado", dm: "nao_enviada", linkedin: "nao_enviado" } });
    const dm1: Historico = { canal: "dm", tipo: "enviado", data: hora("2026-09-22", "10:00"), toque: "dm1" };
    const e1: Historico = { canal: "email", tipo: "enviado", data: hora("2026-09-23", "09:00"), toque: "email1" };
    const e2: Historico = { ...email2Feito, data: hora("2026-09-28", "09:00") };
    const { r, f } = await sair(l, kitHunter, [dm1, e1, e2]);
    expect(r.descartados).toEqual([]);
    expect(r.sairiaHoje[0]).toMatchObject({ toque: "ultimo" });
    const texto = f.s.simulados[0].conteudo;
    expect(texto.startsWith("[simulação] Assunto:")).toBe(true);
    expect(texto).toContain("Olá, Carla,");
    expect(texto).toMatch(/onde a gestão está mais frágil: https:\/\/empresarialacademy\.com\/r\/2\.ultimo\.[\w.-]+/);
    expect(texto).toContain("Fazer o diagnóstico gratuito");
    expect(texto).not.toContain("Reservar meu bate-papo");
    expect(texto).not.toContain("Oi, Carla!");
  });

  it("lead fora do perfil recebe o diagnóstico no e-mail 1", async () => {
    const l = candidato(3, { email: "atelie@modelo.com.br", nome: "Carla Menezes", empresa: "Ateliê Modelo" });
    const kit = { email1: { ...kitHunter.email1, convite: "Se quiser um retrato rápido da gestão, o diagnóstico gratuito está aqui: {{link_diagnostico}}" } };
    const { r, f } = await sair(l, kit, [{ ...dm1Antigo, data: hora("2026-10-05", "10:00") }], { prova: "erik", no_perfil: false });
    expect(r.sairiaHoje[0]).toMatchObject({ toque: "email1" });
    const texto = f.s.simulados[0].conteudo;
    expect(texto).toContain("Fazer o diagnóstico gratuito");
    expect(texto).toMatch(/diagnóstico gratuito está aqui: https:\/\/empresarialacademy\.com\/r\/3\.email1\.[\w.-]+/);
    expect(texto).not.toMatch(/Reservar meu bate-papo|na quarta/);
  });

  it("e-mail de exemplo raspado do site não entra na cadência", async () => {
    const leads = [candidato(4, { email: "seu@email.com" }), candidato(5, { email: "email@exemplo.com" }), candidato(6, { email: "carla@distribuidora-modelo.com.br" })];
    const f = fakeDb({ leads, kits: { 4: kitHunter, 5: kitHunter, 6: kitHunter } });
    const r = await rodar(depsDe(f.db, mundoCrm({}).crm, { render: renderF7, agora: agoraD7 }));
    expect(r.sairiaHoje.map((x) => x.leadId)).toEqual([6]);
    expect(r.devidosDeEmail).toBe(1);
  });

  it("marcador de dia sugerido gravado antes da correção é refeito com a preposição", async () => {
    const f = fakeDb({ leads: [candidato(7, { email: "carla@distribuidora-modelo.com.br", nome: "Carla Menezes" })], kits: { 7: kitHunter } });
    f.s.marcadores.set("rotina:dia-sugerido:2026-10-06", { dia: "2026-10-07", hora: "15:00", texto: "quarta-feira, 7 de outubro, às 15h", origem: "regra" });
    const r = await rodar(depsDe(f.db, mundoCrm({}).crm, { render: renderF7, agora: agoraD7 }));
    expect(r.sairiaHoje[0].diaSugerido).toBe("na quarta, às 15h");
  });
});

/* ---------------------------------------------------------------- F11: nutrição e A/B no orquestrador */

describe("orquestrador: nutrição mensal, indicação e A/B", () => {
  const post = { titulo: "Como destravar a gestão de uma metalúrgica", slug: "destravar-gestao", resumo: "Um roteiro curto para o dono sair da operação.", temas: ["Indústria"], publicadoEm: hora("2026-09-20", "10:00") };
  const nut = (id: number, over: Partial<import("./nutricao").LeadNutricao> = {}): import("./nutricao").LeadNutricao => ({
    id,
    nome: `Lead ${id}`,
    empresa: `Empresa ${id}`,
    segmento: "Indústria",
    email: `n${id}@gmail.com`,
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
  /** Lead de nutrição também precisa existir em `leads` para o fakeDb devolver o conteúdo dele (não entra na cadência: etapa fora). */
  const mundoNut = (nuts: ReturnType<typeof nut>[], extra: LeadCandidato[] = []) => {
    const f = fakeDb({ leads: [...extra, ...nuts.map((n) => candidato(n.id, { etapa: "nutricao_continua", email: n.email, nome: n.nome, empresa: n.empresa }))], suprimidos: ["suprimido@gmail.com"] });
    const db: OutboundDb = { ...f.db, candidatosNutricao: async () => nuts, postsRecentes: async () => [post] };
    return { ...f, db };
  };

  it("simulação: o e-mail de nutrição entra depois da cadência, com o post do blog, link rastreado e descadastro", async () => {
    const { db, s } = mundoNut([nut(10)], [candidato(1, { email: "a@gmail.com" })]);
    const r = await rodar(depsDe(db, mundoCrm({}).crm, { render: renderF7 }));
    expect(r.sairiaHoje.map((x) => [x.leadId, x.toque])).toEqual([[1, "email1"], [10, "nutr_2026_10"]]);
    const sim = s.simulados.find((x) => x.leadId === 10)!;
    expect(sim.chave).toBe("sim:email:10:nutr_2026_10:2026-10-06");
    expect(sim.conteudo).toContain("Leitura do mês: Como destravar a gestão de uma metalúrgica");
    expect(sim.conteudo).toMatch(/\/r\/10\.nutr_2026_10\.x/); // clique rastreado até o post
    expect(sim.conteudo).toContain("api/marketing/sair?l=10");
    expect(sim.conteudo).not.toMatch(/[—–]/);
    expect(sim.conteudo).not.toContain("{{");
    expect(s.logs).toHaveLength(0);
  });

  it("nunca para quem pediu para sair, e-mail suprimido, ou quem já recebeu neste mês", async () => {
    const nuts = [nut(11, { optOut: true }), nut(12, { email: "suprimido@gmail.com" }), nut(13, { ultimoEnvioEm: hora("2026-09-25", "10:00") }), nut(14, { etapa: "saiu_da_lista" }), nut(15)];
    const { db } = mundoNut(nuts);
    const r = await rodar(depsDe(db, mundoCrm({}).crm, { render: renderF7 }));
    expect(r.sairiaHoje.map((x) => x.leadId)).toEqual([15]);
  });

  it("'não é o momento' recebe o pedido de indicação, sem post, com o convite do bate-papo rápido", async () => {
    const { db, s } = mundoNut([nut(20, { naoAgora: true, nome: "Ana Souza" })]);
    const r = await rodar(depsDe(db, mundoCrm({}).crm, { render: renderF7 }));
    expect(r.sairiaHoje).toHaveLength(1);
    expect(r.sairiaHoje[0]).toMatchObject({ toque: "indicacao" });
    expect(r.sairiaHoje[0].assunto).toBe("Ana, uma pergunta rápida");
    const sim = s.simulados[0];
    expect(sim.conteudo).toContain("conhece algum dono de empresa");
    expect(sim.conteudo).toContain("bate-papo rápido");
    expect(sim.conteudo).not.toMatch(/\b20 min/);
    expect(sim.conteudo).not.toContain("Leitura do mês");
  });

  it("sem post publicado no blog, o material do mês não sai (e nada é inventado)", async () => {
    const f = mundoNut([nut(30)]);
    const r = await rodar(depsDe({ ...f.db, postsRecentes: async () => [] }, mundoCrm({}).crm, { render: renderF7 }));
    expect(r.sairiaHoje).toEqual([]);
  });

  it("envio real: sai pelo mesmo teto e intervalo do e-mail frio e grava chave única por mês e a variante do A/B", async () => {
    const env = { OUTBOUND_ENVIO_REAL: "email" };
    const f = mundoNut([nut(40)]);
    const crm = mundoCrm({ 40: estado({ etapa: "nutricao_continua" }) });
    const enviar = vi.fn(async () => ({ ok: true }));
    const r = await rodar(depsDe(f.db, crm.crm, { env, enviar, render: renderF7, agora: hora("2026-10-06", "09:00") }));
    expect(r.enviados.map((x) => x.leadId)).toEqual([40]);
    const params = enviar.mock.calls[0] as unknown as [Record<string, string>];
    expect(params[0]).toMatchObject({ to: "n40@gmail.com", from: "comercial@empresarialacademy.com" });
    expect(params[0].html).toContain("Leitura do mês");
    expect(crm.interacoes.find((i) => i.tipo === "enviado")).toMatchObject({ canal: "email", chave: "out:email:40:nutr_2026_10", metadados: { toque: "nutr_2026_10" } });
    // continua em Nutrição contínua: o e-mail do mês não reabre a cadência
    expect(crm.leads[40].etapa).toBe("nutricao_continua");
  });

  it("A/B no envio real: a variante do assunto fica gravada na interação `enviado` e bate com o assunto que saiu", async () => {
    const env = { OUTBOUND_ENVIO_REAL: "email" };
    for (const id of [1, 2, 3, 4, 5, 6]) {
      const f = fakeDb({ leads: [candidato(id, { email: `x${id}@gmail.com`, nome: "Ana Souza", empresa: "Souza Metais" })] });
      const crm = mundoCrm({ [id]: estado({ etapa: "qualificado" }) });
      await rodar(depsDe(f.db, crm.crm, { env, render: renderF7, agora: hora("2026-10-06", "09:00") }));
      const env1 = crm.interacoes.find((i) => i.tipo === "enviado")!;
      const assunto = String(env1.metadados?.assunto);
      expect(env1.metadados?.variantes).toEqual({ assunto: assunto.startsWith("Souza Metais:") ? "convite_20min" : "kit" });
    }
  });
});
