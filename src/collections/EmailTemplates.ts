import type { CollectionConfig } from "payload";

const ehArea = (data: unknown) => String((data as { chave?: string } | null)?.chave ?? "").startsWith("area:");
const DICA_TEXTO = "Escreva {{nome}} onde entra o primeiro nome do lead. Linha em branco separa parágrafos. Link colado vira clicável.";

/**
 * Textos editáveis das jornadas automáticas de nutrição (EA Leads). Um modelo
 * por tema de material (`tema:<slug da categoria>`), por pilar do diagnóstico
 * (`pilar:<nome do pilar>`) e por área de atuação do lead do EA Hunter
 * (`area:<segmento>`, `area:generico` de reserva). Lido por src/lib/nurture-emails.ts: campo vazio
 * volta pro texto padrão do código, então apagar um modelo nunca quebra envio.
 * Collapsibles sem `name`: só organizam a tela, as colunas do banco não mudam.
 */
export const EmailTemplates: CollectionConfig = {
  slug: "email-templates",
  labels: { singular: "Modelo de e-mail", plural: "Modelos de e-mail" },
  admin: {
    useAsTitle: "nome",
    defaultColumns: ["nome", "jornada", "ativo", "updatedAt"],
    listSearchableFields: ["nome", "chave"],
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
    { name: "jornada", type: "text", label: "Jornada", admin: { position: "sidebar", readOnly: true } },
    {
      name: "ativo",
      type: "checkbox",
      label: "Envio ligado",
      defaultValue: false,
      admin: {
        position: "sidebar",
        condition: (data) => ehArea(data),
        description:
          "Jornada do EA Hunter: só envia com isto marcado. O lead do Hunter não deu consentimento, então ligar é uma decisão de base legal (LGPD).",
      },
    },
    {
      name: "chave",
      type: "text",
      required: true,
      unique: true,
      index: true,
      label: "Código interno",
      admin: {
        position: "sidebar",
        description:
          "É por aqui que o sistema acha o modelo (ex.: tema:vendas, pilar:Métricas de Sucesso, area:Indústria e distribuição). Não altere num modelo existente.",
      },
    },
    { name: "nome", type: "text", required: true, label: "Nome do modelo" },
    {
      name: "tema",
      type: "text",
      label: "Tema, como aparece no texto",
      admin: {
        condition: (data) => String(data?.chave ?? "").startsWith("tema:"),
        description: "Em minúsculas, com acento: gestão, vendas, liderança.",
      },
    },
    {
      type: "collapsible",
      label: "1º e-mail",
      fields: [
        { name: "assuntoPrimeiro", type: "text", label: "Assunto" },
        {
          name: "corpoPrimeiro",
          type: "textarea",
          label: "Texto",
          admin: { condition: (data) => ehArea(data), rows: 12, description: DICA_TEXTO },
        },
        {
          name: "sinais",
          type: "textarea",
          label: "Sinais do problema (um por linha)",
          admin: { condition: (data) => !ehArea(data), rows: 4 },
        },
        {
          name: "acoes",
          type: "textarea",
          label: "O que fazer já nesta semana (uma ação por linha)",
          admin: { condition: (data) => !ehArea(data), rows: 4 },
        },
      ],
    },
    {
      type: "collapsible",
      label: "2º e-mail",
      fields: [
        { name: "assuntoSegundo", type: "text", label: "Assunto" },
        {
          name: "corpoSegundo",
          type: "textarea",
          label: "Texto",
          admin: { condition: (data) => ehArea(data), rows: 12, description: DICA_TEXTO },
        },
        {
          name: "metodo",
          type: "textarea",
          label: "Como o Gestão 360 trabalha isso",
          admin: { condition: (data) => !ehArea(data), rows: 5 },
        },
      ],
    },
    {
      type: "collapsible",
      label: "3º e-mail",
      admin: { condition: (data) => ehArea(data) },
      fields: [
        { name: "assuntoTerceiro", type: "text", label: "Assunto" },
        { name: "corpoTerceiro", type: "textarea", label: "Texto", admin: { rows: 12, description: DICA_TEXTO } },
      ],
    },
    {
      name: "previa",
      type: "ui",
      admin: {
        components: { Field: "@/components/admin/ea-leads/TemplatePreviewField#TemplatePreviewField" },
      },
    },
  ],
};
