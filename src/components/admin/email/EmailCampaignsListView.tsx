import type { ListViewServerProps } from "payload";
import Link from "next/link";
import { EaLeadsNav } from "@/components/admin/ea-leads/EaLeadsNav";

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
    nome: "Resultado do Diagnóstico de Maturidade",
    gatilho: "O lead termina o Diagnóstico no site",
    quando: "Na hora",
    publico: "Quem responde as 36 perguntas",
    entrega: "Relatório com a nota geral (0 a 100%), o nível de maturidade, o radar dos 6 pilares e o plano de ação para o pilar mais fraco.",
    statusBadge: "Ativo · na hora",
    statusColor: "#3F7D58",
    origem: "diagnostic-email.ts",
  },
  {
    nome: "Nutrição depois do Diagnóstico",
    gatilho: "O lead fez o Diagnóstico e aceitou receber contatos",
    quando: "2, 5 e 7 dias depois",
    publico: "Quem fez o Diagnóstico a partir de 18/07/2026, com consentimento e sem descadastro",
    entrega: "3 e-mails sobre o pilar mais fraco: o que ele custa e o que fazer já, como o Gestão 360 resolve, e o convite para a conversa com o Thiago. Para depois de 30 dias.",
    statusBadge: "Ativo · todo dia",
    statusColor: "#3F7D58",
    origem: "nurture-emails.ts",
  },
  {
    nome: "Nutrição por tema do material",
    gatilho: "O lead baixa um material gratuito no site",
    quando: "2, 5 e 7 dias depois",
    publico: "Quem baixou material, com consentimento e sem descadastro",
    entrega: "3 e-mails sobre o tema do material (gestão, vendas ou liderança). Levam ao Diagnóstico de Maturidade e à conversa com o Thiago.",
    statusBadge: "Ativo · todo dia",
    statusColor: "#3F7D58",
    origem: "nurture-emails.ts",
  },
  {
    nome: "Nutrição por área de atuação (EA Hunter)",
    gatilho: "O EA Hunter manda a primeira DM para o lead",
    quando: "Logo após a DM, 3 dias depois e mais 4 dias depois",
    publico: "Leads do EA Hunter com e-mail e sem descadastro, cuja área está com \"Envio ligado\"",
    entrega: "3 e-mails pela área da empresa: Serviços B2B, Indústria e distribuição, Clínicas e saúde. As demais áreas recebem o modelo genérico.",
    statusBadge: "Desligado · ligar no modelo",
    statusColor: "#8A5F1E",
    origem: "nurture-emails.ts",
  },
  {
    nome: "Aviso de conteúdo novo",
    gatilho: "Um artigo ou material é publicado no site (por você ou pelo EA Post)",
    quando: "Na publicação; se estiver agendado, no dia marcado",
    publico: "Assinantes da newsletter e leads que aceitaram receber conteúdo",
    entrega: "Resumo do artigo ou material com o link para ler ou baixar.",
    statusBadge: "Ativo · ao publicar",
    statusColor: "#3F7D58",
    origem: "content-alerts.ts",
  },
  {
    nome: "Contrato para assinatura",
    gatilho: "Você envia um contrato pelo Gerador de Contratos",
    quando: "Na hora",
    publico: "O cliente que vai assinar",
    entrega: "E-mail com os dados do plano contratado e o link seguro para a assinatura digital.",
    statusBadge: "Ativo · quando você envia",
    statusColor: "#3F7D58",
    origem: "Contracts.ts",
  },
];

function statusPill(status: CampaignDoc["status"]): { label: string; bg: string; color: string } {
  switch (status) {
    case "enviada":
      return { label: "Enviada", bg: "rgba(46,125,91,0.15)", color: "#2E7D5B" };
    case "agendada_envio":
      return { label: "Envio pedido", bg: "rgba(193,161,96,0.2)", color: "#8A5F1E" };
    case "enviando":
      return { label: "Enviando…", bg: "rgba(29,43,60,0.15)", color: NAVY };
    case "erro":
      return { label: "Erro no envio", bg: "rgba(178,59,59,0.15)", color: "#B23B3B" };
    default:
      return { label: "Rascunho", bg: "var(--theme-elevation-150)", color: "var(--theme-elevation-700)" };
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return "Sem data";
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
      <EaLeadsNav comTitulo />

      <div className="ea-leads-numeros">
        {[
          { href: "/eahub/collections/leads", rotulo: "Leads na base", valor: leadsCount.totalDocs },
          { href: "/eahub/collections/email-segments", rotulo: "Segmentos", valor: segmentsCount.totalDocs },
          { href: "/eahub/collections/email-templates", rotulo: "Modelos de e-mail", valor: templatesCount.totalDocs },
          { href: "/eahub/collections/email-logs", rotulo: "E-mails enviados", valor: logsCount.totalDocs },
        ].map((n) => (
          <Link key={n.href} href={n.href} className="ea-leads-numero">
            <strong>{n.valor.toLocaleString("pt-BR")}</strong>
            <span>{n.rotulo}</span>
          </Link>
        ))}
      </div>

      {/* SEÇÃO 1: TODAS AS REGRAS AUTOMÁTICAS DA EA */}
      <section style={{ marginBottom: "2.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--theme-elevation-150)", paddingBottom: "0.6rem", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "'Sora', sans-serif", fontSize: "1.1rem", color: NAVY, fontWeight: 700 }}>Jornadas automáticas</h2>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--theme-elevation-600)" }}>
              E-mails que saem sozinhos, conforme o que o lead faz. Os textos ficam em Modelos de e-mail.
            </p>
          </div>
          <span style={{ background: "rgba(46,125,91,0.12)", color: "#2E7D5B", border: "1px solid rgba(46,125,91,0.3)", borderRadius: 12, padding: "0.2rem 0.6rem", fontSize: "0.72rem", fontWeight: 700 }}>
            {AUTOMATION_RULES.length} jornadas
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))", gap: "1rem" }}>
          {AUTOMATION_RULES.map((rule) => (
            <div
              key={rule.nome}
              style={{
                background: "#fff",
                border: "1px solid var(--theme-elevation-150)",
                borderTop: `2px solid ${GOLD}`,
                borderRadius: 14,
                padding: "1.1rem 1.25rem",
                boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                <h3 style={{ margin: 0, fontFamily: "'Sora', sans-serif", fontSize: "0.98rem", color: NAVY, fontWeight: 700 }}>{rule.nome}</h3>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.5rem",
                    borderRadius: 4,
                    background: `${rule.statusColor}1F`,
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
            <h2 style={{ margin: 0, fontFamily: "'Sora', sans-serif", fontSize: "1.1rem", color: NAVY, fontWeight: 700 }}>Campanhas que você dispara</h2>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--theme-elevation-600)" }}>
              Um e-mail para um segmento de leads, enviado quando você quiser.
            </p>
          </div>
          <Link href={createUrl} className="ea-btn-gold">
            + Nova campanha
          </Link>
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
                          <span style={{ color: "var(--theme-elevation-500)" }}>Ainda não enviada</span>
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
