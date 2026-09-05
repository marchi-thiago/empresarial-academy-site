import type { ListViewServerProps } from "payload";
import Link from "next/link";
import { SYSTEM_CARD_LINK_PROPS } from "@/lib/system-card-link";
import Image from "next/image";
import { DeleteLinkButton } from "./DeleteLinkButton";
import { isBasicAuthProtectedPath } from "@/lib/basic-auth-protected-paths";

const NAVY = "#1D2B3C";
const GOLD = "#C99A3E";

type SystemLinkDoc = {
  id: string | number;
  name: string;
  url?: string | null;
  description?: string | null;
  order?: number | null;
};

/**
 * List view custom da coleção `system-links` (registrada em
 * admin.components.views.list): apresenta os sistemas da EA como um portfólio
 * de cartões — é o "cartão de visita" da empresa. Adicionar usa o formulário
 * nativo de criação; editar abre o registro; remover é inline (DeleteLinkButton).
 */
export async function SystemLinksListView(props: ListViewServerProps) {
  const { payload, data, collectionSlug, newDocumentURL } = props as ListViewServerProps & {
    newDocumentURL?: string;
  };

  // `data.docs` já vem paginado; para o portfólio (poucos itens) buscamos todos ordenados.
  const { docs } = await payload.find({
    collection: "system-links",
    limit: 200,
    depth: 0,
    sort: "order",
  });
  const links = (docs as unknown as SystemLinkDoc[]) ?? ((data?.docs as unknown as SystemLinkDoc[]) || []);

  const adminRoute = "/eahub";
  const createUrl = newDocumentURL || `${adminRoute}/collections/${collectionSlug}/create`;

  return (
    <div className="ea-view">
      <header
        className="ea-view-header"
        style={{
          background: NAVY,
          color: "#fff",
          borderRadius: 12,
          borderBottom: `3px solid ${GOLD}`,
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Image src="/logo-empresarial-academy.png" alt="" width={192} height={183} style={{ width: 44, height: "auto" }} />
          <div>
            <h1 style={{ margin: 0, color: "#fff", fontSize: "1.3rem", fontFamily: "'Sora', sans-serif" }}>Sistemas EA</h1>
            <p style={{ margin: "0.2rem 0 0", color: GOLD, fontSize: "0.85rem" }}>
              O portfólio de sistemas e plataformas da Empresarial Academy.
            </p>
          </div>
        </div>
        <Link
          href={createUrl}
          style={{
            background: "linear-gradient(180deg, #E5CA8C 0%, #C99A3E 100%)",
            color: "#0F1722",
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            textDecoration: "none",
            padding: "0.6rem 1.1rem",
            borderRadius: 8,
            whiteSpace: "nowrap",
            boxShadow: "0 2px 10px rgba(201, 154, 62, 0.25)",
          }}
        >
          + Adicionar sistema
        </Link>
      </header>

      {links.length === 0 ? (
        <p>Nenhum sistema cadastrado ainda. Use &quot;Adicionar sistema&quot;.</p>
      ) : (
        <div className="ea-card-grid">
          {links.map((link) => {
            const url = (link.url ?? "").trim();
            const isExternal = /^https?:\/\//.test(url);
            const editUrl = `${adminRoute}/collections/${collectionSlug}/${link.id}`;
            return (
              <div
                key={link.id}
                style={{
                  background: "var(--ea-surface-bg, #FFFFFF)",
                  border: "1px solid var(--ea-card-border, #E7E2D8)",
                  borderTop: `3px solid ${url ? GOLD : "var(--ea-card-border, #E7E2D8)"}`,
                  borderRadius: 14,
                  padding: "1.2rem 1.4rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  boxShadow: "0 4px 20px -2px rgba(29, 43, 60, 0.04)",
                  opacity: url ? 1 : 0.7,
                }}
              >
                <strong style={{ fontSize: "1rem" }}>{link.name}</strong>
                {link.description ? (
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--theme-elevation-700)" }}>
                    {link.description}
                  </p>
                ) : null}
                {url ? (
                  <code style={{ fontSize: "0.75rem", color: "var(--theme-elevation-500)", wordBreak: "break-all" }}>{url}</code>
                ) : (
                  <span style={{ fontSize: "0.75rem", color: "var(--theme-elevation-500)" }}>Em breve (sem link)</span>
                )}

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto", paddingTop: "0.5rem", flexWrap: "wrap" }}>
                  {url ? (
                    // Sistema sempre abre em aba nova, interno ou externo
                    // (ver system-card-link.ts) — o HUB fica atrás.
                    isExternal ? (
                      <a
                        href={url}
                        {...SYSTEM_CARD_LINK_PROPS}
                        style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--theme-text)" }}
                      >
                        Abrir ↗
                      </a>
                    ) : (
                      <Link
                        href={url}
                        {...SYSTEM_CARD_LINK_PROPS}
                        style={{ fontSize: "0.8rem", fontWeight: 600 }}
                        prefetch={isBasicAuthProtectedPath(url) ? false : undefined}
                      >
                        Abrir ↗
                      </Link>
                    )
                  ) : null}
                  <Link href={editUrl} style={{ fontSize: "0.8rem" }}>
                    Editar
                  </Link>
                  <span style={{ marginLeft: "auto" }}>
                    <DeleteLinkButton id={link.id} name={link.name} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
