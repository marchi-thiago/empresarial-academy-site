import { NextResponse } from 'next/server';
import { getPayloadClient } from '@/lib/payload';
import { GoogleGenAI } from '@google/genai';
import { getSaoPauloDateISO } from '@/lib/google-ads';

export async function POST(req: Request) {
  try {
    const { campaignId } = await req.json();
    
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'A chave da API do Gemini (GEMINI_API_KEY) não está configurada no ambiente.' },
        { status: 500 }
      );
    }

    const payload = await getPayloadClient();

    // Buscar os dados da campanha no Payload
    const campaign = await payload.findByID({
      collection: 'ad-campaigns',
      id: campaignId,
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 });
    }

    // Buscar métricas da campanha nos últimos 30 dias (data real)
    const cutoffDate = getSaoPauloDateISO(-30);
    const metrics = await payload.find({
      collection: 'ad-metrics-daily',
      where: {
        and: [
          { campaign: { equals: campaignId } },
          { date: { greater_than_equal: cutoffDate } },
        ],
      },
      sort: 'date',
      limit: 100,
    });

    // Consolidar os dados para o prompt
    const totalClicks = metrics.docs.reduce((acc, m) => acc + (m.clicks || 0), 0);
    const totalImpressions = metrics.docs.reduce((acc, m) => acc + (m.impressions || 0), 0);
    const totalCost = metrics.docs.reduce((acc, m) => acc + (m.cost || 0), 0);
    const totalConversions = metrics.docs.reduce((acc, m) => acc + (m.conversions || 0), 0);
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpa = totalConversions > 0 ? (totalCost / totalConversions) : 0;
    
    const daysWithData = metrics.docs.length;
    const periodLabel = daysWithData > 0
      ? `Últimos 30 dias (${String(metrics.docs[0].date).slice(0, 10)} a ${String(metrics.docs[daysWithData - 1].date).slice(0, 10)}, ${daysWithData} dias com dados)`
      : 'Últimos 30 dias';

    const campaignData = {
      name: campaign.name,
      status: campaign.status,
      dailyBudget: campaign.dailyBudgetTarget || 'Não definido',
      cpcCeiling: campaign.cpcCeiling || 'Não definido',
      performance30d: {
        period: periodLabel,
        clicks: totalClicks,
        impressions: totalImpressions,
        cost: totalCost.toFixed(2),
        conversions: totalConversions,
        ctr: ctr.toFixed(2) + '%',
        cpa: cpa.toFixed(2),
      },
    };

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Preparar o prompt
    const prompt = `
Atue como um Especialista em Tráfego Pago Sênior (Foco em B2B e PMEs).
Analise a seguinte campanha do Google Ads da 'Empresarial Academy' (focada em maturidade corporativa e educação de donos de PME).

DADOS DA CAMPANHA:
Nome: ${campaignData.name}
Status Atual: ${campaignData.status}
Orçamento Diário: R$ ${campaignData.dailyBudget}
Teto de CPC: R$ ${campaignData.cpcCeiling}

DESEMPENHO (${campaignData.performance30d.period}):
- Cliques: ${campaignData.performance30d.clicks}
- Impressões: ${campaignData.performance30d.impressions}
- Custo Total: R$ ${campaignData.performance30d.cost}
- Conversões (Leads): ${campaignData.performance30d.conversions}
- CTR: ${campaignData.performance30d.ctr}
- Custo por Conversão (CAC/CPA): R$ ${campaignData.performance30d.cpa}

OBJETIVO DA ANÁLISE:
Gere um plano de ação direto, profissional e formatado em Markdown com:
1. **Diagnóstico Rápido**: O que está bom e o que está ruim.
2. **Plano de Redução de CAC / Otimização**: 3 ações práticas para melhorar a eficiência da verba.
3. **Forecast de ROI (Projeção)**: Se otimizarmos os pontos acima, o que podemos esperar de projeção para os próximos 30 dias (Simule números).

Responda SOMENTE com o relatório em Markdown. Evite jargões excessivos se não for explicá-los. Seja tático e focado na escala.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return NextResponse.json({
      success: true,
      insight: response.text,
      metrics: campaignData
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Erro no Forecast IA:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
