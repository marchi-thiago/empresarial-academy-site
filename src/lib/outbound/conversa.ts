import { normalizarChave } from "@/lib/crm/telas/dossie";
import { dataIso, inicioDoDia } from "./tempo";

/**
 * Lógica pura da página pública /conversa?t=<tokenConversa>: qual vídeo de prova, URL do Calendly
 * com nome, e-mail e dia sugeridos, e o que cada gesto do visitante grava no CRM.
 */

export const CALENDLY_URL = "https://calendly.com/thiago-empresarialacademy/new-meeting";

export type Prova = "fabio" | "daniella" | "erik";
const PROVAS: readonly Prova[] = ["fabio", "daniella", "erik"];

const ehObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Prova escolhida pelo dossiê para o e-mail (F7): os três depoimentos ou a demo de 60 s do segmento. Sem reconhecer: Fábio. */
export function provaDoDossie(dossie: unknown): Prova | "demo_segmento" {
  let d = dossie;
  if (typeof d === "string") {
    try {
      d = JSON.parse(d);
    } catch {
      return "fabio";
    }
  }
  if (!ehObj(d)) return "fabio";
  const chave = Object.keys(d).find((k) => ["prova", "provaescolhida", "provadosegmento"].includes(normalizarChave(k)));
  if (!chave) return "fabio";
  const texto = normalizarChave(JSON.stringify(d[chave]));
  return PROVAS.find((p) => texto.includes(p)) ?? (texto.includes("demo") ? "demo_segmento" : "fabio");
}

/** Vídeo da página /conversa: a demo de segmento ainda não tem arquivo no site, então cai no Fábio. */
export function resolverProva(dossie: unknown): Prova {
  const p = provaDoDossie(dossie);
  return p === "demo_segmento" ? "fabio" : p;
}

export type PrefillCalendly = { nome?: string | null; email?: string | null; dia?: string | null };

/** URL do evento com nome, e-mail e dia pré-preenchidos (parâmetros `name`, `email`, `month` e `date` do Calendly). */
export function urlDoCalendly(p: PrefillCalendly = {}): string {
  const u = new URL(CALENDLY_URL);
  if (p.nome) u.searchParams.set("name", p.nome);
  if (p.email) u.searchParams.set("email", p.email);
  if (p.dia && /^\d{4}-\d{2}-\d{2}$/.test(p.dia)) {
    u.searchParams.set("month", p.dia.slice(0, 7));
    u.searchParams.set("date", p.dia);
  }
  u.searchParams.set("hide_gdpr_banner", "1");
  return u.toString();
}

export type GestoDaConversa = "abriu" | "play" | "agendou";
export const GESTOS: readonly GestoDaConversa[] = ["abriu", "play", "agendou"];

export type InteracaoDaConversa = {
  canal: "sistema";
  direcao: "entrada";
  tipo: "abriu_pagina" | "deu_play" | "agendou";
  metadados: Record<string, unknown>;
  chave: string;
  conteudo?: string;
};

/**
 * O que gravar para cada gesto. Chave de idempotência: abrir e dar play contam uma vez por dia;
 * agendar, uma vez por evento do Calendly (`evento` = URI que vem no postMessage).
 */
export function interacaoDoGesto(leadId: number, gesto: GestoDaConversa, agora: Date, evento?: string | null): InteracaoDaConversa {
  const dia = dataIso(inicioDoDia(agora));
  if (gesto === "abriu") {
    return { canal: "sistema", direcao: "entrada", tipo: "abriu_pagina", metadados: { destino: "conversa" }, chave: `conversa:abriu:${leadId}:${dia}` };
  }
  if (gesto === "play") {
    return { canal: "sistema", direcao: "entrada", tipo: "deu_play", metadados: { destino: "conversa" }, chave: `conversa:play:${leadId}:${dia}` };
  }
  const uri = (evento ?? "").slice(0, 200);
  return {
    canal: "sistema",
    direcao: "entrada",
    tipo: "agendou",
    metadados: { origem: "conversa", calendlyEvento: uri || null },
    chave: `conversa:agendou:${leadId}:${uri || dia}`,
    conteudo: "Reunião de 20 minutos marcada pela página /conversa.",
  };
}

export const PROXIMO_PASSO_REUNIAO = "Reunião de 20 min";
