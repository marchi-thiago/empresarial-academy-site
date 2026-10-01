import path from "path";
import { fileURLToPath } from "url";
import { buildConfig, type Plugin } from "payload";
import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { s3Storage } from "@payloadcms/storage-s3";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { pt } from "@payloadcms/translations/languages/pt";
import sharp from "sharp";

import { Users } from "@/collections/Users";
import { Media } from "@/collections/Media";
import { Categories } from "@/collections/Categories";
import { Posts } from "@/collections/Posts";
import { Materials } from "@/collections/Materials";
import { MaterialCategories } from "@/collections/MaterialCategories";
import { MaterialFiles } from "@/collections/MaterialFiles";
import { Testimonials } from "@/collections/Testimonials";
import { Leads } from "@/collections/Leads";
import { Contracts } from "@/collections/Contracts";
import { ContractDocuments } from "@/collections/ContractDocuments";
import { resendEmailAdapter } from "@/lib/payload-email-adapter";
import { EmailLogs } from "@/collections/EmailLogs";
import { EmailSegments } from "@/collections/EmailSegments";
import { EmailCampaigns } from "@/collections/EmailCampaigns";
import { EmailTemplates } from "@/collections/EmailTemplates";
import { AdCampaigns } from "@/collections/AdCampaigns";
import { AdGroups } from "@/collections/AdGroups";
import { AdKeywords } from "@/collections/AdKeywords";
import { AdMetricsDaily } from "@/collections/AdMetricsDaily";
import { AdCompetitors } from "@/collections/AdCompetitors";
import { SystemLinks } from "@/collections/SystemLinks";
import { ApiInventory } from "@/collections/ApiInventory";
import { Interacoes } from "@/collections/Interacoes";
import { CrmConfig } from "@/globals/CrmConfig";
import { AdsSettings } from "@/globals/AdsSettings";
import { siteConfig } from "@/lib/site-config";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const databaseUri = process.env.DATABASE_URI || "file:./empresarial-academy.db";

// Dev usa SQLite (file:...); produção usa Postgres (postgres:// ou postgresql://).
const db = databaseUri.startsWith("postgres")
  ? postgresAdapter({ pool: { connectionString: databaseUri }, push: true })
  : sqliteAdapter({ client: { url: databaseUri } });

// Storage S3/R2 para uploads em produção (serverless tem filesystem efêmero).
// Ativa apenas quando as variáveis estiverem definidas; em dev continua no disco.
const plugins: Plugin[] = [];
if (process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID) {
  plugins.push(
    s3Storage({
      collections: {
        media: true,
        "material-files": true,
        "contract-documents": true,
      },
      bucket: process.env.S3_BUCKET,
      config: {
        endpoint: process.env.S3_ENDPOINT || undefined,
        region: process.env.S3_REGION || "auto",
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
        },
      },
    }),
  );
}

