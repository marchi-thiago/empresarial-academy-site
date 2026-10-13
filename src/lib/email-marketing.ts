import { createHmac } from "crypto";
import type { Payload, Where } from "payload";
import { getPayloadClient } from "@/lib/payload";
import { sendMail } from "@/lib/email";
import { logEmailSend } from "@/lib/email-log";
import { siteConfig } from "@/lib/site-config";
import { getWeakestPillar, getOverallScore } from "@/lib/lead-scoring";
import { convertLexicalToHTMLAsync } from "@payloadcms/richtext-lexical/html-async";
import { eaStateToStyle } from "@/lib/text-state-palette";
import type { CSSProperties } from "react";

/**
 * Núcleo do painel de campanhas (newsletter/mailmarketing manual):
 * resolve quais leads casam com um Segmento e dispara uma Campanha para eles,
 * reaproveitando sendMail (Resend→SMTP→log) e registrando cada envio em
 * email-logs. Conformidade (e-mail válido, consentimento, não descadastrado)
 * é SEMPRE aplicada aqui — não é configurável no segmento.
 */

const NAVY = "#1D2B3C";
const GOLD = "#C1A160";
const INK = "#15191f";
const GRAY = "#5b626e";
const LINE = "#d9dce1";

// Bits de formatação inline do Lexical (mesmos valores do NodeFormat).
const IS_BOLD = 1;
const IS_ITALIC = 1 << 1;
const IS_STRIKETHROUGH = 1 << 2;
const IS_UNDERLINE = 1 << 3;
const IS_CODE = 1 << 4;
const IS_SUBSCRIPT = 1 << 5;
const IS_SUPERSCRIPT = 1 << 6;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function styleToInlineCss(style: CSSProperties): string {
  return Object.entries(style)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
    .join(";");
}

type SerializedTextNode = { text: string; format: number; $?: Record<string, unknown> | null };

/**
 * Conversor de texto para o HTML do e-mail que, além dos formatos padrão
 * (negrito/itálico/…), aplica a paleta EA de cor/tamanho (TextStateFeature) —
 * o conversor padrão do Payload (`convertLexicalToHTMLAsync`) a ignora.
 * Espelha `EaRichText.tsx` (mesma lógica, para React) e `src/lib/editor.ts`.
 */
const eaEmailTextConverter = {
  text: ({ node }: { node: SerializedTextNode }) => {
    let text = escapeHtml(node.text);
    if (node.format & IS_BOLD) text = `<strong>${text}</strong>`;
    if (node.format & IS_ITALIC) text = `<em>${text}</em>`;
    if (node.format & IS_STRIKETHROUGH) text = `<span style="text-decoration:line-through">${text}</span>`;
    if (node.format & IS_UNDERLINE) text = `<span style="text-decoration:underline">${text}</span>`;
    if (node.format & IS_CODE) text = `<code>${text}</code>`;
    if (node.format & IS_SUBSCRIPT) text = `<sub>${text}</sub>`;
    if (node.format & IS_SUPERSCRIPT) text = `<sup>${text}</sup>`;

    const style = eaStateToStyle(node.$);
    if (style) text = `<span style="${styleToInlineCss(style)}">${text}</span>`;
    return text;
  },
};

const FROM = "Empresarial Academy <contato@empresarialacademy.com>";
const REPLY_TO = siteConfig.contact.email;

export type SegmentCriteria = {
  source?: string | null;
  pillar?: string | null;
  scoreMin?: number | null;
  scoreMax?: number | null;
  createdFrom?: string | null;
  createdTo?: string | null;
};

type LeadDoc = {
  id: string | number;
  email: string;
  name?: string | null;
  source?: string | null;
  details?: Record<string, unknown> | null;
};

function sourceMatches(leadSource: string, criteria?: string | null): boolean {
  if (!criteria || criteria === "any") return true;
  switch (criteria) {
    case "diagnostic":
      return leadSource === "Diagnóstico de Maturidade Empresarial";
    case "newsletter":
      return leadSource === "Newsletter";
    case "popup":
      return leadSource === "Pop-up de captura";
    case "download":
      return leadSource.startsWith("Download:");
    case "contact":
      return leadSource === "Contato" || leadSource.startsWith("Contato — ");
    default:
      return true;
  }
}

/**
 * Busca os leads elegíveis (compliance sempre aplicado) que casam com os
 * critérios de segmentação. Filtros de origem/pilar/score rodam em memória —
 * a base é pequena o suficiente (dezenas/centenas de leads) para isso ser
 * simples e correto em vez de tentar traduzir tudo em `where` do Payload.
 */
export async function resolveSegmentLeads(
  criteria: SegmentCriteria,
  payloadClient?: Payload,
): Promise<LeadDoc[]> {
  const payload = payloadClient ?? (await getPayloadClient());

  const and: Where[] = [
    { consent: { equals: true } },
    { marketingOptOut: { not_equals: true } },
  ];
  if (criteria.createdFrom) and.push({ createdAt: { greater_than_equal: criteria.createdFrom } });
  if (criteria.createdTo) and.push({ createdAt: { less_than_equal: criteria.createdTo } });

  const { docs } = await payload.find({
    collection: "leads",
    where: { and },
    limit: 2000,
    depth: 0,
  });

  return (docs as LeadDoc[]).filter((lead) => {
    if (!lead.email) return false;
    if (!sourceMatches(lead.source || "", criteria.source)) return false;

    const details = lead.details && typeof lead.details === "object" ? lead.details : null;

    if (criteria.pillar && criteria.pillar !== "any") {
      const weakest = getWeakestPillar(details);
      if (!weakest || weakest.name !== criteria.pillar) return false;
    }

    if (criteria.scoreMin != null || criteria.scoreMax != null) {
      const overall = getOverallScore(details);
      if (overall == null) return false;
      if (criteria.scoreMin != null && overall < criteria.scoreMin) return false;
      if (criteria.scoreMax != null && overall > criteria.scoreMax) return false;
    }

    return true;
  });
}

