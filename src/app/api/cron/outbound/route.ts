import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";
import { depsDeProducao } from "@/lib/outbound/payload-outbound";
import { rodar } from "@/lib/outbound/orquestrador";

/**
 * Orquestrador do outbound (F6). Chamado a cada ~10 minutos por um chamador externo (o worker do Hunter;
 * o plano Hobby da Vercel só aceita cron diário). Cada chamada envia no máximo 1 e-mail e só quando
 * `OUTBOUND_ENVIO_REAL` inclui `email`; sem isso, simula e grava "o que sairia hoje" em `interacoes`.
 *
 * Autenticação: `Authorization: Bearer ${CRON_SECRET}`. Diferente dos outros crons, sem CRON_SECRET a rota
 * recusa tudo (nunca fica aberta). `?dry=1` calcula e responde sem gravar nada.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const digest = (v: string) => createHash("sha256").update(v).digest();

function autorizado(request: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const h = request.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  return token.length > 0 && timingSafeEqual(digest(token), digest(segredo));
}

async function executar(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const payload = await getPayloadClient();
  try {
    const relatorio = await rodar(depsDeProducao(payload), { dry });
    return NextResponse.json(relatorio);
  } catch (e) {
    payload.logger.error(`[outbound] orquestrador falhou: ${e}`);
    return NextResponse.json({ erro: "falha_no_orquestrador" }, { status: 500 });
  }
}

export const GET = executar;
export const POST = executar;
