import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";
import { DIAGNOSTIC_ORIGIN } from "@/lib/diagnostic-email";
import { sendNurtureEmail, sendCategoryNurtureEmail, type NurtureInput } from "@/lib/nurture-emails";
import { sendPendingContentAlerts } from "@/lib/content-alerts";

/**
 * Cron diário da sequência de nutrição pós-diagnóstico (vercel.json → crons).
 *
 * Regras:
 * - Somente leads do Diagnóstico, com consentimento, sem opt-out e criados a
 *   partir de NURTURE_START (não retroage sobre a base antiga).
 * - Etapas por idade do lead: E1 ≥ D+2 · E2 ≥ D+5 · E3 ≥ D+7. Uma etapa por
 *   execução (cron diário ⇒ espaçamento natural mínimo de 1 dia).
 * - Lead que estaciona (>30 dias sem completar) é encerrado sem envio.
 * - `?dry=1` lista o que seria enviado, sem enviar (para conferência).
 *
 * Autenticação: header `Authorization: Bearer ${CRON_SECRET}` (enviado pela
 * Vercel quando a env CRON_SECRET existe) ou `?key=CRON_SECRET` para teste
 * manual. Sem CRON_SECRET definido (dev local), a rota fica aberta.
 */

/** Leads criados antes desta data não entram na sequência. */
const NURTURE_START = "2026-07-18T00:00:00.000Z";
/** Idade máxima (dias) para continuar nutrindo; depois encerra. */
const MAX_AGE_DAYS = 30;
/** Limite de envios por execução (proteção de quota do Resend). */
const MAX_SENDS_PER_RUN = 50;

