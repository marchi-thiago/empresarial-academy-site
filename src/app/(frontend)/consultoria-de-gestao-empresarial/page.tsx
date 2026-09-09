import type { Metadata } from "next";
import { ConsultoriaLPTemplate } from "@/components/landing/ConsultoriaLPTemplate";

/**
 * LP dedicada à palavra-chave "consultoria de gestão empresarial" (Google
 * Ads — 100 a 1.000 buscas/mês, lance estimado R$ 6,96–31,72). Canonical
 * aponta para /consultoria-pme para não competir por ranqueamento orgânico
 * com a página principal — o H1/título distintos servem à relevância do
 * anúncio (Quality Score), não à indexação. Ver "Plano de Posicionamento e
 * Esteira", seção "Mídia paga", item "4 · página".
 */
export const metadata: Metadata = {
  title: "Consultoria de Gestão Empresarial | Organize a gestão e cresça com método",
  description:
    "Consultoria de gestão empresarial para donos de PME que cresceram mais rápido que a organização interna. Diagnóstico gratuito, indicadores e método aplicado.",
  alternates: { canonical: "/consultoria-pme" },
};

export default function Page() {
  return (
    <ConsultoriaLPTemplate
      eyebrow="Consultoria de Gestão Empresarial · Método Gestão 360"
      h1="Consultoria de Gestão Empresarial para quem cresceu mais rápido que a própria organização"
      subtitle="Consultoria de gestão empresarial prática, para donos de pequenas e médias empresas que precisam sair da correria do dia a dia, colocar indicadores no lugar e voltar a crescer com método — não no improviso."
      newsletterOrigem="Newsletter — LP consultoria-gestao-empresarial"
      origemTag="[LP1]"
      hero={{
        src: "/videos/lp-consultoria-gestao-empresarial.mp4",
        poster: "/images/lp-consultoria-gestao-empresarial-capa.jpg",
        legenda: "Thiago Marchi explica o diagnóstico de maturidade em menos de 2 minutos.",
        comSom: true,
        autoPlay: true,
        loop: true,
      }}
    />
  );
}
