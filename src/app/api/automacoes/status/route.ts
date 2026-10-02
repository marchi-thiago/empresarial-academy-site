import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";
import { montarRespostaDoStatus } from "@/lib/automacoes/status";

/**
 * Status das automações do site e do Hunter para o Painel de Automações do EA Flow.
 *
 * Só GET, com `Authorization: Bearer ${SDR_SEGREDO}` (o segredo compartilhado entre Hunter, EA Flow e site;
 * contrato em Agentes/CONTRATO-SDR-ASSINATURA.md). Sem `SDR_SEGREDO` no servidor responde 503 e não lê nada do banco;
 * segredo errado, 401. Só LÊ: nada é gravado. O banco só é consultado quando alguém abre o painel.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const digest = (v: string) => createHash("sha256").update(v).digest();

function autorizar(request: Request): 401 | 503 | null {
  const segredo = process.env.SDR_SEGREDO;
  if (!segredo) return 503;
  const h = request.headers.get("authorization") ?? "";
  const token = (h.startsWith("Bearer ") ? h.slice(7) : "").trim();
  return token && timingSafeEqual(digest(token), digest(segredo)) ? null : 401;
}

export async function GET(request: Request) {
  const negado = autorizar(request);
  if (negado) return NextResponse.json({ erro: negado === 503 ? "não configurado" : "Não autorizado." }, { status: negado });
  try {
    const payload = await getPayloadClient();
    return NextResponse.json(await montarRespostaDoStatus(payload), { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    console.error(`[automacoes/status] falha ao montar o status: ${erro}`);
    return NextResponse.json({ erro: "falha_ao_montar_status" }, { status: 500 });
  }
}
