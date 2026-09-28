import type { CollectionConfig } from "payload";
import { sendCampaignNow } from "@/lib/email-marketing";
import { eaEditor } from "@/lib/editor";

/**
 * Campanha manual de e-mail (newsletter/mailmarketing) para um Segmento.
 *
 * Fluxo de envio (sem UI custom — só campos nativos do Payload): escrever o
 * conteúdo com status "Rascunho", revisar o `memberCount` do segmento
 * escolhido e então salvar com status **"Agendada (enviar agora)"** — o hook
 * `afterChange` abaixo dispara o envio de verdade e, ao final, atualiza o
 * status para "Enviada" ou "Erro" com as estatísticas.
 */
export const EmailCampaigns: CollectionConfig = {
  slug: "email-campaigns",
  labels: { singular: "Campanha de e-mail", plural: "Campanhas e nutrição" },
  admin: {
    useAsTitle: "subject",
    defaultColumns: ["subject", "segment", "status", "statsSent", "statsTotal"],
    group: "EA Leads",
    description:
      "Campanhas manuais e todas as regras automáticas de disparo de e-mails da EA.",
    components: {
      views: {
        list: {
          Component: "@/components/admin/email/EmailCampaignsListView#EmailCampaignsListView",
        },
      },
    },
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: "subject", type: "text", required: true, label: "Assunto do e-mail" },
    {
      name: "segment",
      type: "relationship",
      relationTo: "email-segments",
      required: true,
      label: "Segmento (para quem enviar)",
    },
    {
      name: "body",
      type: "richText",
      required: true,
      label: "Conteúdo do e-mail",
      editor: eaEditor,
    },
    {
      name: "status",
      type: "select",
      label: "Status",
      defaultValue: "rascunho",
      admin: { position: "sidebar" },
      options: [
        { label: "Rascunho", value: "rascunho" },
        { label: "Agendada (enviar agora)", value: "agendada_envio" },
        { label: "Enviando…", value: "enviando", },
        { label: "Enviada", value: "enviada" },
        { label: "Erro no envio", value: "erro" },
      ],
    },
    {
      type: "collapsible",
      label: "Estatísticas do envio",
      admin: { position: "sidebar" },
      fields: [
        { name: "statsTotal", type: "number", label: "Total no segmento", admin: { readOnly: true } },
        { name: "statsSent", type: "number", label: "Enviados", admin: { readOnly: true } },
        { name: "statsFailed", type: "number", label: "Falharam", admin: { readOnly: true } },
        { name: "statsStartedAt", type: "date", label: "Início do envio", admin: { readOnly: true } },
        { name: "statsFinishedAt", type: "date", label: "Fim do envio", admin: { readOnly: true } },
        { name: "statsError", type: "text", label: "Erro", admin: { readOnly: true } },
      ],
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        const justScheduled =
          doc.status === "agendada_envio" && previousDoc?.status !== "agendada_envio";
        if (!justScheduled) return doc;
        try {
          await sendCampaignNow(doc.id);
        } catch (e) {
          req.payload.logger.error(`[email-campaigns] falha ao enviar ${doc.id}: ${e}`);
          await req.payload.update({
            collection: "email-campaigns",
            id: doc.id,
            data: { status: "erro", statsError: String(e) },
          });
        }
        return doc;
      },
    ],
  },
};
