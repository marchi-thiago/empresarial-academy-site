import type { CollectionConfig, Field } from "payload";

const rollupFields: Field[] = [
  { name: "rollupWindowDays", type: "number", label: "Janela (dias)", defaultValue: 30 },
  { name: "rollupImpressions", type: "number", label: "Impressões", defaultValue: 0 },
  { name: "rollupClicks", type: "number", label: "Cliques", defaultValue: 0 },
  { name: "rollupCost", type: "number", label: "Custo (R$)", defaultValue: 0 },
  { name: "rollupConversions", type: "number", label: "Conversões", defaultValue: 0 },
  {
    name: "rollupUpdatedAt",
    type: "date",
    label: "Atualizado em",
    admin: { readOnly: true },
  },
];

/**
 * Palavra-chave dentro de um grupo de anúncios. `status` é decidido pelo
 * Thiago (nunca escrito automaticamente) — o motor de recomendação
 * (src/lib/ads-insights.ts) só sugere, ex. "candidata a negativa".
 */
export const AdKeywords: CollectionConfig = {
  slug: "ad-keywords",
  labels: { singular: "Palavra-chave de Ads", plural: "Palavras-chave de Ads" },
  admin: {
    useAsTitle: "text",
    defaultColumns: ["text", "matchType", "adGroup", "status", "rollupCost"],
        group: "Tráfego & Ads",
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "campaign",
      type: "relationship",
      relationTo: "ad-campaigns",
      label: "Campanha",
    },
    {
      name: "adGroup",
      type: "relationship",
      relationTo: "ad-groups",
      required: false,
      label: "Grupo de anúncios",
    },
    { name: "text", type: "text", required: true, label: "Palavra-chave" },
    {
      name: "isNegative",
      type: "checkbox",
      defaultValue: false,
      label: "Palavra negativada?",
      admin: { position: "sidebar" },
    },
    {
      name: "negativeLevel",
      type: "select",
      label: "Nível da negativação",
      defaultValue: "ad_group",
      admin: {
        position: "sidebar",
        condition: (data) => Boolean(data?.isNegative),
      },
      options: [
        { label: "Grupo de anúncios", value: "ad_group" },
        { label: "Campanha", value: "campaign" },
      ],
    },
    {
      name: "matchType",
      type: "select",
      label: "Correspondência",
      required: true,
      defaultValue: "frase",
      options: [
        { label: "Frase", value: "frase" },
        { label: "Exata", value: "exata" },
        { label: "Ampla", value: "ampla" },
      ],
    },
    {
      name: "status",
      type: "select",
      label: "Status",
      defaultValue: "ativa",
      admin: { position: "sidebar" },
      options: [
        { label: "Ativa", value: "ativa" },
        { label: "Pausada", value: "pausada" },
        { label: "Candidata a negativa", value: "candidata-negativa" },
      ],
    },
    {
      type: "collapsible",
      label: "Métricas (acumulado)",
      fields: rollupFields,
    },
    // ——— Dados do Planejador de Palavras-chave (Google) ———
    // Volume/lances/concorrência ANTES de a campanha existir — base do
    // forecast pré-investimento. Alimentado pelo seed-ads-recon ou à mão.
    {
      type: "collapsible",
      label: "Planejador do Google (pré-investimento)",
      fields: [
        {
          type: "row",
          fields: [
            { name: "plannerVolume", type: "text", label: "Pesquisas/mês (faixa)" },
            {
              name: "plannerCompetition",
              type: "select",
              label: "Concorrência",
              defaultValue: "sem_dados",
              options: [
                { label: "Sem dados (volume ~zero)", value: "sem_dados" },
                { label: "Baixa", value: "baixa" },
                { label: "Média", value: "media" },
                { label: "Alta", value: "alta" },
              ],
            },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "plannerTopBidLow", type: "number", label: "Lance topo — mín (R$)" },
            { name: "plannerTopBidHigh", type: "number", label: "Lance topo — máx (R$)" },
            { name: "plannerYoY", type: "text", label: "Variação YoY" },
          ],
        },
        { name: "plannerCapturedAt", type: "date", label: "Capturado em" },
      ],
    },
  ],
};
