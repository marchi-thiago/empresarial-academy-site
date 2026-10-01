import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";
import { crmDb, garantirTokenConversa } from "@/lib/crm/payload-db";
import { tratarClique } from "@/lib/outbound/rastreio-registro";

/** Clique rastreado pelo domínio da EA: registra `clicado` no CRM e redireciona. Ver src/lib/outbound/rastreio.ts. */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  let payload: Awaited<ReturnType<typeof getPayloadClient>> | null = null;
  try {
    payload = await getPayloadClient();
  } catch {
    payload = null;
  }
  const p = payload;
  const r = await tratarClique(
    {
      crm: p ? crmDb(p) : ({} as never),
      tokenDoLead: async (id) => (p ? garantirTokenConversa(p, id) : null),
    },
    codigo,
    request.headers.get("user-agent"),
  ).catch(() => null);
  const destino = r?.location ?? "https://empresarialacademy.com";
  return NextResponse.redirect(destino, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
