import { NextResponse } from "next/server";
import { exigirSessao } from "@/lib/secretaria/sessao";

export async function GET(request: Request) {
  const negado = await exigirSessao(request);
  if (negado) return negado;
  const baseUrl = process.env.EA_FLOW_URL;
  const apiKey = process.env.EA_FLOW_ADMIN_API_KEY;
  if (!baseUrl || !apiKey) {
    return NextResponse.json({ ok: false, error: "EA_FLOW_URL/EA_FLOW_ADMIN_API_KEY não configuradas" }, { status: 500 });
  }
  const { searchParams } = new URL(request.url);
  const instanceName = searchParams.get("instanceName");
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/whatsapp/list-groups?instanceName=${instanceName}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(45000),
      cache: "no-store",
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
