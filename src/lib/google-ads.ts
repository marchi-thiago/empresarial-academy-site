import { GoogleAdsApi, enums } from 'google-ads-api';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import configPromise from '@payload-config';

type GoogleAdsCustomer = ReturnType<GoogleAdsApi['Customer']>;

/**
 * A `google-ads-api` não lança `Error` padrão — decodifica a falha da API do
 * Google num objeto próprio (`{ errors: [{ message, error_code }] }`, do proto
 * `GoogleAdsFailure`), às vezes sem `.message` na raiz. Sem isso, o front acaba
 * mostrando literalmente "Erro: undefined" (ex.: developer token em nível de
 * teste tentando ler a conta real — erro comum até o Basic Access ser aprovado).
 */
export function extractGoogleAdsErrorMessage(error: unknown): string {
  const e = error as {
    message?: string;
    errors?: Array<{ message?: string; error_code?: unknown }>;
    response?: { data?: { error?: { message?: string } } };
  };
  const fromFailure = e?.errors?.[0]?.message;
  if (fromFailure) return fromFailure;
  if (e?.message) return e.message;
  const fromRest = e?.response?.data?.error?.message;
  if (fromRest) return fromRest;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isGoogleAdsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_DEVELOPER_TOKEN &&
      process.env.GOOGLE_CUSTOMER_ID &&
      process.env.GOOGLE_LOGIN_CUSTOMER_ID,
  );
}

export async function getGoogleAdsClient() {
  const payload = await getPayload({ config: configPromise });
  const settings = await payload.findGlobal({ slug: 'ads-settings' }) as unknown as { refreshToken?: string };
  
  if (!settings?.refreshToken) {
    throw new Error('Google Ads não está conectado. Vá no EA ADS Manager (dentro do EA HUB) e autorize o acesso.');
  }

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
    developer_token: process.env.GOOGLE_DEVELOPER_TOKEN || '',
  });

  const customer = client.Customer({
    // Conta-cliente onde as campanhas rodam de fato (770-135-7894), vinculada
    // à MCC "EA MKT HUB" (confirmado por e-mail do Google em 24/07 — a MCC não
    // roda campanha nela mesma, é só a conta administradora).
    customer_id: process.env.GOOGLE_CUSTOMER_ID || '',
    // Conta MCC — autentica em nome da conta-cliente acima.
    login_customer_id: process.env.GOOGLE_LOGIN_CUSTOMER_ID || process.env.GOOGLE_CUSTOMER_ID || '',
    refresh_token: settings.refreshToken,
  });

  return { client, customer, enums };
}

