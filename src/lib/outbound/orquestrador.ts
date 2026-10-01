import type { Pesos } from "@/lib/crm/pesos";
import { registrarInteracao, type CrmDb } from "@/lib/crm/registrar";
import { decisorDoDossie } from "@/lib/crm/telas/dossie";
import type { Etapa } from "@/lib/crm/tipos";
import type { SendOutlookMailParams } from "@/lib/assessor/microsoft-graph";
import {
  agendamentoDoLead,
  elegivel,
  emailDevido,
  type Agendamento,
  type Historico,
  type LeadCadencia,
} from "./cadencia";
import { classificarMensagem, type MensagemCaixa } from "./caixa";
import { REMETENTE, envioRealLigado, lerCaixaLigado, tetoEmailPorDia } from "./config";
import { provaDoDossie } from "./conversa";
import { eventoOutlookParaOcupado, sugerirDia, type DiaSugerido, type Ocupado } from "./dia-sugerido";
import { renderEmailOutbound as renderPadrao, primeiroNome as primeiroNomeValido, type DadosEmailOutbound, type EmailOutbound, type PartesFixasOutbound } from "./email/render";
import { confirmarVariantes, escolherVariantes } from "./experimentos";
import { planejarNutricao, textoDaNutricao, type ItemNutricao, type LeadNutricao, type PostNutricao } from "./nutricao";
import { mapearTextos, partesDoKit } from "./kit";
import { intervaloAleatorio, planejarEmails, referenciaDoPlano, type CandidatoEmail, type Descartado, type EnvioDoDia, type ItemPlano, type Pausa } from "./plano";
import { acharReunioes } from "./recalcular";
import { rastreadorDoLead, urlDoPixel } from "./rastreio";
import { dataIso, inicioDoDia, somarDias } from "./tempo";
import { marcadoresSobrando, preencher, problemaDoTexto } from "./texto";
import { siteConfig } from "@/lib/site-config";
import { verificarAlertas } from "./alertas";
import { processarFollowUps, processarLembretes, type ReunioesDb } from "./lembretes";

/**
 * Orquestrador do outbound (F6). Cada chamada: recalcula temperatura (1 vez por dia), lê a caixa comercial@
 * (se ligada), confere a agenda do Outlook (1 vez por hora), agenda os próximos toques de cada lead
 * (`cadencia.proximoToqueEm` e `proximoCanal`, que o Hunter, o EA Flow e a Fila do dia leem) e trata o e-mail:
 *  - simulação (padrão): grava em `interacoes` o que sairia no dia (`metadados.simulado = true`), sem enviar nem mexer no lead;
 *  - envio real (OUTBOUND_ENVIO_REAL=email): no máximo 1 e-mail por chamada, respeitando intervalo, teto, janela e domínio.
 * Persistência e rede entram por `Deps`, então tudo testa sem banco.
 */

export type ConteudoLead = {
  id: number;
  nome: string;
  empresa: string | null;
  email: string | null;
  kit: unknown;
  dossie: unknown;
  tokenConversa: string;
};

export type LeadCandidato = LeadCadencia & {
  nome: string;
  empresa: string | null;
  /** O que já está gravado em `cadencia`, para só escrever o que mudou. */
  agendaGravada: { canal: string | null; em: Date | null; etapaAtual: string | null };
};

export type ReuniaoLead = { id: number; email: string; etapa: Etapa; temData: boolean };

