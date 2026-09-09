"use client";

import { useState, useMemo } from "react";
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
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");

  const activeGroup = useMemo(
    () => adGroups.find((g) => String(g.id) === selectedGroupId),
    [adGroups, selectedGroupId],
  );

  // Totais agregados de todos os grupos
  const totals = useMemo(() => {
    const impressions = adGroups.reduce((acc, g) => acc + (g.rollupImpressions || 0), 0);
    const clicks = adGroups.reduce((acc, g) => acc + (g.rollupClicks || 0), 0);
    const cost = adGroups.reduce((acc, g) => acc + (g.rollupCost || 0), 0);
    const conversions = adGroups.reduce((acc, g) => acc + (g.rollupConversions || 0), 0);
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const avgCpc = clicks > 0 ? cost / clicks : 0;
    return { impressions, clicks, cost, conversions, ctr, avgCpc };
  }, [adGroups]);

  // Indicadores adaptativos (grupo selecionado ou consolidado da campanha)
  const isColletando = scorecard.status === "coletando";
  const displayClicks = activeGroup ? activeGroup.rollupClicks : scorecard.totals.clicks;
  const displayImpressions = activeGroup ? activeGroup.rollupImpressions : scorecard.totals.impressions;
  const displayCost = activeGroup ? activeGroup.rollupCost : scorecard.totals.cost;
  const displayCtr = displayImpressions > 0 ? displayClicks / displayImpressions : 0;
  const displayAvgCpc = displayClicks > 0 ? displayCost / displayClicks : 0;

  const ctrState: KpiState = isColletando ? "neutral" : displayCtr < T.CTR_LOW_THRESHOLD ? "warn" : "good";
  const cpcState: KpiState = isColletando
    ? "neutral"
    : displayAvgCpc > (campaign.cpcCeiling || T.CPC_CEILING_FALLBACK)
      ? "bad"
      : "good";
  const cacState: KpiState =
    scorecard.cac === null ? "neutral" : scorecard.cac > T.CAC_TARGET * T.CAC_WARNING_RATIO ? "bad" : "good";
  const roiState: KpiState =
    scorecard.roiMultiple === null ? "neutral" : scorecard.roiMultiple >= T.ROI_GOOD_MULTIPLE ? "good" : "warn";

  // Lista de palavras-chave filtradas
  const filteredKeywords = useMemo(() => {
    if (activeGroup) {
      return keywordsByGroup.get(String(activeGroup.id)) ?? [];
    }
    return adGroups.flatMap((g) => keywordsByGroup.get(String(g.id)) ?? []);
  }, [activeGroup, adGroups, keywordsByGroup]);

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

      {/* Barra de Filtro de Grupos de Anúncios estilo Google Ads */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          background: "var(--theme-elevation-50)",
          border: "1px solid var(--theme-elevation-150)",
          borderRadius: 8,
          padding: "0.6rem 0.9rem",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.84rem", fontWeight: 700, color: "var(--theme-elevation-700)" }}>
          <span>🎯 Filtro de Grupo:</span>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setSelectedGroupId("all")}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: 6,
              fontSize: "0.82rem",
              fontWeight: selectedGroupId === "all" ? 700 : 500,
              border: selectedGroupId === "all" ? "1.5px solid #C99A3E" : "1px solid var(--theme-elevation-200)",
              background: selectedGroupId === "all" ? "#C99A3E" : "var(--theme-elevation-100)",
              color: selectedGroupId === "all" ? "#1D2B3C" : "var(--theme-elevation-800)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Todos os grupos ({totals.clicks} cliq.)
          </button>
          {adGroups.map((g) => {
            const isSel = selectedGroupId === String(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGroupId(isSel ? "all" : String(g.id))}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: 6,
                  fontSize: "0.82rem",
                  fontWeight: isSel ? 700 : 500,
                  border: isSel ? "1.5px solid #1a73e8" : "1px solid var(--theme-elevation-200)",
                  background: isSel ? "#1a73e8" : "var(--theme-elevation-100)",
                  color: isSel ? "#fff" : "var(--theme-elevation-800)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  transition: "all 0.15s ease",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: g.status === "ativo" ? "#3F7D58" : "var(--theme-elevation-400)",
                  }}
                />
                <span>{g.name}</span>
                <span style={{ fontSize: "0.75rem", opacity: 0.85 }}>({g.rollupClicks} cliq.)</span>
              </button>
            );
          })}
        </div>
        {activeGroup && (
          <button
            type="button"
            onClick={() => setSelectedGroupId("all")}
            style={{
              marginLeft: "auto",
              padding: "0.25rem 0.5rem",
              borderRadius: 4,
              fontSize: "0.78rem",
              border: "none",
              background: "transparent",
              color: "var(--theme-elevation-600)",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            ✕ Limpar filtro
          </button>
        )}
      </div>

      {activeGroup && (
        <div
          style={{
            padding: "0.5rem 0.85rem",
            borderRadius: 6,
            background: "rgba(26, 115, 232, 0.08)",
            border: "1px solid rgba(26, 115, 232, 0.2)",
            marginBottom: "1rem",
            fontSize: "0.85rem",
            color: "#1a73e8",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>
            📍 Exibindo métricas isoladas do grupo: <strong>{activeGroup.name}</strong> (Status:{" "}
            {activeGroup.status === "ativo" ? "Ativo" : "Pausado"})
          </span>
          <span style={{ fontSize: "0.8rem", color: "var(--theme-elevation-600)" }}>
            Janela: Últimos 30 dias (inclui hoje)
          </span>
        </div>
      )}

      <AIForecastButton
        campaignId={String(campaign.id)}
        campaignName={campaign.name}
        autoGenerate={autoGenerateForecast}
        dataVersion={lastSyncedAt}
      />

      <div style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--theme-elevation-500)", margin: "1.5rem 0 0.5rem" }}>
        Tráfego e custo {activeGroup ? `— Grupo: ${activeGroup.name}` : "— Consolidado"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.1rem" }}>
        <Kpi label="Cliques" value={String(displayClicks)} state="neutral" />
        <Kpi label="Impressões" value={String(displayImpressions)} state="neutral" />
        <Kpi label="CTR" value={pct(displayCtr)} state={ctrState} hint={`meta: ≥ ${pct(T.CTR_LOW_THRESHOLD)}`} />
        <Kpi label="CPC médio" value={money(displayAvgCpc)} state={cpcState} hint={`teto: ${money(campaign.cpcCeiling || T.CPC_CEILING_FALLBACK)}`} />
        <Kpi label="Gasto total" value={money(displayCost)} state="neutral" />
      </div>

      {!activeGroup && (
        <>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--theme-elevation-500)", margin: "1.5rem 0 0.5rem" }}>
            Conversão e retorno — Campanha completa
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <Kpi label="Leads atribuídos" value={String(scorecard.leadsCount)} state="neutral" />
            <Kpi label="CAC" value={scorecard.cac !== null ? money(scorecard.cac) : "—"} state={cacState} hint={`meta: ≤ ${money(T.CAC_TARGET)}`} />
            <Kpi label="Receita (ganhos)" value={money(scorecard.revenue)} state="neutral" />
            <Kpi label="ROI" value={scorecard.roiMultiple !== null ? `${scorecard.roiMultiple.toFixed(1)}x` : "—"} state={roiState} hint={`meta: ≥ ${T.ROI_GOOD_MULTIPLE}x`} />
          </div>

          <DailyCostChart dailyMetrics={dailyMetrics} dailyBudget={campaign.dailyBudgetTarget} />
        </>
      )}

      {/* Tabela de Grupos de Anúncios com todas as métricas simultâneas */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={sectionTitle}>📁 Grupos de anúncios (Visão simultânea de todos os grupos)</div>
      </div>
      <div className="ea-table-scroll">
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Status</th>
              <th style={th}>Grupo</th>
              <th style={{ ...th, textAlign: "right" }}>Impressões</th>
              <th style={{ ...th, textAlign: "right" }}>Cliques</th>
              <th style={{ ...th, textAlign: "right" }}>CTR</th>
              <th style={{ ...th, textAlign: "right" }}>CPC Médio</th>
              <th style={{ ...th, textAlign: "right" }}>Custo</th>
              <th style={{ ...th, textAlign: "right" }}>Conversões</th>
              <th style={th}>Sinalizações</th>
            </tr>
          </thead>
          <tbody>
            {adGroups.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ ...td, textAlign: "center", color: "var(--theme-elevation-500)", padding: "1.25rem" }}>
                  Nenhum grupo de anúncios registrado para esta campanha. Clique em &quot;Sincronizar Google Ads Agora&quot; acima.
                </td>
              </tr>
            ) : (
              adGroups.map((g, i) => {
                const flags = computeAdGroupFlags(g);
                const isSelected = selectedGroupId === String(g.id);
                const gCtr = g.rollupImpressions > 0 ? g.rollupClicks / g.rollupImpressions : 0;
                const gAvgCpc = g.rollupClicks > 0 ? g.rollupCost / g.rollupClicks : 0;
                return (
                  <tr
                    key={g.id}
                    onClick={() => setSelectedGroupId(isSelected ? "all" : String(g.id))}
                    style={{
                      ...rowBg(i),
                      backgroundColor: isSelected ? "rgba(201, 154, 62, 0.12)" : undefined,
                      cursor: "pointer",
                      transition: "background-color 0.15s ease",
                    }}
                    title="Clique para filtrar apenas este grupo"
                  >
                    <td style={td}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          padding: "0.15rem 0.5rem",
                          borderRadius: 999,
                          background: g.status === "ativo" ? "rgba(63, 125, 88, 0.12)" : "var(--theme-elevation-100)",
                          color: g.status === "ativo" ? "#3F7D58" : "var(--theme-elevation-600)",
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            backgroundColor: g.status === "ativo" ? "#3F7D58" : "var(--theme-elevation-500)",
                          }}
                        />
                        {g.status === "ativo" ? "Ativo" : "Pausado"}
                      </span>
                    </td>
                    <td style={{ ...td, fontWeight: isSelected ? 700 : 500, color: isSelected ? "#1a73e8" : undefined }}>
                      {g.name}
                      {isSelected && <span style={{ marginLeft: 6, fontSize: "0.75rem" }}>📍 (filtrado)</span>}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>{g.rollupImpressions}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{g.rollupClicks}</td>
                    <td style={{ ...td, textAlign: "right" }}>{pct(gCtr)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{g.rollupClicks > 0 ? money(gAvgCpc) : "—"}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{money(g.rollupCost)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{g.rollupConversions}</td>
                    <td style={td}>
                      <FlagList flags={flags} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {adGroups.length > 0 && (
            <tfoot>
              <tr style={{ background: "var(--theme-elevation-100)", borderTop: "2px solid var(--theme-elevation-200)", fontWeight: 700 }}>
                <td style={{ ...td, fontSize: "0.82rem", color: "var(--theme-elevation-600)" }}>—</td>
                <td style={{ ...td, fontSize: "0.88rem" }}>TOTAL CONSOLIDADO</td>
                <td style={{ ...td, textAlign: "right" }}>{totals.impressions}</td>
                <td style={{ ...td, textAlign: "right" }}>{totals.clicks}</td>
                <td style={{ ...td, textAlign: "right" }}>{pct(totals.ctr)}</td>
                <td style={{ ...td, textAlign: "right" }}>{totals.clicks > 0 ? money(totals.avgCpc) : "—"}</td>
                <td style={{ ...td, textAlign: "right" }}>{money(totals.cost)}</td>
                <td style={{ ...td, textAlign: "right" }}>{totals.conversions}</td>
                <td style={td}>—</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Tabela de Palavras-chave detalhada com métricas */}
      <div style={sectionTitle}>
        🔑 Palavras-chave {activeGroup ? `(Filtradas pelo Grupo: ${activeGroup.name})` : "(Todos os Grupos)"} ({filteredKeywords.length})
      </div>
      <div className="ea-table-scroll">
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Status</th>
              <th style={th}>Palavra-chave</th>
              <th style={th}>Grupo</th>
              <th style={th}>Correspondência</th>
              <th style={{ ...th, textAlign: "right" }}>Impressões</th>
              <th style={{ ...th, textAlign: "right" }}>Cliques</th>
              <th style={{ ...th, textAlign: "right" }}>CTR</th>
              <th style={{ ...th, textAlign: "right" }}>CPC Médio</th>
              <th style={{ ...th, textAlign: "right" }}>Custo</th>
              <th style={{ ...th, textAlign: "right" }}>Conversões</th>
              <th style={th}>Sinalizações</th>
            </tr>
          </thead>
          <tbody>
            {filteredKeywords.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ ...td, textAlign: "center", color: "var(--theme-elevation-500)", padding: "1.25rem" }}>
                  Nenhuma palavra-chave encontrada para o filtro atual.
                </td>
              </tr>
            ) : (
              filteredKeywords.map((k, i) => {
                const group = adGroups.find((g) => String(g.id) === String(k.adGroup));
                const flags = computeKeywordFlags(k, campaign.cpcCeiling);
                const kCtr = k.rollupImpressions > 0 ? k.rollupClicks / k.rollupImpressions : 0;
                const kAvgCpc = k.rollupClicks > 0 ? k.rollupCost / k.rollupClicks : 0;
                return (
                  <tr key={k.id} style={rowBg(i)}>
                    <td style={td}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          padding: "0.1rem 0.45rem",
                          borderRadius: 999,
                          background: k.status === "ativa" ? "rgba(63, 125, 88, 0.12)" : "var(--theme-elevation-100)",
                          color: k.status === "ativa" ? "#3F7D58" : "var(--theme-elevation-600)",
                        }}
                      >
                        {k.status === "ativa" ? "Ativa" : "Pausada"}
                      </span>
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>{k.text}</td>
                    <td style={td}>{group?.name ?? "—"}</td>
                    <td style={td}>
                      <span style={{ fontSize: "0.8rem", color: "var(--theme-elevation-700)" }}>
                        {k.matchType === "exata" ? "[Exata]" : '"Frase"'}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>{k.rollupImpressions}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{k.rollupClicks}</td>
                    <td style={{ ...td, textAlign: "right" }}>{pct(kCtr)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{k.rollupClicks > 0 ? money(kAvgCpc) : "—"}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{money(k.rollupCost)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{k.rollupConversions}</td>
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
