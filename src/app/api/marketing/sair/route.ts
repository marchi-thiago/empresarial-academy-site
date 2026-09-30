import { getPayloadClient } from "@/lib/payload";
import { crmDb } from "@/lib/crm/payload-db";
import { registrarInteracao } from "@/lib/crm/registrar";
import { marketingOptOutToken } from "@/lib/email-marketing";

/**
 * Descadastro das campanhas manuais (link "Sair da lista" das campanhas).
 * Marca `marketingOptOut` no lead — independente da nutrição pós-diagnóstico
 * (`nurtureOptOut`, em /api/nutricao/sair), que segue seu próprio controle.
 */

const page = (title: string, msg: string) => `<!doctype html><html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#f6f5f1;font-family:Arial,Helvetica,sans-serif;color:#15191f">
<div style="max-width:480px;margin:80px auto;padding:0 20px;text-align:center">
  <div style="background:#fff;border:1px solid #d9dce1;border-radius:14px;padding:36px 28px">
    <div style="color:#C1A160;font-weight:700;letter-spacing:.5px;font-size:13px">EMPRESARIAL ACADEMY</div>
    <h1 style="font-size:20px;margin:14px 0 10px;color:#1D2B3C">${title}</h1>
    <p style="font-size:15px;line-height:1.6;color:#5b626e;margin:0">${msg}</p>
    <p style="margin:22px 0 0"><a href="https://empresarialacademy.com" style="color:#8a6a1f;font-weight:600">Voltar ao site</a></p>
  </div>
</div></body></html>`;

const html = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("l") || "";
  const token = url.searchParams.get("t") || "";
  if (!id || !token) {
    return html(page("Link inválido", "Este link de descadastro está incompleto."), 400);
  }

  try {
    const payload = await getPayloadClient();
    const lead = await payload.findByID({ collection: "leads", id, depth: 0 });
    if (!lead || marketingOptOutToken(lead.id, lead.email || "") !== token) {
      return html(page("Link inválido", "Não foi possível validar este link de descadastro."), 400);
    }
    if (!lead.marketingOptOut) {
      await payload.update({
        collection: "leads",
        id: lead.id,
        data: { marketingOptOut: true },
      });
    }
    // CRM: o pedido de saída vira interação e move o lead para "Saiu da lista" (opt-out global).
    try {
      await registrarInteracao(crmDb(payload), {
        leadId: lead.id,
        canal: "email",
        direcao: "entrada",
        tipo: "descadastro",
        metadados: { origem: "marketingOptOut" },
        chave: `descadastro:${lead.id}:marketingOptOut`,
      });
    } catch (e) {
      payload.logger.error(`[crm] descadastro não registrado: ${e}`);
    }
    return html(
      page(
        "Descadastro confirmado",
        "Você não receberá mais e-mails de campanha da Empresarial Academy. Isso não afeta o e-mail do resultado do diagnóstico, caso ainda esteja em andamento.",
      ),
    );
  } catch {
    return html(page("Link inválido", "Não foi possível validar este link de descadastro."), 400);
  }
}
