import type { AdminViewServerProps } from "payload";
import { redirect } from "next/navigation";
import { EaHubBackLink } from "@/components/admin/brand/EaHubBackLink";
import { card, sectionTitle, table, th, td, rowBg, kpiCard, kpiLabel, kpiValue, kpiHint } from "@/components/admin/ads/adsStyles";

/**
 * Placar da campanha Planejamento 2027 (item C09 de Agentes/PROJETO-CAMPANHA-2027.md): metas do
 * plano-campanha.md contra o realizado, total e por semana (segunda a domingo).
 * Fontes: alcance do Instagram pelo EA Post (/api/metricas/campanha); downloads pelo contador dos
 * materiais; diagnósticos com utm_campaign=2027 nos leads; bate-papos pelas interações "agendou"
 * (agenda do Outlook); contratos pelos movimentos de CRM para "ganho".
 */
const INICIO = "2026-10-27";
const FIM = "2027-01-10";
const EA_POST_URL = "https://post.empresarialacademy.com";
const SLUGS_MATERIAL = ["plano-2027-em-1-pagina", "planilha-do-plano-2027"];
const META = { alcance: 25, downloads: 40, diagnosticos: 15, batePapos: 8, contratos: 2 };

type SemanaEaPost = { inicio: string; postsFeed: number; alcanceMediano: number | null; alcanceTotal: number; stories: number };
type Linha = { inicio: string; alcance: number | null; posts: number; diagnosticos: number; batePapos: number; contratos: number };

function segundaDaSemana(iso: string): string {
  const dia = new Date(new Date(iso).getTime() - 3 * 3_600_000); // São Paulo, sem horário de verão
  const dow = (dia.getUTCDay() + 6) % 7;
  return new Date(dia.getTime() - dow * 86_400_000).toISOString().slice(0, 10);
}

