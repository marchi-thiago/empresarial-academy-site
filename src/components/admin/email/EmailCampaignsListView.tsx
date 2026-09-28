import type { ListViewServerProps } from "payload";
import Link from "next/link";
import Image from "next/image";

const NAVY = "#1D2B3C";
const GOLD = "#C99A3E";

type CampaignDoc = {
  id: string | number;
  subject: string;
  segment?: { id: string | number; name?: string } | string | null;
  status: "rascunho" | "agendada_envio" | "enviando" | "enviada" | "erro";
  statsTotal?: number | null;
  statsSent?: number | null;
  statsFailed?: number | null;
  statsStartedAt?: string | null;
  statsFinishedAt?: string | null;
  statsError?: string | null;
  createdAt: string;
};

const AUTOMATION_RULES = [
  {
    nome: "Resultado do Diagnóstico de Maturidade (DME)",
    gatilho: "Lead conclui o Diagnóstico de Maturidade no site ou pelo link direto",
    quando: "Imediato (Tempo Real)",
    publico: "Quem finaliza o questionário de 36 perguntas",
    entrega: "Relatório executivo completo em HTML com pontuação geral (0 a 100%), nível de maturidade, gráfico radar dos 6 pilares e plano de ação estruturado no pilar mais fraco.",
    statusBadge: "✅ Ativo · Imediato",
    statusColor: "#2E7D5B",
    origem: "diagnostic-email.ts",
  },
  {
    nome: "Nutrição Pós-Diagnóstico (Trilha Estratégica E1 / E2 / E3)",
    gatilho: "Cron diário automatizado (/api/cron/nurture-leads)",
    quando: "D+2 (Custo + Ações) · D+5 (Método Gestão 360) · D+7 (Convite para Sessão)",
    publico: "Leads do diagnóstico com consentimento e sem opt-out, criados a partir de 18/07/2026",
    entrega: "Sequência de 3 e-mails de alta conversão: E1 aborda o custo da ineficiência do pilar fraco; E2 detalha o método Gestão 360; E3 convida para call executiva com Thiago Marchi. Encerra após 30 dias parado.",
    statusBadge: "✅ Ativo · Cron Diário",
    statusColor: "#2E7D5B",
    origem: "nurture-emails.ts",
  },
  {
    nome: "Nutrição por Tema (quem baixou material)",
    gatilho: "Cron diário automatizado (/api/cron/nutricao)",
    quando: "D+2 (3 sinais + ações) · D+5 (Método e convite ao Diagnóstico) · D+7 (Convite para Sessão)",
    publico: "Leads de download de material com consentimento e sem opt-out, pelo tema da categoria do material",
    entrega: "Sequência de 3 e-mails pelo tema do material baixado (Gestão, Vendas, Liderança). Objetivo: levar ao Diagnóstico de Maturidade e à Chamada. Textos editáveis em Modelos de e-mail.",
    statusBadge: "✅ Ativo · Cron Diário",
    statusColor: "#2E7D5B",
    origem: "nurture-emails.ts",
  },
  {
    nome: "Alerta de Novo Conteúdo (Blog & Materiais Ricos)",
    gatilho: "Publicação de Artigo ou Material no site (direto ou agendado pelo EA Post)",
    quando: "Imediato (publicação direta) ou no cron diário (agendados)",
    publico: "Assinantes da newsletter e base de leads com opt-in de marketing",
    entrega: "Resumo do artigo/material publicado com chamada para leitura no blog (/blog/[slug]) ou download da ferramenta (/baixar/[slug]).",
    statusBadge: "✅ Ativo · afterChange",
    statusColor: "#2E7D5B",
    origem: "content-alerts.ts",
  },
  {
    nome: "Assinatura e Formalização de Contrato",
    gatilho: "Envio de proposta/contrato pelo Gerador de Contratos da EA",
    quando: "Imediato ao gerar minuta e link de assinatura",
    publico: "Cliente / Contratante da Mentoria ou Consultoria",
    entrega: "E-mail formal com dados do plano de investimento contratado e link seguro para assinatura digital via Autentique / ZapSign.",
    statusBadge: "✅ Ativo · Sob Demanda",
    statusColor: "#2E7D5B",
    origem: "Contracts.ts",
  },
];

