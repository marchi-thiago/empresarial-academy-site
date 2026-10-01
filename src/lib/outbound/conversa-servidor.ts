import type { Payload } from "payload";
import { crmDb } from "@/lib/crm/payload-db";
import { registrarInteracao, type CrmDb } from "@/lib/crm/registrar";
import { GESTOS, PROXIMO_PASSO_REUNIAO, interacaoDoGesto, type GestoDaConversa } from "./conversa";
import { diaParaConversa } from "./dia-sugerido";

/** Lado servidor da página /conversa: valida o token, grava o gesto no CRM e devolve os dados da página. */

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
export const tokenValido = (t: unknown): t is string => typeof t === "string" && TOKEN.test(t);

export type DepsConversa = {
  crm: CrmDb;
  leadPorToken: (token: string) => Promise<{ id: number } | null>;
  /** Depois de agendar: "Reunião de 20 min" no próximo passo (o horário vem da agenda do Outlook, na rotina do orquestrador). */
  marcarProximoPasso: (leadId: number) => Promise<void>;
  agora?: Date;
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** 204 gravado ou repetido; 400 corpo inválido; 404 token desconhecido. Nada expõe o CRM_INGEST_SECRET: o token do lead é a credencial. */
export async function tratarGesto(d: DepsConversa, corpo: unknown): Promise<{ status: 204 | 400 | 404 }> {
  if (!isObj(corpo) || !tokenValido(corpo.t) || !GESTOS.includes(corpo.gesto as GestoDaConversa)) return { status: 400 };
  const lead = await d.leadPorToken(corpo.t);
  if (!lead) return { status: 404 };
  const agora = d.agora ?? new Date();
  const evento = typeof corpo.evento === "string" ? corpo.evento : null;
  const i = interacaoDoGesto(lead.id, corpo.gesto as GestoDaConversa, agora, evento);
  const r = await registrarInteracao(d.crm, { leadId: lead.id, ...i, data: agora }, agora);
  if (r.ok && i.tipo === "agendou") await d.marcarProximoPasso(lead.id);
  return { status: 204 };
}

export type DadosDaConversa = { id: number; nome: string | null; email: string | null; dossie: unknown; dia: { dia: string; hora: string } };

/** Lead do token, com o dia a abrir no Calendly (o sugerido no último e-mail enviado, se ainda vale). */
export async function carregarConversa(payload: Payload, token: string, agora = new Date()): Promise<DadosDaConversa | null> {
  if (!tokenValido(token)) return null;
  const r = await payload.find({ collection: "leads", where: { tokenConversa: { equals: token } }, limit: 1, depth: 0, overrideAccess: true });
  const lead = r.docs[0] as Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!lead) return null;
  const e = await payload.find({
    collection: "interacoes",
    where: { and: [{ lead: { equals: lead.id } }, { canal: { equals: "email" } }, { tipo: { equals: "enviado" } }] },
    sort: "-data",
    limit: 5,
    depth: 0,
    overrideAccess: true,
  });
  const sugerido = (e.docs as Record<string, any>[]) // eslint-disable-line @typescript-eslint/no-explicit-any
    .filter((x) => x.metadados?.simulado !== true)
    .map((x) => (typeof x.metadados?.diaSugerido === "string" ? (x.metadados.diaSugerido as string) : null))
    .find(Boolean);
  return {
    id: Number(lead.id),
    nome: typeof lead.name === "string" && lead.name ? lead.name : null,
    email: typeof lead.email === "string" && lead.email ? lead.email : null,
    dossie: lead.dossie,
    dia: diaParaConversa(agora, sugerido ?? null),
  };
}

export function depsDaConversa(payload: Payload): DepsConversa {
  return {
    crm: crmDb(payload),
    leadPorToken: async (token) => {
      if (!tokenValido(token)) return null;
      const r = await payload.find({ collection: "leads", where: { tokenConversa: { equals: token } }, limit: 1, depth: 0, overrideAccess: true });
      return r.docs[0] ? { id: Number(r.docs[0].id) } : null;
    },
    marcarProximoPasso: async (leadId) => {
      await payload.update({ collection: "leads", id: leadId, depth: 0, overrideAccess: true, data: { proximoPasso: PROXIMO_PASSO_REUNIAO } });
    },
  };
}
