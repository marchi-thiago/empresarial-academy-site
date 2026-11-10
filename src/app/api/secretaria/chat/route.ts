import { NextResponse } from "next/server";
import { exigirSessao } from "@/lib/secretaria/sessao";

export const maxDuration = 300;

/**
 * Proxy do chat da Secretária no painel /eahub/secretaria.
 * Repassa o turno para o EA Flow, que executa ferramentas e gera a resposta
 * pela assinatura Google AI Pro do Thiago no PC (`agy`), sem usar API paga.
 */
export async function POST(req: Request) {
  const negado = await exigirSessao(req);
  if (negado) return negado;

  try {
    const body = (await req.json().catch(() => null)) as { message?: unknown; history?: unknown } | null;
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    const baseUrl = process.env.EA_FLOW_URL;
    const apiKey = process.env.EA_FLOW_ADMIN_API_KEY || process.env.EA_FLOW_API_KEY;
    if (!baseUrl || !apiKey) {
      return NextResponse.json({
        reply: "Motor de IA pela assinatura não configurado neste ambiente (EA_FLOW_URL ou EA_FLOW_ADMIN_API_KEY ausentes).",
      });
    }

    const history = Array.isArray(body?.history)
      ? body.history.filter((h: unknown): h is { role: "user" | "model"; text: string } => {
          const item = h as { role?: unknown; text?: unknown };
          return (
            Boolean(item) &&
            (item.role === "user" || item.role === "model") &&
            typeof item.text === "string" &&
            item.text.trim() !== ""
          );
        })
      : [];

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/secretaria/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ message, history }),
      signal: AbortSignal.timeout(240_000),
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        { reply: "O EA Flow recusou a chave de serviço do site (EA_FLOW_ADMIN_API_KEY)." },
        { status: 502 },
      );
    }

    const data = (await res.json().catch(() => null)) as {
      reply?: unknown;
      quotaExhausted?: unknown;
      viaAssinatura?: unknown;
      error?: unknown;
    } | null;

    if (!res.ok) {
      return NextResponse.json(
        { reply: typeof data?.error === "string" ? data.error : "Não consegui consultar o EA Flow agora." },
        { status: 502 },
      );
    }

    if (data?.quotaExhausted || typeof data?.reply !== "string" || !data.reply.trim()) {
      return NextResponse.json({
        reply:
          data?.viaAssinatura !== false
            ? "A IA pela assinatura do Gemini (EA Hunter / agy no PC) não respondeu a tempo. Confira se o PC está ligado com o EA Hunter rodando."
            : "Não consegui processar essa mensagem agora.",
        quotaExhausted: true,
      });
    }

    return NextResponse.json({ reply: data.reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/secretaria/chat] Erro:", msg);
    return NextResponse.json({ reply: "Tive um problema técnico ao processar isso agora. Pode repetir em instantes?" });
  }
}
