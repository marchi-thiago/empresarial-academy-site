import { randomBytes } from "crypto";
import type { Payload } from "payload";
import { finalDoWhatsapp, normalizarEmail, normalizarHandle } from "./identificar";
import { resolverPesos, type Pesos } from "./pesos";
import type { CrmDb } from "./registrar";
import type { EstadoLead } from "./regras";
import { CANAIS_ENTREGA, ESTADOS_ENTREGA, etapaDe, type RefLead, type StatusEntrega, type Temperatura } from "./tipos";

/** Liga as regras do CRM ao Payload. Sempre com overrideAccess: quem chama é o servidor. */

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const data = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};
const txt = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

function estadoDe(doc: Doc): EstadoLead {
  const cad = doc.cadencia ?? {};
  const ent = doc.statusEntrega ?? {};
  const org = doc.origem ?? {};
  const statusEntrega = Object.fromEntries(CANAIS_ENTREGA.map((c) => [c, ent[c] ?? ESTADOS_ENTREGA[c][0]])) as StatusEntrega;
  return {
    etapa: etapaDe(doc.dealStatus),
    temperatura: (doc.temperatura ?? "frio") as Temperatura,
    pontos: Number(doc.pontosEngajamento ?? 0),
    cadencia: {
      pausada: Boolean(cad.pausada),
      motivoPausa: txt(cad.motivoPausa),
      proximoCanal: txt(cad.proximoCanal),
      canaisEncerrados: Array.isArray(cad.canaisEncerrados) ? cad.canaisEncerrados.filter((x: unknown) => typeof x === "string") : [],
      movidoManualEm: data(cad.movidoManualEm),
    },
    statusEntrega,
    origem: {
      primeiroToqueCanal: txt(org.primeiroToqueCanal),
      primeiroToqueEm: data(org.primeiroToqueEm),
      ultimoToqueCanal: txt(org.ultimoToqueCanal),
      ultimoToqueRotulo: txt(org.ultimoToqueRotulo),
      reuniaoCanal: txt(org.reuniaoCanal),
      reuniaoToque: txt(org.reuniaoToque),
      vendaCanal: txt(org.vendaCanal),
      vendaToque: txt(org.vendaToque),
    },
    optOut: Boolean(doc.nurtureOptOut && doc.marketingOptOut),
  };
}

export function crmDb(payload: Payload): CrmDb {
  // Valor bruto de dealStatus por lead: não reescreve "em_andamento" se a etapa não mudou.
  const brutos = new Map<string, string | null>();

  return {
    async carregarLead(id) {
      try {
        const doc = (await payload.findByID({ collection: "leads", id, depth: 0, overrideAccess: true })) as unknown as Doc;
        brutos.set(String(id), txt(doc.dealStatus));
        return estadoDe(doc);
      } catch {
        return null;
      }
    },

    async pesos(): Promise<Pesos> {
      try {
        const g = await payload.findGlobal({ slug: "crm-config", depth: 0, overrideAccess: true });
        return resolverPesos(g as never);
      } catch (e) {
        payload.logger.warn(`[crm] crm-config indisponível, usando os pesos do plano: ${e}`);
        return resolverPesos(null);
      }
    },

    async interacoesDesde(leadId, desde) {
      const r = await payload.find({
        collection: "interacoes",
        where: { and: [{ lead: { equals: leadId } }, { data: { greater_than_equal: desde.toISOString() } }] },
        pagination: false,
        depth: 0,
        overrideAccess: true,
      });
      return r.docs.map((d) => ({ tipo: d.tipo, pontos: Number(d.pontos ?? 0) }));
    },

    async existeChave(chave) {
      const r = await payload.find({ collection: "interacoes", where: { chave: { equals: chave } }, limit: 1, depth: 0, overrideAccess: true });
      return r.totalDocs > 0;
    },

    async criarInteracao(d) {
      const doc = await payload.create({
        collection: "interacoes",
        overrideAccess: true,
        data: {
          lead: Number(d.lead),
          canal: d.canal,
          direcao: d.direcao,
          tipo: d.tipo,
          conteudo: d.conteudo,
          pontos: d.pontos,
          metadados: (d.metadados ?? undefined) as never,
          data: d.data.toISOString(),
          chave: d.chave,
        },
      });
      return doc.id;
    },

    async salvarLead(id, e) {
      const bruto = brutos.get(String(id)) ?? null;
      const iso = (x: Date | null) => (x ? x.toISOString() : null);
      await payload.update({
        collection: "leads",
        id,
        overrideAccess: true,
        depth: 0,
        data: {
          ...(bruto && etapaDe(bruto) === e.etapa ? {} : { dealStatus: e.etapa }),
          temperatura: e.temperatura,
          pontosEngajamento: e.pontos,
          cadencia: {
            pausada: e.cadencia.pausada,
            motivoPausa: e.cadencia.motivoPausa,
            proximoCanal: e.cadencia.proximoCanal as never,
            canaisEncerrados: e.cadencia.canaisEncerrados,
            movidoManualEm: iso(e.cadencia.movidoManualEm),
          },
          statusEntrega: e.statusEntrega as never,
          origem: {
            primeiroToqueCanal: e.origem.primeiroToqueCanal as never,
            primeiroToqueEm: iso(e.origem.primeiroToqueEm),
            ultimoToqueCanal: e.origem.ultimoToqueCanal,
            ultimoToqueRotulo: e.origem.ultimoToqueRotulo,
            reuniaoCanal: e.origem.reuniaoCanal as never,
            reuniaoToque: e.origem.reuniaoToque,
            vendaCanal: e.origem.vendaCanal as never,
            vendaToque: e.origem.vendaToque,
          },
          ...(e.optOut ? { nurtureOptOut: true, marketingOptOut: true } : {}),
        },
      });
    },
  };
}