export function getSaoPauloDateISO(offsetDays = 0): string {
  const now = new Date();
  if (offsetDays !== 0) {
    now.setDate(now.getDate() + offsetDays);
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

export type CampaignMetricsRow = {
  googleAdsCampaignId: string;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
};

type FetchResult = { ok: true; rows: CampaignMetricsRow[] } | { ok: false; reason: string };

export async function fetchDailyCampaignMetrics(sinceDate: string): Promise<FetchResult> {
  if (!isGoogleAdsConfigured()) return { ok: false, reason: "not-configured" };

  try {
    const { customer } = await getGoogleAdsClient();
    const today = getSaoPauloDateISO();

    const results = await customer.query(`
      SELECT campaign.id, segments.date, metrics.impressions, metrics.clicks,
             metrics.cost_micros, metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${sinceDate}' AND '${today}'
    `);

    const rows: CampaignMetricsRow[] = (results as Array<Record<string, Record<string, unknown>>>).map((r) => ({
      googleAdsCampaignId: String(r.campaign?.id ?? ""),
      date: String(r.segments?.date ?? ""),
      impressions: Number(r.metrics?.impressions ?? 0),
      clicks: Number(r.metrics?.clicks ?? 0),
      cost: Number(r.metrics?.cost_micros ?? 0) / 1_000_000,
      conversions: Number(r.metrics?.conversions ?? 0),
    }));

    return { ok: true, rows };
  } catch (e: unknown) {
    const message = extractGoogleAdsErrorMessage(e);
    if (message.includes('não está conectado')) {
      return { ok: false, reason: "no-refresh-token" };
    }
    console.error("[google-ads] falha ao buscar métricas:", message);
    return { ok: false, reason: "exception" };
  }
}

export type SyncGroupsKeywordsResult = {
  groupsAdded: number;
  groupsUpdated: number;
  keywordsAdded: number;
  keywordsUpdated: number;
};

/**
 * Sincroniza Grupos de Anúncios e Palavras-chave reais da conta Google Ads,
 * atualizando os rollups dos últimos 30 dias para exibição fiel no painel do EA ADS.
 */
export async function syncAdGroupsAndKeywords(
  payload: Payload,
  customer: GoogleAdsCustomer,
  campaignDocs: Array<{ id: string | number; googleAdsCampaignId?: string | null }>,
): Promise<SyncGroupsKeywordsResult> {
  const byGoogleCampId = new Map(
    campaignDocs
      .filter((c) => typeof c.googleAdsCampaignId === "string" && c.googleAdsCampaignId)
      .map((c) => [String(c.googleAdsCampaignId), c.id]),
  );

  let groupsAdded = 0;
  let groupsUpdated = 0;
  let keywordsAdded = 0;
  let keywordsUpdated = 0;

  // 1. Sincroniza Ad Groups (garante que todos os grupos existam, ativos ou pausados)
  try {
    const allGroupsQuery = `
      SELECT
        campaign.id,
        ad_group.id,
        ad_group.name,
        ad_group.status
      FROM ad_group
      WHERE campaign.status != 'REMOVED'
        AND ad_group.status != 'REMOVED'
    `;
    const groupRows = (await customer.query(allGroupsQuery)) as Array<Record<string, Record<string, unknown>>>;

    const groupMetricsQuery = `
      SELECT
        ad_group.id,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM ad_group
      WHERE segments.date DURING LAST_30_DAYS
        AND campaign.status != 'REMOVED'
        AND ad_group.status != 'REMOVED'
    `;
    const groupMetricRows = (await customer.query(groupMetricsQuery)) as Array<Record<string, Record<string, unknown>>>;
    const groupMetricsMap = new Map<string, { impressions: number; clicks: number; cost: number; conversions: number }>();
    for (const m of groupMetricRows) {
      const gId = String(m.ad_group?.id ?? "");
      const prev = groupMetricsMap.get(gId) ?? { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
      groupMetricsMap.set(gId, {
        impressions: prev.impressions + Number(m.metrics?.impressions ?? 0),
        clicks: prev.clicks + Number(m.metrics?.clicks ?? 0),
        cost: prev.cost + Number(m.metrics?.cost_micros ?? 0) / 1_000_000,
        conversions: prev.conversions + Number(m.metrics?.conversions ?? 0),
      });
    }

    for (const r of groupRows) {
      const gCampId = String(r.campaign?.id ?? "");
      const localCampId = byGoogleCampId.get(gCampId);
      if (!localCampId) continue;

      const gGroupId = String(r.ad_group?.id ?? "");
      const groupName = String(r.ad_group?.name ?? "");
      const gStatus = String(r.ad_group?.status ?? "");
      const status: "ativo" | "pausado" = gStatus === "ENABLED" ? "ativo" : "pausado";
      const metrics = groupMetricsMap.get(gGroupId) ?? { impressions: 0, clicks: 0, cost: 0, conversions: 0 };

      const existingGroup = await payload.find({
        collection: "ad-groups",
        where: {
          and: [{ campaign: { equals: localCampId } }, { name: { equals: groupName } }],
        },
        limit: 1,
        depth: 0,
      });

      const groupData = {
        campaign: Number(localCampId),
        name: groupName,
        status,
        rollupWindowDays: 30,
        rollupImpressions: metrics.impressions,
        rollupClicks: metrics.clicks,
        rollupCost: metrics.cost,
        rollupConversions: metrics.conversions,
        rollupUpdatedAt: new Date().toISOString(),
      };

      if (existingGroup.docs.length > 0) {
        await payload.update({
          collection: "ad-groups",
          id: existingGroup.docs[0].id,
          data: groupData,
        });
        groupsUpdated++;
      } else {
        await payload.create({
          collection: "ad-groups",
          data: groupData,
        });
        groupsAdded++;
      }
    }
  } catch (err: unknown) {
    console.error("[google-ads] erro ao sincronizar grupos de anúncios:", extractGoogleAdsErrorMessage(err));
  }

  // 2. Sincroniza Palavras-chave com métricas dos últimos 30 dias
  try {
    const { docs: localGroups } = await payload.find({
      collection: "ad-groups",
      limit: 200,
      depth: 0,
    });

    const groupKeyMap = new Map(
      localGroups.map((g) => [`${String(g.campaign)}::${g.name}`, g.id]),
    );

    const allKwQuery = `
      SELECT
        campaign.id,
        ad_group.id,
        ad_group.name,
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.status
      FROM ad_group_criterion
      WHERE ad_group_criterion.type = 'KEYWORD'
        AND campaign.status != 'REMOVED'
        AND ad_group.status != 'REMOVED'
        AND ad_group_criterion.status != 'REMOVED'
    `;
    const kwRows = (await customer.query(allKwQuery)) as Array<Record<string, Record<string, unknown>>>;

    const kwMetricsQuery = `
      SELECT
        ad_group.id,
        ad_group_criterion.criterion_id,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM ad_group_criterion
      WHERE segments.date DURING LAST_30_DAYS
        AND ad_group_criterion.type = 'KEYWORD'
        AND campaign.status != 'REMOVED'
        AND ad_group.status != 'REMOVED'
        AND ad_group_criterion.status != 'REMOVED'
    `;
    const kwMetricRows = (await customer.query(kwMetricsQuery)) as Array<Record<string, Record<string, unknown>>>;
    const kwMetricsMap = new Map<string, { impressions: number; clicks: number; cost: number; conversions: number }>();
    for (const m of kwMetricRows) {
      const gId = String(m.ad_group?.id ?? "");
      const cId = String(m.ad_group_criterion?.criterion_id ?? "");
      const key = `${gId}::${cId}`;
      const prev = kwMetricsMap.get(key) ?? { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
      kwMetricsMap.set(key, {
        impressions: prev.impressions + Number(m.metrics?.impressions ?? 0),
        clicks: prev.clicks + Number(m.metrics?.clicks ?? 0),
        cost: prev.cost + Number(m.metrics?.cost_micros ?? 0) / 1_000_000,
        conversions: prev.conversions + Number(m.metrics?.conversions ?? 0),
      });
    }

    for (const r of kwRows) {
      const gCampId = String(r.campaign?.id ?? "");
      const localCampId = byGoogleCampId.get(gCampId);
      if (!localCampId) continue;

      const groupName = String(r.ad_group?.name ?? "");
      const localGroupId = groupKeyMap.get(`${localCampId}::${groupName}`);
      if (!localGroupId) continue;

      const kwDataRaw = r.ad_group_criterion as Record<string, unknown> | undefined;
      const kwObj = kwDataRaw?.keyword as { text?: string; match_type?: string } | undefined;
      const text = String(kwObj?.text ?? "");
      if (!text) continue;

      const gGroupId = String(r.ad_group?.id ?? "");
      const gCritId = String(r.ad_group_criterion?.criterion_id ?? "");
      const metrics = kwMetricsMap.get(`${gGroupId}::${gCritId}`) ?? { impressions: 0, clicks: 0, cost: 0, conversions: 0 };

      const gMatchType = String(kwObj?.match_type ?? "");
      const matchType: "exata" | "frase" = gMatchType === "EXACT" ? "exata" : "frase";

      const gStatus = String(r.ad_group_criterion?.status ?? "");
      const status: "ativa" | "pausada" = gStatus === "ENABLED" ? "ativa" : "pausada";

      const existingKw = await payload.find({
        collection: "ad-keywords",
        where: {
          and: [{ adGroup: { equals: localGroupId } }, { text: { equals: text } }],
        },
        limit: 1,
        depth: 0,
      });

      const kwData = {
        adGroup: Number(localGroupId),
        text,
        matchType,
        status,
        rollupWindowDays: 30,
        rollupImpressions: metrics.impressions,
        rollupClicks: metrics.clicks,
        rollupCost: metrics.cost,
        rollupConversions: metrics.conversions,
        rollupUpdatedAt: new Date().toISOString(),
      };

      if (existingKw.docs.length > 0) {
        await payload.update({
          collection: "ad-keywords",
          id: existingKw.docs[0].id,
          data: kwData,
        });
        keywordsUpdated++;
      } else {
        await payload.create({
          collection: "ad-keywords",
          data: kwData,
        });
        keywordsAdded++;
      }
    }
  } catch (err: unknown) {
    console.error("[google-ads] erro ao sincronizar palavras-chave:", extractGoogleAdsErrorMessage(err));
  }

  return { groupsAdded, groupsUpdated, keywordsAdded, keywordsUpdated };
}

export const SYNC_WINDOW_DAYS = 60;

export type SyncMetricsOptions = {
  dry?: boolean;
  windowDays?: number;
};

export type SyncMetricsResult = {
  ok: boolean;
  dry?: boolean;
  processed: number;
  results: Array<Record<string, unknown>>;
  reason?: string;
};

/**
 * Função central de sincronização de métricas diárias.
 * Pode ser executada pelo cron GET ou diretamente com await por outras rotas (ex.: sync-all).
 */
export async function syncCampaignMetricsDaily(
  payload: Payload,
  options: SyncMetricsOptions = {},
): Promise<SyncMetricsResult> {
  const dry = options.dry ?? false;
  const windowDays = options.windowDays ?? SYNC_WINDOW_DAYS;

  if (!isGoogleAdsConfigured()) {
    return { ok: true, processed: 0, results: [], reason: "google-ads-not-configured" };
  }

  const { docs: campaigns } = await payload.find({
    collection: "ad-campaigns",
    where: { googleAdsCampaignId: { exists: true } },
    limit: 100,
    depth: 0,
  });

  const sinceDate = getSaoPauloDateISO(-windowDays);
  const fetched = await fetchDailyCampaignMetrics(sinceDate);
  if (!fetched.ok) {
    return { ok: false, processed: 0, results: [], reason: fetched.reason };
  }

  const byGoogleId = new Map(
    campaigns
      .filter((c) => typeof c.googleAdsCampaignId === "string" && c.googleAdsCampaignId)
      .map((c) => [c.googleAdsCampaignId as string, c.id]),
  );

  const results: Array<Record<string, unknown>> = [];
  for (const row of fetched.rows) {
    const campaignId = byGoogleId.get(row.googleAdsCampaignId);
    if (!campaignId) {
      results.push({ googleAdsCampaignId: row.googleAdsCampaignId, action: "skipped-no-local-campaign" });
      continue;
    }
    try {
      const existing = await payload.find({
        collection: "ad-metrics-daily",
        where: { and: [{ campaign: { equals: campaignId } }, { date: { equals: row.date } }] },
        limit: 1,
        depth: 0,
      });
      const data = {
        campaign: campaignId,
        date: row.date,
        impressions: row.impressions,
        clicks: row.clicks,
        cost: row.cost,
        conversions: row.conversions,
        source: "api" as const,
      };
      if (dry) {
        results.push({ ...data, action: existing.docs[0] ? "would-update" : "would-create" });
        continue;
      }
      if (existing.docs[0]) {
        await payload.update({ collection: "ad-metrics-daily", id: existing.docs[0].id, data });
        results.push({ campaignId, date: row.date, action: "updated" });
      } else {
        await payload.create({ collection: "ad-metrics-daily", data });
        results.push({ campaignId, date: row.date, action: "created" });
      }
    } catch (e) {
      results.push({ campaignId, date: row.date, action: "error", error: String(e) });
    }
  }

  return { ok: true, dry, processed: results.length, results };
}

/**
 * "Quanto tem de crédito no Google Ads": a API do Google Ads NÃO expõe o saldo
 * real de contas pré-pagas self-serve (confirmado — não é um campo que existe
 * no `account_budget`, esse resource só reflete um "limite de gastos" que
 * normalmente só é configurado em contas faturadas/gerenciadas por agência).
 * Para a conta do Thiago (pagamento manual/pré-pago, sem limite configurado),
 * a query abaixo tende a devolver `hasLimit: false` — nesse caso o painel usa
 * os números locais (orçamento diário somado + gasto sincronizado) como proxy
 * e linka pro faturamento real do Google para o valor exato.
 */
export type AccountBudgetSummary =
  | { ok: true; hasLimit: true; approvedLimit: number; spent: number; remaining: number }
  | { ok: true; hasLimit: false }
  | { ok: false; reason: string };

export async function fetchAccountBudgetSummary(): Promise<AccountBudgetSummary> {
  if (!isGoogleAdsConfigured()) return { ok: false, reason: "not-configured" };

  try {
    const { customer } = await getGoogleAdsClient();

    const results = await customer.query(`
      SELECT account_budget.approved_spending_limit_type,
             account_budget.approved_spending_limit_micros,
             account_budget.adjusted_spending_limit_micros,
             account_budget.amount_served_micros
      FROM account_budget
      WHERE account_budget.status = 'APPROVED'
    `);

    const rows = results as Array<Record<string, Record<string, unknown>>>;
    let approvedLimitMicros = 0;
    let servedMicros = 0;
    let anyFinite = false;

    for (const r of rows) {
      const type = Number(r.account_budget?.approved_spending_limit_type ?? 0);
      const limitMicros = Number(
        r.account_budget?.adjusted_spending_limit_micros ?? r.account_budget?.approved_spending_limit_micros ?? 0,
      );
      // SpendingLimitType.INFINITE (2) = sem teto — não entra na soma.
      if (type !== enums.SpendingLimitType.INFINITE && limitMicros > 0) {
        anyFinite = true;
        approvedLimitMicros += limitMicros;
      }
      servedMicros += Number(r.account_budget?.amount_served_micros ?? 0);
    }

    if (!anyFinite) return { ok: true, hasLimit: false };

    const approvedLimit = approvedLimitMicros / 1_000_000;
    const spent = servedMicros / 1_000_000;
    return { ok: true, hasLimit: true, approvedLimit, spent, remaining: Math.max(approvedLimit - spent, 0) };
  } catch (e: unknown) {
    const message = extractGoogleAdsErrorMessage(e);
    if (message.includes("não está conectado")) {
      return { ok: false, reason: "no-refresh-token" };
    }
    console.error("[google-ads] falha ao buscar account_budget:", message);
    return { ok: false, reason: "exception" };
  }
}

export type CampaignStatusAction = "enable" | "pause";

/** Ativa (ENABLED) ou pausa (PAUSED) uma ou mais campanhas de uma vez via mutate em lote. */
export async function setCampaignsStatus(
  googleAdsCampaignIds: string[],
  action: CampaignStatusAction,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isGoogleAdsConfigured()) return { ok: false, reason: "not-configured" };
  if (googleAdsCampaignIds.length === 0) return { ok: false, reason: "no-campaigns" };

  try {
    const { customer } = await getGoogleAdsClient();
    const customerId = process.env.GOOGLE_CUSTOMER_ID || "";
    const status = action === "enable" ? enums.CampaignStatus.ENABLED : enums.CampaignStatus.PAUSED;

    await customer.campaigns.update(
      googleAdsCampaignIds.map((id) => ({
        resource_name: `customers/${customerId}/campaigns/${id}`,
        status,
      })),
    );

    return { ok: true };
  } catch (e: unknown) {
    const message = extractGoogleAdsErrorMessage(e);
    if (message.includes("não está conectado")) {
      return { ok: false, reason: "no-refresh-token" };
    }
    console.error("[google-ads] falha ao alterar status de campanhas:", message);
    return { ok: false, reason: message };
  }
}

export const OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_ADS_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
  redirectUri: process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/ads/callback` : 'http://localhost:3000/api/ads/callback',
  scope: 'https://www.googleapis.com/auth/adwords',
};
