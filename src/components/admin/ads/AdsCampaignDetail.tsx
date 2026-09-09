import type { CampaignScorecard, DailyMetric, Flag } from "@/lib/ads-insights";
import { computeAdGroupFlags, computeKeywordFlags, ADS_INSIGHTS_THRESHOLDS } from "@/lib/ads-insights";
import {
  card,
  table,
  th,
  td,
  rowBg,
  badge,
  statusColor,
  statusLabel,
  statusIcon,
  sectionTitle,
  kpiCard,
  kpiLabel,
  kpiValue,
  kpiHint,
  flagPill,
  flagSeverity,
  type KpiState,
  money,
  pct,
} from "./adsStyles";

type CampaignDoc = {
  id: string | number;
  name: string;
  status: string;
  dailyBudgetTarget: number;
  monthlyBudgetTarget: number;
  cpcCeiling: number;
};

type AdGroupDoc = {
  id: string | number;
  name: string;
  status: string;
  rollupImpressions: number;
  rollupClicks: number;
  rollupCost: number;
  rollupConversions: number;
};

type KeywordDoc = {
  id: string | number;
  adGroup: string | number;
  text: string;
  matchType: string;
  status: string;
  rollupImpressions: number;
  rollupClicks: number;
  rollupCost: number;
  rollupConversions: number;
};

function FlagList({ flags }: { flags: Flag[] }) {
  if (flags.length === 0) return <span style={{ color: "var(--theme-elevation-400)" }}>—</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start" }}>
      {flags.map((f) => (
        <span key={f.code} title={f.recommendation} style={flagPill(flagSeverity(f.code))}>
          {f.label}
        </span>
      ))}
    </div>
  );
}

/** Gráfico de barras simples (SVG à mão, sem lib) — custo por dia vs. o
 * orçamento diário alvo (linha tracejada). */
