"use client";

import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { CONVERSA_PATH, hrefDaConversa } from "@/lib/conversa-link";

/**
 * CTA único de agendamento. Entra no INÍCIO de todo artigo do blog e de todo material gratuito, no layout da página
 * (nunca no conteúdo do CMS). O link vai para /conversa e leva o `?t=` do lead e as UTMs da URL atual, quando existirem.
 * No HTML do servidor o href é o /conversa puro; o navegador acrescenta os parâmetros ao montar.
 */
export function AgendarConversaCta({ className = "" }: { className?: string }) {
  const [href, setHref] = useState<string>(CONVERSA_PATH);

  useEffect(() => {
    try {
      setHref(hrefDaConversa(window.location.search));
    } catch {
      /* mantém o link base */
    }
  }, []);

  return (
    <aside
      aria-labelledby="cta-agendar-titulo"
      data-cta="agendar-conversa"
      className={`rounded-2xl border border-gold/40 border-l-4 border-l-gold bg-surface px-5 py-5 sm:px-7 sm:py-6 ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div>
          <h2 id="cta-agendar-titulo" className="font-heading text-lg font-bold leading-snug text-navy sm:text-xl">
            Quer saber por onde começar na sua empresa?
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-gray sm:text-base">
            Em um bate-papo rápido e gratuito, você vê onde priorizar e onde a IA pode dar retorno.
          </p>
        </div>
        <a href={href} className={buttonClasses("primary", "md", "shrink-0 text-center")}>
          Reservar um bate-papo gratuito
        </a>
      </div>
    </aside>
  );
}
