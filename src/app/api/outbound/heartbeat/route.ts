import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";
import { outboundDb } from "@/lib/outbound/payload-outbound";
import { dataIso } from "@/lib/outbound/tempo";
import { CHAVE_STATUS_HUNTER } from "@/lib/automacoes/chaves";
import { automacoesDoCorpo } from "@/lib/automacoes/hunter";

/**
 * Sinal de vida do EA Hunter (F12). Grava os marcadores que `verificarAlertas` lê:
 * `sistema:heartbeat:hunter` (cada chamada), `sistema:ia_teto:<dia>` (quando o teto de IA estourou) e
 * `sistema:sync:hunter` (quando o Hunter informa `ultima_sincronizacao`).
 *
 * Só POST, com `Authorization: Bearer ${CRON_SECRET}` (o mesmo segredo de /api/cron/outbound). GET não grava nada
 * (responde 405): gravar em GET deixaria prefetch, robô ou link colado disparar escrita no banco, e o segredo
 * iria parar em URL e em log. Sem CRON_SECRET a rota recusa tudo (503).
 *
 * Corpo JSON (todos opcionais): `{ status, pid, ia_teto_atingido, chamadas_ia, teto_ia, ultima_sincronizacao, automacoes,
 * automacoes_geradas_em }`. `automacoes` é o status das automações do Hunter no formato padrão do Painel de Automações
 * (lista validada aqui; fica num registro único, sobrescrito, em `sistema:status:hunter`, e o EA Flow lê por
 * `GET /api/automacoes/status`).
 * O alerta de teto de IA só dispara se o Hunter mandar `ia_teto_atingido: true`; o de sincronização só vale se
 * mandar `ultima_sincronizacao` (ISO 8601). Contrato completo em docs/outbound/RUNBOOK.md.
 */

export const dynamic = "force-dynamic";

type Corpo = {
  status?: unknown;
  pid?: unknown;
  ia_teto_atingido?: unknown;
  chamadas_ia?: unknown;
  teto_ia?: unknown;
  ultima_sincronizacao?: unknown;
  automacoes?: unknown;
  automacoes_geradas_em?: unknown;
};

const digest = (v: string) => createHash("sha256").update(v).digest();

function autorizar(request: Request): 401 | 503 | null {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return 503;
  const h = request.headers.get("authorization") ?? "";
  const token = (h.startsWith("Bearer ") ? h.slice(7) : "").trim();
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
    const automacoes = automacoesDoCorpo(c.automacoes);
    if (automacoes.length > 0) {
      const gerado = data(c.automacoes_geradas_em);
      await db.gravarMarcador?.(CHAVE_STATUS_HUNTER, { geradoEm: (gerado ?? agora).toISOString(), automacoes }, agora);
    }
    return NextResponse.json({ ok: true, recebidoEm: agora.toISOString() });
  } catch (erro) {
    payload.logger.error(`[outbound/heartbeat] erro ao registrar: ${erro}`);
    return NextResponse.json({ erro: "falha_ao_registrar_heartbeat" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ erro: "Use POST com Authorization: Bearer." }, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(request: Request) {
  const corpo = (await request.json().catch(() => null)) as Corpo | null;
  return registrar(request, corpo && typeof corpo === "object" ? corpo : {});
}
