import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Desliga o draftMode do Next (contrário de `/preview`, ver `src/lib/preview.ts`).
 * Sem isso, uma vez em pré-visualização não havia como voltar ao modo normal
 * pelo site — só limpando cookies manualmente. Usado pelo link "Sair da
 * pré-visualização" no banner de rascunho.
 */
export async function GET(request: Request) {
  const draft = await draftMode();
  draft.disable();

  const { searchParams } = new URL(request.url);
  const redirectTo = searchParams.get("redirect") || "/";
  return NextResponse.redirect(new URL(redirectTo, process.env.NEXT_PUBLIC_SITE_URL || request.url));
}