export interface OutboundDb {
  /** Leads em cadência de outbound (legítimo interesse, etapa ativa, sem pausa nem opt-out) com 1º toque desde `desde` ou DM impossível. */
  candidatos(desde: Date): Promise<LeadCandidato[]>;
  /** Toques reais de saída, resultados de ligação, falhas e bloqueios de texto (tipo "bloqueio") de cada lead. Nunca simulados. */
  historico(ids: number[]): Promise<Map<number, Historico[]>>;
  /** Endereços (minúsculos) que não podem receber: opt-out ou bounce em qualquer cadastro. */
  suprimidos(): Promise<Set<string>>;
  /** E-mails REAIS enviados desde `desde`. */
  enviosDeEmail(desde: Date): Promise<(EnvioDoDia & { leadId: number; para: string })[]>;
  bouncesDeEmail(desde: Date): Promise<number>;
  conteudoDoLead(id: number): Promise<ConteudoLead | null>;
  gravarAgenda(id: number, a: { canal: string | null; em: Date | null; etapaAtual: string | null }): Promise<void>;
  /** Linha lead-less (ou do lead) com chave única: `lerMarcador` devolve os metadados se já existir. */
  lerMarcador(chave: string): Promise<Record<string, unknown> | null>;
  /** false se a chave já existia (outra chamada passou na frente). */
  criarMarcador(chave: string, metadados: Record<string, unknown>, leadId?: number): Promise<boolean>;
  gravarMarcador?(chave: string, metadados: Record<string, unknown>, data?: Date): Promise<void>;
  gravarSimulado(i: { leadId: number; chave: string; conteudo: string; metadados: Record<string, unknown>; data: Date }): Promise<boolean>;
  registrarBloqueio(leadId: number, toque: string, motivo: string, data: Date): Promise<void>;
  logEmail(i: { leadId: number; para: string; assunto: string; ok: boolean; erro?: string }): Promise<void>;
  recalcularTemperaturas(agora: Date, pesos: Pesos): Promise<number>;
  pesos(): Promise<Pesos>;
  /** Partes fixas do e-mail editáveis no admin (`email-templates`, chave `outbound:`); vazio = padrão do código. */
  partesFixas(): Promise<PartesFixasOutbound>;
  /** Nutrição mensal (F11): leads em Nutrição contínua ou com a cadência encerrada, base legítimo interesse, sem opt-out. */
  candidatosNutricao?(agora: Date): Promise<LeadNutricao[]>;
  /** Posts publicados do blog (inclui os do EA Post), do mais recente ao mais antigo. */
  postsRecentes?(agora: Date): Promise<PostNutricao[]>;
  leadsParaAgenda(): Promise<ReuniaoLead[]>;
  definirReuniao(leadId: number, inicio: Date | null): Promise<void>;
}

export type EventoDeAgenda = { id: string; inicio: Date; fim: Date; emails: string[]; linkReuniao?: string };

export type Deps = {
  db: OutboundDb;
  crm: CrmDb;
  enviar: (p: SendOutlookMailParams) => Promise<unknown>;
  /** Eventos do Outlook no intervalo; null quando a agenda não está disponível (regra fixa entra). */
  agenda: (de: Date, ate: Date) => Promise<EventoDeAgenda[] | null>;
  lerCaixa: (desde: Date) => Promise<MensagemCaixa[]>;
  urlDescadastro: (leadId: number, email: string) => string;
  /** Formato do e-mail (F7). Injetável para testar sem MJML. */
  render?: (d: DadosEmailOutbound) => Promise<EmailOutbound>;
  /** Reunião e venda (F8): reuniões futuras e propostas em aberto. Ausente = lembretes e follow-ups não rodam. */
  reunioes?: ReunioesDb;
  /** Notificador ao Thiago (WhatsApp comercial via EA Flow). */
  avisar?: (texto: string) => Promise<boolean>;
  /** Revisão semanal (F11): gera a da semana uma única vez. Ausente = desligada (testes). */
  revisao?: () => Promise<unknown>;
  agora: Date;
  rand: () => number;
  env: Record<string, string | undefined>;
};

export type ItemRelatorio = {
  leadId: number;
  nome: string;
  para: string;
  toque: string;
  assunto: string;
  horarioPrevisto: string;
  diaSugerido: string;
};

export type Relatorio = {
  modo: "dry" | "simulacao" | "real";
  janela: { inicio: string; naJanela: boolean };
  pausa: Pausa | null;
  teto: number;
  candidatos: number;
  devidosDeEmail: number;
  /** Simulação e dry: o que sairia (ou, no real, o que acabou de sair). */
  sairiaHoje: ItemRelatorio[];
  enviados: ItemRelatorio[];
  descartados: (Descartado | { leadId: number; motivo: string })[];
  agendados: number;
  rotinas: Record<string, unknown>;
};

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

type Preparado = { ok: true; email: EmailOutbound; variantes?: Record<string, string> } | { ok: false; motivo: string };

/** Quantos candidatos de nutrição entram no plano de cada rodada (o teto diário e a janela decidem quantos saem). */
const MAX_NUTRICAO_POR_RODADA = 60;