function statusPill(status: CampaignDoc["status"]): { label: string; bg: string; color: string } {
  switch (status) {
    case "enviada":
      return { label: "Enviada", bg: "rgba(46,125,91,0.15)", color: "#2E7D5B" };
    case "agendada_envio":
      return { label: "Agendada (enviar agora)", bg: "rgba(193,161,96,0.2)", color: "#8A5F1E" };
    case "enviando":
      return { label: "Enviando…", bg: "rgba(29,43,60,0.15)", color: NAVY };
    case "erro":
      return { label: "Erro no envio", bg: "rgba(178,59,59,0.15)", color: "#B23B3B" };
    default:
      return { label: "Rascunho", bg: "var(--theme-elevation-150)", color: "var(--theme-elevation-700)" };
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function EmailCampaignsListView(props: ListViewServerProps) {
  const { payload, data, collectionSlug, newDocumentURL } = props as ListViewServerProps & {
    newDocumentURL?: string;
  };

  const [campaignsRes, leadsCount, segmentsCount, logsCount, templatesCount] = await Promise.all([
    payload.find({
      collection: "email-campaigns",
      limit: 100,
      depth: 1,
      sort: "-createdAt",
    }),
    payload.count({ collection: "leads" }),
    payload.count({ collection: "email-segments" }),
    payload.count({ collection: "email-logs" }),
    // Tabela nova: enquanto o schema não chega em produção, mostra 0 em vez de derrubar a tela.
    payload.count({ collection: "email-templates" }).catch(() => ({ totalDocs: 0 })),
  ]);

  const campaigns = (campaignsRes.docs as unknown as CampaignDoc[]) ?? ((data?.docs as unknown as CampaignDoc[]) || []);
  const adminRoute = "/eahub";
  const createUrl = newDocumentURL || `${adminRoute}/collections/${collectionSlug}/create`;

  return (
    <div className="ea-view">
      <header
        className="ea-view-header"
        style={{
          background: NAVY,
          color: "#fff",
          borderRadius: 8,
          borderBottom: `3px solid ${GOLD}`,
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          padding: "1rem 1.4rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Image src="/logo-empresarial-academy.png" alt="" width={192} height={183} style={{ width: 44, height: "auto" }} />
          <div>
            <h1 style={{ margin: 0, color: "#fff", fontSize: "1.3rem" }}>EA Leads · Campanhas e nutrição</h1>
            <p style={{ margin: "0.2rem 0 0", color: GOLD, fontSize: "0.85rem" }}>
              Base de leads, segmentos, campanhas, modelos de e-mail e histórico de envios num só lugar.
            </p>
          </div>
        </div>
        <Link
          href={createUrl}
          style={{
            background: GOLD,
            color: NAVY,
            fontWeight: 700,
            textDecoration: "none",
            padding: "0.6rem 1.1rem",
            borderRadius: 6,
            whiteSpace: "nowrap",
            fontSize: "0.85rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          }}
        >
          + Criar Campanha
        </Link>
      </header>

      {/* Barra de Acesso Rápido à Esteira */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
        <Link
          href="/eahub/collections/leads"
          style={{
            background: "var(--theme-elevation-50)",
            border: "1px solid var(--theme-elevation-150)",
            borderRadius: 8,
            padding: "0.7rem 1.1rem",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.6rem",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>🎯</span>
          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--theme-elevation-500)", textTransform: "uppercase", fontWeight: 700 }}>Base de Leads</div>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: NAVY }}>{leadsCount.totalDocs} EA Lead(s)</div>
          </div>
        </Link>

        <Link
          href="/eahub/collections/email-segments"
          style={{
            background: "var(--theme-elevation-50)",
            border: "1px solid var(--theme-elevation-150)",
            borderRadius: 8,
            padding: "0.7rem 1.1rem",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.6rem",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>👥</span>
          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--theme-elevation-500)", textTransform: "uppercase", fontWeight: 700 }}>Segmentos de Leads</div>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: NAVY }}>{segmentsCount.totalDocs} Segmento(s)</div>
          </div>
        </Link>

        <Link
          href="/eahub/collections/email-templates"
          style={{
            background: "var(--theme-elevation-50)",
            border: "1px solid var(--theme-elevation-150)",
            borderRadius: 8,
            padding: "0.7rem 1.1rem",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.6rem",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>✉️</span>
          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--theme-elevation-500)", textTransform: "uppercase", fontWeight: 700 }}>Modelos de E-mail</div>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: NAVY }}>{templatesCount.totalDocs} Modelo(s)</div>
          </div>
        </Link>

        <Link
          href="/eahub/collections/email-logs"
          style={{
            background: "var(--theme-elevation-50)",
            border: "1px solid var(--theme-elevation-150)",
            borderRadius: 8,
            padding: "0.7rem 1.1rem",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.6rem",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>📊</span>
          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--theme-elevation-500)", textTransform: "uppercase", fontWeight: 700 }}>Logs de Disparo</div>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: NAVY }}>{logsCount.totalDocs} Registro(s) de Envio</div>
          </div>
        </Link>
      </div>

      {/* SEÇÃO 1: TODAS AS REGRAS AUTOMÁTICAS DA EA */}
      <section style={{ marginBottom: "2.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--theme-elevation-150)", paddingBottom: "0.6rem", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.05rem", color: NAVY, fontWeight: 700 }}>⚡ Regras Automáticas de E-mails Ativas</h2>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--theme-elevation-600)" }}>
              Automações ativas que disparam sozinhas no backend conforme ações dos leads e crons programados.
            </p>
          </div>
          <span style={{ background: "rgba(46,125,91,0.12)", color: "#2E7D5B", border: "1px solid rgba(46,125,91,0.3)", borderRadius: 12, padding: "0.2rem 0.6rem", fontSize: "0.72rem", fontWeight: 700 }}>
            {AUTOMATION_RULES.length} Regras Ativas
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem" }}>
          {AUTOMATION_RULES.map((rule) => (
            <div
              key={rule.nome}
              style={{
                background: "#fff",
                border: "1px solid var(--theme-elevation-150)",
                borderLeft: `4px solid ${GOLD}`,
                borderRadius: 8,
                padding: "1.1rem 1.25rem",
                boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                <h3 style={{ margin: 0, fontSize: "0.95rem", color: NAVY, fontWeight: 700 }}>{rule.nome}</h3>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.5rem",
                    borderRadius: 4,
                    background: "rgba(46,125,91,0.12)",
                    color: rule.statusColor,
                    whiteSpace: "nowrap",
                  }}
                >
                  {rule.statusBadge}
                </span>
              </div>

              <div style={{ fontSize: "0.8rem", color: "var(--theme-elevation-700)", lineHeight: 1.45 }}>
                {rule.entrega}
              </div>

              <div style={{ marginTop: "auto", paddingTop: "0.6rem", borderTop: "1px dashed var(--theme-elevation-150)", fontSize: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div>
                  <strong style={{ color: "var(--theme-elevation-800)" }}>Gatilho:</strong>{" "}
                  <span style={{ color: "var(--theme-elevation-600)" }}>{rule.gatilho}</span>
                </div>
                <div>
                  <strong style={{ color: "var(--theme-elevation-800)" }}>Quando:</strong>{" "}
                  <span style={{ color: "var(--theme-elevation-600)" }}>{rule.quando}</span>
                </div>
                <div>
                  <strong style={{ color: "var(--theme-elevation-800)" }}>Público:</strong>{" "}
                  <span style={{ color: "var(--theme-elevation-600)" }}>{rule.publico}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SEÇÃO 2: CAMPANHAS MANUAIS & SEGMENTADAS */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--theme-elevation-150)", paddingBottom: "0.6rem", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.05rem", color: NAVY, fontWeight: 700 }}>📬 Campanhas Manuais & Segmentadas</h2>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--theme-elevation-600)" }}>
              Disparos manuais ou agendados criados pela equipe para um segmento específico de leads.
            </p>
          </div>
          <span style={{ background: "rgba(29,43,60,0.1)", color: NAVY, borderRadius: 12, padding: "0.2rem 0.6rem", fontSize: "0.72rem", fontWeight: 700 }}>
            {campaigns.length} Campanha(s)
          </span>
        </div>

        {campaigns.length === 0 ? (
          <div style={{ padding: "2.5rem", textAlign: "center", background: "var(--theme-elevation-50)", borderRadius: 8, border: "1px dashed var(--theme-elevation-200)" }}>
            <p style={{ color: "var(--theme-elevation-700)", fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>Nenhuma campanha manual criada ainda.</p>
            <p style={{ color: "var(--theme-elevation-500)", fontSize: "0.82rem", marginTop: "0.3rem" }}>
              Crie uma nova campanha, escolha o segmento e agende o disparo.
            </p>
            <Link
              href={createUrl}
              style={{
                display: "inline-block",
                marginTop: "0.8rem",
                background: GOLD,
                color: NAVY,
                fontWeight: 700,
                textDecoration: "none",
                padding: "0.5rem 1rem",
                borderRadius: 6,
                fontSize: "0.82rem",
              }}
            >
              + Criar Primeira Campanha
            </Link>
          </div>
        ) : (
          <div className="ea-table-scroll" style={{ border: "1px solid var(--theme-elevation-150)", borderRadius: 8, background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", minWidth: 680 }}>
              <thead>
                <tr style={{ background: NAVY, color: "#fff" }}>
                  <th style={{ padding: "0.7rem 1rem", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase" }}>Assunto</th>
                  <th style={{ padding: "0.7rem 1rem", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase" }}>Segmento</th>
                  <th style={{ padding: "0.7rem 1rem", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase" }}>Status</th>
                  <th style={{ padding: "0.7rem 1rem", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase" }}>Envios / Total</th>
                  <th style={{ padding: "0.7rem 1rem", textAlign: "left", fontSize: "0.75rem", textTransform: "uppercase" }}>Data</th>
                  <th style={{ padding: "0.7rem 1rem", textAlign: "right", fontSize: "0.75rem", textTransform: "uppercase" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((camp) => {
                  const pill = statusPill(camp.status);
                  const segmentName = typeof camp.segment === "object" && camp.segment?.name ? camp.segment.name : "Segmento padrão";
                  const editUrl = `${adminRoute}/collections/${collectionSlug}/${camp.id}`;

                  return (
                    <tr key={camp.id} style={{ borderTop: "1px solid var(--theme-elevation-150)" }}>
                      <td style={{ padding: "0.8rem 1rem", fontWeight: 700, color: NAVY }}>
                        <Link href={editUrl} style={{ color: NAVY, textDecoration: "none" }}>
                          {camp.subject}
                        </Link>
                      </td>
                      <td style={{ padding: "0.8rem 1rem", color: "var(--theme-elevation-700)" }}>
                        {segmentName}
                      </td>
                      <td style={{ padding: "0.8rem 1rem", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.18rem 0.55rem", borderRadius: 4, background: pill.bg, color: pill.color }}>
                          {pill.label}
                        </span>
                      </td>
                      <td style={{ padding: "0.8rem 1rem", whiteSpace: "nowrap", color: "var(--theme-elevation-700)" }}>
                        {camp.statsSent !== undefined && camp.statsSent !== null ? (
                          <span>
                            <strong>{camp.statsSent}</strong> / {camp.statsTotal ?? 0}{" "}
                            {camp.statsFailed ? <span style={{ color: "#B23B3B" }}>({camp.statsFailed} falhas)</span> : null}
                          </span>
                        ) : (
                          <span style={{ color: "var(--theme-elevation-400)" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "0.8rem 1rem", whiteSpace: "nowrap", color: "var(--theme-elevation-500)", fontSize: "0.78rem" }}>
                        {formatDate(camp.statsFinishedAt || camp.statsStartedAt || camp.createdAt)}
                      </td>
                      <td style={{ padding: "0.8rem 1rem", textAlign: "right", whiteSpace: "nowrap" }}>
                        <Link
                          href={editUrl}
                          style={{
                            background: "var(--theme-elevation-100)",
                            color: NAVY,
                            border: "1px solid var(--theme-elevation-200)",
                            borderRadius: 4,
                            padding: "0.3rem 0.65rem",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            textDecoration: "none",
                          }}
                        >
                          Ver / Editar ↗
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
