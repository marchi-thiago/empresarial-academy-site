import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";
import { dataIso } from "@/lib/outbound/tempo";

export const dynamic = "force-dynamic";

interface HeartbeatPayload {
  status?: string;
  ia_teto_atingido?: boolean;
  chamadas_ia?: number;
  teto_ia?: number;
  ultima_sincronizacao?: string;
  pid?: number;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "ok";
  const iaTeto = url.searchParams.get("ia_teto") === "1" || url.searchParams.get("ia_teto") === "true";

  return processarHeartbeat({
    status,
    ia_teto_atingido: iaTeto,
  });
}

export async function POST(request: Request) {
  let body: HeartbeatPayload = {};
  try {
    body = (await request.json()) as HeartbeatPayload;
  } catch {
    // Body vazio ou não JSON: aceita como ping simples
  }

  return processarHeartbeat(body);
}

async function processarHeartbeat(dados: HeartbeatPayload) {
  const agora = new Date();
  const payload = await getPayloadClient();

  try {
    // 1. Atualizar ou criar marcador de heartbeat
    const existentes = await payload.find({
      collection: "interacoes",
      where: { chave: { equals: "sistema:heartbeat:hunter" } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });

    const metadados: Record<string, unknown> = {
      recebidoEm: agora.toISOString(),
      pid: dados.pid,
      status: dados.status ?? "ok",
      chamadas_ia: dados.chamadas_ia,
      teto_ia: dados.teto_ia,
    };

    if (existentes.docs.length > 0) {
      await payload.update({
        collection: "interacoes",
        id: existentes.docs[0].id,
        depth: 0,
        overrideAccess: true,
        data: {
          data: agora.toISOString(),
          metadados,
        },
      });
    } else {
      await payload.create({
        collection: "interacoes",
        depth: 0,
        overrideAccess: true,
        data: {
          chave: "sistema:heartbeat:hunter",
          canal: "sistema",
          direcao: "entrada",
          tipo: "lembrete",
          conteudo: "Heartbeat EA Hunter",
          pontos: 0,
          metadados,
          data: agora.toISOString(),
        },
      });
    }

    // 2. Se reportou teto de IA atingido, registrar marcador do dia
    if (dados.ia_teto_atingido) {
      const chaveTeto = `sistema:ia_teto:${dataIso(agora)}`;
      const tetoExistente = await payload.find({
        collection: "interacoes",
        where: { chave: { equals: chaveTeto } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });

      if (tetoExistente.docs.length === 0) {
        await payload.create({
          collection: "interacoes",
          depth: 0,
          overrideAccess: true,
          data: {
            chave: chaveTeto,
            canal: "sistema",
            direcao: "saida",
            tipo: "lembrete",
            conteudo: `Teto diário de IA atingido: ${dados.chamadas_ia ?? "N/A"} de ${dados.teto_ia ?? "N/A"}`,
            pontos: 0,
            metadados: {
              chamadas: dados.chamadas_ia,
              teto: dados.teto_ia,
              registradoEm: agora.toISOString(),
            },
            data: agora.toISOString(),
          },
        });
      }
    }

    // 3. Se passou última sincronização, atualizar marcador de sync
    if (dados.ultima_sincronizacao) {
      const syncExistente = await payload.find({
        collection: "interacoes",
        where: { chave: { equals: "sistema:sync:hunter" } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });

      const syncMeta = { ultimaSincronizacao: dados.ultima_sincronizacao, registradoEm: agora.toISOString() };
      if (syncExistente.docs.length > 0) {
        await payload.update({
          collection: "interacoes",
          id: syncExistente.docs[0].id,
          depth: 0,
          overrideAccess: true,
          data: {
            data: dados.ultima_sincronizacao,
            metadados: syncMeta,
          },
        });
      } else {
        await payload.create({
          collection: "interacoes",
          depth: 0,
          overrideAccess: true,
          data: {
            chave: "sistema:sync:hunter",
            canal: "sistema",
            direcao: "entrada",
            tipo: "lembrete",
            conteudo: "Última sincronização EA Hunter",
            pontos: 0,
            metadados: syncMeta,
            data: dados.ultima_sincronizacao,
          },
        });
      }
    }

    return NextResponse.json({ ok: true, recebidoEm: agora.toISOString() });
  } catch (erro) {
    payload.logger.error(`[outbound/heartbeat] erro ao processar heartbeat: ${erro}`);
    return NextResponse.json({ erro: "falha_ao_registrar_heartbeat" }, { status: 500 });
  }
}
