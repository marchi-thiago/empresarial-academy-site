import type { AdminViewServerProps } from "payload";
import { redirect } from "next/navigation";
import {
  computeCampaignScorecard,
  ADS_AUTO_SYNC_STALE_MINUTES,
  type AttributedDeal,
  type CampaignScorecard,
  type CompetitorRow,
  type DailyMetric,
  type DealPackage,
  type DealStatus,
} from "@/lib/ads-insights";
import { AdsMatrix, type CampaignControlMeta } from "./AdsMatrix";
import { AdsCampaignDetail } from "./AdsCampaignDetail";
import { AdsForecastPanel } from "./AdsForecastPanel";
import { AdsCompetitorsPanel } from "./AdsCompetitorsPanel";
import { AdsBudgetCard, type AdsBudgetInfo } from "./AdsBudgetCard";
import { SyncAdsButton, AdsAutoSync } from "./AdsClientActions";
import { EaHubBackLink } from "@/components/admin/brand/EaHubBackLink";
import { getSaoPauloDateISO } from "@/lib/google-ads";

type CampaignDoc = {
  id: string | number;
  name: string;
  status: string;
  googleAdsCampaignId?: string | null;
  dailyBudgetTarget: number;
  monthlyBudgetTarget: number;
  cpcCeiling: number;
  forecastClicks?: number | null;
  forecastImpressions?: number | null;
  forecastCost?: number | null;
  forecastCtr?: number | null;
  forecastAvgCpc?: number | null;
  forecastDailyBudget?: number | null;
  forecastCapturedAt?: string | null;
  forecastNotes?: string | null;
};

type DailyMetricDoc = {
  id: string | number;
  campaign: string | number;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
};

type AdGroupDoc = {
  id: string | number;
  campaign: string | number;
  name: string;
  status: string;
  rollupImpressions: number;
  rollupClicks: number;
  rollupCost: number;
  rollupConversions: number;
};

type KeywordDoc = {
  id: string | number;
  campaign?: string | number | null;
  adGroup?: string | number | null;
  text: string;
  isNegative?: boolean;
  negativeLevel?: "ad_group" | "campaign" | null;
  matchType: string;
  status: string;
  rollupImpressions: number;
  rollupClicks: number;
  rollupCost: number;
  rollupConversions: number;
  plannerCompetition?: string | null;
};

type LeadDealDoc = {
  id: string | number;
  adCampaign: string | number | null;
  dealStatus: DealStatus | null;
  dealPackage: DealPackage | null;
  dealValue: number | null;
  dealMonths: number | null;
};

/**
 * View custom registrada em payload.config.ts → admin.components.views.
 * Server Component: recebe `payload`/`searchParams` como props diretas (sem
 * round-trip por API pública — é uma tela só de admin). Views custom NÃO são
 * protegidas pelo redirecionamento de login padrão do Payload (confirmado em
 * @payloadcms/next/dist/views/Root/index.js — `isCustomAdminView` isenta a
 * rota da checagem); e o usuário logado também não vem como prop `user` de
 * nível superior (só `DefaultTemplate` recebe isso) — por isso o guard usa
 * `initPageResult.req.user` diretamente.
 */
