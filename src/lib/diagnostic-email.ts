import { sendMail } from "@/lib/email";
import { siteConfig } from "@/lib/site-config";

/**
 * E-mail automático de resultado enviado ao LEAD que conclui o Diagnóstico de
 * Maturidade Empresarial (public/diagnostico-maturidade-empresarial.html).
 *
 * Objetivo (plano de aquisição, item #2): transformar o diagnóstico de "teste
 * que a pessoa faz e esquece" no início de uma conversa — resultado por pilar +
 * um próximo passo personalizado no pilar mais frágil + CTA de WhatsApp.
 *
 * Remetente fixo: contato@empresarialacademy.com (decisão do cliente).
 * Nunca lança — a captação não pode falhar por causa deste e-mail.
 */

/** Precisa bater com o `origem` enviado pelo diagnóstico. */
export const DIAGNOSTIC_ORIGIN = "Diagnóstico de Maturidade Empresarial";

const FROM = "Empresarial Academy <contato@empresarialacademy.com>";
const REPLY_TO = siteConfig.contact.email; // contato@empresarialacademy.com

const NAVY = "#1D2B3C";
const GOLD = "#C1A160";
const INK = "#15191f";
const GRAY = "#5b626e";
const LINE = "#d9dce1";

/** Ordem oficial dos pilares do diagnóstico. */
const PILLAR_KEYS = [
  "Fluxo de Alta Performance",
  "Arquitetura do Crescimento",
  "Objetivos Estratégicos",
  "Métricas de Sucesso",
  "Gestão de Desafios",
  "Evolução Constante",
] as const;

/** "Por onde começar" por pilar — tom direto, alinhado ao Gestão 360. */
const PILLAR_TIP: Record<string, string> = {
  "Fluxo de Alta Performance":
    "Mapeie o processo que mais gera dor hoje e defina alçadas de decisão claras. Operação que depende só de você não escala.",
  "Arquitetura do Crescimento":
    "Desenhe um organograma simples e implante 1:1 regulares com o time. Estrutura clara sustenta o crescimento — a falta dela trava.",
  "Objetivos Estratégicos":
    "Escreva os 3 objetivos mais importantes dos próximos 90 dias e desdobre em meta por área. Time sem foco comum trabalha duro e anda pouco.",
  "Métricas de Sucesso":
    "Troque métrica de vaidade por métrica de sanidade (margem, caixa, retenção) e separe resultado de saldo em caixa. O que não se mede direito, engana.",
  "Gestão de Desafios":
    "Mapeie os principais riscos do negócio e comece uma reserva de emergência. Empresa sem plano de crise decide no desespero.",
  "Evolução Constante":
    "Reserve tempo fixo para pensar no que vem depois da operação. Quem não questiona o próprio modelo é questionado pelo mercado primeiro.",
};

type Pillar = { name: string; pct: number; label: string };

const parsePct = (v: string): number => {
  const m = /(\d+)\s*%/.exec(v || "");
  return m ? Number(m[1]) : NaN;
};
const parseLabel = (v: string): string => {
  const m = /\(([^)]+)\)/.exec(v || "");
  return m ? m[1].trim() : "";
};
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function pillarBar(p: Pillar, highlight: boolean): string {
  const barColor = highlight ? GOLD : NAVY;
  const filled = Math.max(2, Math.min(100, p.pct));
  return `<tr>
    <td style="padding:10px 0 2px;color:${INK};font-size:14px;font-weight:600">
      ${esc(p.name)}
      <span style="float:right;color:${GRAY};font-weight:400">${p.pct}%${
        p.label ? ` · ${esc(p.label)}` : ""
      }</span>
    </td>
  </tr>
  <tr><td style="padding:0 0 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:6px;overflow:hidden;background:#eceef1">
      <tr>
        <td width="${filled}%" style="background:${barColor};height:8px;line-height:8px;font-size:0">&nbsp;</td>
        <td style="height:8px;line-height:8px;font-size:0">&nbsp;</td>
      </tr>
    </table>
  </td></tr>`;
}