function DailyCostChart({ dailyMetrics, dailyBudget }: { dailyMetrics: DailyMetric[]; dailyBudget: number }) {
  if (dailyMetrics.length === 0) return null;
  const width = 720;
  const height = 140;
  const padding = 24;
  const maxCost = Math.max(dailyBudget * 1.2, ...dailyMetrics.map((m) => m.cost), 1);
  const barGap = 2;
  const barWidth = Math.max((width - padding * 2) / dailyMetrics.length - barGap, 2);
  const scaleY = (v: number) => height - padding - (v / maxCost) * (height - padding * 2);
  const budgetY = scaleY(dailyBudget);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Custo diário nos últimos ${dailyMetrics.length} dias, comparado ao orçamento diário de ${money(dailyBudget)}`}
      style={{ width: "100%", height: "auto", maxWidth: width }}
    >
      <line
        x1={padding}
        x2={width - padding}
        y1={budgetY}
        y2={budgetY}
        stroke="var(--theme-elevation-400)"
        strokeDasharray="4 4"
        strokeWidth={1}
      />
      <text x={width - padding} y={budgetY - 4} textAnchor="end" fontSize={10} fill="var(--theme-elevation-500)">
        orçamento/dia: {money(dailyBudget)}
      </text>
      {dailyMetrics.map((m, i) => {
        const x = padding + i * (barWidth + barGap);
        const y = scaleY(m.cost);
        const barHeight = height - padding - y;
        const over = m.cost > dailyBudget * 1.15;
        return (
          <rect
            key={m.date}
            x={x}
            y={y}
            width={barWidth}
            height={Math.max(barHeight, 0)}
            fill={over ? "var(--theme-warning-500)" : "var(--theme-success-400)"}
          >
            <title>
              {m.date}: {money(m.cost)} · {m.clicks} cliques · {m.conversions} conversões
            </title>
          </rect>
        );
      })}
    </svg>
  );
}

import { AIForecastButton } from "./AdsClientActions";

export function AdsCampaignDetail({
  campaign,
  scorecard,
  dailyMetrics,
  adGroups,
  keywordsByGroup,
  autoGenerateForecast = false,
  lastSyncedAt = null,
}: {
  campaign: CampaignDoc;
  scorecard: CampaignScorecard;
  dailyMetrics: DailyMetric[];
  adGroups: AdGroupDoc[];
  keywordsByGroup: Map<string, KeywordDoc[]>;
  autoGenerateForecast?: boolean;
  /** `lastSync` do ads-settings — usado só pra invalidar o guard de forecast automático quando um sync novo acontece. */
  lastSyncedAt?: string | null;
}) {
  const T = ADS_INSIGHTS_THRESHOLDS;
  const isColletando = scorecard.status === "coletando";
  const ctrState: KpiState = isColletando ? "neutral" : scorecard.ctr < T.CTR_LOW_THRESHOLD ? "warn" : "good";
  const cpcState: KpiState = isColletando
    ? "neutral"
    : scorecard.avgCpc > (campaign.cpcCeiling || T.CPC_CEILING_FALLBACK)
      ? "bad"
      : "good";
  const cacState: KpiState =
    scorecard.cac === null ? "neutral" : scorecard.cac > T.CAC_TARGET * T.CAC_WARNING_RATIO ? "bad" : "good";
  const roiState: KpiState =
    scorecard.roiMultiple === null ? "neutral" : scorecard.roiMultiple >= T.ROI_GOOD_MULTIPLE ? "good" : "warn";

  return (
    <section style={{ ...card, marginTop: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h2 style={{ margin: 0 }}>{campaign.name}</h2>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "0.3rem 0.7rem",
            borderRadius: 999,
            fontSize: "0.88rem",
            fontWeight: 600,
            background: "var(--theme-elevation-100)",
          }}
        >
          <span style={badge(statusColor[scorecard.status])} />
          {statusIcon[scorecard.status]} {statusLabel[scorecard.status]}
        </span>
      </div>

      <p style={{ margin: "0 0 1.1rem", color: "var(--theme-elevation-700)" }}>{scorecard.recommendation}</p>

      <AIForecastButton
        campaignId={String(campaign.id)}
        campaignName={campaign.name}
        autoGenerate={autoGenerateForecast}
        dataVersion={lastSyncedAt}
      />

      <div style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--theme-elevation-500)", margin: "1.5rem 0 0.5rem" }}>
        Tráfego e custo
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.1rem" }}>
        <Kpi label="Cliques" value={String(scorecard.totals.clicks)} state="neutral" />
        <Kpi label="CTR" value={pct(scorecard.ctr)} state={ctrState} hint={`meta: ≥ ${pct(T.CTR_LOW_THRESHOLD)}`} />
        <Kpi label="CPC médio" value={money(scorecard.avgCpc)} state={cpcState} hint={`teto: ${money(campaign.cpcCeiling || T.CPC_CEILING_FALLBACK)}`} />
        <Kpi label="Gasto total" value={money(scorecard.totals.cost)} state="neutral" />
      </div>

      <div style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--theme-elevation-500)", margin: "1.5rem 0 0.5rem" }}>
        Conversão e retorno
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <Kpi label="Leads atribuídos" value={String(scorecard.leadsCount)} state="neutral" />
        <Kpi label="CAC" value={scorecard.cac !== null ? money(scorecard.cac) : "—"} state={cacState} hint={`meta: ≤ ${money(T.CAC_TARGET)}`} />
        <Kpi label="Receita (ganhos)" value={money(scorecard.revenue)} state="neutral" />
        <Kpi label="ROI" value={scorecard.roiMultiple !== null ? `${scorecard.roiMultiple.toFixed(1)}x` : "—"} state={roiState} hint={`meta: ≥ ${T.ROI_GOOD_MULTIPLE}x`} />
      </div>

      <DailyCostChart dailyMetrics={dailyMetrics} dailyBudget={campaign.dailyBudgetTarget} />

      <div style={sectionTitle}>📁 Grupos de anúncios</div>
      <div className="ea-table-scroll">
        <table style={table}>
        <thead>
          <tr>
            <th style={th}>Grupo</th>
            <th style={th}>Cliques</th>
            <th style={th}>Custo</th>
            <th style={th}>Conversões</th>
            <th style={th}>Sinalizações</th>
          </tr>
        </thead>
        <tbody>
          {adGroups.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--theme-elevation-500)", padding: "1.25rem" }}>
                Nenhum grupo de anúncios registrado para esta campanha. Clique em &quot;Sincronizar Google Ads Agora&quot; acima.
              </td>
            </tr>
          ) : (
            adGroups.map((g, i) => {
              const flags = computeAdGroupFlags(g);
              return (
                <tr key={g.id} style={rowBg(i)}>
                  <td style={td}>{g.name}</td>
                  <td style={td}>{g.rollupClicks}</td>
                  <td style={td}>{money(g.rollupCost)}</td>
                  <td style={td}>{g.rollupConversions}</td>
                  <td style={td}>
                    <FlagList flags={flags} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        </table>
      </div>

      <div style={sectionTitle}>🔑 Palavras-chave</div>
      <div className="ea-table-scroll">
        <table style={table}>
        <thead>
          <tr>
            <th style={th}>Palavra-chave</th>
            <th style={th}>Grupo</th>
            <th style={th}>Correspondência</th>
            <th style={th}>Cliques</th>
            <th style={th}>Custo</th>
            <th style={th}>Conversões</th>
            <th style={th}>Sinalizações</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const keywordList = adGroups.flatMap((g) => keywordsByGroup.get(String(g.id)) ?? []);
            if (keywordList.length === 0) {
              return (
                <tr>
                  <td colSpan={7} style={{ ...td, textAlign: "center", color: "var(--theme-elevation-500)", padding: "1.25rem" }}>
                    Nenhuma palavra-chave registrada para esta campanha. Clique em &quot;Sincronizar Google Ads Agora&quot; acima.
                  </td>
                </tr>
              );
            }
            return keywordList.map((k, i) => {
              const group = adGroups.find((g) => String(g.id) === String(k.adGroup));
              const flags = computeKeywordFlags(k, campaign.cpcCeiling);
              return (
                <tr key={k.id} style={rowBg(i)}>
                  <td style={td}>{k.text}</td>
                  <td style={td}>{group?.name ?? "—"}</td>
                  <td style={td}>{k.matchType}</td>
                  <td style={td}>{k.rollupClicks}</td>
                  <td style={td}>{money(k.rollupCost)}</td>
                  <td style={td}>{k.rollupConversions}</td>
                  <td style={td}>
                    <FlagList flags={flags} />
                  </td>
                </tr>
              );
            });
          })()}
        </tbody>
        </table>
      </div>
    </section>
  );
}

function Kpi({ label, value, state, hint }: { label: string; value: string; state: KpiState; hint?: string }) {
  return (
    <div style={kpiCard(state)}>
      <div style={kpiLabel}>{label}</div>
      <div style={kpiValue}>{value}</div>
      {hint ? <div style={kpiHint}>{hint}</div> : null}
    </div>
  );
}
