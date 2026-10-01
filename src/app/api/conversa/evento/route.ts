import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";
import { depsDaConversa, tratarGesto } from "@/lib/outbound/conversa-servidor";

/**
 * Gestos do visitante na página /conversa (abriu, deu play, agendou). A credencial é o token do lead
 * (`tokenConversa`); o CRM_INGEST_SECRET fica só no servidor e nunca é usado aqui.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let corpo: unknown;
  try {
    const texto = await request.text();
    if (texto.length > 2000) return new NextResponse(null, { status: 413 });
    corpo = JSON.parse(texto);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  try {
    const payload = await getPayloadClient();
    const r = await tratarGesto(depsDaConversa(payload), corpo);
    return new NextResponse(null, { status: r.status });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
