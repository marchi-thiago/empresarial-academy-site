"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { heroSlides } from "@/lib/content";

const AUTOPLAY_MS = 6500;

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = heroSlides.length;

  const go = useCallback(
    (i: number) => setIndex(((i % count) + count) % count),
    [count],
  );

  const prefersReduced = useRef(false);
  useEffect(() => {
    prefersReduced.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  useEffect(() => {
    if (paused || prefersReduced.current) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, count]);

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques da Empresarial Academy"
      className="relative isolate flex min-h-[400px] flex-col justify-center overflow-hidden bg-navy text-white md:min-h-[500px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_70%_0%,#2e4358_0%,transparent_70%)]"
      />

      {/* Imagem/vídeo do slide, alinhado à borda direita do banner */}
      {heroSlides.map((slide, i) => {
        const video = "video" in slide ? slide.video : undefined;
        return (
        <div
          key={slide.title}
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] transition-opacity duration-700 md:block ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        >
          {video ? (
            <video
              ref={(el) => {
                if (el) {
                  el.muted = true;
                  el.defaultMuted = true;
                  el.play().catch(() => {});
                }
              }}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={slide.image}
              className="h-full w-full object-contain object-right"
            >
              <source src={video} type="video/mp4" />
            </video>
          ) : (
            <Image
              src={slide.image}
              alt=""
              fill
              priority={i === 0}
              sizes="46vw"
              className="object-contain object-right"
            />
          )}
        </div>
        );
      })}

      <div className="relative mx-auto w-full max-w-6xl px-6 py-8 md:py-10">
        {heroSlides.map((slide, i) => {
          // SEO: apenas o primeiro slide é o H1 da página; os demais são
          // visualmente idênticos, mas não competem como título principal.
          const Title = i === 0 ? "h1" : "p";
          return (
          <div
            key={slide.title}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${count}`}
            aria-hidden={i !== index}
            className={`${i === index ? "block" : "hidden"} max-w-3xl md:max-w-[54%]`}
          >
            <p className="font-[var(--font-heading)] text-sm uppercase tracking-[0.25em] text-gold">
              {slide.eyebrow}
            </p>
            <Title className="mt-3 text-3xl font-bold leading-tight md:text-4xl">
              {slide.title}
            </Title>
            <p className="mt-4 max-w-2xl text-base text-white/80 md:text-lg">
              {slide.subtitle}
            </p>
            <div className="mt-6">
              <Button href={slide.ctaHref} variant="primary" size="lg">
                {slide.ctaLabel}
              </Button>
            </div>
          </div>
          );
        })}

        {/* Controles */}
        <div className="mt-8 flex items-center gap-4">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Slide anterior"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:border-gold hover:text-gold"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <ul className="flex gap-1">
            {heroSlides.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Ir para o slide ${i + 1}`}
                  aria-current={i === index}
                  // 5 pontos a 44px cada não cabem ao lado das duas setas em
                  // telas de celular — o flex comprimia as SETAS pra caber
                  // (achado testando em produção: viravam 30px de largura).
                  // 36px é o meio-termo: bem maior que os 24px originais,
                  // sem forçar overflow.
                  className="flex h-9 min-w-9 shrink-0 items-center justify-center px-1"
                >
                  <span
                    className={`block h-2 rounded-full transition-all ${
                      i === index ? "w-8 bg-gold" : "w-2 bg-white/40 hover:bg-white/60"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Próximo slide"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:border-gold hover:text-gold"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
