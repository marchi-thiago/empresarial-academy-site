import type { CollectionConfig } from "payload";

/**
 * Histórico de todo e-mail de marketing/nutrição disparado a um lead — a base
 * do painel de monitoramento. Cada envio (nutrição, resultado do diagnóstico,
 * campanha manual) grava uma linha aqui via src/lib/email-log.ts.
 * Somente leitura pelo admin — a criação é sempre do servidor.
 */
export const EmailLogs: CollectionConfig = {
  slug: "email-logs",
  labels: { singular: "Envio de e-mail", plural: "Envios de e-mail" },
  admin: {
    useAsTitle: "subject",
    defaultColumns: ["type", "to", "status", "via", "createdAt"],
    group: "EA Leads",
    components: {
      beforeList: ["@/components/admin/ea-leads/EaLeadsNav#EaLeadsNav"],
    },
    description:
      "Histórico de todo e-mail de nutrição/marketing enviado — não inclui as notificações internas de lead para a equipe.",
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "type",
      type: "select",
      required: true,
      label: "Tipo",
      admin: { position: "sidebar" },
      options: [
        { label: "Resultado do diagnóstico", value: "diagnostic-result" },
        { label: "Nutrição — E1 (D+2)", value: "nurture-1" },
        { label: "Nutrição — E2 (D+5)", value: "nurture-2" },
        { label: "Nutrição — E3 (D+7)", value: "nurture-3" },
        { label: "Campanha manual", value: "campaign" },
        { label: "Alerta de novo conteúdo", value: "content-alert" },
        { label: "Contrato enviado para assinatura", value: "contract-sent" },
        { label: "Assinatura de contrato confirmada", value: "contract-signed" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      label: "Status",
      admin: { position: "sidebar" },
      options: [
        { label: "Enviado", value: "sent" },
        { label: "Falhou", value: "failed" },
      ],
    },
    { name: "to", type: "email", required: true, label: "Destinatário" },
    { name: "subject", type: "text", required: true, label: "Assunto" },
    {
      name: "lead",
      type: "relationship",
      relationTo: "leads",
      label: "Lead",
      admin: { position: "sidebar" },
    },
    {
      name: "campaign",
      type: "relationship",
      relationTo: "email-campaigns",
      label: "Campanha",
      admin: { position: "sidebar" },
    },
    {
      name: "via",
      type: "text",
      label: "Provedor",
      admin: { position: "sidebar", description: "resend · smtp · console (não configurado)" },
    },
    { name: "errorMessage", type: "text", label: "Erro" },
  ],
};