export async function rodar(d: Deps, opcoes: { dry?: boolean } = {}): Promise<Relatorio> {
  const { db, agora } = d;
  const dry = Boolean(opcoes.dry);
  const real = !dry && envioRealLigado("email", d.env);
  const modo: Relatorio["modo"] = dry ? "dry" : real ? "real" : "simulacao";
  const rotinas: Record<string, unknown> = {};
  const roda = async (nome: string, f: () => Promise<unknown>) => {
    try {
      rotinas[nome] = await f();
    } catch (e) {
      rotinas[nome] = { erro: String(e instanceof Error ? e.message : e).slice(0, 300) };
    }
  };

  if (!dry) {
    await roda("temperatura", () => rotinaUmaVez(db, `rotina:temperatura:${dataIso(agora)}`, async () => db.recalcularTemperaturas(agora, await db.pesos())));
    if (lerCaixaLigado(d.env)) await roda("caixa", () => processarCaixa(d));
    await roda("agenda", () => rotinaUmaVez(db, `rotina:agenda:${dataIso(agora)}T${String(agora.getUTCHours()).padStart(2, "0")}`, () => reconciliarAgenda(d)));
    if (d.reunioes) {
      await roda("lembretes", () => processarLembretes(d));
      await roda("followUps", () => processarFollowUps(d));
    }
    await roda("alertas", () => verificarAlertas(d));
    await roda("revisaoSemanal", async () => (d.revisao ? d.revisao() : "desligada"));
  }

  const ref = referenciaDoPlano(agora);
  const hoje = ref.inicio;
  const inicioDoPlano = inicioDoDia(hoje);
  const diaDoPlano = dataIso(hoje);

  const desde = somarDias(hoje, -21);
  const leads = await db.candidatos(desde);
  const historico = await db.historico(leads.map((l) => l.id));
  const suprimidos = await db.suprimidos();
  const limiteBloqueio = agora.getTime() - 24 * 3_600_000;

  let agendados = 0;
  const candidatos: CandidatoEmail[] = [];
  const nomes = new Map<number, string>();
  const leadsPorId = new Map<number, LeadCandidato>();
  for (const bruto of leads) {
    const lead: LeadCandidato = { ...bruto, emailSuprimido: bruto.emailSuprimido || (!!bruto.email && suprimidos.has(bruto.email.trim().toLowerCase())) };
    const hist = historico.get(lead.id) ?? [];
    if (!elegivel(lead, hist, hoje)) continue;
    leadsPorId.set(lead.id, lead);
    nomes.set(lead.id, lead.nome);

    if (!dry) {
      const ag = agendamentoDoLead(lead, hist, hoje);
      if (mudou(lead.agendaGravada, ag)) {
        await db.gravarAgenda(lead.id, ag ? { canal: ag.canal, em: ag.em, etapaAtual: `d${ag.dia}_${ag.toque}` } : { canal: null, em: null, etapaAtual: null });
        agendados++;
      }
    }

    const devido = emailDevido(lead, hist, hoje);
    if (!devido || !lead.email) continue;
    if (hist.some((h) => h.tipo === "bloqueio" && h.toque === devido.toque && h.data.getTime() > limiteBloqueio)) continue;
    candidatos.push({
      leadId: lead.id,
      toque: devido.toque,
      para: lead.email.trim().toLowerCase(),
      prioridade: lead.temperatura === "engajado" ? 0 : lead.temperatura === "morno" ? 1 : 2,
      devidoEm: devido.devidoEm,
    });
  }

  // Nutrição mensal e pedido de indicação: entram depois da cadência (prioridade 3) e disputam o mesmo teto, janela e domínio.
  const nutricao = new Map<number, ItemNutricao>();
  if (db.candidatosNutricao && db.postsRecentes) {
    const leadsNut = (await db.candidatosNutricao(hoje)).map((l) => ({ ...l, emailSuprimido: l.emailSuprimido || (!!l.email && suprimidos.has(l.email.trim().toLowerCase())) }));
    const itens = planejarNutricao(leadsNut, await db.postsRecentes(hoje), hoje).filter((i) => !leadsPorId.has(i.lead.id));
    for (const it of itens.slice(0, MAX_NUTRICAO_POR_RODADA)) {
      nutricao.set(it.lead.id, it);
      nomes.set(it.lead.id, it.lead.nome);
      candidatos.push({ leadId: it.lead.id, toque: it.toque, para: it.lead.email!.trim().toLowerCase(), prioridade: 3, devidoEm: hoje });
    }
  }

  const enviosHoje = await db.enviosDeEmail(inicioDoPlano);
  const bounces = await db.bouncesDeEmail(inicioDoPlano);
  const teto = tetoEmailPorDia(d.env);
  const sugestao = await diaSugeridoDoDia(d, diaDoPlano, hoje, dry);

  const descartados: Relatorio["descartados"] = [];
  const preparados = new Map<number, Preparado>();
  const excluidos = new Set<number>();
  let plano = planejarEmails({ candidatos, enviadosHoje: enviosHoje, bouncesHoje: bounces, agora, teto, rand: d.rand });

  // Simulação: valida o texto de cada item; o que não pode sair é excluído e o dia é replanejado.
  // No real a validação é preguiçosa (só o item que vai sair), no laço de envio abaixo.
  const obter = async (item: CandidatoEmail): Promise<Preparado> => {
    if (!preparados.has(item.leadId)) preparados.set(item.leadId, await preparar(d, item, sugestao, nutricao.get(item.leadId)));
    return preparados.get(item.leadId)!;
  };
  for (let volta = 0; volta < 6 && !real; volta++) {
    let excluiu = false;
    for (const item of plano.itens) {
      const p = await obter(item);
      if (p.ok) continue;
      excluidos.add(item.leadId);
      descartados.push({ leadId: item.leadId, motivo: p.motivo });
      excluiu = true;
    }
    if (!excluiu) break;
    plano = planejarEmails({ candidatos: candidatos.filter((c) => !excluidos.has(c.leadId)), enviadosHoje: enviosHoje, bouncesHoje: bounces, agora, teto, rand: d.rand });
  }
  descartados.push(...plano.descartados);

  const relatorio = (item: ItemPlano, p: Extract<Preparado, { ok: true }>): ItemRelatorio => ({
    leadId: item.leadId,
    nome: nomes.get(item.leadId) ?? "",
    para: item.para,
    toque: item.toque,
    assunto: p.email.assunto,
    horarioPrevisto: item.horarioPrevisto.toISOString(),
    diaSugerido: sugestao.texto,
  });

  const sairiaHoje: ItemRelatorio[] = [];
  const enviados: ItemRelatorio[] = [];

  if (!plano.pausa) {
    if (real) {
      if (ref.naJanela && plano.liberadoEm.getTime() <= agora.getTime()) {
        for (const item of plano.itens) {
          const p = await obter(item);
          if (!p.ok) {
            descartados.push({ leadId: item.leadId, motivo: p.motivo });
            await db.registrarBloqueio(item.leadId, item.toque, p.motivo, agora);
            continue;
          }
          const saiu = await enviarUm(d, item, p, diaDoPlano, sugestao);
          if (saiu === "enviado") {
            enviados.push(relatorio(item, p));
            break;
          }
          if (saiu === "falhou") break;
          descartados.push({ leadId: item.leadId, motivo: "ja_tentado_hoje" });
        }
      }
    } else {
      for (const item of plano.itens) {
        const p = preparados.get(item.leadId);
        if (!p?.ok) continue;
        sairiaHoje.push(relatorio(item, p));
        if (!dry) {
          await db.gravarSimulado({
            leadId: item.leadId,
            chave: `sim:email:${item.leadId}:${item.toque}:${diaDoPlano}`,
            conteudo: `[simulação] Assunto: ${p.email.assunto}\n\n${p.email.texto}`,
            metadados: {
              simulado: true,
              toque: item.toque,
              assunto: p.email.assunto,
              para: item.para,
              horarioPrevisto: item.horarioPrevisto.toISOString(),
              diaSugerido: sugestao.dia,
              ...(p.variantes ? { variantes: p.variantes } : {}),
            },
            data: agora,
          });
        }
      }
    }
  }

  return {
    modo,
    janela: { inicio: ref.inicio.toISOString(), naJanela: ref.naJanela },
    pausa: plano.pausa,
    teto,
    candidatos: leadsPorId.size,
    devidosDeEmail: candidatos.length,
    sairiaHoje,
    enviados,
    descartados,
    agendados,
    rotinas,
  };
}

