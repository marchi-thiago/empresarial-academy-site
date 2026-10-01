import type { Payload, Where } from "payload";
import { isMicrosoftGraphConfigured, listOutlookEvents, sendOutlookMail } from "@/lib/assessor/microsoft-graph";
import { marketingOptOutUrl } from "@/lib/email-marketing";
import { loadNurtureTemplates } from "@/lib/nurture-emails";
import { crmDb, garantirTokenConversa } from "@/lib/crm/payload-db";
import type { Pesos } from "@/lib/crm/pesos";
import { decisorDoDossie, linkedinDoDossie } from "@/lib/crm/telas/dossie";
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
import { LIMITES } from "./config";
import { DIAS_ENTRE_NUTRICOES, type LeadNutricao, type PostNutricao } from "./nutricao";
import { avisarThiago } from "@/lib/ea-flow-bridge";
import type { PropostaEmAberto, ReuniaoAgendada, ReunioesDb } from "./lembretes";
import { carregarAgregado, carregarEventosAB, carregarLeadsSlim, carregarMetas, carregarMotivosResultado, interacaoDe } from "@/lib/crm/dados";
import { montarPainel } from "@/lib/crm/telas/painel";
import { rodarRevisaoSemanal } from "./revisao-semanal";

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
          linkedinDecisor: linkedinDoDossie(d.dossie) !== null || decisorDoDossie(d.dossie) !== null,
          agendaGravada: { canal: txt(cad.proximoCanal), em: data(cad.proximoToqueEm), etapaAtual: txt(cad.etapaAtual) },
        };
      });
    },

    async historico(ids) {
      const mapa = new Map<number, Historico[]>();
      if (ids.length === 0) return mapa;
      const r = await payload.find({
        collection: "interacoes",
        where: { and: [{ lead: { in: ids } }, { tipo: { in: ["enviado", "resultado_ligacao", "falha", "lembrete"] } }] },
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
        } else if (tipo === "enviado" && (x.direcao !== "saida" || sim(m))) continue;
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

    async candidatosNutricao(agora) {
      const fimDaCadencia = new Date(agora.getTime() - LIMITES.janelaCadenciaDias * 86_400_000).toISOString();
      const docs = await leadsDoCrm(
        {
          and: [
            { baseLegal: { equals: "legitimo_interesse" } },
            { nurtureOptOut: { not_equals: true } },
            { marketingOptOut: { not_equals: true } },
            { "statusEntrega.email": { not_equals: "devolvido" } },
            {
              or: [
                { dealStatus: { equals: "nutricao_continua" } },
                {
                  and: [
                    { dealStatus: { equals: "em_cadencia" } },
                    { "cadencia.pausada": { not_equals: true } },
                    { "origem.primeiroToqueEm": { less_than: fimDaCadencia } },
                  ],
                },
              ],
            },
          ],
        },
        { name: true, company: true, areaAtuacao: true, email: true, dealStatus: true, cadencia: { pausada: true }, origem: { primeiroToqueEm: true } },
      );
      if (docs.length === 0) return [];

      // "Não é o momento": respostas com intenção nao_agora (poucas; filtra aqui porque a intenção mora num JSON).
      const respostas = await payload.find({
        collection: "interacoes",
        where: { tipo: { equals: "respondido" } },
        select: { lead: true, metadados: true } as never,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      });
      const naoAgora = new Set((respostas.docs as Doc[]).filter((x) => (x.metadados as Doc | null)?.intencao === "nao_agora").map((x) => idDe(x.lead)));

      // Nutrição e indicação já enviadas (chave out:email:<lead>:nutr_AAAA_MM ou :indicacao; simulação usa outra chave).
      const enviados = await payload.find({
        collection: "interacoes",
        where: {
          and: [
            { tipo: { equals: "enviado" } },
            { canal: { equals: "email" } },
            { chave: { contains: "out:email:" } },
            { or: [{ chave: { contains: ":nutr_" } }, { chave: { contains: ":indicacao" } }] },
          ],
        },
        select: { lead: true, chave: true, data: true } as never,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      });
      const ultimo = new Map<number, Date>();
      const indicados = new Set<number>();
      for (const x of enviados.docs as Doc[]) {
        const id = idDe(x.lead);
        const quando = data(x.data);
        if (String(x.chave).endsWith(":indicacao")) indicados.add(id);
        if (quando && (!ultimo.get(id) || quando > ultimo.get(id)!)) ultimo.set(id, quando);
      }

      const limite = agora.getTime() - DIAS_ENTRE_NUTRICOES * 86_400_000;
      return docs.map((d): LeadNutricao => {
        const id = Number(d.id);
        return {
          id,
          nome: txt(d.name) ?? "",
          empresa: txt(d.company),
          segmento: txt(d.areaAtuacao),
          email: txt(d.email),
          etapa: etapaDe(d.dealStatus),
          pausada: Boolean(d.cadencia?.pausada),
          optOut: false,
          emailSuprimido: false,
          naoAgora: naoAgora.has(id),
          indicacaoPedida: indicados.has(id),
          ultimoEnvioEm: ultimo.get(id) ?? null,
          primeiroToqueEm: data(d.origem?.primeiroToqueEm),
        };
      }).filter((l) => !l.ultimoEnvioEm || l.ultimoEnvioEm.getTime() < limite);
    },

    async postsRecentes(agora) {
      const r = await payload.find({
        collection: "posts",
        where: { and: [{ status: { equals: "published" } }, { publishedAt: { less_than_equal: agora.toISOString() } }] },
        sort: "-publishedAt",
        limit: 40,
        depth: 1,
        select: { title: true, slug: true, excerpt: true, category: true, tags: true, publishedAt: true } as never,
        overrideAccess: true,
      });
      return (r.docs as Doc[])
        .filter((p) => txt(p.title) && txt(p.slug) && data(p.publishedAt))
        .map((p): PostNutricao => ({
          titulo: String(p.title),
          slug: String(p.slug),
          resumo: txt(p.excerpt),
          temas: [txt(p.category?.name), ...(Array.isArray(p.tags) ? p.tags.map((t: Doc) => txt(t?.tag)) : [])].filter((x): x is string => !!x),
          publicadoEm: data(p.publishedAt)!,
        }));
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

/** Reunião e venda (F8): o que os lembretes, a ficha pré-reunião e o follow-up da proposta precisam ler. */
export function reunioesDb(payload: Payload): ReunioesDb {
  const leadsDa = async (where: Where, select: Record<string, unknown>) =>
    (await payload.find({ collection: "leads", where, select: select as never, pagination: false, depth: 0, overrideAccess: true, sort: "id" })).docs as Doc[];

  return {
    async reunioesFuturas(agora) {
      const docs = await leadsDa(
        { and: [{ dealStatus: { equals: "reuniao_marcada" } }, { proximoPassoEm: { greater_than_equal: agora.toISOString() } }] },
        { name: true, company: true, areaAtuacao: true, email: true, whatsapp: true, proximoPassoEm: true, temperatura: true, pontosEngajamento: true, dossie: true },
      );
      if (docs.length === 0) return [];
      const desde = new Date(agora.getTime() - 14 * 86_400_000);
      const r = await payload.find({
        collection: "interacoes",
        where: { and: [{ lead: { in: docs.map((d) => Number(d.id)) } }, { data: { greater_than_equal: desde.toISOString() } }] },
        select: { lead: true, canal: true, direcao: true, tipo: true, data: true, conteudo: true, pontos: true, metadados: true } as never,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      });
      const porLead = new Map<number, ReuniaoAgendada["interacoes"]>();
      for (const x of r.docs as Doc[]) {
        if (sim(x.metadados)) continue;
        const i = interacaoDe(x);
        porLead.set(i.leadId, [...(porLead.get(i.leadId) ?? []), i]);
      }
      const saida: ReuniaoAgendada[] = [];
      for (const d of docs) {
        const inicio = data(d.proximoPassoEm);
        if (!inicio) continue;
        const id = Number(d.id);
        saida.push({
          leadId: id,
          nome: txt(d.name) ?? "",
          empresa: txt(d.company),
          segmento: txt(d.areaAtuacao),
          email: txt(d.email),
          whatsapp: txt(d.whatsapp),
          inicio,
          temperatura: txt(d.temperatura) ?? "frio",
          pontos: Number(d.pontosEngajamento ?? 0),
          dossie: d.dossie,
          tokenConversa: await garantirTokenConversa(payload, id),
          interacoes: porLead.get(id) ?? [],
        });
      }
      return saida;
    },

    async propostasEmAberto() {
      const docs = await leadsDa({ dealStatus: { equals: "proposta_enviada" } }, { name: true, company: true, email: true, whatsapp: true, dossie: true });
      if (docs.length === 0) return [];
      const r = await payload.find({
        collection: "interacoes",
        where: { and: [{ lead: { in: docs.map((d) => Number(d.id)) } }, { tipo: { equals: "movimento_manual" } }] },
        select: { lead: true, data: true, metadados: true } as never,
        pagination: false,
        depth: 0,
        overrideAccess: true,
        sort: "data",
      });
      // Entrada mais recente em "Proposta enviada" (sort crescente: a última gravada vence).
      const entrada = new Map<number, Date>();
      for (const x of r.docs as Doc[]) {
        const quando = data(x.data);
        if (quando && (x.metadados as Doc | null)?.para === "proposta_enviada") entrada.set(idDe(x.lead), quando);
      }
      const saida: PropostaEmAberto[] = [];
      for (const d of docs) {
        const propostaEm = entrada.get(Number(d.id));
        if (!propostaEm) continue; // sem registro da entrada na etapa não há de onde contar D2, D5 e D10
        saida.push({ leadId: Number(d.id), nome: txt(d.name) ?? "", empresa: txt(d.company), email: txt(d.email), whatsapp: txt(d.whatsapp), dossie: d.dossie, propostaEm });
      }
      return saida;
    },
  };
}

/** Dependências de produção. Sem Graph configurado: agenda indisponível (regra fixa) e envio falha com erro claro. */
export function depsDeProducao(payload: Payload, agora = new Date()): Deps {
  const db = outboundDb(payload);
  return {
    db,
    crm: crmDb(payload),
    reunioes: reunioesDb(payload),
    enviar: sendOutlookMail,
    agenda: async (de, ate) => {
      if (!isMicrosoftGraphConfigured()) return null;
      const eventos = await listOutlookEvents({ startISO: de.toISOString(), endISO: ate.toISOString() });
      return eventos.map(eventoDeAgenda).filter((x): x is NonNullable<typeof x> => x !== null);
    },
    lerCaixa: (desde) => lerCaixaDoGraph(REMETENTE.address, desde),
    urlDescadastro: (id, email) => marketingOptOutUrl(id, email),
    avisar: avisarThiago,
    revisao: () =>
      rodarRevisaoSemanal({
        agora,
        db,
        avisar: avisarThiago,
        carregar: async (desde) => {
          const [leads, agregado, metas, eventos, motivos] = await Promise.all([
            carregarLeadsSlim(payload),
            carregarAgregado(payload),
            carregarMetas(payload),
            carregarEventosAB(payload, desde),
            carregarMotivosResultado(payload),
          ]);
          return { painel: montarPainel(leads, agregado, metas), eventos, motivos };
        },
      }),
    agora,
    rand: Math.random,
    env: process.env,
  };
}
