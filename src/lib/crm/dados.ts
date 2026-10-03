import type { Payload, Where } from "payload";
import { CANAIS_ENTREGA, ESTADOS_ENTREGA, etapaDe, type StatusEntrega, type Temperatura } from "./tipos";
import type { LeadSlim } from "./telas/cartao";
import type { InteracaoFila, LeadFila } from "./telas/fila";
import { resolverMetas, type Metas } from "./telas/metas";
import type { AgregadoInteracao, LinhaSimulacao } from "./telas/painel";
import { montarFilaLinkedin, type FilaLinkedin } from "./telas/linkedin";
import { fimDoDia } from "./telas/tempo";
import { coberturaDoDossie } from "./pesquisa";
import type { EventoAB } from "@/lib/outbound/experimentos";

/** Leituras do CRM para as telas (Kanban, ficha, Fila, painel). Só servidor; sempre overrideAccess. */

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const txt = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const iso = (v: unknown): string | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Campos leves do lead (sem dossiê, kit nem detalhes do diagnóstico). */
const SELECT_SLIM = {
  name: true,
  company: true,
  areaAtuacao: true,
  fonteCaptacao: true,
  source: true,
  dealStatus: true,
  temperatura: true,
  pontosEngajamento: true,
  whatsapp: true,
  instagram: true,
  email: true,
  proximoPasso: true,
  proximoPassoEm: true,
  cadencia: { proximoCanal: true, proximoToqueEm: true, pausada: true, canaisEncerrados: true },
  statusEntrega: true,
  origem: {
    primeiroToqueEm: true,
    ultimoToqueCanal: true,
    reuniaoCanal: true,
    reuniaoToque: true,
    vendaCanal: true,
    vendaToque: true,
  },
  updatedAt: true,
} as const;

export function slimDe(d: Doc): LeadSlim {
  const ent = d.statusEntrega ?? {};
  const cad = d.cadencia ?? {};
  const org = d.origem ?? {};
  const entrega = Object.fromEntries(CANAIS_ENTREGA.map((c) => [c, ent[c] ?? ESTADOS_ENTREGA[c][0]])) as StatusEntrega;
  return {
    id: Number(d.id),
    nome: txt(d.name) ?? "(sem nome)",
    empresa: txt(d.company),
    segmento: txt(d.areaAtuacao),
    campanha: txt(d.fonteCaptacao),
    origem: txt(d.source),
    etapa: etapaDe(d.dealStatus),
    temperatura: (txt(d.temperatura) ?? "frio") as Temperatura,
    pontos: Number(d.pontosEngajamento ?? 0),
    entrega,
    proximoPasso: txt(d.proximoPasso),
    proximoPassoEm: iso(d.proximoPassoEm),
    proximoCanal: txt(cad.proximoCanal),
    proximoToqueEm: iso(cad.proximoToqueEm),
    pausada: Boolean(cad.pausada),
    canaisEncerrados: Array.isArray(cad.canaisEncerrados) ? cad.canaisEncerrados.filter((x: unknown) => typeof x === "string") : [],
    whatsapp: txt(d.whatsapp),
    instagram: txt(d.instagram),
    email: txt(d.email),
    primeiroToqueEm: iso(org.primeiroToqueEm),
    ultimoToqueCanal: txt(org.ultimoToqueCanal),
    reuniaoCanal: txt(org.reuniaoCanal),
    reuniaoToque: txt(org.reuniaoToque),
    vendaCanal: txt(org.vendaCanal),
    vendaToque: txt(org.vendaToque),
    atualizadoEm: iso(d.updatedAt),
    ...(d.dossie ? { fontesPesquisa: coberturaDoDossie(d.dossie) } : {}),
  };
}

/** Todos os leads em versão enxuta (hoje ~1,4 mil). ponytail: sem paginação; passar de ~20 mil leads pede filtro no servidor. */
export async function carregarLeadsSlim(payload: Payload, opcoes: { comPesquisa?: boolean } = {}): Promise<LeadSlim[]> {
  const r = await payload.find({
    collection: "leads",
    // Dossiê entra só quando a tela quer a cobertura da pesquisa (Kanban); não segue para o navegador (ver cartaoDe).
    select: (opcoes.comPesquisa ? { ...SELECT_SLIM, dossie: true } : SELECT_SLIM) as never,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    sort: "id",
  });
  return r.docs.map((d) => slimDe(d as Doc));
}

