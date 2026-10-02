/**
 * Cotas do Neon e da Vercel: um registro por dia, enviado pelo EA Hunter (`POST /api/infra/cotas`, Bearer SDR_SEGREDO),
 * guardado como marcador `infra:cotas:AAAA-MM-DD` em `interacoes` (sem migração, ver `cotas-db.ts`) e lido pelo cartão do /eahub/apis.
 * Este arquivo só tem validação e contas puras (sem Payload), para testar sem banco.
 *
 * O formato `DiaDeCotas` é o CONTRATO com o Hunter (`EA Hunter/src/features/cotas/tipos.ts`). Mudou lá, mude aqui.
 * O corpo vem do PC por rede: tudo é validado e cortado aqui antes de gravar.
 */

export interface MetricaDeCota {
  chave: string;
  rotulo: string;
  unidade: string;
  dia: number | null;
  mes: number | null;
  limite: number | null;
  pct: number | null;
  estimativa: boolean;
}

export interface ProjetoDeCota {
  id: string;
  sistema: "neon" | "vercel";
  nome: string;
  plano: string | null;
  metricas: MetricaDeCota[];
  cicloDesde?: string;
  cicloAte?: string;
}

export interface DiaDeCotas {
  /** AAAA-MM-DD no fuso de operação do Hunter. */
  dia: string;
  geradoEm: string;
  projetos: ProjetoDeCota[];
}

export const PREFIXO_DA_CHAVE = "infra:cotas:";
export const chaveDoDia = (dia: string): string => `${PREFIXO_DA_CHAVE}${dia}`;
export const MAXIMO_DE_DIAS_POR_ENVIO = 40;
export const DIAS_DO_GRAFICO = 30;

const DIA = /^\d{4}-\d{2}-\d{2}$/u;
const obj = (v: unknown): Record<string, unknown> | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const numOuNulo = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const texto = (v: unknown, max: number): string | null => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);
const iso = (v: unknown): string | undefined => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : undefined);

function metricaValida(x: unknown): MetricaDeCota | null {
  const m = obj(x);
  if (!m) return null;
  const chave = texto(m.chave, 40);
  const rotulo = texto(m.rotulo, 80);
  const unidade = texto(m.unidade, 20);
  if (!chave || !rotulo || !unidade) return null;
  return { chave, rotulo, unidade, dia: numOuNulo(m.dia), mes: numOuNulo(m.mes), limite: numOuNulo(m.limite), pct: numOuNulo(m.pct), estimativa: m.estimativa === true };
}

export function projetoValido(x: unknown): ProjetoDeCota | null {
  const p = obj(x);
  if (!p || !Array.isArray(p.metricas)) return null;
  const id = texto(p.id, 60);
  const nome = texto(p.nome, 120);
  if (!id || !nome || (p.sistema !== "neon" && p.sistema !== "vercel")) return null;
  const desde = iso(p.cicloDesde);
  const ate = iso(p.cicloAte);
  return {
    id,
    sistema: p.sistema,
    nome,
    plano: texto(p.plano, 30),
    metricas: p.metricas.slice(0, 12).map(metricaValida).filter((m): m is MetricaDeCota => m !== null),
    ...(desde ? { cicloDesde: desde } : {}),
    ...(ate ? { cicloAte: ate } : {}),
  };
}

/** Registros válidos do corpo do POST; o que não tiver o formato é descartado. */
export function registrosValidos(bruto: unknown): DiaDeCotas[] {
  const lista = obj(bruto)?.registros;
  if (!Array.isArray(lista)) return [];
  const saida: DiaDeCotas[] = [];
  for (const x of lista.slice(0, MAXIMO_DE_DIAS_POR_ENVIO)) {
    const r = obj(x);
    if (!r || typeof r.dia !== "string" || !DIA.test(r.dia) || !Array.isArray(r.projetos)) continue;
    const projetos = r.projetos.slice(0, 40).map(projetoValido).filter((p): p is ProjetoDeCota => p !== null);
    if (projetos.length === 0) continue;
    saida.push({ dia: r.dia, geradoEm: iso(r.geradoEm) ?? new Date().toISOString(), projetos });
  }
  return saida;
}

/** Datas (AAAA-MM-DD) dos últimos `quantos` dias, terminando em `ate` (UTC), da mais antiga para a mais nova. */
export function ultimosDias(ate: Date, quantos = DIAS_DO_GRAFICO): string[] {
  const fim = Date.UTC(ate.getUTCFullYear(), ate.getUTCMonth(), ate.getUTCDate());
  return Array.from({ length: quantos }, (_, i) => new Date(fim - (quantos - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

// ---------------------------------------------------------------------------------------------------------------
// Auxiliares do gráfico (puros)
// ---------------------------------------------------------------------------------------------------------------

/** Valores diários de uma métrica de um projeto, um por dia da janela (0 onde não houve registro). */
export function serieDaMetrica(registros: readonly DiaDeCotas[], projetoId: string, chave: string, dias: readonly string[]): number[] {
  const porDia = new Map(registros.map((r) => [r.dia, r]));
  return dias.map((d) => porDia.get(d)?.projetos.find((p) => p.id === projetoId)?.metricas.find((m) => m.chave === chave)?.dia ?? 0);
}

export interface ProjetoDoGrafico {
  /** Retrato mais recente do projeto. */
  atual: ProjetoDeCota;
  dia: string;
}

/** Projetos que aparecem em algum dia, com o retrato mais recente de cada um (Neon primeiro, depois Vercel). */
export function projetosDoGrafico(registros: readonly DiaDeCotas[]): ProjetoDoGrafico[] {
  const ultimo = new Map<string, ProjetoDoGrafico>();
  for (const r of [...registros].sort((a, b) => (a.dia < b.dia ? -1 : 1))) {
    for (const p of r.projetos) ultimo.set(p.id, { atual: p, dia: r.dia });
  }
  return [...ultimo.values()].sort((a, b) => (a.atual.sistema === b.atual.sistema ? a.atual.id.localeCompare(b.atual.id) : a.atual.sistema === "neon" ? -1 : 1));
}

/** Verde abaixo de 70%, amarelo de 70 a 89,9%, vermelho a partir de 90 (mesma regra do Painel de Automações). */
export function faixaDaCota(pct: number | null): "ok" | "atencao" | "critico" {
  if (pct === null) return "ok";
  if (pct >= 90) return "critico";
  if (pct >= 70) return "atencao";
  return "ok";
}
