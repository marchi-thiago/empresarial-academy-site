import type { CollectionConfig } from "payload";
import { attributeLeadToAds } from "@/lib/ads-attribution";
import { generateDiagnosticId } from "@/lib/diagnostic-id";

/**
 * Leads captados pelo site (newsletter, pop-up, download de materiais,
 * diagnóstico) e pelo EA Hunter. Gravados além do e-mail enviado ao time: servem de
 * histórico/backup e permitem exportar a base pelo admin.
 */
export const Leads: CollectionConfig = {
  slug: "leads",
  labels: { singular: "Lead", plural: "Base de leads" },
  defaultSort: "-createdAt",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "company", "areaAtuacao", "whatsapp", "instagram", "email", "fonteCaptacao", "createdAt"],
    group: "EA Leads",
    listSearchableFields: ["name", "email", "company", "instagram", "whatsapp", "areaAtuacao", "fonteCaptacao"],
    components: {
      beforeList: ["@/components/admin/ea-leads/EaLeadsNav#EaLeadsNav"],
    },
  },
  access: {
    // Leitura/gestão só para usuários do admin. A captação pelo site cria via
    // Local API (servidor); o Thiago também pode adicionar/remover leads à mão.
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    // Resumo fixo na lateral: o que se olha primeiro em qualquer lead.
    { name: "source", type: "text", required: true, label: "Origem", admin: { position: "sidebar" } },
    {
      name: "dealStatus",
      type: "select",
      label: "Status do negócio",
      defaultValue: "em_andamento",
      admin: { position: "sidebar" },
      options: [
        { label: "Em andamento", value: "em_andamento" },
        { label: "Ganho", value: "ganho" },
        { label: "Perdido", value: "perdido" },
      ],
    },
    {
      name: "consent",
      type: "checkbox",
      label: "Deu consentimento (LGPD)",
      admin: {
        position: "sidebar",
        description: "Marcado quando a pessoa aceitou receber contatos num formulário do site. Lead do EA Hunter entra sem.",
      },
    },
    {
      // Abas sem `name`: só organizam a tela, não mudam nenhuma coluna do banco.
      type: "tabs",
      tabs: [
        {
          label: "Contato",
          fields: [
            {
              type: "row",
              fields: [
                { name: "name", type: "text", required: true, label: "Nome" },
                { name: "company", type: "text", label: "Empresa" },
              ],
            },
            {
              type: "row",
              fields: [
                // Opcional: lead do EA Hunter (Instagram) muitas vezes só tem WhatsApp e @.
                { name: "email", type: "email", label: "E-mail" },
                {
                  name: "whatsapp",
                  type: "text",
                  label: "WhatsApp",
                  admin: {
                    description: "Número com DDD. Na lista vira link para conversar.",
                    components: { Cell: "@/components/admin/leads/WhatsAppCell#WhatsAppCell" },
                  },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "instagram",
                  type: "text",
                  label: "Instagram",
                  admin: { components: { Cell: "@/components/admin/leads/InstagramCell#InstagramCell" } },
                },
                { name: "site", type: "text", label: "Site" },
              ],
            },
            {
              name: "notes",
              type: "textarea",
              label: "Observações",
              admin: { description: "Suas anotações sobre o lead: contexto, conversa, próximo passo." },
            },
          ],
        },
        {
          label: "Captação",
          description: "De onde o lead veio e o que interessa a ele.",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "areaAtuacao",
                  type: "text",
                  label: "Área de atuação",
                  admin: { description: "Segmento da empresa. Define a nutrição por área." },
                },
                {
                  name: "fonteCaptacao",
                  type: "text",
                  label: "Fonte da captação",
                  admin: { description: "Onde o EA Hunter achou: hashtag, seguidores ou comentários de um perfil." },
                },
              ],
            },
            {
              name: "interestCategory",
              type: "text",
              label: "Tema de interesse (material baixado)",
              admin: { description: "Categoria do material que a pessoa baixou no site (ex.: gestao). Define a nutrição por tema." },
            },
            {
              type: "row",
              fields: [
                { name: "hunterId", type: "number", label: "Número no EA Hunter", unique: true, admin: { readOnly: true } },
                { name: "prospectadoEm", type: "date", label: "Primeira DM pelo EA Hunter", admin: { readOnly: true } },
              ],
            },
            {
              type: "collapsible",
              label: "Anúncio que trouxe o lead (Google Ads)",
              admin: { initCollapsed: true },
              fields: [
                {
                  name: "adCampaign",
                  type: "relationship",
                  relationTo: "ad-campaigns",
                  label: "Campanha",
                  admin: { description: "Preenchido sozinho pelo clique no anúncio. Pode corrigir à mão." },
                },
                { name: "adGroup", type: "relationship", relationTo: "ad-groups", label: "Grupo de anúncios" },
                { name: "adKeyword", type: "relationship", relationTo: "ad-keywords", label: "Palavra-chave" },
                { name: "adGclid", type: "text", label: "Código do clique (gclid)", admin: { readOnly: true } },
              ],
            },
          ],
        },
        {
          label: "E-mails e nutrição",
          description: "O que este lead já recebeu e o que ele aceita receber.",
          fields: [
            {
              name: "emailHistory",
              type: "ui",
              admin: { components: { Field: "@/components/admin/ea-leads/LeadEmailHistoryField#LeadEmailHistoryField" } },
            },
            {
              type: "row",
              fields: [
                { name: "wantsNewsletter", type: "checkbox", label: "Aceita newsletter", defaultValue: false },
                { name: "wantsPromotions", type: "checkbox", label: "Aceita ofertas", defaultValue: false },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "nurtureOptOut",
                  type: "checkbox",
                  label: "Parar a nutrição automática",
                  defaultValue: false,
                  admin: {
                    description: "Marque quando agendar a conversa, virar cliente ou pedir para sair. O link de descadastro marca sozinho.",
                  },
                },
                {
                  name: "marketingOptOut",
                  type: "checkbox",
                  label: "Não enviar campanhas",
                  defaultValue: false,
                  admin: { description: "Marcado pelo link \"Sair da lista\" das campanhas manuais." },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "nurtureStage",
                  type: "number",
                  label: "E-mails da nutrição já enviados",
                  defaultValue: 0,
                  admin: { description: "De 0 a 3. Com 3, a sequência terminou." },
                },
                { name: "nurtureLastAt", type: "date", label: "Último e-mail da nutrição" },
              ],
            },
          ],
        },
        {
          label: "Diagnóstico",
          description: "Resultado do Diagnóstico de Maturidade, quando o lead fez.",
          fields: [
            {
              name: "diagnosticReport",
              type: "ui",
              label: "Relatório do Diagnóstico",
              admin: { components: { Field: "@/components/admin/leads/DiagnosticAnalysisField#DiagnosticAnalysisField" } },
            },
            {
              type: "row",
              fields: [
                {
                  name: "diagnosticId",
                  type: "text",
                  label: "Código do diagnóstico",
                  admin: {
                    readOnly: true,
                    description: "Ex.: EA-DIAG-2026-X8K2M",
                    components: { Cell: "@/components/admin/leads/DiagnosticBadgeCell#DiagnosticBadgeCell" },
                  },
                },
                { name: "hasDiagnostic", type: "checkbox", label: "Fez o Diagnóstico", defaultValue: false },
              ],
            },
            { name: "details", type: "json", label: "Dados completos (respostas do diagnóstico e dados do EA Hunter)" },
          ],
        },
        {
          label: "Negócio",
          description: "Resultado comercial com este lead.",
          fields: [
            {
              name: "dealPackage",
              type: "select",
              label: "Pacote",
              defaultValue: "nenhum",
              options: [
                { label: "Nenhum", value: "nenhum" },
                { label: "Essencial (recorrente)", value: "essencial" },
                { label: "Implementação (projeto)", value: "implementacao" },
                { label: "Outro", value: "outro" },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "dealValue",
                  type: "number",
                  label: "Valor fechado (R$)",
                  admin: { description: "Opcional. Substitui o valor padrão do pacote." },
                },
                { name: "dealMonths", type: "number", label: "Meses de contrato (Essencial)", defaultValue: 3 },
                { name: "dealClosedAt", type: "date", label: "Fechado em" },
              ],
            },
            { name: "dealNotes", type: "textarea", label: "Notas comerciais" },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        const isDiag = Boolean(
          data.hasDiagnostic ||
          data.diagnosticId ||
          (typeof data.source === "string" && data.source.includes("Diagnóstico")) ||
          (data.details && Boolean(data.details["Maturidade Geral"]))
        );

        if (isDiag) {
          data.hasDiagnostic = true;
          if (!data.diagnosticId) {
            data.diagnosticId = generateDiagnosticId();
          }
        }

        if (operation !== "create") return data;
        try {
          const attribution = await attributeLeadToAds(data.details, req.payload);
          if (attribution.adCampaign) data.adCampaign = attribution.adCampaign;
          if (attribution.adGroup) data.adGroup = attribution.adGroup;
          if (attribution.adKeyword) data.adKeyword = attribution.adKeyword;
          if (attribution.adGclid) data.adGclid = attribution.adGclid;
        } catch (e) {
          req.payload.logger.error(`[leads] falha na atribuição de Ads: ${e}`);
        }
        return data;
      },
    ],
  },
};
