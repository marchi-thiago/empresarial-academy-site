"use client";

import { useEffect, useRef } from "react";
import { criarSondagem, type ResultadoDaBusca } from "@/lib/sondagem";

const EVENTOS_DE_USO = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

/**
 * Liga `criarSondagem` (src/lib/sondagem.ts) a uma tela: busca ao abrir e depois no intervalo (mínimo de 60 s), só com a
 * aba visível e em uso, e para de vez quando `buscar` devolve "parar" (401 ou 403).
 */
export function useSondagem(buscar: () => Promise<ResultadoDaBusca>, intervaloMs: number): void {
  const ref = useRef(buscar);
  ref.current = buscar;

  useEffect(() => {
    const s = criarSondagem({
      buscar: () => ref.current(),
      intervaloMs,
      visivel: () => document.visibilityState === "visible",
    });
    const aoMudar = () => s.aoMudarVisibilidade();
    const aoUsar = () => s.aoUsar();
    document.addEventListener("visibilitychange", aoMudar);
    for (const ev of EVENTOS_DE_USO) window.addEventListener(ev, aoUsar, { passive: true });
    s.comecar();
    return () => {
      s.parar();
      document.removeEventListener("visibilitychange", aoMudar);
      for (const ev of EVENTOS_DE_USO) window.removeEventListener(ev, aoUsar);
    };
  }, [intervaloMs]);
}
