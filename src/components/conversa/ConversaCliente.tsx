"use client";

import { useEffect, useRef } from "react";

/**
 * Parte interativa da página /conversa: vídeo de prova e agenda do Calendly.
 * Cada gesto (abrir, dar play, agendar) vai para /api/conversa/evento com o token do lead.
 * O segredo do CRM nunca chega ao navegador: o servidor valida o token.
 */

const WIDGET_SRC = "https://assets.calendly.com/assets/external/widget.js";

type Gesto = "abriu" | "play" | "agendou";

function avisar(token: string | null, gesto: Gesto, evento?: string) {
  if (!token) return;
  try {
    void fetch("/api/conversa/evento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ t: token, gesto, evento }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // o visitante não precisa saber
  }
}

export function ConversaCliente({
  token,
  video,
  poster,
  legenda,
  calendlyUrl,
  nome,
  email,
}: {
  token: string | null;
  video: string;
  poster: string;
  legenda: string;
  calendlyUrl: string;
  nome: string | null;
  email: string | null;
}) {
  const agenda = useRef<HTMLDivElement>(null);
  const jaDeuPlay = useRef(false);

  useEffect(() => {
    avisar(token, "abriu");

    const iniciar = () => {
      if (!window.Calendly || !agenda.current) return;
      agenda.current.innerHTML = "";
      window.Calendly.initInlineWidget({
        url: calendlyUrl,
        parentElement: agenda.current,
        prefill: { ...(nome ? { name: nome } : {}), ...(email ? { email } : {}) },
      });
    };
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${WIDGET_SRC}"]`);
    if (window.Calendly) iniciar();
    else if (existente) existente.addEventListener("load", iniciar);
    else {
      const s = document.createElement("script");
      s.src = WIDGET_SRC;
      s.async = true;
      s.addEventListener("load", iniciar);
      document.body.appendChild(s);
    }

    const aoReceber = (e: MessageEvent) => {
      if (e.origin !== "https://calendly.com") return;
      const d = e.data as { event?: string; payload?: { event?: { uri?: string } } } | null;
      if (d?.event === "calendly.event_scheduled") avisar(token, "agendou", d.payload?.event?.uri);
    };
    window.addEventListener("message", aoReceber);
    return () => {
      window.removeEventListener("message", aoReceber);
      existente?.removeEventListener("load", iniciar);
    };
  }, [token, calendlyUrl, nome, email]);

  return (
    <>
      <figure className="mx-auto w-full max-w-[300px]">
        <video
          className="aspect-[9/16] max-h-[68vh] w-full rounded-2xl bg-navy object-cover"
          controls
          playsInline
          preload="metadata"
          poster={poster}
          onPlay={() => {
            if (jaDeuPlay.current) return;
            jaDeuPlay.current = true;
            avisar(token, "play");
          }}
        >
          <source src={video} type="video/mp4" />
        </video>
        <figcaption className="mt-3 text-center text-sm text-gray">{legenda}</figcaption>
      </figure>

      <section aria-labelledby="agendar" className="mt-10">
        <h2 id="agendar" className="font-heading text-xl font-semibold text-navy">
          Escolha o melhor horário
        </h2>
        <div
          ref={agenda}
          className="mt-4 overflow-hidden rounded-2xl border border-line bg-white"
          style={{ minWidth: "320px", height: "760px" }}
          aria-label="Agendamento da reunião de 20 minutos"
        />
      </section>
    </>
  );
}
