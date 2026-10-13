import { NextResponse } from "next/server";
import { sendLeadEmail } from "@/lib/email";
import { saveLead } from "@/lib/leads";
import { sendContatoConfirmacaoEmail } from "@/lib/nurture-emails";
import { enviarWhatsappDoSite } from "@/lib/ea-flow-bridge";

/**
 * Endpoint de contato.
 * - Validação server-side (não confia no cliente).
 * - Anti-spam via honeypot ("website" deve vir vazio).
 * - Pronto para integração com CRM/e-mail (ver TODO).
 */

type Payload = {
  nome?: string;
  email?: string;
  telefone?: string;
  assunto?: string;
  mensagem?: string;
  consentimento?: boolean;
  website?: string; // honeypot
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitize(v: unknown, max = 2000): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  let body: Payload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  // Honeypot: bots preenchem campos ocultos.
  if (sanitize(body.website)) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const nome = sanitize(body.nome, 120);
  const email = sanitize(body.email, 160);
  const telefone = sanitize(body.telefone, 40);
  const assunto = sanitize(body.assunto, 120);
  const mensagem = sanitize(body.mensagem, 4000);
  const consentimento = body.consentimento === true;

  const errors: Record<string, string> = {};
  if (nome.length < 2) errors.nome = "Informe seu nome.";
  if (!EMAIL_RE.test(email)) errors.email = "Informe um e-mail válido.";
  if (telefone.replace(/\D/g, "").length < 10)
    errors.telefone = "Informe um telefone válido.";
  if (mensagem.length < 10) errors.mensagem = "Conte um pouco mais (mín. 10 caracteres).";
  if (!consentimento)
    errors.consentimento = "É necessário aceitar a Política de Privacidade.";

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  const leadId = await saveLead({
    name: nome,
    email,
    whatsapp: telefone,
    source: assunto ? `Contato — ${assunto}` : "Contato",
    details: mensagem ? { Mensagem: mensagem.slice(0, 200) } : undefined,
    consent: consentimento,
  });

  await Promise.all([
    sendLeadEmail({
      subject: `Novo contato pelo site${assunto ? ` — ${assunto}` : ""}`,
      replyTo: email,
      fields: {
        Nome: nome,
        "E-mail": email,
        Telefone: telefone,
        Assunto: assunto,
        Mensagem: mensagem,
      },
    }),
    // Confirmação ao lead (o descadastro do rodapé precisa do id gravado).
    leadId != null ? sendContatoConfirmacaoEmail({ leadId, name: nome, email }) : null,
    enviarWhatsappDoSite("site_whatsapp_contato", { nome, telefone, email }),
  ]);

  return NextResponse.json({ ok: true }, { status: 200 });
}
