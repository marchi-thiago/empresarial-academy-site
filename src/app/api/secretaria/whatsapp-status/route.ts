import { NextResponse } from "next/server";
import { exigirSessao } from "@/lib/secretaria/sessao";
import { comCache } from "@/lib/secretaria/cache";

/**
 * Proxy para o status real das instâncias WhatsApp no EA Flow — a
 * EVOLUTION_API_KEY nunca sai do backend do ea-flow, esta rota só repassa
 * a autenticação de serviço (EA_FLOW_ADMIN_API_KEY).
 *
 * Só atende quem está logado no EA HUB. Memória curta (30 s; 5 min quando o EA Flow recusa a chave de serviço):
 * várias abas viram uma ida só ao EA Flow.
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
    const r = await comCache("whatsapp-status", async () => {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/whatsapp/status`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(12000),
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
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
