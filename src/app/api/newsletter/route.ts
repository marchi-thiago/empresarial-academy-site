import { NextResponse } from "next/server";
import { sendLeadEmail } from "@/lib/email";
import { saveLead } from "@/lib/leads";
import { sendRdConversion } from "@/lib/rdstation";
import {
  DIAGNOSTIC_ORIGIN,
  sendDiagnosticResultEmail,
} from "@/lib/diagnostic-email";
import { enviarWhatsappDoSite, notifyEaFlowLead } from "@/lib/ea-flow-bridge";
import { getWeakestPillar } from "@/lib/lead-scoring";
import { generateDiagnosticId } from "@/lib/diagnostic-id";
import { getPayloadClient } from "@/lib/payload";
import { sendBoasVindasEmail, sendDownloadThanksEmail, temaDoMaterial } from "@/lib/nurture-emails";

type Payload = {
  nome?: string;
  empresa?: string;
  email?: string;
  whatsapp?: string;
  instagram?: string;
  diagnosticId?: string;
  consentimento?: boolean;
  origem?: string;
  /** Slug do material baixado (DownloadButton) — resolve a categoria no servidor, nunca confia no cliente. */
  materialSlug?: string;
  website?: string; // honeypot
  extra?: Record<string, string>;
};

/** Material baixado (título + slug da categoria) pelo slug. Nunca lança: sem material achado, devolve null. */
async function resolverMaterial(materialSlug: string): Promise<{ title: string; category: string | null } | null> {
  try {
    const payload = await getPayloadClient();
    const { docs } = await payload.find({
      collection: "materials",
      where: { slug: { equals: materialSlug } },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    });
    const material = docs[0] as { title?: string; category?: { slug?: string } | number | null } | undefined;
    if (!material) return null;
    const category = material.category;
    return {
      title: material.title ?? "",
      category: category && typeof category === "object" ? (category.slug ?? null) : null,
    };
  } catch {
    return null;
  }
}

/** O lead já concluiu o DME (tem a nota geral gravada)? Nunca lança. */
async function leadJaFezDme(leadId: string | number): Promise<boolean> {
  try {
    const payload = await getPayloadClient();
    const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
    const details = (lead as { details?: Record<string, unknown> | null }).details;
    return Boolean(details && details["Maturidade Geral"]);
  } catch {
    return false;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sanitize = (v: unknown, max = 200) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export async function POST(request: Request) {
  let body: Payload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (sanitize(body.website)) return NextResponse.json({ ok: true });

  const nome = sanitize(body.nome, 120);
  const empresa = sanitize(body.empresa, 120);
  const email = sanitize(body.email, 160);
  const whatsapp = sanitize(body.whatsapp, 40);
  const instagram = sanitize(body.instagram, 80);
  const clientDiagId = sanitize(body.diagnosticId, 40);
  const origem = sanitize(body.origem, 60) || "Newsletter";

  const errors: Record<string, string> = {};
  if (nome.length < 2) errors.nome = "Informe seu nome.";
  if (!EMAIL_RE.test(email)) errors.email = "Informe um e-mail válido.";
  if (body.consentimento !== true)
    errors.consentimento = "É necessário aceitar receber os contatos.";

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  const extra: Record<string, string> = {};
  if (body.extra && typeof body.extra === "object") {
    for (const [k, v] of Object.entries(body.extra)) {
      const key = sanitize(k, 60);
      const val = sanitize(v, 200);
      if (key && val) extra[key] = val;
    }
  }

  const materialSlug = sanitize(body.materialSlug, 200);
  const material = materialSlug ? await resolverMaterial(materialSlug) : null;
  const interestCategory = material?.category ?? undefined;

  const isDiagnostic =
    origem === DIAGNOSTIC_ORIGIN ||
    origem.includes("Diagnóstico") ||
    Boolean(extra["Maturidade Geral"]);
  const hasFinishedDiagnostic =
    origem === DIAGNOSTIC_ORIGIN || Boolean(extra["Maturidade Geral"]);
  const diagnosticId = isDiagnostic ? (clientDiagId || generateDiagnosticId()) : undefined;

  // Gravar o lead primeiro (sequencial) para termos o id disponível e
  // vincular o e-mail de resultado ao histórico em email-logs.
  const leadId = await saveLead({
    name: nome,
    email,
    company: empresa,
    whatsapp,
    instagram,
    source: origem,
    details: extra,
    consent: body.consentimento === true,
    diagnosticId,
    hasDiagnostic: isDiagnostic,
    interestCategory,
  });

  const emailFields: Record<string, string | undefined> = {
    Origem: origem,
    ...(diagnosticId ? { "ID do Diagnóstico": diagnosticId } : {}),
    Nome: nome,
    Empresa: empresa,
    "E-mail": email,
    WhatsApp: whatsapp,
    Instagram: instagram,
    ...extra,
  };

  const tasks: Promise<unknown>[] = [
    sendLeadEmail({
      subject: diagnosticId && hasFinishedDiagnostic
        ? `Novo Diagnóstico de Maturidade [${diagnosticId}] — ${nome}${empresa ? ` (${empresa})` : ""}`
        : `Nova captação — ${origem}`,
      replyTo: email,
      fields: emailFields,
    }),
    sendRdConversion({
      conversionIdentifier: origem,
      email,
      name: nome,
      whatsapp,
      company: empresa,
    }),
  ];

  // Follow-up automático: o próprio lead recebe o resultado + próximo passo
  // personalizado pelo pilar mais frágil (só na conclusão do diagnóstico).
  if (hasFinishedDiagnostic) {
    tasks.push(
      sendDiagnosticResultEmail({
        name: nome,
        email,
        company: empresa,
        whatsapp,
        scores: extra,
        leadId: leadId ?? undefined,
        diagnosticId,
      }),
    );
    // EA Flow (Fase 5) — dispara fluxo de automação de mensagens pelo evento
    // "lead_diagnostico". No-op se o EA Flow ainda não estiver em produção
    // (EA_FLOW_URL/EA_FLOW_API_KEY ausentes) — ver ea-flow-bridge.ts.
    tasks.push(notifyEaFlowLead({ name: nome, email, whatsapp, instagram }));
    tasks.push(
      enviarWhatsappDoSite("site_whatsapp_dme", {
        nome,
        telefone: whatsapp,
        email,
        campos: { pilar: getWeakestPillar(extra)?.name ?? "o que o resultado aponta" },
      }),
    );
  }

  // Download de material: agradecimento na hora, com o DME como próximo passo.
  // Sem lead gravado não envia (o descadastro precisa do id); o cron da nutrição reenvia.
  if (material && materialSlug && leadId != null) {
    tasks.push(
      leadJaFezDme(leadId).then((jaFezDme) =>
        sendDownloadThanksEmail({
          leadId,
          name: nome,
          email,
          materialTitle: material.title,
          materialSlug,
          tema: temaDoMaterial(material.category ?? "", material.title),
          jaFezDme,
        }),
      ),
    );
  }

  if (material && whatsapp) {
    tasks.push(enviarWhatsappDoSite("site_whatsapp_download", { nome, telefone: whatsapp, email, campos: { material: material.title } }));
  }

  // Inscrição (rodapé, pop-up, páginas de consultoria): boas-vindas na hora.
  if (!isDiagnostic && !materialSlug && leadId != null) {
    tasks.push(sendBoasVindasEmail({ leadId, name: nome, email }));
  }

  await Promise.all(tasks);

  return NextResponse.json({ ok: true, diagnosticId }, { status: 200 });
}