export async function AdsPerformanceView({ payload, searchParams, initPageResult }: AdminViewServerProps) {
  const user = initPageResult?.req?.user;
  if (!user) {
    redirect("/eahub/login?redirect=%2Feahub%2Fads-performance");
  }

  const { docs: campaignDocs } = await payload.find({
    collection: "ad-campaigns",
    limit: 50,
    depth: 0,
    sort: "name",
  });
  const campaigns = campaignDocs as unknown as CampaignDoc[];

  const adsSettings = (await payload.findGlobal({ slug: "ads-settings" })) as unknown as {
    refreshToken?: string;
    lastSync?: string | null;
    budgetStatus?: "com_limite" | "sem_limite" | "indisponivel" | null;
    budgetApprovedLimit?: number | null;
    budgetSpent?: number | null;
    budgetRemaining?: number | null;
    budgetSyncedAt?: string | null;
  };
  const isConnected = Boolean(adsSettings?.refreshToken);
  const oauthSuccess = searchParams?.oauth === "success";

  // Convenience pedida pelo Thiago: sem sincronizar há mais de
  // ADS_AUTO_SYNC_STALE_MINUTES, o painel sincroniza sozinho ao abrir
  // (ver AdsAutoSync) — cobre tanto a 1ª configuração (sem campanha ainda)
  // quanto o uso do dia a dia.
  const isStale =
    !adsSettings.lastSync ||
    Date.now() - new Date(adsSettings.lastSync).getTime() > ADS_AUTO_SYNC_STALE_MINUTES * 60 * 1000;

  if (campaigns.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <EaHubBackLink />
        <h1>EA ADS Manager</h1>
        <AdsAutoSync isStale={isStale} isConnected={isConnected} />
        {oauthSuccess && (
          <div style={{ padding: 12, backgroundColor: "#e6f4ea", color: "#137333", marginBottom: 16, borderRadius: 4 }}>
            Google Ads conectado com sucesso!
          </div>
        )}
        <div style={{ padding: 16, backgroundColor: "#fef7e0", color: "#b06000", marginBottom: 24, borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>
            {isConnected
              ? "Se o Sincronizar der erro de autenticação (ex.: invalid_grant), reconecte o Google Ads abaixo."
              : "O EA ADS precisa de acesso à sua conta do Google Ads para puxar os dados reais e analisar a performance."}
          </span>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/ads/oauth" style={{ padding: "8px 16px", backgroundColor: "#1a73e8", color: "#fff", textDecoration: "none", borderRadius: 4, fontWeight: "bold" }}>
            {isConnected ? "Reconectar Google Ads" : "Conectar Google Ads"}
          </a>
        </div>
        <p>
          Nenhuma campanha cadastrada ainda. Crie uma em &quot;Marketing → Campanhas de Ads&quot;
          (ou conecte seu Google Ads e aperte em Sincronizar).
        </p>
        {isConnected && <SyncAdsButton />}
      </div>
    );
  }

  const campaignIds = campaigns.map((c) => c.id);

  const [{ docs: dailyDocs }, { docs: groupDocs }, { docs: leadDocs }] = await Promise.all([
    payload.find({
      collection: "ad-metrics-daily",
      where: { campaign: { in: campaignIds } },
      limit: 3000,
      depth: 0,
      sort: "date",
    }),
    payload.find({
      collection: "ad-groups",
      where: { campaign: { in: campaignIds } },
      limit: 200,
      depth: 0,
      sort: "name",
    }),
    payload.find({
      collection: "leads",
      where: { adCampaign: { in: campaignIds } },
      limit: 3000,
      depth: 0,
    }),
  ]);

  const dailyMetrics = dailyDocs as unknown as DailyMetricDoc[];
  const adGroups = groupDocs as unknown as AdGroupDoc[];
  const leads = leadDocs as unknown as LeadDealDoc[];

  const groupIds = adGroups.map((g) => g.id);
  const [{ docs: keywordDocs }, { docs: competitorDocs }] = await Promise.all([
    payload.find({
      collection: "ad-keywords",
      where: {
        or: [
          { adGroup: { in: groupIds.length > 0 ? groupIds : [-1] } },
          { campaign: { in: campaignIds.length > 0 ? campaignIds : [-1] } },
        ],
      },
      limit: 1000,
      depth: 0,
      sort: "text",
    }),
    payload.find({
      collection: "ad-competitors",
      limit: 200,
      depth: 0,
      sort: "name",
    }),
  ]);
  const keywords = keywordDocs as unknown as KeywordDoc[];
  const competitors = competitorDocs as unknown as CompetitorRow[];

  const thirtyDaysAgo = getSaoPauloDateISO(-30);

  // Agrupa por campanha para calcular o placar de cada uma (janela móvel de 30 dias).
  const scorecards: CampaignScorecard[] = campaigns.map((campaign) => {
    const metrics: DailyMetric[] = dailyMetrics
      .filter((m) => String(m.campaign) === String(campaign.id))
      .filter((m) => (typeof m.date === "string" ? m.date.slice(0, 10) : String(m.date)) >= thirtyDaysAgo)
      .map((m) => ({
        date: typeof m.date === "string" ? m.date.slice(0, 10) : String(m.date),
        impressions: m.impressions ?? 0,
        clicks: m.clicks ?? 0,
        cost: m.cost ?? 0,
        conversions: m.conversions ?? 0,
      }));

    const deals: AttributedDeal[] = leads
      .filter((l) => String(l.adCampaign) === String(campaign.id))
      .map((l) => ({
        dealStatus: l.dealStatus ?? "em_andamento",
        dealPackage: l.dealPackage ?? "nenhum",
        dealValue: l.dealValue,
        dealMonths: l.dealMonths,
      }));

    return computeCampaignScorecard({ campaign, dailyMetrics: metrics, attributedDeals: deals });
  });

  const dailyBudgets = new Map(campaigns.map((c) => [String(c.id), c.dailyBudgetTarget]));

  const controlMeta = new Map<string, CampaignControlMeta>(
    campaigns.map((c) => [
      String(c.id),
      { googleAdsCampaignId: c.googleAdsCampaignId || null, googleStatus: c.status },
    ]),
  );

  const totalDailyBudget = campaigns
    .filter((c) => c.status === "ativa")
    .reduce((sum, c) => sum + (c.dailyBudgetTarget ?? 0), 0);

  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const monthSpend = dailyMetrics
    .filter((m) => (typeof m.date === "string" ? m.date : String(m.date)).slice(0, 7) === currentMonthPrefix)
    .reduce((sum, m) => sum + (m.cost ?? 0), 0);

  const budgetInfo: AdsBudgetInfo = {
    status: adsSettings.budgetStatus ?? null,
    approvedLimit: adsSettings.budgetApprovedLimit,
    spent: adsSettings.budgetSpent,
    remaining: adsSettings.budgetRemaining,
    syncedAt: adsSettings.budgetSyncedAt,
  };

  const selectedParam = searchParams?.campaign;
  const selectedIdRaw = Array.isArray(selectedParam) ? selectedParam[0] : selectedParam;
  const selected =
    campaigns.find((c) => String(c.id) === String(selectedIdRaw)) ?? campaigns[0];
  const selectedScorecard = scorecards.find((s) => String(s.campaignId) === String(selected.id))!;

  const selectedDailyMetrics = dailyMetrics
    .filter((m) => String(m.campaign) === String(selected.id))
    .filter((m) => (typeof m.date === "string" ? m.date.slice(0, 10) : String(m.date)) >= thirtyDaysAgo)
    .map((m) => ({
      date: typeof m.date === "string" ? m.date.slice(0, 10) : String(m.date),
      impressions: m.impressions ?? 0,
      clicks: m.clicks ?? 0,
      cost: m.cost ?? 0,
      conversions: m.conversions ?? 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const getRelId = (rel: unknown): string => {
    if (!rel) return "";
    if (typeof rel === "object" && rel !== null && "id" in rel) {
      return String((rel as { id: unknown }).id);
    }
    return String(rel);
  };

  const selectedGroups = adGroups.filter((g) => getRelId(g.campaign) === String(selected.id));
  const selectedGroupIds = new Set(selectedGroups.map((g) => String(g.id)));

  const keywordsByGroup = new Map<string, KeywordDoc[]>();
  const campaignNegativeKeywords: KeywordDoc[] = [];

  for (const k of keywords) {
    const campId = getRelId(k.campaign);
    const grpId = getRelId(k.adGroup);

    if (campId === String(selected.id) || (grpId && selectedGroupIds.has(grpId))) {
      if (k.isNegative && k.negativeLevel === "campaign") {
        campaignNegativeKeywords.push(k);
      } else if (grpId) {
        if (!keywordsByGroup.has(grpId)) keywordsByGroup.set(grpId, []);
        keywordsByGroup.get(grpId)!.push({
          ...k,
          adGroup: grpId,
        });
      }
    }
  }

  // Forecast pré-investimento da campanha selecionada (se capturado).
  const hasForecast = (selected.forecastClicks ?? 0) > 0 && (selected.forecastCost ?? 0) > 0;
  const selectedKeywords = keywords.filter(
    (k) => !k.isNegative && selectedGroupIds.has(getRelId(k.adGroup)),
  );
  const keywordsWithoutVolume = selectedKeywords.filter(
    (k) => (k.plannerCompetition ?? "sem_dados") === "sem_dados",
  ).length;

  return (
    <div className="ea-view" style={{ maxWidth: 1100 }}>
      <EaHubBackLink />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>EA ADS Manager</h1>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/eahub/globals/ads-settings"
          style={{ padding: "6px 12px", border: "1px solid var(--theme-elevation-150)", borderRadius: 4, textDecoration: "none", color: "inherit", fontSize: 13 }}
        >
          ⚙️ Configurações do EA ADS
        </a>
      </div>

      <AdsAutoSync isStale={isStale} isConnected={isConnected} />

      {oauthSuccess && (
        <div style={{ padding: 12, backgroundColor: "#e6f4ea", color: "#137333", marginBottom: 16, borderRadius: 4 }}>
          Google Ads conectado com sucesso!
        </div>
      )}
      <div style={{ padding: 16, backgroundColor: "#fef7e0", color: "#b06000", marginBottom: 24, borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>
          {isConnected
            ? "Se o Sincronizar der erro de autenticação (ex.: invalid_grant), reconecte o Google Ads abaixo."
            : "O EA ADS precisa de acesso à sua conta do Google Ads para puxar os dados reais e analisar a performance."}
        </span>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/ads/oauth" style={{ padding: "8px 16px", backgroundColor: "#1a73e8", color: "#fff", textDecoration: "none", borderRadius: 4, fontWeight: "bold" }}>
          {isConnected ? "Reconectar Google Ads" : "Conectar Google Ads"}
        </a>
      </div>

      <AdsBudgetCard budget={budgetInfo} totalDailyBudget={totalDailyBudget} monthSpend={monthSpend} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <p style={{ color: "var(--theme-elevation-600)", margin: 0, maxWidth: '600px' }}>
          Visão rápida por campanha, com sugestões automáticas — clique num card para aprofundar.
        </p>
        <SyncAdsButton />
      </div>

      <AdsMatrix
        scorecards={scorecards}
        dailyBudgets={dailyBudgets}
        selectedId={String(selected.id)}
        controlMeta={controlMeta}
      />

      {hasForecast ? (
        <AdsForecastPanel
          forecast={{
            clicks: selected.forecastClicks!,
            impressions: selected.forecastImpressions ?? 0,
            cost: selected.forecastCost!,
            ctrPct: selected.forecastCtr ?? 0,
            avgCpc: selected.forecastAvgCpc ?? 0,
            dailyBudget: selected.forecastDailyBudget ?? 0,
            capturedAt: selected.forecastCapturedAt,
            notes: selected.forecastNotes,
          }}
          keywordsWithoutVolume={keywordsWithoutVolume}
          keywordsTotal={selectedKeywords.length}
        />
      ) : null}

      <AdsCampaignDetail
        campaign={selected}
        scorecard={selectedScorecard}
        dailyMetrics={selectedDailyMetrics}
        adGroups={selectedGroups}
        keywordsByGroup={keywordsByGroup}
        campaignNegativeKeywords={campaignNegativeKeywords}
        autoGenerateForecast={!isStale}
        lastSyncedAt={adsSettings.lastSync ?? null}
      />

      <AdsCompetitorsPanel rows={competitors} />
    </div>
  );
}
