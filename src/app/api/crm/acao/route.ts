import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";
import { crmDb } from "@/lib/crm/payload-db";
import { registrarInteracao } from "@/lib/crm/registrar";
import { carregarLeadSlim } from "@/lib/crm/dados";
import { cartaoDe } from "@/lib/crm/telas/cartao";
import { planejarAcao, type Acao } from "@/lib/crm/telas/acoes";

/**
 * Ações do Thiago nas telas do CRM: arrastar card, botões da Fila do dia e próximo passo.
 * Só usuário logado no admin (cookie do Payload). Toda mudança de etapa passa por
 * `registrarInteracao()`, então fica na linha do tempo e aplica as regras do CRM.
 * A validação e o que gravar estão em `planejarAcao` (testado em src/lib/crm/telas).
 */

export const dynamic = "force-dynamic";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Barra pedido vindo de outro site (o cookie do admin iria junto). */
function mesmaOrigem(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // fetch do próprio site sem Origin (navegadores antigos)
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
  if (!isObj(corpo) || typeof corpo.acao !== "string") return NextResponse.json({ erro: "Ação ausente." }, { status: 400 });
  const leadId = Number(corpo.leadId);
  if (!Number.isInteger(leadId) || leadId <= 0) return NextResponse.json({ erro: "Lead inválido." }, { status: 400 });

  const db = crmDb(payload);
  const estado = await db.carregarLead(leadId);
  if (!estado) return NextResponse.json({ erro: "Lead não encontrado." }, { status: 404 });

  const plano = planejarAcao({ ...corpo, leadId } as unknown as Acao, estado.etapa);
  if (!plano.ok) return NextResponse.json({ erro: plano.erro }, { status: 422 });

  try {
    for (const i of plano.interacoes) {
      const r = await registrarInteracao(db, { leadId, canal: i.canal, direcao: i.direcao, tipo: i.tipo, conteudo: i.conteudo, metadados: i.metadados });
      if (!r.ok) return NextResponse.json({ erro: "Não foi possível registrar a interação." }, { status: 409 });
    }

    const l = plano.lead;
    const data: Record<string, unknown> = {};
    if (l.motivoResultado) data.motivoResultado = { motivo: l.motivoResultado.motivo, detalhe: l.motivoResultado.detalhe };
    if ("proximoPasso" in l) data.proximoPasso = l.proximoPasso;
    if ("proximoPassoEm" in l) data.proximoPassoEm = l.proximoPassoEm;
    if (Object.keys(data).length > 0) {
      await payload.update({ collection: "leads", id: leadId, data: data as never, overrideAccess: true, depth: 0 });
    }
  } catch (e) {
    payload.logger.error(`[crm] ação ${String(corpo.acao)} falhou no lead ${leadId}: ${e}`);
    return NextResponse.json({ erro: "Não foi possível salvar. Tente de novo." }, { status: 500 });
  }

  const slim = await carregarLeadSlim(payload, leadId);
  return NextResponse.json({ ok: true, cartao: slim ? cartaoDe(slim) : null });
}
