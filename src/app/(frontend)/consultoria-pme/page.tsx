import type { Metadata } from "next";
import { ConsultoriaLPTemplate } from "@/components/landing/ConsultoriaLPTemplate";

export const metadata: Metadata = {
  title: "Consultoria para PMEs | Organize a gestão e cresça com método",
  description:
    "Consultoria prática para donos de pequenas e médias empresas: organize processos, monte indicadores e volte a crescer com método. Comece pelo diagnóstico gratuito.",
  alternates: { canonical: "/consultoria-pme" },
};

export default function Page() {
  return (
    <ConsultoriaLPTemplate
      eyebrow="Consultoria e mentoria para PMEs · Método Gestão 360"
      h1="A sua empresa depende de você para tudo? Está na hora de organizar a gestão."
      subtitle="As empresas não quebram por falta de vendas — quebram por falta de gestão. Consultoria prática para donos de pequenas e médias empresas que querem sair da correria do dia a dia, colocar indicadores no lugar e crescer com método, não no improviso."
      newsletterOrigem="Newsletter — LP consultoria-pme"
      origemTag="[PME]"
      hero={{
        src: "/videos/lp-consultoria-pme.mp4",
        poster: "/images/lp-consultoria-pme-capa.jpg",
        legenda: "Thiago Marchi explica o diagnóstico de maturidade em 1 minuto e meio.",
        comSom: true,
        autoPlay: true,
        loop: true,
      }}
    />
  );
}
