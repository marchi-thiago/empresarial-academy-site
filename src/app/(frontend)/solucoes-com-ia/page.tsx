import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { SistemaCard, sistemasVideoJsonLd } from "@/components/SistemaCard";
import { sistemasVideo, tecnologiaIA, type SistemaVideo } from "@/lib/content";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Soluções com IA: sistemas sob medida para a gestão",
  description:
    "Consultoria empresarial com IA: veja os sistemas que rodam a Empresarial Academy e o tipo de solução que construímos sob medida para a sua empresa ganhar tempo, cortar custo e aumentar o lucro.",
  alternates: { canonical: "/solucoes-com-ia" },
};

const GRUPOS: SistemaVideo["grupo"][] = [
  "Atrair clientes",
  "Atender e vender",
  "Formalizar a venda",
  "Diagnosticar e gerir",
];

/**
 * Página pública dos sistemas (substitui /tecnologia em 28/09/2026, Branding
 * v3). Mostra os sistemas próprios da EA como prova do que a consultoria
 * entrega, agrupados pelo resultado para o dono, com vídeo quando publicado.
 */
export default function Page() {
  const videoJsonLd = sistemasVideoJsonLd(sistemasVideo);
  const whatsapp = `https://wa.me/${siteConfig.contact.phoneRaw}?text=${encodeURIComponent(
    "Olá! Vi as soluções com IA no site e quero entender o que faz sentido para a minha empresa.",
  )}`;

  return (
    <main>
      {videoJsonLd.length > 0 ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }} />
      ) : null}
      <PageHero
        title="Soluções com IA: o método rodando no dia a dia"
        subtitle="Sistemas e automações feitos sob medida dentro da consultoria. Estes são os que rodam a Empresarial Academy hoje, e o tipo de solução que construímos para a sua empresa."
        crumbs={[{ label: "Soluções com IA" }]}
      />

      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading title={tecnologiaIA.titulo} subtitle="Consultoria empresarial com IA, sempre medida por resultado." />
        <div className="mt-8 grid gap-4 text-gray md:grid-cols-3">
          {tecnologiaIA.paragrafos.map((p) => (
            <p key={p.slice(0, 24)} className="leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      </section>

      {GRUPOS.map((grupo, i) => {
        const itens = sistemasVideo.filter((s) => s.grupo === grupo);
        return (
          <section key={grupo} className={i % 2 === 0 ? "bg-white" : undefined}>
            <div className="mx-auto max-w-6xl px-6 py-16">
              <SectionHeading title={grupo} />
              <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {itens.map((s) => (
                  <SistemaCard key={s.slug} sistema={s} />
                ))}
              </div>
            </div>
          </section>
        );
      })}

      <section className="bg-navy text-white">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <SectionHeading
            title="Onde um sistema desses ganha tempo na sua empresa?"
            subtitle="Começa pelo diagnóstico gratuito: ele mostra onde a gestão trava. A partir dali, a consultoria organiza o método e constrói o sistema que faz sentido para a sua operação."
            align="center"
            invert
          />
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button href="/diagnostico-maturidade-empresarial.html" external variant="primary" size="lg">
              Fazer o diagnóstico gratuito
            </Button>
            <Button href={whatsapp} external variant="outline" size="lg">
              Conversar pelo WhatsApp
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
