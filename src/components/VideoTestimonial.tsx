"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Card de depoimento em vídeo (formato retrato, 9:16).
 *
 * Inicia em autoplay mutado (garantindo compatibilidade com Chrome, Safari e Edge)
 * e exibe o botão elegante "Ativar som 🔊". Ao clicar para ativar o som,
 * o vídeo reinicia do início (para não perder nenhuma fala), o som é ligado e
 * outros vídeos na página são mutados.
 */
export function VideoTestimonial({
  video,
  poster,
  name,
  role,
  caption = true,
}: {
  video: string;
  poster: string;
  name: string;
  role: string;
  /** Legenda com nome/cargo abaixo do vídeo. Desative quando essas
   * informações já aparecem no texto ao lado do card. */
  caption?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Forçar muted no DOM nativo para evitar bloqueios de autoplay pelos navegadores
    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute("muted", "");
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");

    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn("Autoplay impedido pelo navegador:", err);
      });
    }
  }, [video]);

  const handleUnmute = () => {
    const el = ref.current;
    if (!el) return;

    // Mutar qualquer outro vídeo na página para que os áudios não se sobreponham
    document.querySelectorAll<HTMLVideoElement>("video").forEach((v) => {
      if (v !== el) {
        v.muted = true;
      }
    });

    el.muted = false;
    el.defaultMuted = false;
    setIsMuted(false);

    // Se o vídeo já estiver rodando há alguns segundos sem som, reiniciar para ouvir o depoimento completo
    if (el.currentTime > 1 && el.currentTime < 15) {
      el.currentTime = 0;
    }
    el.play().catch(() => {});
  };

  const handleVolumeChange = () => {
    const el = ref.current;
    if (el) {
      setIsMuted(el.muted || el.volume === 0);
    }
  };

  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="relative aspect-[9/16] w-full bg-navy">
        <video
          ref={ref}
          data-testimonial
          src={video}
          poster={poster}
          autoPlay
          muted
          loop
          controls
          playsInline
          preload="auto"
          onVolumeChange={handleVolumeChange}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Botão de ativar som sobreposto ao vídeo */}
        {isMuted && (
          <button
            type="button"
            onClick={handleUnmute}
            className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full border border-gold/40 bg-navy/90 px-3 py-1.5 text-xs font-semibold text-gold shadow-lg backdrop-blur transition duration-200 hover:scale-105 hover:border-gold hover:bg-navy md:text-sm"
            aria-label={`Ativar som do depoimento de ${name}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
            <span>Ativar som 🔊</span>
          </button>
        )}
      </div>
      {caption && (
        <figcaption className="p-5">
          <p className="font-semibold text-navy">{name}</p>
          <p className="text-sm text-gray">{role}</p>
        </figcaption>
      )}
    </figure>
  );
}
