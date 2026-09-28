import { getPayloadClient } from "@/lib/payload";
import type { DataFromCollectionSlug } from "payload";

export type LeadInput = {
  name: string;
  email: string;
  company?: string;
  whatsapp?: string;
  instagram?: string;
  source: string;
  details?: Record<string, string>;
  consent?: boolean;
  diagnosticId?: string;
  hasDiagnostic?: boolean;
  /** Slug da categoria do material baixado (material-categories.slug) — ver Leads.ts. */
  interestCategory?: string;
};

/**
 * Grava o lead na coleção `leads` do CMS (histórico/backup do e-mail).
 * Nunca lança — a captação não pode falhar por causa do banco.
 * Retorna o id do lead criado (para vincular envios ao log), ou null se falhou.
 */
async function ensureLeadsColumns(payload: unknown) {
  try {
    const pool = (payload as { db?: { pool?: { query: (sql: string) => Promise<unknown> } } })?.db?.pool;
    if (pool) {
      await pool.query(`
        ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "instagram" text;
        ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "diagnostic_id" text;
        ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "has_diagnostic" boolean DEFAULT false;
        ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "interest_category" text;
      `);
    }
  } catch (e) {
    console.warn("[ensureLeadsColumns] aviso:", e);
  }
}

export async function saveLead(lead: LeadInput): Promise<string | number | null> {
  try {
    const payload = await getPayloadClient();
    await ensureLeadsColumns(payload);
    const consent = lead.consent ?? false;
    const isDiag = Boolean(
      lead.hasDiagnostic ||
      lead.diagnosticId ||
      lead.source === "Diagnóstico de Maturidade Empresarial" ||
      (lead.details && Boolean(lead.details["Maturidade Geral"]))
    );

    // Se temos diagnosticId ou email, verificar se o lead já foi registrado no início
    if (lead.diagnosticId || lead.email) {
      try {
        const { docs } = await payload.find({
          collection: "leads",
          where: lead.diagnosticId
            ? { diagnosticId: { equals: lead.diagnosticId } }
            : { email: { equals: lead.email } },
          limit: 1,
          overrideAccess: true,
        });

        if (docs.length > 0) {
          const existing = docs[0] as unknown as {
            id: string | number;
            name?: string;
            company?: string;
            whatsapp?: string;
            instagram?: string;
            diagnosticId?: string;
            details?: Record<string, string>;
          };

          const mergedDetails = {
            ...(existing.details || {}),
            ...(lead.details || {}),
          };

          const updatedDoc = await payload.update({
            collection: "leads",
            id: existing.id,
            data: {
              name: lead.name || existing.name,
              email: lead.email,
              company: lead.company || existing.company || undefined,
              whatsapp: lead.whatsapp || existing.whatsapp || undefined,
              instagram: lead.instagram || existing.instagram || undefined,
              source: lead.source,
              details: Object.keys(mergedDetails).length > 0 ? mergedDetails : undefined,
              diagnosticId: lead.diagnosticId || existing.diagnosticId || undefined,
              hasDiagnostic: isDiag,
              // Novo interesse sobrepõe o antigo: o lead baixando um segundo
              // material troca o tema da nutrição pro mais recente.
              interestCategory: lead.interestCategory || undefined,
              wantsNewsletter: consent,
              wantsPromotions: consent,
            } as unknown as DataFromCollectionSlug<"leads">,
            overrideAccess: true,
          });
          return updatedDoc.id;
        }
      } catch (findErr) {
        console.warn("[saveLead] aviso ao buscar lead existente:", findErr);
      }
    }

    const doc = await payload.create({
      collection: "leads",
      data: {
        name: lead.name,
        email: lead.email,
        company: lead.company || undefined,
        whatsapp: lead.whatsapp || undefined,
        instagram: lead.instagram || undefined,
        source: lead.source,
        details: lead.details && Object.keys(lead.details).length > 0 ? lead.details : undefined,
        consent,
        diagnosticId: lead.diagnosticId || undefined,
        hasDiagnostic: isDiag,
        interestCategory: lead.interestCategory || undefined,
        // O checkbox único de consentimento dos formulários públicos cobre
        // newsletter e promoções ao mesmo tempo (decisão do Thiago, 24/07) —
        // não há opt-in granular separado por enquanto.
        wantsNewsletter: consent,
        wantsPromotions: consent,
      } as unknown as DataFromCollectionSlug<"leads">,
      overrideAccess: true,
    });
    return doc.id;
  } catch (e) {
    console.error("[lead] falha ao gravar no CMS:", e);
    return null;
  }
}
