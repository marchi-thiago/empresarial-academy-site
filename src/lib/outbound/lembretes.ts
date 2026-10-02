import { registrarInteracao } from "@/lib/crm/registrar";
import { decisorDoDossie } from "@/lib/crm/telas/dossie";
import type { InteracaoFila } from "@/lib/crm/telas/fila";
import { siteConfig } from "@/lib/site-config";
import { LIMITES, REMETENTE, envioRealLigado } from "./config";
import { montarFicha } from "./ficha-pre-reuniao";
import { chaveFollowUp, passoVigente, textoFollowUp, type PassoFollowUp } from "./follow-up";
import type { Deps, EventoDeAgenda } from "./orquestrador";
import { dataIso, ehDiaUtil, partesBr, somarDias, textoDoDia } from "./tempo";

/**
 * Reunião e venda (Plano Outbound, seção 8, frente F8): confirmação na hora do agendamento, lembretes 24h e 1h
 * antes, ficha pré-reunião ao Thiago e follow-up da proposta em D2, D5 e D10.
 * Tudo idempotente por chave em `interacoes` (a rotina roda a cada ~10 minutos).
 * Envio ao lead SÓ EM SIMULAÇÃO por padrão, seguindo `OUTBOUND_ENVIO_REAL` do orquestrador (F6):
 *  - e-mail: real só com `email` na chave;
 *  - WhatsApp: sempre simulado até o envio ser ligado à rota `/api/outbound/whatsapp` do EA Flow (F9, ainda sem chip).
 * A ficha pré-reunião e os avisos de follow-up vão ao Thiago (não ao lead), pelo aviso do EA Flow.
 */

export type ReuniaoAgendada = {
  leadId: number;
  nome: string;
  empresa: string | null;
  segmento: string | null;
  email: string | null;
  whatsapp: string | null;
  inicio: Date;
  temperatura: string;
  pontos: number;
  dossie: unknown;
  tokenConversa: string;
  /** Interações dos últimos 14 dias (sinais de engajamento da ficha). */
  interacoes: InteracaoFila[];
};

export type PropostaEmAberto = {
  leadId: number;
  nome: string;
  empresa: string | null;
  email: string | null;
  whatsapp: string | null;
  dossie: unknown;
  /** Quando o lead entrou em "Proposta enviada". */
  propostaEm: Date;
};

export interface ReunioesDb {
  /** Leads em "Reunião marcada" com data futura. */
  reunioesFuturas(agora: Date): Promise<ReuniaoAgendada[]>;
  /** Leads em "Proposta enviada", com a data da entrada na etapa. */
  propostasEmAberto(): Promise<PropostaEmAberto[]>;
}

/* ------------------------------------------------------------------ regras puras */

export type TipoLembrete = "confirmacao" | "24h" | "1h";

/**
 * O que fazer agora com os lembretes de uma reunião a `horasAte` horas. A confirmação sai assim que a reunião existe;
 * se ela e outro lembrete estão devidos juntos (agendou de véspera), só a confirmação sai e o outro é dado como coberto.
 * Se falhou a rotina por horas, só o lembrete mais próximo da reunião sai.
 */
export function lembretesDevidos(horasAte: number, feitos: ReadonlySet<TipoLembrete>): { enviar: TipoLembrete[]; cobertos: TipoLembrete[] } {
  if (horasAte <= 0) return { enviar: [], cobertos: [] };
  const devidos: TipoLembrete[] = [];
  if (!feitos.has("confirmacao")) devidos.push("confirmacao");
  if (horasAte <= 24 && !feitos.has("24h")) devidos.push("24h");
  if (horasAte <= 1 && !feitos.has("1h")) devidos.push("1h");
  if (devidos.includes("confirmacao")) return { enviar: ["confirmacao"], cobertos: devidos.filter((t) => t !== "confirmacao") };
  return { enviar: devidos.slice(-1), cobertos: devidos.slice(0, -1) };
}

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

const quandoTexto = (inicio: Date) => {
  const p = partesBr(inicio);
  return textoDoDia(dataIso(inicio), `${String(p.hora).padStart(2, "0")}:${String(p.min).padStart(2, "0")}`);
};

