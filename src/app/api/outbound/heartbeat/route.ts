import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";
import { outboundDb } from "@/lib/outbound/payload-outbound";
import { dataIso } from "@/lib/outbound/tempo";

/**
 * Sinal de vida do EA Hunter (F12). Grava os marcadores que `verificarAlertas` lê:
 * `sistema:heartbeat:hunter` (cada chamada), `sistema:ia_teto:<dia>` (quando o teto de IA estourou) e
 * `sistema:sync:hunter` (quando o Hunter informa `ultima_sincronizacao`).
 *
 * Autenticação, como os crons do site: `Authorization: Bearer ${CRON_SECRET}` ou `?key=${CRON_SECRET}`.
 * O `?key=` existe porque o Hunter pinga por GET numa URL só (`HEARTBEAT_PING_URL`), sem cabeçalho.
 * Sem CRON_SECRET a rota recusa tudo (503): nunca fica aberta, porque grava no banco.
 *
 * GET: `?status=ok&ia_teto=1`. POST (JSON): `{ status, pid, ia_teto_atingido, chamadas_ia, teto_ia, ultima_sincronizacao }`.
 */

export const dynamic = "force-dynamic";

type Corpo = {
  status?: unknown;
  pid?: unknown;
  ia_teto_atingido?: unknown;
  chamadas_ia?: unknown;
  teto_ia?: unknown;
  ultima_sincronizacao?: unknown;
};

const digest = (v: string) => createHash("sha256").update(v).digest();

function autorizar(request: Request): 401 | 503 | null {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return 503;
  const h = request.headers.get("authorization") ?? "";
  const token = (h.startsWith("Bearer ") ? h.slice(7) : (new URL(request.url).searchParams.get("key") ?? "")).trim();
  return token && timingSafeEqual(digest(token), digest(segredo)) ? null : 401;
}

const numero = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const data = (v: unknown): Date | null => {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

async function registrar(request: Request, c: Corpo) {
  const negado = autorizar(request);
  if (negado) return NextResponse.json({ erro: negado === 503 ? "não configurado" : "Não autorizado." }, { status: negado });

  const agora = new Date();
  const payload = await getPayloadClient();
  const db = outboundDb(payload);
  const chamadas = numero(c.chamadas_ia);
  const teto = numero(c.teto_ia);
  try {
    await db.gravarMarcador?.(
      "sistema:heartbeat:hunter",
      { recebidoEm: agora.toISOString(), status: typeof c.status === "string" ? c.status.slice(0, 40) : "ok", pid: numero(c.pid), chamadas_ia: chamadas, teto_ia: teto },
      agora,
    );
    if (c.ia_teto_atingido === true) {
      await db.criarMarcador(`sistema:ia_teto:${dataIso(agora)}`, { chamadas, teto, registradoEm: agora.toISOString() });
    }
    const sync = data(c.ultima_sincronizacao);
    if (sync) await db.gravarMarcador?.("sistema:sync:hunter", { ultimaSincronizacao: sync.toISOString(), registradoEm: agora.toISOString() }, sync);
    return NextResponse.json({ ok: true, recebidoEm: agora.toISOString() });
  } catch (erro) {
    payload.logger.error(`[outbound/heartbeat] erro ao registrar: ${erro}`);
    return NextResponse.json({ erro: "falha_ao_registrar_heartbeat" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  return registrar(request, { status: q.get("status") ?? "ok", ia_teto_atingido: q.get("ia_teto") === "1" || q.get("ia_teto") === "true" });
}

export async function POST(request: Request) {
  const corpo = (await request.json().catch(() => null)) as Corpo | null;
  return registrar(request, corpo && typeof corpo === "object" ? corpo : {});
}
