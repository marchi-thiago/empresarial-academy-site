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
 * "enviado": grava interação linkedin_convite_enviado, atualiza statusEntrega.linkedin para convite_enviado.
 * "aceito": grava interação linkedin_aceito, atualiza statusEntrega.linkedin para aceito.
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
  const tipo = ehEnviado ? "linkedin_convite_enviado" : "linkedin_aceito";
  const direcao = ehEnviado ? "saida" : "entrada";
  const conteudo = ehEnviado
    ? "Convite do LinkedIn enviado pelo Thiago"
    : "Convite do LinkedIn aceito pelo lead";
  const novoStatusEntrega = ehEnviado ? "convite_enviado" : "aceito";

  try {
    const res = await registrarInteracao(db, {
      leadId,
      canal: "linkedin",
      direcao,
      tipo,
      conteudo,
      metadados: { toque: "linkedin", origemAcao: "fila_linkedin" },
    });

    if (!res.ok) {
      return NextResponse.json({ erro: "Não foi possível registrar a interação." }, { status: 409 });
    }

    // Garante a gravação direta de statusEntrega.linkedin no lead
    await payload.update({
      collection: "leads",
      id: leadId,
      data: {
        statusEntrega: {
          ...estado.statusEntrega,
          linkedin: novoStatusEntrega,
        },
      } as never,
      overrideAccess: true,
      depth: 0,
    });
  } catch (e) {
    payload.logger.error(`[crm/linkedin] ação ${acao} falhou no lead ${leadId}: ${e}`);
    return NextResponse.json({ erro: "Não foi possível salvar. Tente de novo." }, { status: 500 });
  }

  const slim = await carregarLeadSlim(payload, leadId);
  return NextResponse.json({
    ok: true,
    leadId,
    statusLinkedin: novoStatusEntrega,
    cartao: slim ? cartaoDe(slim) : null,
  });
}