export type TextoLembrete = { assunto: string; texto: string };

export function textoLembrete(tipo: TipoLembrete, v: { nome: string; inicio: Date; linkReuniao?: string; linkConversa: string }): TextoLembrete {
  const quando = quandoTexto(v.inicio);
  const acesso = v.linkReuniao ? `Link de acesso: ${v.linkReuniao}` : "O link de acesso está no convite que chegou no seu e-mail.";
  const remarcar = `Se precisar remarcar: ${v.linkConversa}`;
  if (tipo === "confirmacao") {
    return {
      assunto: `Reunião confirmada: ${quando}`,
      texto: `Oi, ${v.nome}! Seu bate-papo com o Thiago, da Empresarial Academy, está confirmado para ${quando}.\n\n${acesso}\n${remarcar}`,
    };
  }
  if (tipo === "24h") {
    return {
      assunto: `Lembrete: nossa reunião é ${quando}`,
      texto: `Oi, ${v.nome}! Lembrete do nosso bate-papo, ${quando}.\n\n${acesso}\n${remarcar}`,
    };
  }
  return {
    assunto: "Nossa reunião começa em cerca de 1 hora",
    texto: `Oi, ${v.nome}! Nosso bate-papo começa em cerca de 1 hora, ${quando}.\n\n${acesso}`,
  };
}

/** Segunda a sexta, 8h às 18h de Brasília: janela dos toques comerciais (follow-up). */
export function naJanelaComercial(agora: Date): boolean {
  const { hora } = partesBr(agora);
  return ehDiaUtil(agora) && hora >= LIMITES.janelaEmail.de && hora < LIMITES.janelaEmail.ate;
}