function buildHtml(opts: {
  firstName: string;
  company: string;
  overall: { pct: number; label: string };
  pillars: Pillar[];
  weakest: Pillar;
  whatsappUrl: string;
  consultoriaUrl: string;
  diagnosticId?: string;
}): string {
  const { firstName, company, overall, pillars, weakest, whatsappUrl, consultoriaUrl, diagnosticId } =
    opts;
  const tip =
    PILLAR_TIP[weakest.name] ||
    "Priorize esse pilar no seu plano dos próximos 90 dias.";
  const empresaTxt = company ? ` da ${esc(company)}` : " da sua empresa";

  const bars = pillars
    .map((p) => pillarBar(p, p.name === weakest.name))
    .join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f6f5f1;font-family:Arial,Helvetica,sans-serif;color:${INK}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Seu resultado por pilar e o próximo passo para destravar o crescimento.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${LINE};border-radius:14px;overflow:hidden">

  <tr><td style="background:${NAVY};padding:24px 28px">
    <div style="color:${GOLD};font-weight:700;letter-spacing:.5px;font-size:13px">EMPRESARIAL ACADEMY</div>
    <div style="color:#ffffff;font-size:20px;font-weight:700;margin-top:6px">Diagnóstico de Maturidade Empresarial</div>
    ${diagnosticId ? `<div style="display:inline-block;margin-top:10px;padding:4px 10px;border-radius:6px;background:rgba(193,161,96,0.2);border:1px solid ${GOLD};color:#ffffff;font-size:11.5px;font-weight:700;letter-spacing:.5px">ID: ${esc(diagnosticId)}</div>` : ""}
  </td></tr>

  <tr><td style="padding:26px 28px 8px">
    <p style="margin:0 0 12px;font-size:16px">Olá, ${esc(firstName)},</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${INK}">
      Obrigado por concluir o diagnóstico${empresaTxt}. Este é o retrato da sua
      gestão hoje, nos seis pilares que mais pesam no crescimento.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NAVY};border-radius:12px;margin:0 0 22px">
      <tr><td align="center" style="padding:20px">
        <div style="color:#ffffff;opacity:.75;font-size:12px;letter-spacing:1px">MATURIDADE GERAL</div>
        <div style="color:${GOLD};font-size:40px;font-weight:800;line-height:1.1;margin-top:2px">${overall.pct}%</div>
        ${overall.label ? `<div style="color:#ffffff;font-size:14px;margin-top:2px">${esc(overall.label)}</div>` : ""}
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bars}</table>
  </td></tr>

  <tr><td style="padding:12px 28px 8px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${GOLD};border-radius:12px;background:#faf7ef">
      <tr><td style="padding:18px 20px">
        <div style="color:${GRAY};font-size:12px;letter-spacing:.5px;text-transform:uppercase">Seu ponto mais frágil agora</div>
        <div style="color:${NAVY};font-size:18px;font-weight:700;margin:4px 0 8px">${esc(weakest.name)} — ${weakest.pct}%</div>
        <p style="margin:0;font-size:14px;line-height:1.6;color:${INK}">${esc(tip)}</p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 28px 6px">
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6">
      Quer destravar esse pilar com um plano sob medida? Vamos conversar — em
      poucos minutos eu te mostro o caminho mais curto para o próximo nível.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="border-radius:10px;background:${GOLD}">
        <a href="${whatsappUrl}" style="display:inline-block;padding:14px 26px;color:${NAVY};font-weight:700;font-size:15px;text-decoration:none">Falar no WhatsApp &rarr;</a>
      </td>
    </tr></table>
    <p style="margin:14px 0 0;font-size:13px;color:${GRAY}">
      Ou conheça a <a href="${consultoriaUrl}" style="color:#8a6a1f;font-weight:600">consultoria empresarial com IA</a>.
    </p>
  </td></tr>

  <tr><td style="padding:22px 28px 26px">
    <div style="border-top:1px solid ${LINE};padding-top:16px">
      <p style="margin:0;font-size:14px;color:${INK}"><strong>Thiago Marchi</strong> · Empresarial Academy</p>
      <p style="margin:4px 0 0;font-size:13px;color:${GRAY}">Método para crescer. Gestão para permanecer.</p>
    </div>
  </td></tr>

</table>
<p style="max-width:560px;margin:14px auto 0;font-size:11px;color:#9aa0a8;text-align:center;line-height:1.5">
  Você recebeu este e-mail porque concluiu o Diagnóstico de Maturidade em
  <a href="${siteConfig.url}" style="color:#9aa0a8">empresarialacademy.com</a>.