const STEP_THRESHOLD_DAYS = [2, 5, 7] as const;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const key = url.searchParams.get("key");
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const dry = url.searchParams.get("dry") === "1";

  const payload = await getPayloadClient();
  const { docs } = await payload.find({
    collection: "leads",
    where: {
      and: [
        { source: { equals: DIAGNOSTIC_ORIGIN } },
        { consent: { equals: true } },
        { nurtureOptOut: { not_equals: true } },
        { nurtureStage: { less_than: 3 } },
        { createdAt: { greater_than_equal: NURTURE_START } },
      ],
    },
    limit: 200,
    sort: "createdAt",
    depth: 0,
  });

  const now = Date.now();
  const results: Array<Record<string, unknown>> = [];
  let sends = 0;

  for (const lead of docs) {
    if (sends >= MAX_SENDS_PER_RUN) break;

    const stage = Number(lead.nurtureStage ?? 0);
    if (!(stage >= 0 && stage < 3)) continue;

    const ageDays = (now - new Date(lead.createdAt).getTime()) / 86_400_000;

    // Lead velho demais para seguir na sequência: encerra sem enviar.
    if (ageDays > MAX_AGE_DAYS) {
      if (!dry) {
        await payload.update({
          collection: "leads",
          id: lead.id,
          data: { nurtureStage: 3 },
        });
      }
      results.push({ id: lead.id, email: lead.email, action: "expired" });
      continue;
    }

    if (ageDays < STEP_THRESHOLD_DAYS[stage]) continue;

    // Espaçamento mínimo de 1 dia entre etapas (proteção contra reexecução).
    const lastAt = lead.nurtureLastAt ? new Date(lead.nurtureLastAt).getTime() : 0;
    if (lastAt && now - lastAt < 86_400_000 * 0.9) continue;

    const step = (stage + 1) as 1 | 2 | 3;
    const input: NurtureInput = {
      leadId: lead.id,
      name: lead.name || "",
      email: lead.email || "",
      company: lead.company || undefined,
      details:
        lead.details && typeof lead.details === "object"
          ? (lead.details as Record<string, unknown>)
          : null,
    };

    if (dry) {
      results.push({ id: lead.id, email: lead.email, action: `would-send-E${step}` });
      continue;
    }

    const sent = await sendNurtureEmail(step, input);
    if (sent.ok) {
      sends += 1;
      await payload.update({
        collection: "leads",
        id: lead.id,
        data: { nurtureStage: step, nurtureLastAt: new Date().toISOString() },
      });
    }
    results.push({
      id: lead.id,
      email: lead.email,
      action: sent.ok ? `sent-E${step}` : `failed-E${step}`,
      via: sent.via,
    });
  }

  // Leads de download de material, nutridos por TEMA (não fizeram o
  // diagnóstico, então não têm pilar mais fraco) -- mesma cadência D+2/D+5/D+7,
  // conteúdo do tema do material baixado, terminando no mesmo convite à
  // Chamada. Pedido do Thiago (27/09/2026): DME + reunião como objetivo.
  if (sends < MAX_SENDS_PER_RUN) {
    const { docs: downloadDocs } = await payload.find({
      collection: "leads",
      where: {
        and: [
          { interestCategory: { exists: true } },
          { consent: { equals: true } },
          { nurtureOptOut: { not_equals: true } },
          { nurtureStage: { less_than: 3 } },
          { createdAt: { greater_than_equal: NURTURE_START } },
        ],
      },
      limit: 200,
      sort: "createdAt",
      depth: 0,
    });

    for (const lead of downloadDocs) {
      if (sends >= MAX_SENDS_PER_RUN) break;
      // Filtrado em memória (mesmo padrão de src/lib/email-marketing.ts):
      // interestCategory só existe em lead de download, mas confere a origem
      // mesmo assim -- não é a chave de segmentação, é sinal duplo de segurança.
      if (!lead.interestCategory || !String(lead.source || "").startsWith("Download:")) continue;

      const stage = Number(lead.nurtureStage ?? 0);
      if (!(stage >= 0 && stage < 3)) continue;

      const ageDays = (now - new Date(lead.createdAt).getTime()) / 86_400_000;

      if (ageDays > MAX_AGE_DAYS) {
        if (!dry) {
          await payload.update({ collection: "leads", id: lead.id, data: { nurtureStage: 3 } });
        }
        results.push({ id: lead.id, email: lead.email, action: "expired-download" });
        continue;
      }

      if (ageDays < STEP_THRESHOLD_DAYS[stage]) continue;

      const lastAt = lead.nurtureLastAt ? new Date(lead.nurtureLastAt).getTime() : 0;
      if (lastAt && now - lastAt < 86_400_000 * 0.9) continue;

      const step = (stage + 1) as 1 | 2 | 3;
      const categoryLabel = String(lead.interestCategory)
        .replace(/-/g, " ")
        .replace(/^./u, (c) => c.toUpperCase());

      if (dry) {
        results.push({ id: lead.id, email: lead.email, action: `would-send-download-E${step}`, category: lead.interestCategory });
        continue;
      }

      const sent = await sendCategoryNurtureEmail(step, {
        leadId: lead.id,
        name: lead.name || "",
        email: lead.email || "",
        category: String(lead.interestCategory),
        categoryLabel,
      });
      if (sent.ok) {
        sends += 1;
        await payload.update({
          collection: "leads",
          id: lead.id,
          data: { nurtureStage: step, nurtureLastAt: new Date().toISOString() },
        });
      }
      results.push({
        id: lead.id,
        email: lead.email,
        action: sent.ok ? `sent-download-E${step}` : `failed-download-E${step}`,
        via: sent.via,
        category: lead.interestCategory,
      });
    }
  }

  // Alertas de conteúdo AGENDADO cuja data chegou (posts/materiais) — o hook
  // afterChange só cobre publicação imediata; agendados são enviados aqui.
  const contentAlerts = dry ? [] : await sendPendingContentAlerts();

  return NextResponse.json({
    ok: true,
    dry,
    candidates: docs.length,
    processed: results.length,
    results,
    contentAlerts,
  });
}
