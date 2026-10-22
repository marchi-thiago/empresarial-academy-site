import Link from "next/link";

export function EaHubAlertsBanner({
  pendingContractsCount = 0,
}: {
  pendingContractsCount?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "1rem",
        marginBottom: "2.25rem",
      }}
    >
      {/* Alerta 1: Central de Aprovação EA Post */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          padding: "1rem 1.25rem",
          borderRadius: 14,
          background: "rgba(201,154,62,0.08)",
          border: "1px solid rgba(201,154,62,0.3)",
        }}
      >
        <span style={{ fontSize: "1.6rem" }}>⚡</span>
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: "0.88rem", display: "block", color: "var(--ea-text-primary, #1D2B3C)", fontFamily: "'Sora', sans-serif" }}>
            Central de Aprovação · EA Post
          </strong>
          <span style={{ fontSize: "0.78rem", color: "var(--ea-text-secondary, #5B6472)" }}>
            Rascunhos de Blog, Materiais e Redes aguardando revisão.
          </span>
        </div>
        <a
          href="https://post.empresarialacademy.com/admin/aprovacao"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "0.76rem",
            fontWeight: 700,
            color: "#1D2B3C",
            background: "#C99A3E",
            padding: "0.4rem 0.85rem",
            borderRadius: 8,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Aprovar ↗
        </a>
      </div>

      {/* Alerta 2: Contratos Pendentes */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          padding: "1rem 1.25rem",
          borderRadius: 14,
          background: "rgba(59,130,246,0.07)",
          border: "1px solid rgba(59,130,246,0.25)",
        }}
      >
        <span style={{ fontSize: "1.6rem" }}>📑</span>
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: "0.88rem", display: "block", color: "var(--ea-text-primary, #1D2B3C)", fontFamily: "'Sora', sans-serif" }}>
            Formalização & Assinaturas
          </strong>
          <span style={{ fontSize: "0.78rem", color: "var(--ea-text-secondary, #5B6472)" }}>
            {pendingContractsCount > 0
              ? `${pendingContractsCount} contrato(s) aguardando assinatura.`
              : "Todos os contratos ativos estão formalizados."}
          </span>
        </div>
        <Link
          href="/eahub/contratos/novo"
          style={{
            fontSize: "0.76rem",
            fontWeight: 700,
            color: "#FFFFFF",
            background: "#1D2B3C",
            padding: "0.4rem 0.85rem",
            borderRadius: 8,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Novo Contrato +
        </Link>
      </div>

      {/* Alerta 3: Torre de Controle WhatsApp */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          padding: "1rem 1.25rem",
          borderRadius: 14,
          background: "rgba(46,125,91,0.07)",
          border: "1px solid rgba(46,125,91,0.25)",
        }}
      >
        <span style={{ fontSize: "1.6rem" }}>🟢</span>
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: "0.88rem", display: "block", color: "var(--ea-text-primary, #1D2B3C)", fontFamily: "'Sora', sans-serif" }}>
            EA Assessor · WhatsApp Ativo
          </strong>
          <span style={{ fontSize: "0.78rem", color: "var(--ea-text-secondary, #5B6472)" }}>
            Conexão com nuvem e Gemini AI sincronizada 24/7.
          </span>
        </div>
        <Link
          href="/eahub/secretaria"
          style={{
            fontSize: "0.76rem",
            fontWeight: 700,
            color: "#2E7D5B",
            background: "rgba(46,125,91,0.15)",
            padding: "0.4rem 0.85rem",
            borderRadius: 8,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Painel ↗
        </Link>
      </div>
    </div>
  );
}
