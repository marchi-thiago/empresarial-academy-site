import { NextResponse } from 'next/server';
import { OAUTH_CONFIG } from '@/lib/google-ads';
import { getPayloadClient } from '@/lib/payload';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Nenhum código retornado pelo Google.' }, { status: 400 });
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: OAUTH_CONFIG.clientId,
        client_secret: OAUTH_CONFIG.clientSecret,
        redirect_uri: OAUTH_CONFIG.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const data = await tokenResponse.json();

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    if (!data.refresh_token) {
      return NextResponse.json({ 
        error: 'O Google não retornou um refresh_token. Acesse myaccount.google.com/permissions, remova o app e tente conectar novamente.' 
      }, { status: 400 });
    }

    // Salva o Refresh Token no banco de dados do Payload (Global AdsSettings)
    const payload = await getPayloadClient();
    await payload.updateGlobal({
      slug: 'ads-settings',
      data: {
        refreshToken: data.refresh_token,
      },
    });

    // Redireciona de volta para o dashboard
    return NextResponse.redirect(new URL('/eahub/ads-performance?oauth=success', process.env.NEXT_PUBLIC_SITE_URL || req.url));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('OAuth Callback Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
