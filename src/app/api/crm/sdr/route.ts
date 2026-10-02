import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";
import { crmDb } from "@/lib/crm/payload-db";
import { registrarInteracao } from "@/lib/crm/registrar";
import { carregarLeadSlim } from "@/lib/crm/dados";
import { alterarEstadoSdr, apresentarSdr, configSdr, consultarEstadoSdr, contatoDoLead, textoLinhaDoTempo, type AcaoSdr, type SituacaoSdr } from "@/lib/crm/sdr";

/**
 * Estado do SDR do EA Assessor na ficha do cliente e botão "Voltar ao SDR" / "Tirar do SDR".
 * Só usuário logado no admin (cookie do Payload). A chamada ao EA Flow sai daqui, com o
 * segredo (SDR_SEGREDO) que nunca chega ao navegador. Contrato: Agentes/CONTRATO-SDR-ASSINATURA.md.
 */

export const dynamic = "force-dynamic";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Barra pedido vindo de outro site (o cookie do admin iria junto). */
function mesmaOrigem(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

const resposta = (situacao: SituacaoSdr, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ situacao, ...apresentarSdr(situacao), ...extra });

async function lead(req: Request, leadIdBruto: unknown) {
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: req.headers });
  if (!user) return { ok: false, resposta: NextResponse.json({ erro: "Não autorizado." }, { status: 401 }) } as const;
  const leadId = Number(leadIdBruto);
  if (!Number.isInteger(leadId) || leadId <= 0) return { ok: false, resposta: NextResponse.json({ erro: "Lead inválido." }, { status: 400 }) } as const;
  const slim = await carregarLeadSlim(payload, leadId);
  if (!slim) return { ok: false, resposta: NextResponse.json({ erro: "Lead não encontrado." }, { status: 404 }) } as const;
  return { ok: true, payload, leadId, slim } as const;
}

export async function GET(req: Request) {
  const l = await lead(req, new URL(req.url).searchParams.get("leadId"));
  if (!l.ok) return l.resposta;
  const config = configSdr();
  if (!config) return resposta("nao_configurado");
  const contato = contatoDoLead(l.slim);
  if (!contato) return resposta("sem_contato");
  const r = await consultarEstadoSdr(contato, config);
  return resposta(r.ok ? r.estado : r.situacao);
}

export async function POST(req: Request) {
  if (!mesmaOrigem(req)) return NextResponse.json({ erro: "Origem não permitida." }, { status: 403 });
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ erro: "Envie JSON." }, { status: 415 });
  }
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  if (!isObj(corpo) || (corpo.acao !== "retomar" && corpo.acao !== "pausar")) {
    return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
  }
  const acao = corpo.acao as AcaoSdr;

  const l = await lead(req, corpo.leadId);
  if (!l.ok) return l.resposta;

  const config = configSdr();
  if (!config) return resposta("nao_configurado", { erro: "SDR não configurado." });
  const contato = contatoDoLead(l.slim);
  if (!contato) return resposta("sem_contato", { erro: "Este lead não tem telefone nem Instagram." });

  const r = await alterarEstadoSdr(contato, acao, config);
  if (!r.ok) return resposta(r.situacao, { erro: "Não foi possível falar com o EA Flow. Tente de novo." });

  // Só vira linha do tempo o que de fato mudou no EA Flow (se o SDR geral está desligado, nada aconteceu).
  const esperado = acao === "retomar" ? "sdr" : "thiago";
  if (r.estado === esperado) {
    try {
      await registrarInteracao(crmDb(l.payload), {
        leadId: l.leadId,
        canal: "nota",
        direcao: "saida",
        tipo: "lembrete",
        conteudo: textoLinhaDoTempo(acao),
        metadados: { sdr: acao },
      });
    } catch (e) {
      l.payload.logger.error(`[crm] SDR ${acao} aplicado, mas a nota do lead ${l.leadId} falhou: ${e}`);
    }
  }
  return resposta(r.estado, r.estado === esperado ? {} : { erro: "O SDR está desligado. Ligue pela Secretaria." });
}