export default buildConfig({
  serverURL: databaseUri.startsWith("postgres") ? siteConfig.url : undefined,
  email: resendEmailAdapter,
  routes: {
    // Painel renomeado para "EA HUB" e servido em /eahub (a pasta
    // src/app/(payload)/eahub casa com esta rota; ver resolveImportMapFilePath).
    admin: "/eahub",
  },
  // Admin inteiro em português ("Criar novo", "Buscar", "Filtros"...), antes vinha em inglês.
  i18n: {
    supportedLanguages: { pt },
    fallbackLanguage: "pt",
  },
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: {
      titleSuffix: "— EA HUB",
      // Favicon da aba do navegador no EA HUB = logo oficial da Empresarial
      // Academy (substitui o ícone padrão do Payload).
      icons: [
        { rel: "icon", type: "image/png", url: "/logo-empresarial-academy.png" },
        { rel: "shortcut icon", type: "image/png", url: "/logo-empresarial-academy.png" },
        { rel: "apple-touch-icon", type: "image/png", url: "/logo-empresarial-academy.png" },
      ],
    },
    components: {
      afterNavLinks: [
        "@/components/admin/marketing/EaMarketingManagerNavLink#EaMarketingManagerNavLink",
        "@/components/admin/secretaria/SecretariaNavLink#SecretariaNavLink",
        "@/components/admin/contracts/ContractGeneratorNavLink#ContractGeneratorNavLink",
      ],
      graphics: {
        Logo: "@/components/admin/brand/EaLogo#EaLogo",
        Icon: "@/components/admin/brand/EaIcon#EaIcon",
      },
      views: {
        login: {
          Component: "@/components/admin/brand/SiteLoginView#SiteLoginView",
          path: "/login",
        },
        logout: {
          Component: "@/components/admin/brand/SiteLogoutView#SiteLogoutView",
          path: "/logout",
        },
        // Home do /eahub = EA Marketing Manager (a "entrada única" — definição do
        // Thiago). Como view `dashboard`, renderiza COM a nav lateral do Payload.
        // Unificado em 2026-07-23(b): antes havia um EaHubDashboard separado que
        // duplicava ~80% deste hub; removido, o Marketing Manager (mais completo:
        // e-mail, mídia, sistemas dinâmicos) virou a home.
        dashboard: {
          Component: "@/components/admin/marketing/EaMarketingManagerView#EaMarketingManagerView",
        },
        secretaria: {
          Component: "@/components/admin/secretaria/SecretariaVirtualView#SecretariaVirtualView",
          path: "/secretaria",
          meta: { title: "EA Assessor" },
        },
        // Rotas antigas do hub redirecionam para a home /eahub (preserva
        // favoritos para /marketing-manager e /central-ea).
        marketingManager: {
          Component: "@/components/admin/central/CentralEaRedirect#CentralEaRedirect",
          path: "/marketing-manager",
        },
        centralEaRedirect: {
          Component: "@/components/admin/central/CentralEaRedirect#CentralEaRedirect",
          path: "/central-ea",
        },
        adsPerformance: {
          Component: "@/components/admin/ads/AdsPerformanceView#AdsPerformanceView",
          path: "/ads-performance",
          meta: { title: "EA ADS Manager" },
        },
        contractGenerator: {
          Component: "@/components/admin/contracts/ContractGeneratorView#ContractGeneratorView",
          path: "/contratos/novo",
          meta: { title: "Gerador de Contratos" },
        },
        apiInventory: {
          Component: "@/components/admin/apis/ApiInventoryView#ApiInventoryView",
          path: "/apis",
          meta: { title: "Painel de APIs" },
        },
        // CRM do EA Leads (Plano Outbound, F4). exact: "/crm" não pode engolir "/crm/fila".
        crmKanban: {
          Component: "@/components/admin/crm/CrmKanbanView#CrmKanbanView",
          path: "/crm",
          exact: true,
          meta: { title: "Kanban" },
        },
        crmFila: {
          Component: "@/components/admin/crm/CrmFilaView#CrmFilaView",
          path: "/crm/fila",
          exact: true,
          meta: { title: "Fila do dia" },
        },
        crmLinkedin: {
          Component: "@/components/admin/crm/CrmLinkedinView#CrmLinkedinView",
          path: "/crm/linkedin",
          exact: true,
          meta: { title: "LinkedIn" },
        },
        crmPainel: {
          Component: "@/components/admin/crm/CrmPainelView#CrmPainelView",
          path: "/crm/painel",
          exact: true,
          meta: { title: "Painel do CRM" },
        },
        crmFicha: {
          Component: "@/components/admin/crm/CrmFichaView#CrmFichaView",
          path: "/crm/lead/:id",
          exact: true,
          meta: { title: "Ficha do cliente" },
        },
        tvDashboard: {
          Component: "@/components/admin/tv/TvDashboardView#TvDashboardView",
          path: "/tv",
          meta: { title: "Torre de Controle" },
        },
        commercialPresentation: {
          Component: "@/components/admin/presentation/CommercialPresentationView#CommercialPresentationView",
          path: "/apresentacao",
          meta: { title: "Apresentação Comercial DME" },
        },
      },
    },
  },
  collections: [
    Posts,
    Categories,
    Materials,
    MaterialCategories,
    MaterialFiles,
    Testimonials,
    Leads,
    Contracts,
    ContractDocuments,
    EmailSegments,
    EmailCampaigns,
    EmailTemplates,
    EmailLogs,
    Interacoes,
    AdCampaigns,
    AdGroups,
    AdKeywords,
    AdMetricsDaily,
    AdCompetitors,
    SystemLinks,
    ApiInventory,
    Media,
    Users,
  ],
  globals: [
    AdsSettings,
    CrmConfig,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  db,
  plugins,
  sharp,
});
