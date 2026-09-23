import { NextResponse } from "next/server";
import { ASSESSOR_TOOL_DECLARATIONS, executeAssessorTool } from "@/lib/assessor/assessor-tools";
import { sendMail } from "@/lib/email";

function buildSystemPrompt(): string {
  const now = new Date();
  const agora = now.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const hojeISO = now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  return `Você é o EA Assessor, o assessor executivo pessoal de Thiago Marchi — fundador e líder executivo da Empresarial Academy.

DATA E HORA ATUAL: ${agora} (fuso America/Sao_Paulo). Hoje é ${hojeISO}. Use isso para resolver expressões relativas como "hoje", "amanhã", "essa semana" ao montar datas ISO 8601 para as ferramentas — nunca peça ao Thiago para informar a data de hoje, você já sabe.

POSTURA — proativo e objetivo, sempre. É o que te diferencia de um chatbot:
- PROATIVO: você é consultivo, não reativo. Quando Thiago descrever uma situação, proponha a ação concreta (agendar, redigir o e-mail, sugerir horário) em vez de só confirmar que entendeu. Antecipe o próximo passo óbvio e aponte por conta própria o que ele provavelmente ia querer saber (conflito de agenda, algo pendente há dias).
- OBJETIVO: frases curtas, direto ao ponto, sem enrolação nem preâmbulo.
- Nunca finja ter executado uma ação. Se uma ferramenta falhar ou uma conexão não estiver disponível, diga exatamente isso.

REGRA DE CONFIRMAÇÃO — ações que escrevem em sistemas externos (criar evento, enviar e-mail):
- O único dado sempre obrigatório para criar_evento_agenda é título, data e horário. Participante/e-mail NÃO é obrigatório — se Thiago não souber ou não tiver o e-mail de alguém, crie o evento assim mesmo (como lembrete pessoal) e diga que pode adicionar o participante depois. NUNCA bloqueie a criação do evento só porque falta um e-mail.
- Se você não conseguir uma informação (ex: buscar e-mail de alguém), não pare a conversa nisso: informe a limitação em uma frase E já execute a parte que você consegue fazer sem aquele dado.
- Se o pedido já vier com os detalhes essenciais, isso já é confirmação suficiente — execute direto.
- Quando Thiago responder a uma pergunta sua, isso é a confirmação e o contexto da ação pendente — complete a ação com o que já foi dito na conversa, não reinicie a pergunta do zero.
- Se a ação for ambígua ou de alto impacto, resuma o que vai fazer e peça confirmação rápida antes de executar.

FERRAMENTAS DISPONÍVEIS:
- consultar_agenda, criar_evento_agenda, enviar_email (Google e/ou Outlook, conforme o que estiver conectado).
Se uma ferramenta disser que a conexão não está configurada, informe isso com transparência — é pendência de autorização do Thiago, não erro seu.

Este é o painel de teste interno (EA HUB), não o WhatsApp real — mas as ferramentas executam ações reais quando conectadas. Fale em português do Brasil, fuso America/Sao_Paulo.`;
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

async function callGemini(contents: GeminiContent[], apiKey: string, model: string) {
  const payload = {
    system_instruction: { parts: [{ text: buildSystemPrompt() }] },
    contents,
    tools: [{ function_declarations: ASSESSOR_TOOL_DECLARATIONS }],
    generationConfig: { temperature: 0.6, maxOutputTokens: 800 },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errText}`);
  }

  return res.json();
}

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();
    if (!message) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || "";
    const model = process.env.GEMINI_MODEL || "gemini-flash-latest";

    if (!apiKey) {
      return NextResponse.json({
        reply: "Recebi sua mensagem, mas o motor de IA ainda não está configurado (GEMINI_API_KEY ausente).",
      });
    }

    const priorTurns: GeminiContent[] = Array.isArray(history)
      ? history
          .filter((h: unknown): h is { role: string; text: string } => {
            const item = h as { role?: unknown; text?: unknown };
            return (item.role === "user" || item.role === "model") && typeof item.text === "string" && item.text.trim() !== "";
          })
          .map((h) => ({ role: h.role, parts: [{ text: h.text }] }))
      : [];

    const contents: GeminiContent[] = [...priorTurns, { role: "user", parts: [{ text: message }] }];

    const MAX_TOOL_ROUNDS = 4;
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const data = await callGemini(contents, apiKey, model);
      const candidate = data.candidates?.[0];
      const parts: GeminiPart[] = candidate?.content?.parts || [];

      const functionCalls = parts.filter((p) => p.functionCall);
      if (!functionCalls.length) {
        const text = parts.find((p) => p.text)?.text;
        return NextResponse.json({ reply: text || "Como posso te ajudar agora?" });
      }

      contents.push({ role: "model", parts });

      const functionResponseParts: GeminiPart[] = [];
      for (const part of functionCalls) {
        const call = part.functionCall!;
        const result = await executeAssessorTool(call.name, call.args || {});
        functionResponseParts.push({
          functionResponse: { name: call.name, response: { ok: result.ok, summary: result.summary } },
        });
      }
      contents.push({ role: "user", parts: functionResponseParts });
    }

    return NextResponse.json({
      reply: "Essa solicitação envolveu mais etapas do que consigo concluir numa resposta só. Pode confirmar o que falta?",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/secretaria/chat] Erro:", msg);
    const isQuota = /429|402|resource_exhausted|quota exceeded|quota_exceeded|insufficient quota|credit balance|billing/i.test(msg);
    if (isQuota) {
      const emailDestino = process.env.ALERT_EMAIL || "thiago@empresarialacademy.com";
      void sendMail({
        to: emailDestino,
        subject: "🚨 [ALERTA CRÍTICO] Saldo da API de IA Esgotado - Painel Secretária",
        text: `O saldo ou quota da API do Google Gemini esgotou no Painel da Secretária.\n\nAção necessária: recarregar créditos no Google AI Studio / Google Cloud.\n\nDetalhe do erro: ${msg}`,
        html: `<div style="font-family:Arial,sans-serif;padding:16px"><h2 style="color:#b91c1c">🚨 Saldo de API de IA Esgotado</h2><p>O saldo ou quota da API Google Gemini esgotou no painel da Secretária.</p><p><strong>Ação necessária:</strong> recarregar créditos no Google AI Studio / Google Cloud.</p><p><code>${msg.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string)}</code></p></div>`,
      }).catch((mailErr) => console.error("[api/secretaria/chat] Falha ao enviar e-mail de alerta:", mailErr));

      return NextResponse.json({ reply: "", quotaExhausted: true });
    }
    return NextResponse.json({ reply: "Tive um problema técnico ao processar isso agora. Pode repetir em instantes?" });
  }
}
