import { draftMode } from "next/headers";
import { NextResponse } from "next/server";
import { PREVIEW_COLLECTIONS, getPreviewSecret, type PreviewCollection } from "@/lib/preview";

/**
 * Liga o draftMode do Next e redireciona para a página real do conteúdo
 * (`/blog/<slug>` ou `/materiais/<slug>`), que então renderiza o documento
 * mesmo em rascunho. Ver `src/lib/preview.ts`. Segredo obrigatório em
 * produção; em dev (sem PREVIEW_SECRET) fica liberado.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const collection = searchParams.get("collection") as PreviewCollection | null;
  const slug = searchParams.get("slug");

  const expected = getPreviewSecret();
  if (expected && secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!collection || !PREVIEW_COLLECTIONS[collection] || !slug) {
    return NextResponse.json({ error: "parâmetros inválidos" }, { status: 400 });
  }

  const draft = await draftMode();
  draft.enable();

  const base = PREVIEW_COLLECTIONS[collection].path;
  return NextResponse.redirect(new URL(`${base}/${slug}`, process.env.NEXT_PUBLIC_SITE_URL || request.url));
}
