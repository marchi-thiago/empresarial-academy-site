import type { Payload, Where } from "payload";
import { ETAPAS_NA_CADENCIA } from "@/lib/outbound/cadencia";
import { inicioDoDia } from "@/lib/outbound/tempo";
import { CHAVE_HEARTBEAT_HUNTER, CHAVE_RODADA, CHAVE_STATUS_HUNTER } from "./chaves";
import { automacoesDoCorpo, type StatusGuardadoDoHunter } from "./hunter";
import type { DadosDoSite, LinhaAgregada, RodadaDoOrquestrador } from "./site";

/**
 * Leitura do banco para o Painel de Automações. Só roda quando alguém abre o painel (o EA Flow chama
 * `GET /api/automacoes/status` ao abrir a tela): o Neon do site não acorda por causa do painel em nenhum outro momento.
 * Uma varredura agregada de `interacoes` (sem trazer linha por linha), alguns `count` de leads e um `find` de 3 marcadores.
 */

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface Janelas {
  agora: Date;
  /** Início do dia de Brasília. */
  hoje: Date;
  /** Há 6 dias, no início do dia de Brasília (7 dias contando hoje). */
  semana: Date;
  ultimas24h: Date;
}

export function janelas(agora: Date): Janelas {
  const hoje = inicioDoDia(agora);
  return { agora, hoje, semana: new Date(hoje.getTime() - 6 * 86_400_000), ultimas24h: new Date(agora.getTime() - 24 * 3_600_000) };
}

const txt = (v: unknown): string => (typeof v === "string" ? v : "");
const data = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Agrupamento em memória (SQLite de desenvolvimento). Em produção (Postgres) o mesmo agrupamento é feito em SQL. */
export function agregarInteracoesEmMemoria(docs: Doc[], j: Janelas): LinhaAgregada[] {
  const mapa = new Map<string, LinhaAgregada>();
  for (const d of docs) {
    const quando = data(d.data);
    if (!quando) continue;
    const partes = txt(d.chave).split(":");
    const linha = {
      canal: txt(d.canal),
      direcao: txt(d.direcao),
      tipo: txt(d.tipo),
      simulado: (d.metadados as Doc | null)?.simulado === true,
      p1: partes[0] ?? "",
      p2: partes[1] ?? "",
    };
    const k = [linha.canal, linha.direcao, linha.tipo, linha.simulado, linha.p1, linha.p2].join("|");
    const a = mapa.get(k) ?? { ...linha, hoje: 0, semana: 0, ultimas24h: 0, ultima: null };
    if (quando >= j.hoje) a.hoje++;
    if (quando >= j.semana) a.semana++;
    if (quando >= j.ultimas24h) a.ultimas24h++;
    if (!a.ultima || quando > a.ultima) a.ultima = quando;
    mapa.set(k, a);
  }
  return [...mapa.values()];
}

