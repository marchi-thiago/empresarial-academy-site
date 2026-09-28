import type { CollectionConfig } from "payload";

/**
 * Textos editáveis das jornadas automáticas de nutrição (EA Leads). Um modelo
 * por tema de material (`tema:<slug da categoria>`) e por pilar do diagnóstico
 * (`pilar:<nome do pilar>`). Lido por src/lib/nurture-emails.ts: campo vazio
 * volta pro texto padrão do código, então apagar um modelo nunca quebra envio.
 */
export const EmailTemplates: CollectionConfig = {
  slug: "email-templates",
  labels: { singular: "Modelo de e-mail", plural: "Modelos de e-mail" },
  admin: {
    useAsTitle: "nome",
    defaultColumns: ["nome", "jornada", "updatedAt"],
    group: "EA Leads",
    description:
      "Textos das jornadas automáticas de nutrição. Campo vazio usa o texto padrão. Listas: um item por linha.",
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
    { name: "nome", type: "text", required: true, label: "Nome" },
    {
      name: "chave",
      type: "text",
      required: true,
      unique: true,
      index: true,
      label: "Chave",
      admin: {
        position: "sidebar",
        description:
          "Como o sistema acha este modelo: tema:<slug da categoria do material> (ex.: tema:vendas) ou pilar:<nome do pilar>. Não altere num modelo existente.",
      },
    },
    { name: "jornada", type: "text", label: "Jornada", admin: { position: "sidebar", readOnly: true } },
    {
      name: "tema",
      type: "text",
      label: "Tema (como aparece no texto, minúsculo)",
      admin: { condition: (data) => String(data?.chave ?? "").startsWith("tema:") },
    },
    { name: "assuntoPrimeiro", type: "text", label: "Assunto do E1 (D+2)" },
    { name: "assuntoSegundo", type: "text", label: "Assunto do E2 (D+5)" },
    {
      name: "sinais",
      type: "textarea",
      label: "E1: sinais / custo do problema (um por linha)",
    },
    { name: "acoes", type: "textarea", label: "E1: ações para começar esta semana (uma por linha)" },
    { name: "metodo", type: "textarea", label: "E2: como o Gestão 360 trabalha" },
    {
      name: "previa",
      type: "ui",
      admin: {
        components: { Field: "@/components/admin/ea-leads/TemplatePreviewField#TemplatePreviewField" },
      },
    },
  ],
};
