import type { CollectionConfig } from "payload";
import { attributeLeadToAds } from "@/lib/ads-attribution";
import { generateDiagnosticId } from "@/lib/diagnostic-id";
import { randomBytes } from "crypto";
import {
  BASES_LEGAIS,
  CANAIS_ENTREGA,
  ESTADOS_ENTREGA,
  ETAPAS,
  ETAPA_ROTULO,
  MOTIVOS_RESULTADO,
  ROTULO_ESTADO,
  TEMPERATURAS,
} from "@/lib/crm/tipos";

const canaisDoPlano = [
  { label: "DM do Instagram", value: "dm" },
  { label: "E-mail", value: "email" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Ligação", value: "ligacao" },
  { label: "LinkedIn", value: "linkedin" },
];

const opcoesEntrega = (canal: (typeof CANAIS_ENTREGA)[number]) =>
  ESTADOS_ENTREGA[canal].map((value) => ({ label: ROTULO_ESTADO[value] ?? value, value }));

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
      label: "Etapa da jornada",
      defaultValue: "em_andamento",
      admin: {
        position: "sidebar",
        description: "Coluna do Kanban. Em andamento e Perdido são valores antigos: valem como Qualificado e Nutrição contínua.",
      },
      options: [
        // Valores que já existem em dados reais: mantidos, nunca apagados. "ganho" vem de ETAPAS.
        { label: "Em andamento (antigo, conta como Qualificado)", value: "em_andamento" },
        { label: "Perdido (antigo, conta como Nutrição contínua)", value: "perdido" },
        ...ETAPAS.map((value) => ({ label: ETAPA_ROTULO[value], value })),
      ],
    },
    {
      name: "temperatura",
      type: "select",
      label: "Temperatura",
      admin: { position: "sidebar", readOnly: true, description: "Calculada pelos pontos de engajamento dos últimos 7 dias." },
      options: TEMPERATURAS.map((value) => ({ label: value.charAt(0).toUpperCase() + value.slice(1), value })),
    },
    {
      name: "pontosEngajamento",
      type: "number",
      label: "Pontos de engajamento (7 dias)",
      admin: { position: "sidebar", readOnly: true },
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
          label: "CRM",
          description: "Cadência e entrega por canal. O sistema preenche sozinho pelos eventos; dá para corrigir à mão.",
          fields: [
            {
              name: "cadencia",
              type: "group",
              label: "Cadência",
              fields: [
                { name: "etapaAtual", type: "text", label: "Etapa atual (toque)", admin: { description: "Ex.: d0_dm1, d1_email1." } },
                {
                  type: "row",
                  fields: [
                    { name: "proximoToqueEm", type: "date", label: "Próximo toque em" },
                    { name: "proximoCanal", type: "select", label: "Canal do próximo toque", options: canaisDoPlano },
                  ],
                },
                {
                  type: "row",
                  fields: [
                    { name: "pausada", type: "checkbox", label: "Cadência pausada", defaultValue: false },
                    { name: "motivoPausa", type: "text", label: "Motivo da pausa" },
                  ],
                },
                {
                  name: "canaisEncerrados",
                  type: "json",
                  label: "Canais encerrados (falha definitiva)",
                  admin: { description: "Canais que saíram da cadência deste lead: número sem WhatsApp, bounce permanente, DM sem botão." },
                },
                {
                  name: "movidoManualEm",
                  type: "date",
                  label: "Último arraste manual",
                  admin: { readOnly: true, description: "Com arraste manual, o sistema só o supera com fato novo (resposta, reunião, descadastro)." },
                },
              ],
            },
            {
              name: "statusEntrega",
              type: "group",
              label: "Status de entrega por canal",
              fields: [
                {
                  type: "row",
                  fields: CANAIS_ENTREGA.map((canal) => ({
                    name: canal,
                    type: "select" as const,
                    label: { email: "E-mail", whatsapp: "WhatsApp", dm: "DM", linkedin: "LinkedIn" }[canal],
                    options: opcoesEntrega(canal),
                  })),
                },
              ],
            },
            {
              name: "origem",
              type: "group",
              label: "Origem (qual toque gerou o quê)",
              fields: [
                {
                  type: "row",
                  fields: [
                    { name: "primeiroToqueCanal", type: "select", label: "Primeiro toque: canal", options: canaisDoPlano },
                    { name: "primeiroToqueEm", type: "date", label: "Primeiro toque: data" },
                  ],
                },
                {
                  type: "row",
                  fields: [
                    { name: "ultimoToqueCanal", type: "text", label: "Último toque: canal" },
                    { name: "ultimoToqueRotulo", type: "text", label: "Último toque: qual (ex.: email1)" },
                  ],
                },
                {
                  type: "row",
                  fields: [
                    { name: "reuniaoCanal", type: "select", label: "Toque que gerou a reunião: canal", options: canaisDoPlano },
                    { name: "reuniaoToque", type: "text", label: "Toque que gerou a reunião: qual" },
                  ],
                },
                {
                  type: "row",
                  fields: [
                    { name: "vendaCanal", type: "select", label: "Toque que gerou a venda: canal", options: canaisDoPlano },
                    { name: "vendaToque", type: "text", label: "Toque que gerou a venda: qual" },
                  ],
                },
              ],
            },
            {
              type: "row",
              fields: [
                { name: "proximoPasso", type: "text", label: "Próximo passo" },
                { name: "proximoPassoEm", type: "date", label: "Próximo passo em" },
              ],
            },
            {
              name: "motivoResultado",
              type: "group",
              label: "Motivo do resultado (ganho ou nutrição depois de reunião)",
              fields: [
                {
                  type: "row",
                  fields: [
                    { name: "motivo", type: "select", label: "Motivo", options: [...MOTIVOS_RESULTADO] },
                    { name: "detalhe", type: "text", label: "Detalhe" },
                  ],
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "baseLegal",
                  type: "select",
                  label: "Base legal (LGPD)",
                  options: [...BASES_LEGAIS],
                  admin: { description: "Lead do EA Hunter: legítimo interesse B2B (docs/outbound/LGPD.md)." },
                },
                {
                  name: "tokenConversa",
                  type: "text",
                  label: "Token da página /conversa",
                  unique: true,
                  admin: { readOnly: true, description: "Identifica o lead no link ?t= sem expor o número dele." },
                },
              ],
            },
            {
              name: "dossie",
              type: "json",
              label: "Dossiê (gerado pela IA do EA Hunter)",
              admin: { description: "Decisor, empresa, dor provável, gancho, prova escolhida, tom, perfil." },
            },
            { name: "kit", type: "json", label: "Kit de mensagens (DMs, e-mails, WhatsApp, ligação, LinkedIn)" },
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

        if (operation === "create") {
          if (!data.tokenConversa) data.tokenConversa = randomBytes(18).toString("base64url");
          if (!data.baseLegal) {
            const doHunter = data.hunterId != null || (typeof data.source === "string" && data.source.includes("EA Hunter"));
            if (doHunter) data.baseLegal = "legitimo_interesse";
            else if (data.consent) data.baseLegal = "consentimento";
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
