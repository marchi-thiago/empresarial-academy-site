import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";
import { encontrarLead, crmDb } from "@/lib/crm/payload-db";
import { temReferencia } from "@/lib/crm/identificar";
import { registrarInteracao } from "@/lib/crm/registrar";
import { CANAIS, DIRECOES, TIPOS, type Canal, type Direcao, type RefLead, type Tipo } from "@/lib/crm/tipos";

/**
 * Ingestão de eventos do CRM (EA Hunter, EA Flow, orquestrador). Contrato em
 * docs/outbound/CONTRATO-EVENTOS.md.
 *
 * Autenticação: `Authorization: Bearer ${CRM_INGEST_SECRET}`. Sem a variável
 * configurada a rota recusa tudo (fecha por padrão), nunca fica aberta.
 */

export const dynamic = "force-dynamic";

const MAX_EVENTOS = 100;

const digest = (v: string) => createHash("sha256").update(v).digest();

function autorizado(request: Request): boolean {
  const segredo = process.env.CRM_INGEST_SECRET;
  if (!segredo) return false;
  const h = request.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  return token.length > 0 && timingSafeEqual(digest(token), digest(segredo));
}

type Resultado =
  | { indice: number; ok: true; leadId: number; interacaoId: number | string; pontos: number; etapa: string; movimento: { de: string; para: string; automatico: boolean } | null }
  | { indice: number; ok: false; erro: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export async function POST(request: Request) {
  if (!process.env.CRM_INGEST_SECRET) {
    return NextResponse.json({ erro: "CRM_INGEST_SECRET não configurado neste ambiente." }, { status: 503 });
  }
  if (!autorizado(request)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const lista: unknown[] = isObj(corpo) && Array.isArray(corpo.eventos) ? corpo.eventos : isObj(corpo) ? [corpo] : [];
  if (lista.length === 0) return NextResponse.json({ erro: "Nenhum evento no corpo." }, { status: 400 });
  if (lista.length > MAX_EVENTOS) {
    return NextResponse.json({ erro: `No máximo ${MAX_EVENTOS} eventos por chamada.` }, { status: 413 });
  }

  const payload = await getPayloadClient();
  const db = crmDb(payload);
  const resultados: Resultado[] = [];

  for (let indice = 0; indice < lista.length; indice++) {
    const e = lista[indice];
    if (!isObj(e)) {
      resultados.push({ indice, ok: false, erro: "evento inválido" });
      continue;
    }
    const canal = e.canal as Canal;
    const direcao = e.direcao as Direcao;
    const tipo = e.tipo as Tipo;
    if (!CANAIS.includes(canal)) { resultados.push({ indice, ok: false, erro: "canal inválido" }); continue; }
    if (!DIRECOES.includes(direcao)) { resultados.push({ indice, ok: false, erro: "direcao inválida" }); continue; }
    if (!TIPOS.includes(tipo)) { resultados.push({ indice, ok: false, erro: "tipo inválido" }); continue; }

    const ref = (isObj(e.lead) ? e.lead : {}) as RefLead;
    if (!temReferencia(ref)) { resultados.push({ indice, ok: false, erro: "lead sem identificador (leadId, hunterId, instagram, email ou whatsapp)" }); continue; }

    let data: Date | undefined;
    if (e.data != null) {
      data = new Date(String(e.data));
      if (Number.isNaN(data.getTime())) { resultados.push({ indice, ok: false, erro: "data inválida" }); continue; }
    }
    if (e.pontos != null && typeof e.pontos !== "number") { resultados.push({ indice, ok: false, erro: "pontos deve ser número" }); continue; }

    try {
      const leadId = await encontrarLead(payload, ref);
      if (leadId == null) { resultados.push({ indice, ok: false, erro: "lead_nao_encontrado" }); continue; }
      const r = await registrarInteracao(db, {
        leadId,
        canal,
        direcao,
        tipo,
        conteudo: typeof e.conteudo === "string" ? e.conteudo : undefined,
        pontos: typeof e.pontos === "number" ? e.pontos : undefined,
        metadados: isObj(e.metadados) ? e.metadados : null,
        data,
        chave: typeof e.chave === "string" && e.chave ? e.chave : undefined,
      });
      resultados.push(
        r.ok
          ? { indice, ok: true, leadId, interacaoId: r.interacaoId, pontos: r.pontos, etapa: r.etapa, movimento: r.movimento }
          : { indice, ok: false, erro: r.motivo },
      );
    } catch (err) {
      payload.logger.error(`[crm/eventos] falha no evento ${indice}: ${err}`);
      resultados.push({ indice, ok: false, erro: "erro_interno" });
    }
  }

  // 200 mesmo com falhas parciais: o chamador lê `resultados` por evento.
  return NextResponse.json({ resultados });
}

// Método errado responde 405 sem tocar no banco.
export function GET() {
  return NextResponse.json({ erro: "Use POST." }, { status: 405 });
}
