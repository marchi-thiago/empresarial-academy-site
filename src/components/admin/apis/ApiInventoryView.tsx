import type { AdminViewServerProps } from "payload";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EaHubBackLink } from "@/components/admin/brand/EaHubBackLink";
import { CotasInfraCard } from "@/components/admin/apis/CotasInfraCard";
import { card, sectionTitle, table, th, td, rowBg, badge, EA_GOLD } from "@/components/admin/ads/adsStyles";

type SystemRow = { system: string; envVar?: string | null; active?: boolean | null };

type ApiDoc = {
  id: string | number;
  name: string;
  provider: string;
  category: string;
  systems: SystemRow[];
  status: "ativo" | "bloqueado" | "pendente" | "dormente" | "cancelamento";
  expiresAt?: string | null;
  renewalCycle?: string | null;
  hasBilling?: boolean | null;
  billingType?: string | null;
  balanceOrCost?: string | null;
  balanceCheckedAt?: string | null;
  billingLink?: string | null;
  credentialLocation?: string | null;
  notes?: string | null;
  lastVerified?: string | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  ia: "IA",
  "redes-sociais": "Redes sociais",
  marketing: "Marketing / Ads",
  email: "E-mail",
  mensageria: "Automação de mensagens",
  infra: "Infraestrutura",
  outro: "Outro",
};

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  bloqueado: "Bloqueado",
  pendente: "Pendente",
  dormente: "Dormente",
  cancelamento: "Candidato a cancelamento",
};

const STATUS_COLOR: Record<string, string> = {
  ativo: "var(--theme-success-500)",
  bloqueado: "var(--theme-error-500)",
  pendente: "var(--theme-warning-500)",
  dormente: "var(--theme-elevation-400)",
  cancelamento: "var(--theme-error-500)",
};

const CATEGORY_ORDER = ["ia", "redes-sociais", "marketing", "email", "mensageria", "infra", "outro"];

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function expirationState(expiresAt?: string | null): "none" | "expired" | "soon" | "ok" {
  if (!expiresAt) return "none";
  const days = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return "expired";
  if (days <= 14) return "soon";
  return "ok";
}

/**
 * Painel de inventário de APIs (/eahub/apis) — pedido do Thiago (24/08/2026):
 * ver, num lugar só, de onde é cada API usada pelos sistemas da EA, quantos
 * sistemas a usam, quando vence e se tem saldo/faturamento atrelado. Dados
 * vivem na collection `api-inventory`, carregados via seed inicial
 * (/api/dev/seed-api-inventory) e editáveis daqui em diante pelo admin
 * padrão do Payload.
 */
