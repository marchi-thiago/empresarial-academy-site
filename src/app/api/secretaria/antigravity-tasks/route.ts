import { NextResponse } from "next/server";
import { exigirSessao } from "@/lib/secretaria/sessao";
import { comCache, esquecer } from "@/lib/secretaria/cache";

/**
 * Proxy pra fila de ordens do Antigravity no ea-flow. Só atende quem está logado no EA HUB. A leitura tem memória
 * curta (30 s; 5 min quando o EA Flow recusa a chave de serviço) para não acordar o banco do EA Flow a cada aba aberta.
 */
export async function GET(request: Request) {
  const negado = await exigirSessao(request);
  if (negado) return negado;
  const baseUrl = process.env.EA_FLOW_URL;
  const apiKey = process.env.EA_FLOW_ADMIN_API_KEY;
  if (!baseUrl || !apiKey) {
    return NextResponse.json({ ok: false, error: "EA_FLOW_URL/EA_FLOW_ADMIN_API_KEY não configuradas" }, { status: 500 });
  }
  try {
    const r = await comCache("antigravity-tasks", async () => {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/antigravity-tasks`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
      return { status: res.status, corpo: await res.json() };
    });
    // 401 do EA Flow é problema da chave de serviço do site, não da sessão de quem olha a tela: vira 502, para a tela não achar que perdeu o login.
    if (r.status === 401 || r.status === 403) {
      return NextResponse.json({ ok: false, error: "O EA Flow recusou a chave de serviço do site (EA_FLOW_ADMIN_API_KEY na Vercel do site)." }, { status: 502 });
    }
    return NextResponse.json(r.corpo, { status: r.status });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

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
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/antigravity-tasks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json();
    // A fila mudou: a próxima leitura precisa ir ao EA Flow.
    esquecer("antigravity-tasks");
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