export async function carregarLeadSlim(payload: Payload, id: number): Promise<LeadSlim | null> {
  try {
    const d = await payload.findByID({ collection: "leads", id, select: SELECT_SLIM as never, depth: 0, overrideAccess: true });
    return slimDe(d as Doc);
  } catch {
    return null;
  }
}

/** Linha gravada pela simulação do orquestrador (`metadados.simulado`): aparece na ficha, nunca nas contagens. */
const simulado = (d: Doc): boolean => (d.metadados as Doc | null)?.simulado === true;

export const interacaoDe = (d: Doc): InteracaoFila => ({
  leadId: Number(typeof d.lead === "object" && d.lead ? d.lead.id : d.lead),
  canal: String(d.canal),
  direcao: d.direcao === "entrada" ? "entrada" : "saida",
  tipo: String(d.tipo),
  data: iso(d.data) ?? new Date(0).toISOString(),
  conteudo: txt(d.conteudo),
  pontos: Number(d.pontos ?? 0),
});

/** Fila do dia: os leads que podem entrar nela e as interações dos últimos 30 dias deles. */
export async function carregarFila(payload: Payload, agora: Date): Promise<{ leads: LeadFila[]; interacoes: InteracaoFila[] }> {
  const fim = fimDoDia(agora).toISOString();
  const where: Where = {
    or: [
      { dealStatus: { in: ["respondeu", "engajado", "reuniao_marcada"] } },
      {
        and: [
          { "cadencia.proximoCanal": { in: ["ligacao", "linkedin"] } },
          { "cadencia.proximoToqueEm": { less_than: fim } },
          { "cadencia.pausada": { not_equals: true } },
        ],
      },
    ],
  };
  const r = await payload.find({
    collection: "leads",
    where,
    select: { ...SELECT_SLIM, kit: true, dossie: true } as never,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  const leads: LeadFila[] = r.docs.map((d) => ({ ...slimDe(d as Doc), kit: (d as Doc).kit, dossie: (d as Doc).dossie }));
  if (leads.length === 0) return { leads, interacoes: [] };

  const desde = new Date(agora.getTime() - 30 * 86_400_000).toISOString();
  const i = await payload.find({
    collection: "interacoes",
    where: { and: [{ lead: { in: leads.map((l) => l.id) } }, { data: { greater_than_equal: desde } }] },
    select: { lead: true, canal: true, direcao: true, tipo: true, data: true, conteudo: true, pontos: true, metadados: true } as never,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    sort: "-data",
  });
  // Envio simulado do orquestrador (F6) não é fato: fica fora da Fila.
  return { leads, interacoes: i.docs.filter((d) => !simulado(d as Doc)).map((d) => interacaoDe(d as Doc)) };
}

/** Ficha: o lead completo e a linha do tempo (mais recente primeiro). */
export async function carregarFicha(payload: Payload, id: number) {
  let lead: Doc;
  try {
    lead = (await payload.findByID({ collection: "leads", id, depth: 0, overrideAccess: true })) as Doc;
  } catch {
    return null;
  }
  const limite = 200;
  const i = await payload.find({
    collection: "interacoes",
    where: { lead: { equals: id } },
    depth: 0,
    limit: limite,
    sort: "-data",
    overrideAccess: true,
  });
  const interacoes = i.docs.map((d) => ({
    ...interacaoDe(d as Doc),
    id: Number(d.id),
    metadados: (d as Doc).metadados as Record<string, unknown> | null,
    simulado: simulado(d as Doc),
  }));
  // Total real e total simulado separados (a simulação nunca entra na conta do que aconteceu de verdade).
  let totalSimulado = 0;
  const pool = (payload.db as unknown as { pool?: { query: (s: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> } }).pool;
  if (pool) {
    const r = await pool.query(`SELECT count(*)::int AS n FROM interacoes WHERE lead_id = $1 AND COALESCE(metadados->>'simulado', '') = 'true'`, [id]);
    totalSimulado = Number(r.rows[0]?.n ?? 0);
  } else {
    totalSimulado = interacoes.filter((x) => x.simulado).length;
  }
  return {
    lead,
    slim: slimDe(lead),
    interacoes,
    totalInteracoes: i.totalDocs,
    totalSimulado,
    totalReal: Math.max(0, i.totalDocs - totalSimulado),
    limite,
  };
}

/** Interações agrupadas para o painel. SQL no Postgres; no SQLite de desenvolvimento, agrupa em memória. */
export async function carregarAgregado(payload: Payload): Promise<AgregadoInteracao[]> {
  const pool = (payload.db as unknown as { pool?: { query: (s: string) => Promise<{ rows: Record<string, unknown>[] }> } }).pool;
  if (pool) {
    const r = await pool.query(
      `SELECT lead_id AS "leadId", canal::text AS canal, direcao::text AS direcao, tipo::text AS tipo,
              metadados->>'intencao' AS intencao, metadados->>'desfecho' AS desfecho, count(*)::int AS n
         FROM interacoes WHERE lead_id IS NOT NULL AND COALESCE(metadados->>'simulado', '') <> 'true' GROUP BY 1, 2, 3, 4, 5, 6`,
    );
    return r.rows.map((x) => ({
      leadId: Number(x.leadId),
      canal: String(x.canal),
      direcao: String(x.direcao),
      tipo: String(x.tipo),
      intencao: (x.intencao as string | null) ?? null,
      desfecho: (x.desfecho as string | null) ?? null,
      n: Number(x.n),
    }));
  }
  const i = await payload.find({ collection: "interacoes", pagination: false, depth: 0, overrideAccess: true });
  const m = new Map<string, AgregadoInteracao>();
  for (const d of i.docs as Doc[]) {
    const x = interacaoDe(d);
    if (!x.leadId || simulado(d)) continue;
    const intencao = txt((d.metadados as Doc | null)?.intencao);
    const desfecho = txt((d.metadados as Doc | null)?.desfecho);
    const k = `${x.leadId}|${x.canal}|${x.direcao}|${x.tipo}|${intencao}|${desfecho}`;
    const a = m.get(k) ?? { leadId: x.leadId, canal: x.canal, direcao: x.direcao, tipo: x.tipo, intencao, desfecho, n: 0 };
    a.n++;
    m.set(k, a);
  }
  return [...m.values()];
}

/** Já existe algum envio real (saída que não seja simulada) registrado no CRM? Serve para explicar telas vazias. */
export async function carregarTemEnvioReal(payload: Payload): Promise<boolean> {
  const pool = (payload.db as unknown as { pool?: { query: (s: string) => Promise<{ rows: Record<string, unknown>[] }> } }).pool;
  if (pool) {
    const r = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM interacoes WHERE direcao::text = 'saida' AND tipo::text IN ('enviado', 'resultado_ligacao') AND COALESCE(metadados->>'simulado', '') <> 'true') AS tem`,
    );
    return r.rows[0]?.tem === true;
  }
  const i = await payload.find({ collection: "interacoes", where: { and: [{ direcao: { equals: "saida" } }, { tipo: { in: ["enviado", "resultado_ligacao"] } }] }, pagination: false, depth: 0, overrideAccess: true });
  return (i.docs as Doc[]).some((d) => !simulado(d));
}

/** Toques simulados por canal (leads distintos e total), para o painel mostrar a simulação separada do real. */
export async function carregarSimulacao(payload: Payload): Promise<LinhaSimulacao[]> {
  const pool = (payload.db as unknown as { pool?: { query: (s: string) => Promise<{ rows: Record<string, unknown>[] }> } }).pool;
  if (pool) {
    const r = await pool.query(
      `SELECT canal::text AS canal, count(*)::int AS toques, count(DISTINCT lead_id)::int AS leads
         FROM interacoes WHERE COALESCE(metadados->>'simulado', '') = 'true' AND direcao::text = 'saida' GROUP BY 1 ORDER BY 2 DESC`,
    );
    return r.rows.map((x) => ({ canal: String(x.canal), toques: Number(x.toques), leads: Number(x.leads) }));
  }
  const i = await payload.find({ collection: "interacoes", pagination: false, depth: 0, overrideAccess: true });
  const m = new Map<string, { toques: number; leads: Set<number> }>();
  for (const d of i.docs as Doc[]) {
    if (!simulado(d)) continue;
    const x = interacaoDe(d);
    if (x.direcao !== "saida") continue;
    const a = m.get(x.canal) ?? { toques: 0, leads: new Set<number>() };
    a.toques++;
    a.leads.add(x.leadId);
    m.set(x.canal, a);
  }
  return [...m].map(([canal, a]) => ({ canal, toques: a.toques, leads: a.leads.size })).sort((a, b) => b.toques - a.toques);
}

/** Metas do painel: o que está no global crm-config; campo vazio ou coluna ainda inexistente = padrão do plano. */
export async function carregarMetas(payload: Payload): Promise<Metas> {
  try {
    const g = (await payload.findGlobal({ slug: "crm-config", depth: 0, overrideAccess: true })) as Doc;
    return resolverMetas(g.metas);
  } catch (e) {
    payload.logger.warn(`[crm] metas indisponíveis, usando as do plano: ${e}`);
    return resolverMetas(null);
  }
}

/** Fila do LinkedIn: carrega leads candidatos e interações do canal linkedin. */
export async function carregarDadosLinkedin(payload: Payload, agora: Date): Promise<FilaLinkedin> {
  const r = await payload.find({
    collection: "leads",
    select: { ...SELECT_SLIM, kit: true, dossie: true } as never,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  const leads: LeadFila[] = r.docs.map((d) => ({
    ...slimDe(d as Doc),
    kit: (d as Doc).kit,
    dossie: (d as Doc).dossie,
  }));

  const desde = new Date(agora.getTime() - 30 * 86_400_000).toISOString();
  const i = await payload.find({
    collection: "interacoes",
    where: {
      and: [
        { canal: { equals: "linkedin" } },
        { data: { greater_than_equal: desde } },
      ],
    },
    select: { lead: true, canal: true, direcao: true, tipo: true, data: true, conteudo: true, pontos: true, metadados: true } as never,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    sort: "-data",
  });
  const interacoes = i.docs.filter((d) => !simulado(d as Doc)).map((d) => interacaoDe(d as Doc));
  return montarFilaLinkedin(leads, interacoes, agora);
}


/**
 * Envios, respostas e reuniões dos últimos `dias` dias, para medir os testes A/B e fechar a revisão semanal.
 * Só fatos reais (simulação fora). `variantes` vem de `metadados.variantes` do envio.
 */
export async function carregarEventosAB(payload: Payload, desde: Date): Promise<EventoAB[]> {
  const r = await payload.find({
    collection: "interacoes",
    where: { and: [{ data: { greater_than_equal: desde.toISOString() } }, { tipo: { in: ["enviado", "respondido", "agendou"] } }] },
    select: { lead: true, canal: true, direcao: true, tipo: true, data: true, metadados: true } as never,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  const eventos: EventoAB[] = [];
  for (const d of r.docs as Doc[]) {
    if (simulado(d)) continue;
    const x = interacaoDe(d);
    if (!x.leadId) continue;
    const v = (d.metadados as Doc | null)?.variantes;
    const variantes =
      v && typeof v === "object" && !Array.isArray(v)
        ? (Object.fromEntries(Object.entries(v as Doc).filter(([, id]) => typeof id === "string")) as Record<string, string>)
        : undefined;
    eventos.push({ leadId: x.leadId, canal: x.canal, direcao: x.direcao, tipo: x.tipo, data: new Date(x.data), ...(variantes && Object.keys(variantes).length ? { variantes } : {}) });
  }
  return eventos;
}

/** Motivos de ganho e de nutrição depois de reunião (`motivoResultado`), com a contagem de cada um. */
export async function carregarMotivosResultado(payload: Payload): Promise<{ motivo: string; etapa: string; n: number }[]> {
  const r = await payload.find({
    collection: "leads",
    where: { "motivoResultado.motivo": { exists: true } },
    select: { dealStatus: true, motivoResultado: true } as never,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  const m = new Map<string, number>();
  for (const d of r.docs as Doc[]) {
    const motivo = txt(d.motivoResultado?.motivo);
    if (!motivo) continue;
    const k = `${etapaDe(d.dealStatus)}|${motivo}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].map(([k, n]) => ({ etapa: k.split("|")[0], motivo: k.split("|")[1], n })).sort((a, b) => b.n - a.n);
}

/** Última revisão semanal gravada pelo orquestrador (chave `revisao:semanal:<segunda>`), ou null. */
export async function carregarUltimaRevisao(payload: Payload): Promise<{ semana: string; texto: string } | null> {
  const r = await payload.find({
    collection: "interacoes",
    where: { chave: { like: "revisao:semanal:" } },
    sort: "-chave",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const m = (r.docs[0] as Doc | undefined)?.metadados as Doc | undefined;
  return m && typeof m.texto === "string" ? { semana: typeof m.semana === "string" ? m.semana : "", texto: m.texto } : null;
}
