"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

/**
 * Barra de navegação de volta, padrão pra TODAS as telas do EA HUB — pedido
 * do Thiago em 05/09/2026: "em algumas janelas perdemos o acesso a voltar".
 *
 * Implementa o padrão usado na web para isto (o mesmo do GitHub, do Google
 * Drive e do admin do Shopify), que resolve o caso em que o histórico está
 * vazio — aba nova, link colado, F5 numa rota profunda:
 *
 *   1. "Voltar": só aparece quando existe histórico DENTRO deste site.
 *      Detectado por `window.history.length > 1` combinado com
 *      `document.referrer` da mesma origem — sem essa segunda checagem, uma
 *      aba recém-aberta (que já nasce com length 1 e às vezes 2) mostraria
 *      um botão que não leva a lugar nenhum, que é exatamente o beco sem
 *      saída relatado.
 *   2. "Subir um nível" (breadcrumb): SEMPRE presente, derivado do próprio
 *      pathname. É o caminho garantido, não depende de histórico nenhum.
 *   3. "EA HUB": âncora fixa pra home, sempre presente.
 *
 * Ou seja: mesmo numa aba aberta do zero, sem histórico, existem dois
 * caminhos de saída. Nunca fica preso.
 */
export function EaBackBar({
  /** Rótulo do destino do "subir um nível" quando o automático não serve. */
  parentLabel,
  /** Sobrescreve o destino calculado do "subir um nível". */
  parentHref,
  hubHref = "/eahub",
}: {
  parentLabel?: string;
  parentHref?: string;
  hubHref?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // Só no cliente: no servidor não existe history nem referrer, e mostrar
    // o botão no HTML inicial pra depois escondê-lo causaria um pulo visual.
    if (typeof window === "undefined") return;
    const sameOriginReferrer = Boolean(document.referrer) && document.referrer.startsWith(window.location.origin);
    setCanGoBack(window.history.length > 1 && sameOriginReferrer);
  }, [pathname]);

  // Sobe um segmento do caminho: /eahub/collections/leads → /eahub/collections
  const computedParent = (() => {
    if (parentHref) return parentHref;
    const segments = (pathname ?? "").split("/").filter(Boolean);
    if (segments.length <= 1) return hubHref;
    return `/${segments.slice(0, -1).join("/")}`;
  })();

  const showParent = computedParent !== hubHref;

  return (
    <nav
      aria-label="Navegação de retorno"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        flexWrap: "wrap",
        marginBottom: "1rem",
        fontSize: "0.85rem",
        fontWeight: 600,
      }}
    >
      {canGoBack ? (
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            padding: 0,
            font: "inherit",
            color: "var(--theme-elevation-600, #5b626e)",
            cursor: "pointer",
          }}
        >
          <span aria-hidden style={{ fontSize: "1.1em", lineHeight: 1 }}>←</span>
          Voltar
        </button>
      ) : null}

      {showParent ? (
        <>
          {canGoBack ? <span aria-hidden style={{ color: "var(--theme-elevation-300, #c9ccd2)" }}>/</span> : null}
          <Link
            href={computedParent}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--theme-elevation-600, #5b626e)",
              textDecoration: "none",
            }}
          >
            {parentLabel ?? "Tela anterior"}
          </Link>
        </>
      ) : null}

      {canGoBack || showParent ? <span aria-hidden style={{ color: "var(--theme-elevation-300, #c9ccd2)" }}>/</span> : null}
      <Link
        href={hubHref}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--theme-elevation-600, #5b626e)",
          textDecoration: "none",
        }}
      >
        🏠 EA HUB
      </Link>
    </nav>
  );
}
