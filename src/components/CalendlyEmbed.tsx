"use client";

import { useEffect, useRef } from "react";

/**
 * Incorpora o agendamento do Calendly (widget inline) — usado em páginas
 * institucionais/orgânicas (ex.: /contato) como alternativa ao formulário.
 * NÃO usar na landing page de aquisição paga (preserva a hierarquia de CTA).
 * Se o slug do evento mudar no Calendly, atualizar CALENDLY_URL.
 */
const CALENDLY_URL = "https://calendly.com/thiago-empresarialacademy/new-meeting";
const WIDGET_SRC = "https://assets.calendly.com/assets/external/widget.js";

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (opts: { url: string; parentElement: HTMLElement; prefill?: { name?: string; email?: string } }) => void;
    };
  }
}

export function CalendlyEmbed({
  url = CALENDLY_URL,
  minHeight = 720,
}: {
  url?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function init() {
      if (window.Calendly && ref.current) {
        ref.current.innerHTML = "";
        window.Calendly.initInlineWidget({ url, parentElement: ref.current });
      }
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${WIDGET_SRC}"]`,
    );

    if (window.Calendly) {
      init();
    } else if (existing) {
      existing.addEventListener("load", init);
    } else {
      const s = document.createElement("script");
      s.src = WIDGET_SRC;
      s.async = true;
      s.addEventListener("load", init);
      document.body.appendChild(s);
    }

    return () => existing?.removeEventListener("load", init);
  }, [url]);

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-2xl border border-line bg-white"
      style={{ minWidth: "320px", height: `${minHeight}px` }}
      aria-label="Agendamento de reunião"
    />
  );
}
