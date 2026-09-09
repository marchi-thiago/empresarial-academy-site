import { NextResponse } from 'next/server';
import { getPayloadClient } from '@/lib/payload';
import { setAdGroupStatus, extractGoogleAdsErrorMessage } from '@/lib/google-ads';

export async function POST(req: Request) {
  try {
    const payload = await getPayloadClient();
    const body = await req.json();
    const groupId = String(body?.groupId ?? '');
    const action: 'enable' | 'pause' = body?.action === 'enable' ? 'enable' : 'pause';

    if (!groupId) {
      return NextResponse.json({ success: false, error: 'ID do grupo não informado.' }, { status: 400 });
    }

    const groupDoc = await payload.findByID({
      collection: 'ad-groups',
      id: groupId,
      depth: 1,
    });

    if (!groupDoc) {
      return NextResponse.json({ success: false, error: 'Grupo não encontrado.' }, { status: 404 });
    }

    const campaignObj = typeof groupDoc.campaign === 'object' ? groupDoc.campaign : null;
    const googleAdsCampaignId = campaignObj ? (campaignObj as { googleAdsCampaignId?: string }).googleAdsCampaignId : null;

    const result = await setAdGroupStatus({
      googleAdsCampaignId: googleAdsCampaignId ? String(googleAdsCampaignId) : undefined,
      groupName: groupDoc.name,
      action,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.reason }, { status: 500 });
    }

    await payload.update({
      collection: 'ad-groups',
      id: groupId,
      data: {
        status: action === 'enable' ? 'ativo' : 'pausado',
      },
    });

    return NextResponse.json({ success: true, status: action === 'enable' ? 'ativo' : 'pausado' });
  } catch (error: unknown) {
    console.error('Erro ao alterar status do grupo:', error);
    return NextResponse.json({ success: false, error: extractGoogleAdsErrorMessage(error) }, { status: 500 });
  }
}
