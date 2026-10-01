import type { Payload, Where } from "payload";
import { isMicrosoftGraphConfigured, listOutlookEvents, sendOutlookMail } from "@/lib/assessor/microsoft-graph";
import { marketingOptOutUrl } from "@/lib/email-marketing";
import { loadNurtureTemplates } from "@/lib/nurture-emails";
import { crmDb, garantirTokenConversa } from "@/lib/crm/payload-db";
import type { Pesos } from "@/lib/crm/pesos";
import { decisorDoDossie, linkedinDoDossie } from "@/lib/crm/telas/dossie";
import { ehSeguidorEa } from "@/lib/crm/telas/linkedin";
import { CANAIS_ENTREGA, ESTADOS_ENTREGA, etapaDe, type StatusEntrega, type Temperatura } from "@/lib/crm/tipos";
import type { Historico } from "./cadencia";
import { ETAPAS_NA_CADENCIA } from "./cadencia";
import { lerCaixaDoGraph } from "./caixa";
import { REMETENTE } from "./config";
import { PROXIMO_PASSO_REUNIAO } from "./conversa";
import { dominioDe } from "./plano";
import { recalcularTemperatura } from "./recalcular";
import { partesFixasDoMapa } from "./email/render";
import { eventoDeAgenda, type ConteudoLead, type Deps, type LeadCandidato, type OutboundDb } from "./orquestrador";
import { dataIso } from "./tempo";
import { avisarThiago } from "@/lib/ea-flow-bridge";

/** Liga o orquestrador ao Payload (Local API, sempre overrideAccess: quem chama é o servidor). */

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const txt = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const data = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};
const idDe = (v: unknown): number => Number(typeof v === "object" && v ? (v as Doc).id : v);
const sim = (m: unknown) => (m as Doc | null)?.simulado === true;

/** Tipo gravado em `email-logs`. O valor "outbound" exige o enum novo (docs/outbound/migracoes/F6-email-logs-outbound.sql, pendência 16). */
export const TIPO_EMAIL_LOG = "campaign" as const;

