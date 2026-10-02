import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPayloadClient } from "@/lib/payload";
import { SecretariaClientPanel } from "@/components/admin/secretaria/SecretariaClientPanel";
import Link from "next/link";

export const metadata: Metadata = {
  title: "EA Assessor — Torre de Controle Executiva | Empresarial Academy",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SecretariaFrontendPage() {
  // Torre de controle interna: só com login no EA HUB. Sem cookie de sessão nem abre o banco (visitante e robô
  // aqui mantinham o Neon acordado e disparavam consultas ao EA Flow, auditoria de 01/10/2026).
  const entrar = "/eahub/login?redirect=%2Fassessor";
  if (!(await cookies()).get("payload-token")) redirect(entrar);

  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: await headers() });
  if (!user) redirect(entrar);

  let postsCount = 0;
  let leadsCount = 0;
  try {
    const [p, l] = await Promise.all([
      payload.count({ collection: "posts" }),
      payload.count({ collection: "leads" }),
    ]);
    postsCount = p.totalDocs;
    leadsCount = l.totalDocs;
  } catch (e) {
    console.error("Error fetching counts:", e);
  }

  return (
    <div
      style={{
        background: "#0f172a",
        minHeight: "100vh",
        padding: "32px 20px 80px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#f8fafc",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Top Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 28,
            paddingBottom: 20,
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#fff" }}>
                EA Assessor (IA)
              </h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  background: "rgba(34, 197, 94, 0.15)",
                  color: "#4ade80",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                WhatsApp Nuvem 24/7 Ativo
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
              Torre de Controle Operacional de Thiago Marchi e da Empresarial Academy
            </p>
          </div>

          <Link
            href="/eahub"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 18px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              color: "#f8fafc",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ← Voltar ao EA HUB
          </Link>
        </div>

        <SecretariaClientPanel postsCount={postsCount} leadsCount={leadsCount} />
      </div>
    </div>
  );
}