/**
 * Acha o lead por id, hunterId, @ do Instagram, e-mail ou WhatsApp (nessa ordem).
 * Retorna o id ou null. ponytail: WhatsApp compara os 11 últimos dígitos por SQL
 * (varre a tabela leads, hoje ~1,4 mil linhas); trocar por coluna normalizada se passar de dezenas de milhares.
 */
export async function encontrarLead(payload: Payload, ref: RefLead): Promise<number | null> {
  const um = async (where: Record<string, unknown>) => {
    const r = await payload.find({ collection: "leads", where: where as never, limit: 1, depth: 0, overrideAccess: true, sort: "id" });
    return (r.docs[0]?.id as number | undefined) ?? null;
  };

  if (ref.leadId != null && ref.leadId !== "") {
    const id = Number(ref.leadId);
    if (Number.isInteger(id) && id > 0) {
      const r = await um({ id: { equals: id } });
      if (r) return r;
    }
  }
  if (ref.hunterId != null && ref.hunterId !== "") {
    const n = Number(ref.hunterId);
    if (Number.isFinite(n)) {
      const r = await um({ hunterId: { equals: n } });
      if (r) return r;
    }
  }
  if (ref.instagram) {
    const h = normalizarHandle(ref.instagram);
    if (h) {
      const r = await um({ or: [{ instagram: { equals: `@${h}` } }, { instagram: { equals: h } }] });
      if (r) return r;
    }
  }
  if (ref.email && ref.email.includes("@")) {
    const r = await um({ email: { equals: normalizarEmail(ref.email) } });
    if (r) return r;
  }
  if (ref.whatsapp) {
    const fim = finalDoWhatsapp(ref.whatsapp);
    const pool = (payload.db as unknown as { pool?: { query: (s: string, p: unknown[]) => Promise<{ rows: { id: number }[] }> } }).pool;
    if (fim && pool) {
      const r = await pool.query(
        "SELECT id FROM leads WHERE whatsapp IS NOT NULL AND right(regexp_replace(whatsapp, '\\D', '', 'g'), 11) = $1 ORDER BY id LIMIT 1",
        [fim],
      );
      if (r.rows[0]) return r.rows[0].id;
    }
  }
  return null;
}

/** Token opaco da página /conversa?t=; cria na hora se o lead ainda não tem (leads antigos e do Hunter). */
export async function garantirTokenConversa(payload: Payload, leadId: number): Promise<string> {
  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  if (lead.tokenConversa) return lead.tokenConversa;
  const token = randomBytes(18).toString("base64url");
  await payload.update({ collection: "leads", id: leadId, data: { tokenConversa: token }, overrideAccess: true, depth: 0 });
  return token;
}