</p>
</td></tr></table>
</body></html>`;
}

function buildText(opts: {
  firstName: string;
  overall: { pct: number; label: string };
  pillars: Pillar[];
  weakest: Pillar;
  whatsappUrl: string;
}): string {
  const { firstName, overall, pillars, weakest, whatsappUrl } = opts;
  const tip = PILLAR_TIP[weakest.name] || "";
  return [
    `Olá, ${firstName},`,
    ``,
    `Seu resultado no Diagnóstico de Maturidade Empresarial:`,
    `Maturidade geral: ${overall.pct}%${overall.label ? ` (${overall.label})` : ""}`,
    ``,
    ...pillars.map((p) => `- ${p.name}: ${p.pct}%${p.label ? ` (${p.label})` : ""}`),
    ``,
    `Seu ponto mais frágil agora: ${weakest.name} — ${weakest.pct}%`,
    tip,
    ``,
    `Vamos conversar e montar um plano para destravar esse pilar:`,
    whatsappUrl,
    ``,
    `Thiago Marchi · Empresarial Academy`,
    `Método para crescer. Gestão para permanecer.`,
  ].join("\n");
}

type Input = {
  name: string;
  email: string;
  company?: string;
  whatsapp?: string;
  /** Campo `extra` do diagnóstico: "Maturidade Geral" + notas por pilar. */
  scores: Record<string, string>;
  /** Id do lead já gravado (para vincular no email-logs). */
  leadId?: string | number;
  /** Identificador único do diagnóstico (ex: EA-DIAG-2026-X8K2M). */
  diagnosticId?: string;
};

/**
 * Monta o e-mail (assunto + html + text) a partir dos dados do lead.
 * Puro/testável — retorna null se não houver notas por pilar. Não envia.
 */
export function renderDiagnosticEmail(
  input: Input,
): { subject: string; html: string; text: string } | null {
  const { name, company, scores, diagnosticId } = input;

  const pillars: Pillar[] = PILLAR_KEYS.map((k) => ({
    name: k,
    pct: parsePct(scores[k]),
    label: parseLabel(scores[k]),
  })).filter((p) => Number.isFinite(p.pct));

  // Sem notas por pilar não há e-mail personalizado a enviar.
  if (pillars.length === 0) return null;

  const overallRaw = scores["Maturidade Geral"] || "";
  const overall = {
    pct: Number.isFinite(parsePct(overallRaw))
      ? parsePct(overallRaw)
      : Math.round(pillars.reduce((a, p) => a + p.pct, 0) / pillars.length),
    label: parseLabel(overallRaw),
  };

  const weakest = pillars.reduce((min, p) => (p.pct < min.pct ? p : min), pillars[0]);
  const firstName = (name || "").trim().split(/\s+/)[0] || "empreendedor(a)";

  const diagRef = diagnosticId ? ` (ID: ${diagnosticId})` : "";
  const waText = `Olá! Fiz o Diagnóstico de Maturidade${diagRef} e quero destravar meu pilar de ${weakest.name} (${weakest.pct}%). Podemos conversar?`;
  const whatsappUrl = `https://wa.me/${siteConfig.contact.phoneRaw}?text=${encodeURIComponent(
    waText,
  )}`;
  const consultoriaUrl = `${siteConfig.url}/servicos/consultoria`;

  const subject = diagnosticId
    ? `Seu resultado do Diagnóstico de Maturidade Empresarial [${diagnosticId}]`
    : "Seu resultado do Diagnóstico de Maturidade Empresarial";

  return {
    subject,
    html: buildHtml({
      firstName,
      company: company || "",
      overall,
      pillars,
      weakest,
      whatsappUrl,
      consultoriaUrl,
      diagnosticId,
    }),
    text: buildText({ firstName, overall, pillars, weakest, whatsappUrl }),
  };
}

export async function sendDiagnosticResultEmail(
  input: Input,
): Promise<{ ok: boolean; via: string }> {
  try {
    if (!input.email) return { ok: false, via: "no-email" };
    const mail = renderDiagnosticEmail(input);
    if (!mail) return { ok: false, via: "no-scores" };

    const result = await sendMail({
      to: input.email,
      from: FROM,
      replyTo: REPLY_TO,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    const { logEmailSend } = await import("@/lib/email-log");
    await logEmailSend({
      type: "diagnostic-result",
      to: input.email,
      subject: mail.subject,
      ok: result.ok,
      via: result.via,
      leadId: input.leadId,
    });
    return result;
  } catch (e) {
    console.error("[diagnostic-email] exceção:", e);
    return { ok: false, via: "exception" };
  }
}
