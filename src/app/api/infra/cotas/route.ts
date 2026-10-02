import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";
import { registrosValidos } from "@/lib/infra/cotas";
import { guardarRegistros } from "@/lib/infra/cotas-db";

/**
 * Retrato diário de cotas do Neon e da Vercel, enviado pelo EA Hunter (uma vez por dia). Guarda um registro por dia
 * (marcador `infra:cotas:AAAA-MM-DD` em `interacoes`) e o cartão do /eahub/apis desenha o gráfico dos últimos 30 dias.
 *
 * Só POST, com `Authorization: Bearer ${SDR_SEGREDO}` (o segredo compartilhado entre Hunter, EA Flow e site).
 * Sem `SDR_SEGREDO` no servidor responde 503 e não grava nada; segredo errado, 401. GET responde 405 e não lê nem grava:
 * gravar ou ler em GET deixaria robô, prefetch ou link colado mexer no banco.
 * Corpo: `{ registros: DiaDeCotas[] }` (até 40 dias; contrato em `src/lib/infra/cotas.ts`).
 */

export const dynamic = "force-dynamic";

const digest = (v: string) => createHash("sha256").update(v).digest();

function autorizar(request: Request): 401 | 503 | null {
  const segredo = process.env.SDR_SEGREDO;
  if (!segredo) return 503;
  const h = request.headers.get("authorization") ?? "";
  const token = (h.startsWith("Bearer ") ? h.slice(7) : "").trim();
  return token && timingSafeEqual(digest(token), digest(segredo)) ? null : 401;
}

export async function GET() {
  return NextResponse.json({ erro: "Use POST com Authorization: Bearer." }, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(request: Request) {
  const negado = autorizar(request);
  if (negado) return NextResponse.json({ erro: negado === 503 ? "não configurado" : "Não autorizado." }, { status: negado });

  const corpo = await request.json().catch(() => null);
  const registros = registrosValidos(corpo);
  if (registros.length === 0) return NextResponse.json({ erro: "nenhum registro válido" }, { status: 400 });

  try {
    const payload = await getPayloadClient();
    const gravados = await guardarRegistros(payload, registros);
    return NextResponse.json({ ok: true, recebidos: registros.length, gravados });
  } catch (erro) {
    console.error(`[infra/cotas] falha ao gravar: ${erro}`);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 500 });
  }
}
