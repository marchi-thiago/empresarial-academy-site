import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/layout/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { VideoTestimonial } from "@/components/VideoTestimonial";
import { depoimentosVideo, pilares } from "@/lib/content";
import { servicosMenu, siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Serviços",
  description:
    "Consultoria empresarial com IA, Mentorias Estratégicas, Palestras, Curso e Livro Gestão 360: tudo nasce do mesmo método de 6 pilares.",
  alternates: { canonical: "/servicos" },
};

const servicesJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: servicosMenu.map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: {
      "@type": "Service",
      name: s.title,
      description: s.desc,
      url: `${siteConfig.url}${s.href}`,
      provider: { "@type": "Organization", name: siteConfig.name },
      areaServed: "BR",
    },
  })),
};

export default function Page() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(servicesJsonLd) }}
      />
      <PageHero
        title="Conheça nossos serviços e produtos"
        subtitle="Consultoria empresarial com IA, mentoria, palestras, curso e livro: o mesmo método aplicado do jeito que a sua empresa precisa."
        crumbs={[{ label: "Serviços" }]}
        video="/videos/servicos-360.mp4"
        image="/images/negocios.jpg"
        imageAlt="Empresarial Academy — Serviços 360"
      />

      {/* Metodologia Gestão 360 — 6 pilares */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          title="Metodologia Gestão 360"
          subtitle="Nossa metodologia proprietária, presente em tudo o que entregamos: 6 pilares para organizar processos, multiplicar lucros e liderar com clareza. Método para crescer, gestão para permanecer."
        />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pilares.map((p) => (
            <li
              key={p.n}
              className="relative rounded-xl border border-line bg-white p-7"
            >
              <span className="absolute right-6 top-6 font-[var(--font-heading)] text-3xl font-bold text-line">
                {p.n}
              </span>
              <Icon name={p.icon} className="h-9 w-9 text-gold-ink" />
              <h3 className="mt-4 text-lg font-semibold text-navy">
                {p.titulo}
              </h3>
              <p className="mt-2 text-sm text-gray">{p.desc}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <Button href="/servicos/curso-gestao-360" variant="secondary" size="md">
            Detalhes do Curso Gestão 360
          </Button>
        </div>
      </section>

      {/* Outros serviços */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeading title="Soluções para cada momento do seu negócio" align="center" />
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {servicosMenu.map((s) => (
              <li
                key={s.href}
                className="flex flex-col rounded-xl border border-line bg-surface p-7"
              >
                <Icon name={s.icon} className="h-10 w-10 text-gold-ink" />
                <h3 className="mt-4 text-lg font-semibold text-navy">
                  {s.title}
                </h3>
                <p className="mt-2 flex-1 text-sm text-gray">{s.desc}</p>
                <Link
                  href={s.href}
                  className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-gold-ink hover:underline"
                >
                  Saiba mais →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* O impacto do nosso método — prova social em vídeo */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeading title="O impacto do nosso método" align="center" />
          <div className="mx-auto mt-10 grid max-w-4xl items-center gap-8 md:grid-cols-[320px_1fr]">
            <div className="mx-auto w-full max-w-sm md:mx-0">
              <VideoTestimonial
                video={depoimentosVideo.daniella.video}
                poster={depoimentosVideo.daniella.poster}
                name={depoimentosVideo.daniella.name}
                role={depoimentosVideo.daniella.role}
                caption={false}
              />
            </div>
            <div className="text-center md:text-left">
              <p className="text-sm font-semibold text-gold-ink">
                {depoimentosVideo.daniella.name} · {depoimentosVideo.daniella.role}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-navy">
                {depoimentosVideo.daniella.chamada}
              </h3>
              <p className="mt-3 text-sm text-gray">{depoimentosVideo.daniella.texto}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy-light text-white">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">
            Não sabe por onde começar?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">
            Faça uma avaliação gratuita e descubra a solução ideal para o momento
            da sua empresa.
          </p>
          <div className="mt-6">
            <Button href="/diagnostico-maturidade-empresarial.html" external variant="primary" size="lg">
              Fazer diagnóstico gratuito
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
