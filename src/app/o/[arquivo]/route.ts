import { getPayloadClient } from "@/lib/payload";
import { crmDb } from "@/lib/crm/payload-db";
import { GIF_1X1, tratarAbertura } from "@/lib/outbound/rastreio-registro";

/** Pixel de abertura (/o/<leadId>.<toque>.<assinatura>.gif): registra `aberto` e devolve um GIF transparente. */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ arquivo: string }> }) {
  const { arquivo } = await params;
  try {
    const payload = await getPayloadClient();
    await tratarAbertura({ crm: crmDb(payload), tokenDoLead: async () => null }, arquivo, request.headers.get("user-agent"));
  } catch {
    // a imagem sai mesmo sem banco
  }
  return new Response(new Uint8Array(GIF_1X1), {
    headers: { "Content-Type": "image/gif", "Content-Length": String(GIF_1X1.length), "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  });
}