function mudou(gravada: LeadCandidato["agendaGravada"], novo: Agendamento | null): boolean {
  if (!novo) return gravada.canal !== null || gravada.em !== null || gravada.etapaAtual !== null;
  return (
    gravada.canal !== novo.canal ||
    gravada.etapaAtual !== `d${novo.dia}_${novo.toque}` ||
    !gravada.em ||
    dataIso(gravada.em) !== dataIso(novo.em)
  );
}

/** Roda `f` só se ninguém rodou a mesma chave antes (marcador único no banco). */
async function rotinaUmaVez(db: OutboundDb, chave: string, f: () => Promise<unknown>): Promise<unknown> {
  if (!(await db.criarMarcador(chave, { rotina: chave }))) return "ja_rodou";
  return f();
}

async function diaSugeridoDoDia(d: Deps, dia: string, hoje: Date, dry: boolean): Promise<DiaSugerido> {
  const chave = `rotina:dia-sugerido:${dia}`;
  const salvo = await d.db.lerMarcador(chave);
  if (salvo && typeof salvo.dia === "string" && typeof salvo.hora === "string" && typeof salvo.texto === "string") {
    return { dia: salvo.dia, hora: salvo.hora, texto: salvo.texto, origem: salvo.origem === "agenda" ? "agenda" : "regra" };
  }
  let ocupados: Ocupado[] | null = null;
  try {
    const eventos = await d.agenda(inicioDoDia(hoje), somarDias(inicioDoDia(hoje), 9));
    if (eventos) ocupados = eventos.map((e) => ({ inicio: e.inicio, fim: e.fim }));
  } catch {
    ocupados = null;
  }
  const s = sugerirDia(hoje, ocupados);
  if (!dry) await d.db.criarMarcador(chave, { ...s });
  return s;
}