export async function ApiInventoryView({ payload, initPageResult }: AdminViewServerProps) {
  const user = initPageResult?.req?.user;
  if (!user) {
    redirect("/eahub/login?redirect=%2Feahub%2Fapis");
  }

  const { docs } = await payload.find({
    collection: "api-inventory",
    limit: 200,
    depth: 0,
    sort: "name",
  });
  const apis = docs as unknown as ApiDoc[];

  const total = apis.length;
  const shared = apis.filter((a) => (a.systems ?? []).length > 1).length;
  const expiringSoon = apis.filter((a) => expirationState(a.expiresAt) === "soon").length;
  const expired = apis.filter((a) => expirationState(a.expiresAt) === "expired").length;
  const withBilling = apis.filter((a) => a.hasBilling).length;

  const byCategory = new Map<string, ApiDoc[]>();
  for (const api of apis) {
    const key = api.category || "outro";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(api);
  }

  return (
    <div className="ea-view" style={{ maxWidth: 1200 }}>
      <EaHubBackLink />
      <h1 style={{ margin: "0 0 0.25rem" }}>Painel de APIs</h1>
      <p style={{ color: "var(--theme-elevation-600)", margin: "0 0 1.5rem" }}>
        Toda API/credencial externa usada por algum sistema da EA — provedor, sistema(s) consumidor(es), vencimento e
        faturamento. Edite direto em cada linha ou em{" "}
        <Link href="/eahub/collections/api-inventory">Inventário de APIs</Link>.
      </p>

      <div className="ea-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem", marginBottom: "1.75rem" }}>
        <Stat label="APIs cadastradas" value={String(total)} />
        <Stat label="Compartilhadas (2+ sistemas)" value={String(shared)} />
        <Stat label="Vencendo em ≤14 dias" value={String(expiringSoon)} warn={expiringSoon > 0} />
        <Stat label="Vencidas" value={String(expired)} bad={expired > 0} />
        <Stat label="Com faturamento atrelado" value={String(withBilling)} />
      </div>

      <CotasInfraCard payload={payload} />

      {CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => (
        <section key={cat} style={{ marginBottom: "1.75rem" }}>
          <h2 style={sectionTitle}>{CATEGORY_LABEL[cat] ?? cat}</h2>
          <div className="ea-table-scroll" style={{ ...card, padding: 0, overflow: "hidden" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>API</th>
                  <th style={th}>Provedor</th>
                  <th style={th}>Sistema(s)</th>
                  <th style={th}>Status</th>
                  <th style={th}>Vencimento</th>
                  <th style={th}>Faturamento / saldo</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.get(cat)!.map((api, i) => {
                  const systems = api.systems ?? [];
                  const expState = expirationState(api.expiresAt);
                  return (
                    <tr key={api.id} style={rowBg(i)}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {api.name}
                        {api.notes ? (
                          <div style={{ fontWeight: 400, fontSize: "0.78rem", color: "var(--theme-elevation-500)", marginTop: 2, maxWidth: 320 }}>
                            {api.notes}
                          </div>
                        ) : null}
                      </td>
                      <td style={td}>{api.provider}</td>
                      <td style={td}>
                        {systems.map((s) => s.system).join(", ") || "—"}
                        {systems.length > 1 ? (
                          <span
                            style={{
                              display: "inline-block",
                              marginLeft: 6,
                              padding: "0.1rem 0.45rem",
                              borderRadius: 999,
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              background: "var(--theme-elevation-100)",
                              border: `1px solid ${EA_GOLD}`,
                              color: "var(--theme-elevation-700)",
                            }}
                          >
                            compartilhada
                          </span>
                        ) : null}
                      </td>
                      <td style={td}>
                        <span style={badge(STATUS_COLOR[api.status] ?? "var(--theme-elevation-300)")} />
                        {STATUS_LABEL[api.status] ?? api.status}
                      </td>
                      <td style={{ ...td, color: expState === "expired" || expState === "soon" ? "var(--theme-error-600)" : undefined, fontWeight: expState === "expired" || expState === "soon" ? 600 : undefined }}>
                        {formatDate(api.expiresAt)}
                        {api.renewalCycle ? (
                          <div style={{ fontWeight: 400, fontSize: "0.78rem", color: "var(--theme-elevation-500)" }}>{api.renewalCycle}</div>
                        ) : null}
                      </td>
                      <td style={td}>
                        {api.hasBilling ? (
                          <>
                            {api.balanceOrCost || "sem valor registrado"}
                            {api.billingLink ? (
                              <div style={{ fontSize: "0.78rem" }}>
                                <a href={api.billingLink} target="_blank" rel="noopener noreferrer">
                                  ver saldo real ↗
                                </a>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span style={{ color: "var(--theme-elevation-500)" }}>sem faturamento</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {total === 0 ? (
        <p>
          Nenhuma API cadastrada ainda. Rode a carga inicial (<code>/api/dev/seed-api-inventory</code>) ou crie
          manualmente em <Link href="/eahub/collections/api-inventory">Inventário de APIs</Link>.
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value, warn, bad }: { label: string; value: string; warn?: boolean; bad?: boolean }) {
  const color = bad ? "var(--theme-error-500)" : warn ? "var(--theme-warning-500)" : EA_GOLD;
  return (
    <div style={{ ...card, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: "0.78rem", color: "var(--theme-elevation-500)", textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.15rem" }}>{value}</div>
    </div>
  );
}
