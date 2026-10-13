import { getPayloadClient } from "@/lib/payload";

export type EmailLogType =
  | "diagnostic-result"
  | "nurture-1"
  | "nurture-2"
  | "nurture-3"
  | "download-thanks"
  | "campaign"
  | "content-alert"
  | "contract-sent"
  | "contract-signed";

/**
 * Registra um envio (ou falha) na coleção `email-logs`, para o painel de
 * monitoramento. Nunca lança — logging não pode derrubar o envio em si.
 */
export async function logEmailSend(input: {
  type: EmailLogType;
  to: string;
  subject: string;
  ok: boolean;
  via: string;
  leadId?: string | number;
  campaignId?: string | number;
  errorMessage?: string;
}): Promise<void> {
  try {
    if (!input.to) return;
    const payload = await getPayloadClient();
    await payload.create({
      collection: "email-logs",
      data: {
        type: input.type,
        to: input.to,
        subject: input.subject,
        status: input.ok ? "sent" : "failed",
        via: input.via,
        lead: input.leadId != null ? Number(input.leadId) : undefined,
        campaign: input.campaignId != null ? Number(input.campaignId) : undefined,
        errorMessage: input.errorMessage,
      },
    });
  } catch (e) {
    console.error("[email-log] falha ao registrar envio:", e);
  }
}