function semanasDaCampanha(): string[] {
  const out: string[] = [];
  const hoje = new Date().toISOString().slice(0, 10);
  for (let d = segundaDaSemana(`${INICIO}T12:00:00Z`); d <= FIM && d <= hoje; ) {
    out.push(d);
    d = new Date(new Date(`${d}T12:00:00Z`).getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  }
  return out;
}

async function alcanceDoEaPost(): Promise<{ semanas: SemanaEaPost[]; erro: string | null }> {
  const key = process.env.CONTENT_ENGINE_API_KEY;
  if (!key) return { semanas: [], erro: "CONTENT_ENGINE_API_KEY não configurada." };
  try {
    const res = await fetch(`${EA_POST_URL}/api/metricas/campanha?desde=${INICIO}`, { headers: { authorization: `Bearer ${key}` }, cache: "no-store" });
    if (!res.ok) return { semanas: [], erro: `EA Post respondeu ${res.status}.` };
    return { semanas: ((await res.json()) as { semanas: SemanaEaPost[] }).semanas, erro: null };
  } catch {
    return { semanas: [], erro: "EA Post fora do ar." };
  }
}

const fmt = (n: number | null) => (n == null ? "sem dado" : n.toLocaleString("pt-BR"));
const estado = (valor: number | null, meta: number, proporcao = 1) =>
  valor == null ? "neutral" : valor >= meta * proporcao ? "good" : valor >= meta * proporcao * 0.6 ? "warn" : "bad";

export async function Placar2027View({ payload, initPageResult }: AdminViewServerProps) {
  if (!initPageResult?.req?.user) redirect("/eahub/login?redirect=%2Feahub%2Fplacar-2027");

  const desde = `${INICIO}T03:00:00.000Z`;
  const [ea, materiais, leads, interacoes] = await Promise.all([
    alcanceDoEaPost(),
    payload.find({ collection: "materials", where: { slug: { in: SLUGS_MATERIAL } }, limit: 10, depth: 0 }),
    payload.find({
      collection: "leads",
      where: { and: [{ createdAt: { greater_than_equal: desde } }, { source: { like: "Diagnóstico" } }] },
      limit: 2000,
      depth: 0,
    }),
    payload.find({
      collection: "interacoes",
      where: { and: [{ data: { greater_than_equal: desde } }, { tipo: { in: ["agendou", "movimento_manual"] } }] },
      limit: 2000,
      depth: 0,
    }),
  ]);

  const downloads = (materiais.docs as unknown as { downloads?: number | null }[]).reduce((s, m) => s + (m.downloads ?? 0), 0);
  const diagnosticos = (leads.docs as unknown as { createdAt: string; details?: Record<string, unknown> | null }[]).filter(
    (l) => l.details?.utm_campaign === "2027",
  );
  const its = interacoes.docs as unknown as { tipo: string; data: string; metadados?: { para?: string } | null }[];
  const batePapos = its.filter((i) => i.tipo === "agendou");
  const contratos = its.filter((i) => i.tipo === "movimento_manual" && i.metadados?.para === "ganho");

  const porSemana = new Map<string, SemanaEaPost>(ea.semanas.map((s) => [s.inicio, s]));
  const conta = <T,>(xs: T[], data: (x: T) => string, semana: string) => xs.filter((x) => segundaDaSemana(data(x)) === semana).length;
  const linhas: Linha[] = semanasDaCampanha().map((inicio) => ({
    inicio,
    alcance: porSemana.get(inicio)?.alcanceMediano ?? null,
    posts: porSemana.get(inicio)?.postsFeed ?? 0,
    diagnosticos: conta(diagnosticos, (l) => l.createdAt, inicio),
    batePapos: conta(batePapos, (i) => i.data, inicio),
    contratos: conta(contratos, (i) => i.data, inicio),
  }));

  const alcances = ea.semanas.map((s) => s.alcanceMediano).filter((x): x is number => x != null);
  const alcanceAtual = alcances.length ? alcances[alcances.length - 1] : null;
  const decorrido = Math.min(1, Math.max(0, (Date.now() - Date.parse(desde)) / (Date.parse(`${FIM}T23:59:00-03:00`) - Date.parse(desde))));

  const kpis = [
    { rotulo: "Alcance mediano por post (última semana)", valor: alcanceAtual, meta: META.alcance, prop: 1, fonte: ea.erro ?? "Instagram, via EA Post" },
    { rotulo: "Downloads do material", valor: downloads, meta: META.downloads, prop: decorrido, fonte: "Plano 2027 em 1 página + planilha" },
    { rotulo: "Diagnósticos da campanha", valor: diagnosticos.length, meta: META.diagnosticos, prop: decorrido, fonte: "leads com utm_campaign=2027" },
    { rotulo: "Bate-papos agendados", valor: batePapos.length, meta: META.batePapos, prop: decorrido, fonte: "agenda do Outlook, todas as origens" },
    { rotulo: "Contratos fechados", valor: contratos.length, meta: META.contratos, prop: decorrido, fonte: "CRM: leads movidos para Ganho" },
  ];

  return (
    <div className="ea-view" style={{ maxWidth: 1200 }}>
      <EaHubBackLink />
      <h1 style={{ margin: "0 0 0.25rem" }}>Placar Planejamento 2027</h1>
      <p style={{ color: "var(--theme-elevation-600)", margin: "0 0 1.5rem" }}>
        Campanha de 27/10/2026 a 10/01/2027. Metas do plano da campanha contra o realizado. A cor compara com o esperado
        até hoje ({Math.round(decorrido * 100)}% do período).
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.8rem", marginBottom: "1.5rem" }}>
        {kpis.map((k) => (
          <div key={k.rotulo} style={kpiCard(estado(k.valor, k.meta, k.prop))}>
            <div style={kpiLabel}>{k.rotulo}</div>
            <div style={kpiValue}>
              {fmt(k.valor)} <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>/ {k.meta}</span>
            </div>
            <div style={kpiHint}>{k.fonte}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <h2 style={sectionTitle}>Semana a semana</h2>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Semana</th>
              <th style={th}>Posts no feed</th>
              <th style={th}>Alcance mediano (meta {META.alcance})</th>
              <th style={th}>Diagnósticos</th>
              <th style={th}>Bate-papos</th>
              <th style={th}>Contratos</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={l.inicio} style={rowBg(i)}>
                <td style={td}>{new Date(`${l.inicio}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</td>
                <td style={td}>{l.posts}</td>
                <td style={td}>{fmt(l.alcance)}</td>
                <td style={td}>{l.diagnosticos}</td>
                <td style={td}>{l.batePapos}</td>
                <td style={td}>{l.contratos}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ color: "var(--theme-elevation-600)", fontSize: "0.85rem", marginTop: "0.8rem" }}>
          Downloads só existem como total (o contador do material não guarda a data). Bate-papos contam todas as origens:
          a agenda não diz de qual campanha veio a reunião.
        </p>
      </div>
    </div>
  );
}
