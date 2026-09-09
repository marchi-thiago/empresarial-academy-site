import { NextResponse } from 'next/server';
import { getPayloadClient } from '@/lib/payload';
import {
  getGoogleAdsClient,
  isGoogleAdsConfigured,
  extractGoogleAdsErrorMessage,
  fetchAccountBudgetSummary,
  syncAdGroupsAndKeywords,
  syncCampaignMetricsDaily,
} from '@/lib/google-ads';

export async function POST() {
  try {
    const payload = await getPayloadClient();
    
    // 1. Check if user is admin
    // Omit user check since it's an internal route triggered from admin panel
    
    if (!isGoogleAdsConfigured()) {
      return NextResponse.json({ success: false, error: 'Variáveis de ambiente do Google Ads não configuradas.' }, { status: 400 });
    }

    const { customer } = await getGoogleAdsClient();

    // 2. Fetch all active campaigns from Google Ads
    const results = await customer.query(`
      SELECT campaign.id, campaign.name, campaign.status, campaign.bidding_strategy_type, campaign_budget.amount_micros
      FROM campaign
      WHERE campaign.status != 'REMOVED'
    `);

    let added = 0;
    let updated = 0;

    for (const row of results as unknown[]) {
      const typedRow = row as { campaign: { id: string, name: string, status: string }, campaign_budget: { amount_micros: number } };
      const gId = String(typedRow.campaign.id);
      const name = String(typedRow.campaign.name);
      
      const existing = await payload.find({
        collection: 'ad-campaigns',
        where: { googleAdsCampaignId: { equals: gId } },
        limit: 1,
      });

      const isCampEnabled =
        String(typedRow.campaign.status) === 'ENABLED' ||
        String(typedRow.campaign.status) === '2' ||
        Number(typedRow.campaign.status) === 2;

      if (existing.docs.length > 0) {
        // Update
        await payload.update({
          collection: 'ad-campaigns',
          id: existing.docs[0].id,
          data: {
            name,
            status: isCampEnabled ? 'ativa' : 'pausada',
            // Reflete o orçamento diário real da campanha no Google Ads — sem isso,
            // o card de crédito/orçamento do painel ficava desatualizado sempre que
            // o orçamento fosse alterado direto no Google (só era gravado na criação).
            dailyBudgetTarget: (typedRow.campaign_budget?.amount_micros ?? 0) / 1_000_000,
          },
        });
        updated++;
      } else {
        // Create
        await payload.create({
          collection: 'ad-campaigns',
          data: {
            name,
            googleAdsCampaignId: gId,
            status: isCampEnabled ? 'ativa' : 'pausada',
            dailyBudgetTarget: (typedRow.campaign_budget?.amount_micros ?? 0) / 1_000_000,
            monthlyBudgetTarget: ((typedRow.campaign_budget?.amount_micros ?? 0) / 1_000_000) * 30,
            cpcCeiling: 10.5,
          },
        });
        added++;
      }
    }

    // 3. Sincroniza o orçamento/crédito da conta (Faturamento no Google Ads).
    const budgetSummary = await fetchAccountBudgetSummary();
    const budgetData = budgetSummary.ok
      ? budgetSummary.hasLimit
        ? {
            budgetStatus: 'com_limite' as const,
            budgetApprovedLimit: budgetSummary.approvedLimit,
            budgetSpent: budgetSummary.spent,
            budgetRemaining: budgetSummary.remaining,
          }
        : { budgetStatus: 'sem_limite' as const, budgetApprovedLimit: null, budgetSpent: null, budgetRemaining: null }
      : { budgetStatus: 'indisponivel' as const, budgetApprovedLimit: null, budgetSpent: null, budgetRemaining: null };

    await payload.updateGlobal({
      slug: 'ads-settings',
      data: { ...budgetData, budgetSyncedAt: new Date().toISOString(), lastSync: new Date().toISOString() },
    });

    // 4. Sincroniza Grupos de Anúncios e Palavras-chave reais da conta
    const { docs: allCampaigns } = await payload.find({
      collection: 'ad-campaigns',
      limit: 100,
      depth: 0,
    });
    const groupKwSummary = await syncAdGroupsAndKeywords(payload, customer, allCampaigns);

    // 5. Sincroniza Métricas Diárias dos últimos 60 dias de forma síncrona (com await)
    const metricsSummary = await syncCampaignMetricsDaily(payload, { windowDays: 60 });

    return NextResponse.json({
      success: true,
      added,
      updated,
      groups: groupKwSummary,
      dailyMetricsProcessed: metricsSummary.processed,
    });
  } catch (error: unknown) {
    console.error('Erro na sincronização de campanhas:', error);
    return NextResponse.json({ success: false, error: extractGoogleAdsErrorMessage(error) }, { status: 500 });
  }
}
