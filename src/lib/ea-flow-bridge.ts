/**
 * Ponte com o EA Flow (`C:\dev\ea-flow`, sistema próprio de automação de
 * mensagens) — Fase 5 do projeto. Hoje só notifica o lead do Diagnóstico de
 * Maturidade Empresarial; qualquer outra origem não chama isto.
 *
 * Autenticação via EA_FLOW_API_KEY, mesmo padrão do CONTENT_ENGINE_API_KEY
 * já usado com o EA Post. Se as env vars não estiverem configuradas
 * (deploy do EA Flow ainda não existe), a função não faz nada — nunca lança,
 * nunca atrasa a resposta da captação do lead por causa de um sistema
 * satélite fora do ar. Mesmo contrato do `sendDiagnosticResultEmail`
 * (ver `diagnostic-email.ts`): a captação não pode falhar por isto.
 */
export async function notifyEaFlowLead(params: { name: string; email: string; whatsapp?: string; instagram?: string; eventName?: string }): Promise<void> {
  const baseUrl = process.env.EA_FLOW_URL;
  const apiKey = process.env.EA_FLOW_API_KEY;
  if (!baseUrl || !apiKey) return;

  try {
    await fetch(`${baseUrl.replace(/\/$/, "")}/api/events/external`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        eventName: params.eventName ?? "lead_diagnostico",
        contactExternalId: params.email,
        contactName: params.name,
        source: "Diagnóstico de Maturidade Empresarial (site)",
        // `ensureLeadForContact` (EA Flow) só acha e-mail varrendo `customFields`
        // por um valor com formato de e-mail — nunca olha `contactExternalId`.
        // Sem isto, o lead do site nunca casava por e-mail com o mesmo lead
        // que depois aparece no Instagram/WhatsApp, e o telefone/@ do
        // formulário eram coletados e simplesmente descartados aqui.
        customFields: { email: params.email, whatsapp: params.whatsapp, instagram: params.instagram },
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("[ea-flow-bridge] falha ao notificar EA Flow:", err);
  }
}

/**
 * WhatsApp ao lead do site que deixou telefone, pelo número comercial oficial
 * (13/10/2026). O EA Flow escolhe a instância comercial e o fluxo do `evento`
 * tem o texto (`{{nome}}` e os `campos`, ex.: material, pilar). Nunca lança e
 * nunca atrasa a captação: sem telefone ou sem as env vars, não faz nada.
 */
export async function enviarWhatsappDoSite(
  evento: "site_whatsapp_download" | "site_whatsapp_dme" | "site_whatsapp_contato" | "site_whatsapp_texto",
  lead: { nome: string; telefone?: string; email: string; campos?: Record<string, string> },
): Promise<boolean> {
  const baseUrl = process.env.EA_FLOW_URL;
  const apiKey = process.env.EA_FLOW_API_KEY;
  const digitos = (lead.telefone ?? "").replace(/\D/g, "");
  if (!baseUrl || !apiKey || digitos.length < 10) return false;

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/events/external`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        eventName: evento,
        channelType: "evolution",
        contactExternalId: digitos,
        contactName: lead.nome,
        source: "Site (formulário)",
        customFields: { email: lead.email, ...lead.campos },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error(`[ea-flow-bridge] WhatsApp do lead (${evento}) respondeu HTTP ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error(`[ea-flow-bridge] falha no WhatsApp do lead (${evento}):`, err);
    return false;
  }
}

/**
 * Aviso no WhatsApp do Thiago via EA Flow (POST /api/avisos/dono).
 * Usado pelos alertas operacionais do outbound (F12) e notificações críticas.
 * Nunca lança: se falhar ou se as credenciais não existirem, devolve false.
 */
export async function avisarThiago(texto: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
  const baseUrl = process.env.EA_FLOW_URL;
  const apiKey = process.env.EA_FLOW_API_KEY;
  if (!baseUrl || !apiKey) {
    console.warn("[ea-flow-bridge] EA_FLOW_URL ou EA_FLOW_API_KEY não configurados para aviso ao Thiago.");
    return false;
  }

  try {
    const res = await fetchFn(`${baseUrl.replace(/\/$/, "")}/api/avisos/dono`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ texto }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[ea-flow-bridge] aviso ao Thiago respondeu HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[ea-flow-bridge] falha ao enviar aviso ao Thiago:", err);
    return false;
  }
}

