import type { CollectionConfig } from "payload";
import { countSegmentMembers } from "@/lib/email-marketing";

/**
 * Segmento salvo = critérios de seleção sobre a base de leads (fonte de
 * verdade para o painel de campanhas). Regras de conformidade (e-mail
 * válido, consentimento, não descadastrado) são SEMPRE aplicadas por
 * src/lib/email-marketing.ts — não são configuráveis aqui de propósito.
 */
export const EmailSegments: CollectionConfig = {
  slug: "email-segments",
  labels: { singular: "Segmento", plural: "Segmentos" },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "source", "pillar", "memberCount"],
    listSearchableFields: ["name", "description"],
    group: "EA Leads",
    components: {
      beforeList: ["@/components/admin/ea-leads/EaLeadsNav#EaLeadsNav"],
    },
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: "name", type: "text", required: true, label: "Nome do segmento" },
    { name: "description", type: "text", label: "Descrição" },
    {
      name: "source",
      type: "select",
      label: "Origem do lead",
      defaultValue: "any",
      options: [
        { label: "Qualquer origem", value: "any" },
        { label: "Diagnóstico de Maturidade", value: "diagnostic" },
        { label: "Newsletter", value: "newsletter" },
        { label: "Pop-up de captura", value: "popup" },
        { label: "Download de material", value: "download" },
        { label: "Contato", value: "contact" },
      ],
    },
    {
      name: "pillar",
      type: "select",
      label: "Pilar mais fraco (só leads do diagnóstico)",
      defaultValue: "any",
      options: [
        { label: "Qualquer pilar", value: "any" },
        { label: "Fluxo de Alta Performance", value: "Fluxo de Alta Performance" },
        { label: "Arquitetura do Crescimento", value: "Arquitetura do Crescimento" },
        { label: "Objetivos Estratégicos", value: "Objetivos Estratégicos" },
        { label: "Métricas de Sucesso", value: "Métricas de Sucesso" },
        { label: "Gestão de Desafios", value: "Gestão de Desafios" },
        { label: "Evolução Constante", value: "Evolução Constante" },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "scoreMin", type: "number", label: "Nota do diagnóstico: mínima (%)", min: 0, max: 100 },
        { name: "scoreMax", type: "number", label: "Nota do diagnóstico: máxima (%)", min: 0, max: 100 },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "createdFrom", type: "date", label: "Captado a partir de" },
        { name: "createdTo", type: "date", label: "Captado até" },
      ],
    },
    {
      name: "memberCount",
      type: "number",
      label: "Leads que receberiam agora",
      admin: {
        position: "sidebar",
        readOnly: true,
        description:
          "Contados na hora em que a tela abre: com e-mail válido, consentimento, sem descadastro e dentro dos filtros acima.",
      },
      hooks: {
        afterRead: [
          async ({ originalDoc, req }) => {
            try {
              return await countSegmentMembers(originalDoc || {}, req.payload);
            } catch {
              return originalDoc?.memberCount ?? 0;
            }
          },
        ],
      },
    },
  ],
};
