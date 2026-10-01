import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";
import { crmDb } from "@/lib/crm/payload-db";
import { registrarInteracao } from "@/lib/crm/registrar";
import { carregarLeadSlim } from "@/lib/crm/dados";
import { cartaoDe } from "@/lib/crm/telas/cartao";

/**
 * Ações manuais do LinkedIn semiautomático (Plano Outbound F10):
 * - POST /api/crm/linkedin com { leadId, acao: "enviado" | "aceito" }
 *
 * "enviado": grava interação `enviado` no canal linkedin (as regras do CRM levam statusEntrega.linkedin a convite_enviado).
 * "aceito": grava interação `entregue` no canal linkedin (leva a aceito). O status nunca anda para trás.
 *
 * Requer autenticação do Payload (cookie do admin).
 */

export const dynamic = "force-dynamic";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function mesmaOrigem(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!mesmaOrigem(req)) return NextResponse.json({ erro: "Origem não permitida." }, { status: 403 });
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ erro: "Envie JSON." }, { status: 415 });
  }

  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: req.headers });
  if (!user) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  if (!isObj(corpo)) return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });

  const leadId = Number(corpo.leadId);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return NextResponse.json({ erro: "Lead inválido." }, { status: 400 });
  }

  const acao = String(corpo.acao ?? corpo.resultado ?? "");
  if (acao !== "enviado" && acao !== "aceito" && acao !== "enviado_linkedin" && acao !== "aceito_linkedin") {
    return NextResponse.json({ erro: "Ação inválida. Use 'enviado' ou 'aceito'." }, { status: 400 });
  }

  const db = crmDb(payload);
  const estado = await db.carregarLead(leadId);
  if (!estado) return NextResponse.json({ erro: "Lead não encontrado." }, { status: 404 });

  const ehEnviado = acao === "enviado" || acao === "enviado_linkedin";
  // Tipos que o enum do banco já tem: "enviado" (convite) e "entregue" (aceito). As regras do CRM
  // (regras.ts, canal linkedin) já os traduzem em convite_enviado e aceito em statusEntrega.
  const tipo = ehEnviado ? "enviado" : "entregue";
  const direcao = ehEnviado ? "saida" : "entrada";
  const conteudo = ehEnviado
    ? "Convite do LinkedIn enviado pelo Thiago"
    : "Convite do LinkedIn aceito pelo lead";

  try {
    const res = await registrarInteracao(db, {
      leadId,
      canal: "linkedin",
      direcao,
      tipo,
      conteudo,
      metadados: { toque: "linkedin", origemAcao: "fila_linkedin", evento: ehEnviado ? "convite_enviado" : "convite_aceito" },
    });

    if (!res.ok) {
      return NextResponse.json({ erro: "Não foi possível registrar a interação." }, { status: 409 });
    }
  } catch (e) {
    payload.logger.error(`[crm/linkedin] ação ${acao} falhou no lead ${leadId}: ${e}`);
    return NextResponse.json({ erro: "Não foi possível salvar. Tente de novo." }, { status: 500 });
  }

  const slim = await carregarLeadSlim(payload, leadId);
  return NextResponse.json({
    ok: true,
    leadId,
    statusLinkedin: slim?.entrega.linkedin ?? null,
    cartao: slim ? cartaoDe(slim) : null,
  });
}
