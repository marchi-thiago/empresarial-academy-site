import Link from "next/link";

const NAVY = "#1D2B3C";
const GOLD = "#C99A3E";

const AREAS = [
  { href: "/eahub/collections/leads", label: "Base de leads" },
  { href: "/eahub/collections/email-segments", label: "Segmentos" },
  { href: "/eahub/collections/email-campaigns", label: "Campanhas e nutrição" },
  { href: "/eahub/collections/email-templates", label: "Modelos de e-mail" },
  { href: "/eahub/collections/email-logs", label: "Envios" },
];

/** Barra comum das 5 áreas do EA Leads (topo das listas). */
export function EaLeadsNav() {
  return (
    <nav
      aria-label="EA Leads"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.5rem",
        margin: "0 0 1.25rem",
        padding: "0.6rem 0.8rem",
        background: NAVY,
        borderBottom: `3px solid ${GOLD}`,
        borderRadius: 8,
      }}
    >
      <strong style={{ color: GOLD, fontSize: "0.85rem", marginRight: "0.5rem" }}>EA Leads</strong>
      {AREAS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          style={{
            color: "#fff",
            fontSize: "0.82rem",
            textDecoration: "none",
            padding: "0.3rem 0.65rem",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.25)",
          }}
        >
          {a.label}
        </Link>
      ))}
    </nav>
  );
}
