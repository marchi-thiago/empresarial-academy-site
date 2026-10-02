import { NextResponse } from "next/server";
import { exigirSessao } from "@/lib/secretaria/sessao";

/**
 * Proxy para gerar o QR code de pareamento de uma instância WhatsApp no
 * EA Flow. Ação sensível (conecta/reconecta um número real) — só encaminha
 * a instanceName escolhida no painel, a validação de nome conhecido
 * acontece do lado do ea-flow.
 */
export async function POST(request: Request) {
  const negado = await exigirSessao(request);
  if (negado) return negado;
  const baseUrl = process.env.EA_FLOW_URL;
  const apiKey = process.env.EA_FLOW_ADMIN_API_KEY;
  if (!baseUrl || !apiKey) {
    return NextResponse.json({ ok: false, error: "EA_FLOW_URL/EA_FLOW_ADMIN_API_KEY não configuradas" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/whatsapp/connect`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