export function outboundDb(payload: Payload): OutboundDb {
  const crm = crmDb(payload);

  const leadsDoCrm = async (where: Where, select?: Record<string, unknown>) =>
    (await payload.find({ collection: "leads", where, select: select as never, pagination: false, depth: 0, overrideAccess: true, sort: "id" })).docs as Doc[];

  const porChave = async (chave: string) =>
    (await payload.find({ collection: "interacoes", where: { chave: { equals: chave } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as Doc | undefined;

  const criarLinha = async (chave: string, dados: Doc): Promise<boolean> => {
    if (await porChave(chave)) return false;
    try {
      await payload.create({ collection: "interacoes", overrideAccess: true, data: { chave, ...dados } as never });
      return true;
    } catch (e) {
      payload.logger.warn(`[outbound] chave ${chave} não gravada (provável corrida): ${e}`);
      return false;
    }
  };

  return {
    async candidatos(desde) {
      const docs = await leadsDoCrm(
        {
          and: [
            { baseLegal: { equals: "legitimo_interesse" } },
            { dealStatus: { in: [...ETAPAS_NA_CADENCIA] } },
            { "cadencia.pausada": { not_equals: true } },
            { nurtureOptOut: { not_equals: true } },
            { marketingOptOut: { not_equals: true } },
            { or: [{ "origem.primeiroToqueEm": { greater_than_equal: desde.toISOString() } }, { "statusEntrega.dm": { equals: "falhou" } }] },
          ],
        },
        {
          name: true,
          company: true,
          email: true,
          instagram: true,
          whatsapp: true,
          dealStatus: true,
          temperatura: true,
          dossie: true,
          statusEntrega: true,
          cadencia: { pausada: true, proximoCanal: true, proximoToqueEm: true, etapaAtual: true, canaisEncerrados: true },
          origem: { primeiroToqueEm: true },
        },
      );
      return docs.map((d): LeadCandidato => {
        const cad = d.cadencia ?? {};
        const ent = d.statusEntrega ?? {};
        const etapa = etapaDe(d.dealStatus);
        return {
          id: Number(d.id),
          nome: txt(d.name) ?? "",
          empresa: txt(d.company),
          etapa,
          temperatura: (txt(d.temperatura) ?? "frio") as Temperatura,
          pausada: Boolean(cad.pausada),
          optOut: etapa === "saiu_da_lista",
          email: txt(d.email),
          instagram: txt(d.instagram),
          whatsapp: txt(d.whatsapp),
          canaisEncerrados: Array.isArray(cad.canaisEncerrados) ? cad.canaisEncerrados.filter((x: unknown) => typeof x === "string") : [],
          statusEntrega: Object.fromEntries(CANAIS_ENTREGA.map((c) => [c, ent[c] ?? ESTADOS_ENTREGA[c][0]])) as StatusEntrega,
          primeiroToqueEm: data(d.origem?.primeiroToqueEm),
          linkedinDecisor: linkedinDoDossie(d.dossie) !== null || decisorDoDossie(d.dossie) !== null || ehSeguidorEa(d),
          agendaGravada: { canal: txt(cad.proximoCanal), em: data(cad.proximoToqueEm), etapaAtual: txt(cad.etapaAtual) },
        };
      });
    },

    async historico(ids) {
      const mapa = new Map<number, Historico[]>();
      if (ids.length === 0) return mapa;
      const r = await payload.find({
        collection: "interacoes",
        where: { and: [{ lead: { in: ids } }, { tipo: { in: ["enviado", "linkedin_convite_enviado", "resultado_ligacao", "falha", "lembrete"] } }] },
        select: { lead: true, canal: true, direcao: true, tipo: true, data: true, metadados: true } as never,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      });
      for (const x of r.docs as Doc[]) {
        const m = (x.metadados ?? {}) as Doc;
        let tipo: string = x.tipo;
        if (tipo === "lembrete") {
          if (m.bloqueio !== true) continue;
          tipo = "bloqueio";
        } else if ((tipo === "enviado" || tipo === "linkedin_convite_enviado") && (x.direcao !== "saida" || sim(m))) {
          continue;
        }
        if (tipo === "linkedin_convite_enviado") tipo = "enviado";
        const id = idDe(x.lead);
        const lista = mapa.get(id) ?? [];
        lista.push({ canal: String(x.canal), tipo, data: data(x.data) ?? new Date(0), toque: txt(m.toque) });
        mapa.set(id, lista);
      }
      return mapa;
    },

    async suprimidos() {
      const docs = await leadsDoCrm(
        { or: [{ marketingOptOut: { equals: true } }, { nurtureOptOut: { equals: true } }, { dealStatus: { equals: "saiu_da_lista" } }, { "statusEntrega.email": { equals: "devolvido" } }] },
        { email: true },
      );
      return new Set(docs.map((d) => txt(d.email)?.trim().toLowerCase()).filter((x): x is string => !!x));
    },

    async enviosDeEmail(desde) {
      const r = await payload.find({
        collection: "interacoes",
        where: { and: [{ canal: { equals: "email" } }, { tipo: { equals: "enviado" } }, { direcao: { equals: "saida" } }, { data: { greater_than_equal: desde.toISOString() } }] },
        select: { lead: true, data: true, metadados: true } as never,
        pagination: false,
        depth: 0,
        overrideAccess: true,
        sort: "data",
      });
      return (r.docs as Doc[])
        .filter((x) => !sim(x.metadados) && txt((x.metadados as Doc | null)?.para))
        .map((x) => {
          const para = String((x.metadados as Doc).para).toLowerCase();
          return {
            leadId: idDe(x.lead),
            para,
            dominio: dominioDe(para),
            em: data(x.data) ?? new Date(0),
            proximoEnvioApos: data((x.metadados as Doc).proximoEnvioApos),
          };
        });
    },

    async bouncesDeEmail(desde) {
      const r = await payload.find({
        collection: "interacoes",
        where: { and: [{ canal: { equals: "email" } }, { tipo: { equals: "bounce" } }, { data: { greater_than_equal: desde.toISOString() } }] },
        select: { metadados: true } as never,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      });
      return (r.docs as Doc[]).filter((x) => (x.metadados as Doc | null)?.temporario !== true).length;
    },

    async conteudoDoLead(id): Promise<ConteudoLead | null> {
      try {
        const d = (await payload.findByID({ collection: "leads", id, depth: 0, overrideAccess: true })) as Doc;
        const token = await garantirTokenConversa(payload, id);
        return { id, nome: txt(d.name) ?? "", empresa: txt(d.company), email: txt(d.email), kit: d.kit, dossie: d.dossie, tokenConversa: token };
      } catch {
        return null;
      }
    },

    async gravarAgenda(id, a) {
      await payload.update({
        collection: "leads",
        id,
        depth: 0,
        overrideAccess: true,
        data: { cadencia: { etapaAtual: a.etapaAtual, proximoToqueEm: a.em ? a.em.toISOString() : null, proximoCanal: a.canal as never } },
      });
    },

    async lerMarcador(chave) {
      const x = await porChave(chave);
      if (!x) return null;
      const meta = (x.metadados as Record<string, unknown> | null) ?? {};
      return { ...meta, data: x.data };
    },

    async gravarMarcador(chave, metadados, quando = new Date()) {
      const x = await porChave(chave);
      if (x) {
        await payload.update({
          collection: "interacoes",
          id: x.id,
          depth: 0,
          overrideAccess: true,
          data: { metadados, data: quando.toISOString() },
        });
      } else {
        await criarLinha(chave, {
          canal: "sistema",
          direcao: "saida",
          tipo: "lembrete",
          conteudo: chave,
          pontos: 0,
          metadados,
          data: quando.toISOString(),
        });
      }
    },

    criarMarcador(chave, metadados, leadId) {
      return criarLinha(chave, { lead: leadId, canal: "sistema", direcao: "saida", tipo: "lembrete", conteudo: chave, pontos: 0, metadados, data: new Date().toISOString() });
    },

    gravarSimulado(i) {
      return criarLinha(i.chave, { lead: i.leadId, canal: "email", direcao: "saida", tipo: "enviado", conteudo: i.conteudo, pontos: 0, metadados: i.metadados, data: i.data.toISOString() });
    },

    async registrarBloqueio(leadId, toque, motivo, quando) {
      await criarLinha(`bloqueio:${leadId}:${toque}:${dataIso(quando)}`, {
        lead: leadId,
        canal: "sistema",
        direcao: "saida",
        tipo: "lembrete",
        conteudo: `E-mail ${toque} não saiu: ${motivo}`,
        pontos: 0,
        metadados: { bloqueio: true, toque, motivo },
        data: quando.toISOString(),
      });
    },

    async logEmail(i) {
      try {
        await payload.create({
          collection: "email-logs",
          overrideAccess: true,
          data: { type: TIPO_EMAIL_LOG, to: i.para, subject: i.assunto, status: i.ok ? "sent" : "failed", via: "outlook-graph (outbound)", lead: i.leadId, errorMessage: i.erro },
        });
      } catch (e) {
        payload.logger.error(`[outbound] email-log não gravado: ${e}`);
      }
    },

    pesos: () => crm.pesos(),

    async partesFixas() {
      return partesFixasDoMapa(await loadNurtureTemplates(payload));
    },

    async recalcularTemperaturas(agora, pesos: Pesos) {
      const docs = await leadsDoCrm({ or: [{ pontosEngajamento: { greater_than: 0 } }, { temperatura: { in: ["morno", "engajado"] } }] }, { pontosEngajamento: true, temperatura: true });
      if (docs.length === 0) return 0;
      const desde = new Date(agora.getTime() - pesos.janelaDias * 86_400_000);
      const r = await payload.find({
        collection: "interacoes",
        where: { and: [{ lead: { in: docs.map((d) => Number(d.id)) } }, { data: { greater_than_equal: desde.toISOString() } }, { pontos: { greater_than: 0 } }] },
        select: { lead: true, pontos: true, data: true } as never,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      });
      const porLead = new Map<number, { pontos: number; data: Date }[]>();
      for (const x of r.docs as Doc[]) {
        const id = idDe(x.lead);
        porLead.set(id, [...(porLead.get(id) ?? []), { pontos: Number(x.pontos ?? 0), data: data(x.data) ?? new Date(0) }]);
      }
      let mudaram = 0;
      for (const d of docs) {
        const novo = recalcularTemperatura(porLead.get(Number(d.id)) ?? [], agora, pesos);
        if (novo.pontos === Number(d.pontosEngajamento ?? 0) && novo.temperatura === (d.temperatura ?? "frio")) continue;
        await payload.update({ collection: "leads", id: d.id, depth: 0, overrideAccess: true, data: { pontosEngajamento: novo.pontos, temperatura: novo.temperatura } });
        mudaram++;
      }
      return mudaram;
    },

    async leadsParaAgenda() {
      const docs = await leadsDoCrm(
        { and: [{ email: { exists: true } }, { dealStatus: { in: ["em_andamento", "qualificado", "em_cadencia", "engajado", "respondeu", "reuniao_marcada"] } }] },
        { email: true, dealStatus: true, proximoPassoEm: true },
      );
      return docs
        .filter((d) => txt(d.email))
        .map((d) => ({ id: Number(d.id), email: String(d.email).trim().toLowerCase(), etapa: etapaDe(d.dealStatus), temData: !!d.proximoPassoEm }));
    },

    async leadsParaAgendaComData() {
      const docs = await leadsDoCrm(
        { and: [{ dealStatus: { equals: "reuniao_marcada" } }, { proximoPassoEm: { exists: true } }] },
        { email: true, dealStatus: true, proximoPassoEm: true, name: true },
      );
      return docs
        .filter((d) => d.proximoPassoEm)
        .map((d) => ({
          id: Number(d.id),
          email: String(d.email || "").trim().toLowerCase(),
          etapa: etapaDe(d.dealStatus),
          data: String(d.proximoPassoEm),
          nome: String(d.name || ""),
        }));
    },

    async definirReuniao(leadId, inicio) {
      await payload.update({
        collection: "leads",
        id: leadId,
        depth: 0,
        overrideAccess: true,
        data: { proximoPasso: PROXIMO_PASSO_REUNIAO, ...(inicio ? { proximoPassoEm: inicio.toISOString() } : {}) },
      });
    },
  };
}

/** Dependências de produção. Sem Graph configurado: agenda indisponível (regra fixa) e envio falha com erro claro. */
export function depsDeProducao(payload: Payload, agora = new Date()): Deps {
  return {
    db: outboundDb(payload),
    crm: crmDb(payload),
    enviar: sendOutlookMail,
    agenda: async (de, ate) => {
      if (!isMicrosoftGraphConfigured()) return null;
      const eventos = await listOutlookEvents({ startISO: de.toISOString(), endISO: ate.toISOString() });
      return eventos.map(eventoDeAgenda).filter((x): x is NonNullable<typeof x> => x !== null);
    },
    lerCaixa: (desde) => lerCaixaDoGraph(REMETENTE.address, desde),
    urlDescadastro: (id, email) => marketingOptOutUrl(id, email),
    avisar: avisarThiago,
    agora,
    rand: Math.random,
    env: process.env,
  };
}