/** Render e guardas finais do texto, comuns à cadência e à nutrição. */
async function renderizar(d: Deps, dados: DadosEmailOutbound): Promise<{ ok: true; email: EmailOutbound } | { ok: false; motivo: string }> {
  let email: EmailOutbound;
  try {
    email = await (d.render ?? renderPadrao)(dados);
  } catch (e) {
    return { ok: false, motivo: `render_${String(e instanceof Error ? e.message : e).slice(0, 80)}` };
  }
  const problema = problemaDoTexto(email.assunto, email.texto);
  if (problema) return { ok: false, motivo: `texto_${problema}` };
  if (!email.html.trim()) return { ok: false, motivo: "render_vazio" };
  return { ok: true, email };
}

async function prepararNutricao(d: Deps, item: CandidatoEmail, sugestao: DiaSugerido, it: ItemNutricao): Promise<Preparado> {
  const c = await d.db.conteudoDoLead(item.leadId);
  if (!c || !c.email) return { ok: false, motivo: "lead_indisponivel" };
  const nome = primeiroNomeValido(decisorDoDossie(c.dossie) ?? c.nome);
  const texto = textoDaNutricao(it.tipo, {
    nome,
    empresa: c.empresa,
    post: it.post,
    combina: it.combina,
    linkDoPost: it.post ? `${siteConfig.url}/blog/${it.post.slug}` : null,
  });
  if (!texto) return { ok: false, motivo: "sem_post_no_blog" };
  const conversa = `${siteConfig.url}/conversa?t=${encodeURIComponent(c.tokenConversa)}`;
  const r = await renderizar(d, {
    nome: c.nome,
    empresa: c.empresa,
    assunto: texto.assunto,
    kit: texto.kit,
    toque: 2,
    prova: provaDoDossie(c.dossie),
    diaSugerido: sugestao.texto,
    linkConversa: conversa,
    linkOptOut: d.urlDescadastro(c.id, c.email),
    pixelUrl: urlDoPixel(c.id, item.toque),
    rastrear: rastreadorDoLead(c.id, item.toque),
    partesFixas: await partesFixas(d),
    leitura: texto.leitura ?? null,
  });
  return r.ok ? { ok: true, email: r.email } : r;
}