export async function countSegmentMembers(
  criteria: SegmentCriteria,
  payloadClient?: Payload,
): Promise<number> {
  const leads = await resolveSegmentLeads(criteria, payloadClient);
  return leads.length;
}

// ——— Descadastro de campanhas (independente da nutrição) ———

export function marketingOptOutToken(leadId: string | number, email: string): string {
  const secret = process.env.PAYLOAD_SECRET || "dev-secret";
  return createHmac("sha256", secret)
    .update(`marketing:${leadId}:${(email || "").toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

export function marketingOptOutUrl(leadId: string | number, email: string): string {
  return `${siteConfig.url}/api/marketing/sair?l=${encodeURIComponent(String(leadId))}&t=${marketingOptOutToken(leadId, email)}`;
}

function wrapCampaignHtml(bodyHtml: string, unsubscribeUrl: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f6f5f1;font-family:Arial,Helvetica,sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${LINE};border-radius:14px;overflow:hidden">
  <tr><td style="background:${NAVY};padding:20px 28px">
    <div style="color:${GOLD};font-weight:700;letter-spacing:.5px;font-size:13px">EMPRESARIAL ACADEMY <span style="color:#B9C2CC;font-weight:400;letter-spacing:0">- Consultoria com IA</span></div>
  </td></tr>
  <tr><td style="padding:26px 28px;font-size:15px;line-height:1.65;color:${INK}">${bodyHtml}</td></tr>
  <tr><td style="padding:0 28px 26px">
    <div style="border-top:1px solid ${LINE};padding-top:16px">
      <p style="margin:0;font-size:14px;color:${INK}"><strong>Thiago Marchi</strong> · Empresarial Academy</p>
      <p style="margin:4px 0 0;font-size:13px;color:${GRAY}">Método para crescer. Gestão para permanecer.</p>
    </div>
  </td></tr>
</table>
<p style="max-width:560px;margin:14px auto 0;font-size:11px;color:#9aa0a8;text-align:center;line-height:1.5">
  <a href="${siteConfig.url}" style="color:#9aa0a8">empresarialacademy.com</a> ·
  <a href="${unsubscribeUrl}" style="color:#9aa0a8">Sair da lista</a>
</p>
</td></tr></table>
</body></html>`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type CampaignDoc = {
  id: string | number;
  subject: string;
  body: unknown;
  segment: string | number | { id: string | number } | null;
};

/**
 * Dispara uma campanha para todos os leads do segmento vinculado. Chamada
 * pelo hook afterChange de EmailCampaigns quando o status muda para
 * "agendada_envio". Atualiza status/estatísticas ao final.
 */
export async function sendCampaignNow(campaignId: string | number): Promise<void> {
  const payload = await getPayloadClient();
  const campaign = (await payload.findByID({
    collection: "email-campaigns",
    id: campaignId,
    depth: 0,
  })) as unknown as CampaignDoc;
  if (!campaign) return;

  const segmentId =
    typeof campaign.segment === "object" && campaign.segment
      ? campaign.segment.id
      : campaign.segment;

  if (!segmentId) {
    await payload.update({
      collection: "email-campaigns",
      id: campaignId,
      data: { status: "erro", statsError: "Campanha sem segmento definido." },
    });
    return;
  }

  const segment = await payload.findByID({
    collection: "email-segments",
    id: segmentId,
    depth: 0,
  });

  const leads = await resolveSegmentLeads(segment as SegmentCriteria, payload);

  await payload.update({
    collection: "email-campaigns",
    id: campaignId,
    data: {
      status: "enviando",
      statsTotal: leads.length,
      statsSent: 0,
      statsFailed: 0,
      statsStartedAt: new Date().toISOString(),
      statsError: null,
    },
  });

  if (leads.length === 0) {
    await payload.update({
      collection: "email-campaigns",
      id: campaignId,
      data: {
        status: "erro",
        statsError: "Nenhum lead elegível encontrado para este segmento.",
        statsFinishedAt: new Date().toISOString(),
      },
    });
    return;
  }

  const bodyHtml = campaign.body
    ? await convertLexicalToHTMLAsync({
        data: campaign.body as never,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        converters: ({ defaultConverters }: any) => ({ ...defaultConverters, ...eaEmailTextConverter }),
      })
    : "";

  let sent = 0;
  let failed = 0;

  for (const lead of leads) {
    const unsub = marketingOptOutUrl(lead.id, lead.email);
    const html = wrapCampaignHtml(bodyHtml, unsub);
    const text = `${stripHtml(bodyHtml)}\n\nSair da lista: ${unsub}`;

    const result = await sendMail({
      to: lead.email,
      from: FROM,
      replyTo: REPLY_TO,
      subject: campaign.subject,
      html,
      text,
    });

    await logEmailSend({
      type: "campaign",
      to: lead.email,
      subject: campaign.subject,
      ok: result.ok,
      via: result.via,
      leadId: lead.id,
      campaignId,
    });

    if (result.ok) sent += 1;
    else failed += 1;
  }

  await payload.update({
    collection: "email-campaigns",
    id: campaignId,
    data: {
      status: sent > 0 ? "enviada" : "erro",
      statsSent: sent,
      statsFailed: failed,
      statsFinishedAt: new Date().toISOString(),
      statsError: sent === 0 ? "Todos os envios falharam — ver email-logs." : null,
    },
  });
}
