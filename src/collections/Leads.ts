import type { CollectionConfig } from "payload";
import { attributeLeadToAds } from "@/lib/ads-attribution";
import { generateDiagnosticId } from "@/lib/diagnostic-id";

/**
 * Leads captados pelo site (newsletter, pop-up, download de materiais,
 * diagnóstico). Gravados além do e-mail enviado ao time — servem de
 * histórico/backup e permitem exportar a base pelo admin.
 */
export const Leads: CollectionConfig = {
  slug: "leads",
  labels: { singular: "EA Lead", plural: "EA Leads" },
  defaultSort: "-createdAt",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "company", "areaAtuacao", "whatsapp", "instagram", "email", "source", "createdAt"],
    group: "EA Leads",
    description: "Base unificada de todos os leads e diagnósticos de maturidade empresarial captados por DME, WhatsApp, formulários, e-mail e demais canais.",
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
    {
      name: "diagnosticReport",
      type: "ui",
      label: "Relatório do Diagnóstico",
      admin: {
        components: {
          Field: "@/components/admin/leads/DiagnosticAnalysisField#DiagnosticAnalysisField",
        },
      },
    },
    {
      name: "emailHistory",
      type: "ui",
      admin: {
        components: { Field: "@/components/admin/ea-leads/LeadEmailHistoryField#LeadEmailHistoryField" },
      },
    },
    { name: "name", type: "text", required: true, label: "Nome" },
    // Opcional: lead captado pelo EA Hunter (Instagram) muitas vezes só tem WhatsApp/@.
    { name: "email", type: "email", label: "E-mail" },
    { name: "company", type: "text", label: "Empresa" },
    {
      name: "areaAtuacao",
      type: "text",
      label: "Área de atuação",
      admin: { description: "Segmento da empresa (vem do EA Hunter). Usado na nutrição por área de atuação." },
    },
    { name: "site", type: "text", label: "Site" },
    {
      name: "hunterId",
      type: "number",
      label: "ID no EA Hunter",
      unique: true,
      admin: { position: "sidebar", readOnly: true, description: "Preenchido pela sincronização do EA Hunter." },
    },
    {
      name: "prospectadoEm",
      type: "date",
      label: "Primeira DM (EA Hunter)",
      admin: { position: "sidebar", readOnly: true },
    },
    {
      name: "whatsapp",
      type: "text",
      label: "WhatsApp",
      admin: {
        description: "Número com DDD. Na lista vira link para conversar no WhatsApp.",
        components: {
          Cell: "@/components/admin/leads/WhatsAppCell#WhatsAppCell",
        },
      },
    },
    {
      name: "instagram",
      type: "text",
      label: "Instagram",
      admin: {
        description: "@ do Instagram do contato.",
        components: {
          Cell: "@/components/admin/leads/InstagramCell#InstagramCell",
        },
      },
    },
    // ——— Identificação e status do Diagnóstico ———
    {
      name: "diagnosticId",
      type: "text",
      label: "ID do Diagnóstico",
      admin: {
        position: "sidebar",
        readOnly: true,
        description: "Código único de identificação do diagnóstico (ex.: EA-DIAG-2026-X8K2M).",
        components: {
          Cell: "@/components/admin/leads/DiagnosticBadgeCell#DiagnosticBadgeCell",
        },
      },
    },
    {
      name: "hasDiagnostic",
      type: "checkbox",
      label: "Fez Diagnóstico de Maturidade",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Marcado quando o lead iniciou ou respondeu às perguntas de maturidade empresarial.",
      },
    },
    // ——— Preferências de contato (flags) ———
    {
      name: "wantsNewsletter",
      type: "checkbox",
      label: "Quer newsletter",
      defaultValue: false,
      admin: { description: "Aceita receber a newsletter/novos conteúdos." },
    },
    {
      name: "wantsPromotions",
      type: "checkbox",
      label: "Quer promoções",
      defaultValue: false,
      admin: { description: "Aceita receber ofertas e campanhas promocionais." },
    },
    {
      name: "notes",
      type: "textarea",
      label: "Observações",
      admin: { description: "Anotações internas sobre o lead (contexto, histórico, próximos passos)." },
    },
    {
      name: "source",
      type: "text",
      required: true,
      label: "Origem",
      admin: { position: "sidebar" },
    },
    {
      name: "interestCategory",
      type: "text",
      label: "Tema de interesse",
      admin: {
        position: "sidebar",
        description:
          "Slug da categoria do material baixado (ex.: financeiro) — mesmo valor de material-categories.slug. Usado pra segmentar a jornada de nutrição por tema e os alertas de conteúdo novo. Vazio quando a origem não é download de material.",
      },
    },
    {
      name: "details",
      type: "json",
      label: "Dados brutos do diagnóstico / extras",
    },
    {
      name: "consent",
      type: "checkbox",
      label: "Consentimento LGPD",
      admin: { position: "sidebar" },
    },
    // ——— Nutrição pós-diagnóstico (sequência automática de e-mails) ———
    {
      name: "nurtureStage",
      type: "number",
      label: "Nutrição — etapa enviada",
      defaultValue: 0,
      admin: {
        position: "sidebar",
        description:
          "0 = só o e-mail de resultado · 1–3 = e-mails da sequência já enviados (D+2, D+5, D+7).",
      },
    },
    {
      name: "nurtureOptOut",
      type: "checkbox",
      label: "Nutrição — NÃO enviar follow-ups",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description:
          "Marque quando o lead agendar a call, virar cliente ou pedir para não receber. O link de descadastro dos e-mails também marca isto.",
      },
    },
    {
      name: "nurtureLastAt",
      type: "date",
      label: "Nutrição — último envio",
      admin: { position: "sidebar" },
    },
    // ——— Campanhas manuais (newsletter/mailmarketing) ———
    {
      name: "marketingOptOut",
      type: "checkbox",
      label: "Marketing — NÃO enviar campanhas",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description:
          "Descadastro do link 'Sair da lista' das campanhas manuais. Independente da nutrição pós-diagnóstico (nurtureOptOut).",
      },
    },
    // ——— Atribuição de campanha (Google Ads) ———
    {
      type: "collapsible",
      label: "Atribuição de campanha (Ads)",
      admin: { position: "sidebar" },
      fields: [
        {
          name: "adCampaign",
          type: "relationship",
          relationTo: "ad-campaigns",
          label: "Campanha",
          admin: {
            description: "Preenchido automaticamente por gclid/utm_campaign — pode ser corrigido à mão.",
          },
        },
        { name: "adGroup", type: "relationship", relationTo: "ad-groups", label: "Grupo de anúncios" },
        { name: "adKeyword", type: "relationship", relationTo: "ad-keywords", label: "Palavra-chave" },
        {
          name: "adGclid",
          type: "text",
          label: "gclid (bruto)",
          admin: { readOnly: true },
        },
      ],
    },
    // ——— Resultado comercial (CRM manual — RD Station CRM) ———
    {
      type: "collapsible",
      label: "Resultado comercial (CRM)",
      admin: { position: "sidebar" },
      fields: [
        {
          name: "dealStatus",
          type: "select",
          label: "Status do negócio",
          defaultValue: "em_andamento",
          options: [
            { label: "Em andamento", value: "em_andamento" },
            { label: "Ganho", value: "ganho" },
            { label: "Perdido", value: "perdido" },
          ],
        },
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
          name: "dealValue",
          type: "number",
          label: "Valor fechado (R$, opcional)",
          admin: { description: "Sobrepõe o valor padrão do pacote quando preenchido." },
        },
        {
          name: "dealMonths",
          type: "number",
          label: "Meses de contrato (Essencial)",
          defaultValue: 3,
        },
        { name: "dealClosedAt", type: "date", label: "Fechado em" },
        { name: "dealNotes", type: "textarea", label: "Notas comerciais" },
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