type Pool = { query: (s: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

async function carregarLinhas(payload: Payload, j: Janelas): Promise<LinhaAgregada[]> {
  const pool = (payload.db as unknown as { pool?: Pool }).pool;
  if (!pool) {
    const r = await payload.find({ collection: "interacoes", pagination: false, depth: 0, overrideAccess: true });
    return agregarInteracoesEmMemoria(r.docs as Doc[], j);
  }
  const r = await pool.query(
    `SELECT canal::text AS canal, direcao::text AS direcao, tipo::text AS tipo,
            (COALESCE(metadados->>'simulado', '') = 'true') AS simulado,
            split_part(COALESCE(chave, ''), ':', 1) AS p1, split_part(COALESCE(chave, ''), ':', 2) AS p2,
            (count(*) FILTER (WHERE data >= $1))::int AS hoje,
            (count(*) FILTER (WHERE data >= $2))::int AS semana,
            (count(*) FILTER (WHERE data >= $3))::int AS ultimas24h,
            max(data) AS ultima
       FROM interacoes GROUP BY 1, 2, 3, 4, 5, 6`,
    [j.hoje.toISOString(), j.semana.toISOString(), j.ultimas24h.toISOString()],
  );
  return r.rows.map((x) => ({
    canal: String(x.canal),
    direcao: String(x.direcao),
    tipo: String(x.tipo),
    simulado: x.simulado === true,
    p1: String(x.p1 ?? ""),
    p2: String(x.p2 ?? ""),
    hoje: Number(x.hoje),
    semana: Number(x.semana),
    ultimas24h: Number(x.ultimas24h),
    ultima: data(x.ultima),
  }));
}

/** Rodada guardada pelo orquestrador (marcador `sistema:orquestrador:rodada`). */
export function rodadaDoMarcador(doc: Doc | undefined): RodadaDoOrquestrador | null {
  const em = data(doc?.data);
  if (!doc || !em) return null;
  const m = (doc.metadados as Doc | null) ?? {};
  const contagem: Record<string, number> = {};
  for (const [dia, n] of Object.entries((m.contagem as Record<string, unknown> | undefined) ?? {})) if (typeof n === "number" && Number.isFinite(n)) contagem[dia] = n;
  const erros: Record<string, string> = {};
  for (const [nome, e] of Object.entries((m.erros as Record<string, unknown> | undefined) ?? {})) erros[nome] = String(e).slice(0, 200);
  return {
    em,
    modo: typeof m.modo === "string" ? m.modo : null,
    contagem,
    rotinas: Array.isArray(m.rotinas) ? m.rotinas.filter((x): x is string => typeof x === "string") : [],
    erros,
  };
}

export interface MarcadoresDoPainel {
  rodada: RodadaDoOrquestrador | null;
  ultimoSinalDoHunter: Date | null;
  statusDoHunter: StatusGuardadoDoHunter | null;
}

export function lerMarcadores(docs: Doc[]): MarcadoresDoPainel {
  const por = (chave: string) => docs.find((d) => d.chave === chave);
  const hb = por(CHAVE_HEARTBEAT_HUNTER);
  const st = por(CHAVE_STATUS_HUNTER);
  const meta = (st?.metadados as Doc | null) ?? null;
  const lista = automacoesDoCorpo(meta?.automacoes);
  return {
    rodada: rodadaDoMarcador(por(CHAVE_RODADA)),
    ultimoSinalDoHunter: data((hb?.metadados as Doc | null)?.recebidoEm) ?? data(hb?.data),
    statusDoHunter: meta && lista.length > 0 ? { geradoEm: txt(meta.geradoEm), automacoes: lista } : null,
  };
}

export async function carregarDadosDoPainel(payload: Payload, agora: Date): Promise<DadosDoSite & MarcadoresDoPainel> {
  const j = janelas(agora);
  const naCadencia: Where = { and: [{ dealStatus: { in: [...ETAPAS_NA_CADENCIA] } }, { "cadencia.pausada": { not_equals: true } }] };
  const contar = async (where: Where): Promise<number> => (await payload.count({ collection: "leads", where, overrideAccess: true })).totalDocs;
  const fila = (canal: string, ate?: Date): Where => ({
    and: [naCadencia, { "cadencia.proximoCanal": { equals: canal } }, { "cadencia.proximoToqueEm": { less_than: (ate ?? agora).toISOString() } }],
  });
  const limite48h = new Date(agora.getTime() - 48 * 3_600_000);

  const [linhas, marcadores, leadsEmCadencia, leadsEngajados, emailsAtrasados48h, ligacoesNaFila, ligacoesAtrasadas48h, linkedinNaFila, linkedinAtrasados48h] = await Promise.all([
    carregarLinhas(payload, j),
    payload.find({
      collection: "interacoes",
      where: { chave: { in: [CHAVE_RODADA, CHAVE_HEARTBEAT_HUNTER, CHAVE_STATUS_HUNTER] } },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    }),
    contar({ dealStatus: { equals: "em_cadencia" } }),
    contar({ temperatura: { equals: "engajado" } }),
    contar({ and: [{ dealStatus: { equals: "em_cadencia" } }, { "cadencia.pausada": { not_equals: true } }, { "cadencia.proximoCanal": { equals: "email" } }, { "cadencia.proximoToqueEm": { less_than: limite48h.toISOString() } }] }),
    contar(fila("ligacao")),
    contar(fila("ligacao", limite48h)),
    contar(fila("linkedin")),
    contar(fila("linkedin", limite48h)),
  ]);

  const m = lerMarcadores(marcadores.docs as Doc[]);
  return {
    linhas,
    leadsEmCadencia,
    leadsEngajados,
    emailsAtrasados48h,
    ligacoesNaFila,
    ligacoesAtrasadas48h,
    linkedinNaFila,
    linkedinAtrasados48h,
    ...m,
  };
}
