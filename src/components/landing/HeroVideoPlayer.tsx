"use client";

import { useEffect, useRef, useState } from "react";

interface HeroVideoPlayerProps {
  src: string;
  poster: string;
  ariaLabel?: string;
  autoPlay?: boolean;
  loop?: boolean;
  controls?: boolean;
  comSom?: boolean;
  className?: string;
}

/**
 * Player do vídeo principal da hero da landing page.
 *
 * Navegadores modernos (Chrome, Safari, Edge, Firefox) bloqueiam autoplay de
 * vídeos com áudio por política de segurança/experiência. Além disso, no React
 * SSR o atributo `muted` no HTML não define a propriedade JavaScript
 * `video.muted = true`, fazendo com que o navegador recuse o autoplay após a
 * hidratação.
 *
 * Este componente cliente:
 * 1. Força `video.muted = true` e `video.defaultMuted = true` no DOM no carregamento.
 * 2. Chama `.play()` explicitamente no `useEffect`.
 * 3. Se o vídeo tem narração (`comSom: true`), exibe um botão chamativo no canto
 *    superior para o visitante ativar o som com 1 clique.
 * 4. Mantém controles nativos para pausar, avançar e regular volume.
 */
export function HeroVideoPlayer({
  src,
  poster,
  ariaLabel,
  autoPlay = true,
  loop = true,
  controls = true,
  comSom = false,
  className = "absolute inset-0 h-full w-full bg-navy object-contain",
}: HeroVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (autoPlay) {
      // Garantir muted no DOM nativo antes de tentar reproduzir
      video.muted = true;
      video.defaultMuted = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            console.warn("Autoplay impedido pelo navegador:", err);
            setIsPlaying(false);
          });
      }
    }
  }, [autoPlay, src]);

  const handleUnmute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.defaultMuted = false;
    setIsMuted(false);
    video.play().catch(() => {});
  };

  const handleVolumeChange = () => {
    const video = videoRef.current;
    if (video) {
      setIsMuted(video.muted || video.volume === 0);
    }
  };

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        key={src}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        muted
        loop={loop}
        controls={controls}
        playsInline
        preload="auto"
        aria-label={ariaLabel}
        onVolumeChange={handleVolumeChange}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className={className}
      />

      {/* Botão para ativar som quando o vídeo tem narração e está reproduzindo mutado */}
      {comSom && isMuted && isPlaying && (
        <button
          type="button"
          onClick={handleUnmute}
          className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full border border-gold/40 bg-navy/90 px-3.5 py-1.5 text-xs font-semibold text-gold shadow-lg backdrop-blur transition duration-200 hover:scale-105 hover:border-gold hover:bg-navy md:text-sm"
          aria-label="Ativar som do vídeo"
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
  );
}