async function preparar(d: Deps, item: CandidatoEmail, sugestao: DiaSugerido, nutricao?: ItemNutricao): Promise<Preparado> {
  if (nutricao) return prepararNutricao(d, item, sugestao, nutricao);
  const c = await d.db.conteudoDoLead(item.leadId);
  if (!c || !c.email) return { ok: false, motivo: "lead_indisponivel" };
  const partes = partesDoKit(c.kit, item.toque);
  if (!partes) return { ok: false, motivo: "sem_texto_de_email_no_kit" };

  const conversa = `${siteConfig.url}/conversa?t=${encodeURIComponent(c.tokenConversa)}`;
  const rastrear = rastreadorDoLead(c.id, item.toque);
  const nome = decisorDoDossie(c.dossie) ?? c.nome;
  const vars = {
    dia_sugerido: sugestao.texto,
    link_conversa: rastrear(conversa),
    link_diagnostico: rastrear(`${siteConfig.url}/diagnostico-maturidade-empresarial.html`),
    nome: primeiroNome(nome),
    empresa: c.empresa ?? "",
  };
  const kit = mapearTextos(partes, (t) => preencher(t, vars));
  if (marcadoresSobrando(JSON.stringify(kit)).length) return { ok: false, motivo: "texto_marcador_sobrando" };

  // Teste A/B (F11): variante estável por lead; só conta na medição se o assunto saiu como a variante descreve.
  const ab = escolherVariantes("email", c.id, { nome: primeiroNome(nome), empresa: c.empresa });
  const dados: DadosEmailOutbound = {
    nome,
    empresa: c.empresa,
    ...(ab.assunto ? { assunto: ab.assunto } : {}),
    kit,
    toque: item.toque === "email1" ? 1 : 2, // o último toque usa o formato curto do 2º e-mail
    prova: provaDoDossie(c.dossie),
    diaSugerido: sugestao.texto,
    linkConversa: conversa,
    linkOptOut: d.urlDescadastro(c.id, c.email),
    pixelUrl: urlDoPixel(c.id, item.toque),
    rastrear,
    partesFixas: await partesFixas(d),
  };
  const r = await renderizar(d, dados);
  if (!r.ok) return r;
  return { ok: true, email: r.email, variantes: confirmarVariantes(ab, r.email.assunto) };
}

const fixasEmCache = new WeakMap<Deps, Promise<PartesFixasOutbound>>();
function partesFixas(d: Deps): Promise<PartesFixasOutbound> {
  if (!fixasEmCache.has(d)) fixasEmCache.set(d, d.db.partesFixas().catch(() => ({})));
  return fixasEmCache.get(d)!;
}

async function enviarUm(d: Deps, item: ItemPlano, p: Extract<Preparado, { ok: true }>, dia: string, sugestao: DiaSugerido): Promise<"enviado" | "falhou" | "ja_tentado"> {
  const { db, agora } = d;
  // No máximo uma tentativa por lead, toque e dia: falha de rede não vira laço de reenvio.
  if (!(await db.criarMarcador(`claim:email:${item.leadId}:${item.toque}:${dia}`, { para: item.para }, item.leadId))) return "ja_tentado";
  try {
    await d.enviar({
      to: item.para,
      subject: p.email.assunto,
      html: p.email.html,
      texto: p.email.texto,
      from: REMETENTE.address,
      fromName: REMETENTE.name,
      replyTo: REMETENTE.address,
    });
  } catch (e) {
    const erro = String(e instanceof Error ? e.message : e).slice(0, 300);
    await registrarInteracao(d.crm, {
      leadId: item.leadId,
      canal: "email",
      direcao: "saida",
      tipo: "falha",
      conteudo: erro,
      metadados: { toque: item.toque, motivo: "envio_recusado", definitiva: false },
      data: agora,
    }, agora);
    await db.logEmail({ leadId: item.leadId, para: item.para, assunto: p.email.assunto, ok: false, erro });
    return "falhou";
  }
  const proximoEnvioApos = new Date(agora.getTime() + intervaloAleatorio(d.rand));
  await registrarInteracao(d.crm, {
    leadId: item.leadId,
    canal: "email",
    direcao: "saida",
    tipo: "enviado",
    conteudo: `Assunto: ${p.email.assunto}\n\n${p.email.texto}`,
    metadados: {
      toque: item.toque,
      assunto: p.email.assunto,
      para: item.para,
      diaSugerido: sugestao.dia,
      proximoEnvioApos: proximoEnvioApos.toISOString(),
      via: "outlook-graph",
      ...(p.variantes ? { variantes: p.variantes } : {}),
    },
    chave: `out:email:${item.leadId}:${item.toque}`,
    data: agora,
  }, agora);
  await db.logEmail({ leadId: item.leadId, para: item.para, assunto: p.email.assunto, ok: true });
  return "enviado";
}