/** O aviso da ficha ao Thiago não sai de madrugada. */
const horaDeAvisar = (agora: Date) => {
  const { hora } = partesBr(agora);
  return hora >= 7 && hora < 22;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const linkar = (s: string) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

function htmlSimples(texto: string, linkOptOut: string): string {
  const paras = texto
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${linkar(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const rodape = `<p style="margin:24px 0 0;font-size:12px;color:#666">Empresarial Academy · Consultoria empresarial com IA. Para não receber mais mensagens nossas: <a href="${linkOptOut}">clique aqui</a>.</p>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a">${paras}${rodape}</div>`;
}

/* ------------------------------------------------------------------ envio ao lead */

type Envio = {
  leadId: number;
  canal: "whatsapp" | "email";
  para: string | null;
  texto: TextoLembrete;
  chave: string;
  linkOptOut: string;
  suprimido: boolean;
  /** Metadados que identificam o toque (lembrete ou follow-up). */
  meta: Record<string, unknown>;
};

/** Grava (e, se o canal estiver ligado, envia) uma mensagem ao lead. Devolve se algo foi registrado. */
async function emitir(d: Deps, e: Envio): Promise<boolean> {
  if (!e.para) return false;
  if (e.canal === "email" && e.suprimido) return false;
  const real = e.canal === "email" && envioRealLigado("email", d.env);
  const base = { leadId: e.leadId, canal: e.canal, direcao: "saida" as const, tipo: "lembrete" as const, chave: e.chave, data: d.agora };

  if (!real) {
    const r = await registrarInteracao(
      d.crm,
      {
        ...base,
        conteudo: `[simulação] ${e.canal === "email" ? `Assunto: ${e.texto.assunto}\n\n` : ""}${e.texto.texto}`,
        metadados: { ...e.meta, simulado: true, para: e.para, ...(e.canal === "whatsapp" ? { motivoSimulacao: "envio de WhatsApp dos lembretes ainda não está ligado ao EA Flow (F9)" } : {}) },
      },
      d.agora,
    );
    return r.ok;
  }

  // Envio real de e-mail: no máximo uma tentativa por chave (falha de rede não vira laço de reenvio).
  if (!(await d.db.criarMarcador(`claim:${e.chave}`, { para: e.para }, e.leadId))) return false;
  try {
    await d.enviar({
      to: e.para,
      subject: e.texto.assunto,
      html: htmlSimples(e.texto.texto, e.linkOptOut),
      texto: e.texto.texto,
      from: REMETENTE.address,
      fromName: REMETENTE.name,
      replyTo: REMETENTE.address,
    });
  } catch (err) {
    const erro = String(err instanceof Error ? err.message : err).slice(0, 300);
    await registrarInteracao(d.crm, { leadId: e.leadId, canal: "email", direcao: "saida", tipo: "falha", conteudo: erro, metadados: { ...e.meta, motivo: "envio_recusado", definitiva: false }, data: d.agora }, d.agora);
    await d.db.logEmail({ leadId: e.leadId, para: e.para, assunto: e.texto.assunto, ok: false, erro });
    return false;
  }
  await registrarInteracao(
    d.crm,
    { ...base, conteudo: `Assunto: ${e.texto.assunto}\n\n${e.texto.texto}`, metadados: { ...e.meta, simulado: false, para: e.para, via: "outlook-graph" } },
    d.agora,
  );
  await d.db.logEmail({ leadId: e.leadId, para: e.para, assunto: e.texto.assunto, ok: true });
  return true;
}

/* ------------------------------------------------------------------ rotinas */

export type ResultadoLembretes = { reunioes: number; lembretes: number; fichas: number };

export async function processarLembretes(d: Deps): Promise<ResultadoLembretes> {
  const saida: ResultadoLembretes = { reunioes: 0, lembretes: 0, fichas: 0 };
  if (!d.reunioes) return saida;
  const reunioes = await d.reunioes.reunioesFuturas(d.agora);
  saida.reunioes = reunioes.length;
  if (reunioes.length === 0) return saida;

  const suprimidos = await d.db.suprimidos();
  let eventos: Promise<EventoDeAgenda[] | null> | null = null; // agenda do Outlook só é consultada se algo for sair
  const linkDaReuniao = async (r: ReuniaoAgendada): Promise<string | undefined> => {
    eventos ??= d.agenda(d.agora, somarDias(d.agora, 60)).catch(() => null);
    const lista = (await eventos) ?? [];
    const email = r.email?.toLowerCase();
    return lista.find((e) => e.linkReuniao && email && e.emails.includes(email) && Math.abs(e.inicio.getTime() - r.inicio.getTime()) <= 30 * 60_000)?.linkReuniao;
  };

  for (const r of reunioes) {
    const horasAte = (r.inicio.getTime() - d.agora.getTime()) / 3_600_000;
    const marca = r.inicio.toISOString();
    const chave = (tipo: TipoLembrete, canal: string) => `lembrete:${r.leadId}:${marca}:${tipo}:${canal}`;
    const feitos = new Set<TipoLembrete>();
    const tipos: TipoLembrete[] = horasAte <= 1 ? ["confirmacao", "24h", "1h"] : horasAte <= 24 ? ["confirmacao", "24h"] : ["confirmacao"];
    for (const t of tipos) {
      for (const canal of ["whatsapp", "email", "coberto"]) if (await d.crm.existeChave(chave(t, canal))) feitos.add(t);
    }
    const { enviar, cobertos } = lembretesDevidos(horasAte, feitos);

    for (const t of cobertos) {
      await registrarInteracao(d.crm, { leadId: r.leadId, canal: "sistema", direcao: "saida", tipo: "lembrete", conteudo: `Lembrete ${t} dispensado: já coberto pela mensagem mais recente.`, metadados: { lembrete: t, dispensado: true }, chave: chave(t, "coberto"), data: d.agora }, d.agora);
    }

    for (const t of enviar) {
      const nome = primeiroNome(decisorDoDossie(r.dossie) ?? r.nome);
      const texto = textoLembrete(t, { nome, inicio: r.inicio, linkReuniao: await linkDaReuniao(r), linkConversa: `${siteConfig.url}/conversa?t=${encodeURIComponent(r.tokenConversa)}` });
      const comum = { leadId: r.leadId, texto, linkOptOut: r.email ? d.urlDescadastro(r.leadId, r.email) : "", suprimido: !!r.email && suprimidos.has(r.email.toLowerCase()), meta: { lembrete: t, reuniaoEm: marca } };
      const a = await emitir(d, { ...comum, canal: "whatsapp", para: r.whatsapp, chave: chave(t, "whatsapp") });
      const b = await emitir(d, { ...comum, canal: "email", para: r.email, chave: chave(t, "email") });
      if (a || b) saida.lembretes++;
    }

    if (horasAte > 0 && horasAte <= 24 && (await enviarFicha(d, r, horasAte))) saida.fichas++;
  }
  return saida;
}

/** Ficha pré-reunião ao Thiago: grava na linha do tempo do lead e avisa pelo WhatsApp comercial (EA Flow). */
async function enviarFicha(d: Deps, r: ReuniaoAgendada, horasAte: number): Promise<boolean> {
  const chave = `ficha:${r.leadId}:${r.inicio.toISOString()}`;
  if (await d.crm.existeChave(chave)) return false;
  if (!horaDeAvisar(d.agora) && horasAte > 2) return false;
  const ficha = montarFicha({ nome: r.nome, empresa: r.empresa, segmento: r.segmento, dossie: r.dossie, temperatura: r.temperatura, pontos: r.pontos, interacoes: r.interacoes, reuniaoEm: r.inicio, agora: d.agora });
  const avisado = d.avisar ? await d.avisar(ficha.texto) : false;
  // Aviso falhou com tempo de sobra: tenta de novo na próxima rodada. Perto da reunião, fica só na linha do tempo.
  if (!avisado && horasAte > 2) return false;
  const x = await registrarInteracao(d.crm, { leadId: r.leadId, canal: "nota", direcao: "saida", tipo: "lembrete", conteudo: ficha.texto, metadados: { ficha: true, avisoEnviado: avisado, reuniaoEm: r.inicio.toISOString() }, chave, data: d.agora }, d.agora);
  return x.ok;
}

export type ResultadoFollowUps = { propostas: number; followUps: number };

export async function processarFollowUps(d: Deps): Promise<ResultadoFollowUps> {
  const saida: ResultadoFollowUps = { propostas: 0, followUps: 0 };
  if (!d.reunioes || !naJanelaComercial(d.agora)) return saida;
  const propostas = await d.reunioes.propostasEmAberto();
  saida.propostas = propostas.length;
  if (propostas.length === 0) return saida;
  const suprimidos = await d.db.suprimidos();
  const linkDiagnostico = `${siteConfig.url}/diagnostico-maturidade-empresarial.html`;

  for (const p of propostas) {
    const passo: PassoFollowUp | null = passoVigente(p.propostaEm, d.agora);
    if (!passo) continue;
    const chave = chaveFollowUp(p.leadId, p.propostaEm, passo);
    const nome = primeiroNome(decisorDoDossie(p.dossie) ?? p.nome);
    const texto = textoFollowUp(passo, { nome, empresa: p.empresa, linkDiagnostico });
    const dica = passo === 10 ? " Depois deste, registre Ganho ou Nutrição contínua com o motivo." : "";

    // Linha-mestre: dá a idempotência do passo inteiro e deixa o texto visível na linha do tempo.
    const mestre = await registrarInteracao(d.crm, { leadId: p.leadId, canal: "nota", direcao: "saida", tipo: "lembrete", conteudo: `Follow-up D${passo} da proposta.\n\n${texto.texto}`, metadados: { followUp: `D${passo}`, propostaEm: p.propostaEm.toISOString() }, chave, data: d.agora }, d.agora);
    if (!mestre.ok) continue;

    const comum = { leadId: p.leadId, texto, linkOptOut: p.email ? d.urlDescadastro(p.leadId, p.email) : "", suprimido: !!p.email && suprimidos.has(p.email.toLowerCase()), meta: { followUp: `D${passo}`, propostaEm: p.propostaEm.toISOString() } };
    await emitir(d, { ...comum, canal: "whatsapp", para: p.whatsapp, chave: `${chave}:whatsapp` });
    await emitir(d, { ...comum, canal: "email", para: p.email, chave: `${chave}:email` });
    if (d.avisar) await d.avisar(`Follow-up D${passo} da proposta: ${p.empresa ?? p.nome}.${dica}\n\nTexto do follow-up:\n${texto.texto}`);
    saida.followUps++;
  }
  return saida;
}