/** Lê a caixa comercial@ e registra bounces e respostas dos e-mails que enviamos nos últimos 30 dias. */
export async function processarCaixa(d: Deps): Promise<{ lidas: number; bounces: number; respostas: number }> {
  const envios = await d.db.enviosDeEmail(somarDias(d.agora, -30));
  const porEmail = new Map(envios.map((e) => [e.para.toLowerCase(), e.leadId]));
  const mensagens = await d.lerCaixa(somarDias(d.agora, -2));
  let bounces = 0;
  let respostas = 0;
  for (const m of mensagens) {
    const ev = classificarMensagem(m, new Set(porEmail.keys()));
    if (!ev) continue;
    const leadId = porEmail.get(ev.email);
    if (leadId === undefined) continue;
    if (ev.tipo === "bounce") {
      const r = await registrarInteracao(d.crm, {
        leadId,
        canal: "email",
        direcao: "entrada",
        tipo: "bounce",
        conteudo: m.assunto,
        metadados: { temporario: ev.temporario, origem: "caixa" },
        chave: `caixa:${ev.mensagemId}`,
        data: ev.recebidoEm,
      }, d.agora);
      if (r.ok) bounces++;
    } else {
      const r = await registrarInteracao(d.crm, {
        leadId,
        canal: "email",
        direcao: "entrada",
        tipo: "respondido",
        conteudo: ev.texto.slice(0, 2000),
        metadados: ev.descadastro ? { intencao: "descadastro", origem: "caixa" } : { origem: "caixa" },
        chave: `caixa:${ev.mensagemId}`,
        data: ev.recebidoEm,
      }, d.agora);
      if (r.ok) respostas++;
    }
  }
  return { lidas: mensagens.length, bounces, respostas };
}

const JA_MARCADAS: Etapa[] = ["reuniao_marcada", "reuniao_feita", "proposta_enviada", "ganho"];

/** Garantia pela agenda do Outlook: reunião marcada fora da /conversa (ou postMessage perdido) também entra no CRM. */
export async function reconciliarAgenda(d: Deps): Promise<{ reunioes: number; registradas: number }> {
  const leads = await d.db.leadsParaAgenda();
  if (leads.length === 0) return { reunioes: 0, registradas: 0 };
  const eventos = await d.agenda(d.agora, somarDias(d.agora, 30));
  if (!eventos) return { reunioes: 0, registradas: 0 };
  const achadas = acharReunioes(eventos, leads, d.agora);
  let registradas = 0;
  for (const r of achadas) {
    const lead = leads.find((l) => l.id === r.leadId)!;
    if (!JA_MARCADAS.includes(lead.etapa)) {
      const x = await registrarInteracao(d.crm, {
        leadId: r.leadId,
        canal: "sistema",
        direcao: "entrada",
        tipo: "agendou",
        conteudo: "Reunião encontrada na agenda do Outlook.",
        metadados: { origem: "agenda_outlook", inicio: r.inicio.toISOString() },
        chave: `agenda:${r.eventoId}`,
      }, d.agora);
      if (x.ok) registradas++;
    }
    if (!lead.temData) await d.db.definirReuniao(r.leadId, r.inicio);
  }
  return { reunioes: achadas.length, registradas };
}

/** Traduz um evento do Outlook (hora de Brasília, sem fuso) para `EventoDeAgenda`. */
export function eventoDeAgenda(e: { id: string; startISO?: string; endISO?: string; attendeeEmails?: string[]; linkReuniao?: string }): EventoDeAgenda | null {
  const o = eventoOutlookParaOcupado(e.startISO, e.endISO);
  return o ? { id: e.id, inicio: o.inicio, fim: o.fim, emails: e.attendeeEmails ?? [], linkReuniao: e.linkReuniao } : null;
}

