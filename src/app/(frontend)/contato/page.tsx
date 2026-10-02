import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Icon } from "@/components/ui/Icon";
import { ContactForm } from "@/components/forms/ContactForm";
import { CalendlyEmbed } from "@/components/CalendlyEmbed";
import { Faq } from "@/components/ui/Faq";
import { siteConfig } from "@/lib/site-config";
import { faq } from "@/lib/content";
import { whatsappUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Contato",
  description:
    "Fale com a Empresarial Academy: e-mail, WhatsApp e formulário. Dê o próximo passo para evoluir sua gestão.",
  alternates: { canonical: "/contato" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Page() {
  return (
    <main>
      <PageHero
        title="Estamos prontos para ouvir você"
        subtitle="Entre em contato e dê o próximo passo para organizar e evoluir sua gestão com método e clareza."
        crumbs={[{ label: "Contato" }]}
        image="/images/banner-contato.jpg"
        imageAlt="Executivo ao telefone diante de janela panorâmica com vista da cidade, mesa com notebook em primeiro plano"
      />

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          {/* Canais */}
          <div>
            <SectionHeading
              title="Vamos conversar?"
              subtitle="Estamos aqui para ajudar a impulsionar o seu negócio."
            />
            <ul className="mt-8 space-y-4">
              <Canal
                titulo="E-mail"
                valor={siteConfig.contact.email}
                href={`mailto:${siteConfig.contact.email}`}
                icon="mail"
              />
              <Canal
                titulo="WhatsApp"
                valor={siteConfig.contact.phone}
                href={whatsappUrl()}
                icon="phone"
                external
              />
              <Canal
                titulo="Localização"
                valor={siteConfig.contact.address}
                icon="map-pin"
              />
            </ul>
          </div>

          {/* Formulário */}
          <div className="rounded-2xl border border-line bg-surface p-7 md:p-9">
            <h2 className="text-xl font-semibold text-navy">Envie sua mensagem</h2>
            <p className="mt-1 mb-6 text-sm text-gray">
              Preencha o formulário e nossa equipe entrará em contato.
            </p>
            <ContactForm />
          </div>
        </div>
      </section>

      {/* Agendamento direto (Calendly) */}
      <section className="bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeading
            title="Prefere agendar direto?"
            subtitle="Escolha um horário para uma conversa de diagnóstico estratégico, rápida, sem custo e sem compromisso."
            align="center"
          />
          <div className="mt-10">
            <CalendlyEmbed />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeading title="Perguntas frequentes" align="center" />
          <div className="mt-12">
            <Faq items={faq} />
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </main>
  );
}

function Canal({
  titulo,
  valor,
  href,
  icon,
  external,
}: {
  titulo: string;
  valor: string;
  href?: string;
  icon: string;
  external?: boolean;
}) {
  const content = (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-white p-5 transition-colors hover:border-gold">
      <Icon name={icon} className="h-7 w-7 shrink-0 text-gold-ink" />
      <div>
        <div className="text-xs uppercase tracking-wide text-gray">{titulo}</div>
        <div className="font-medium text-navy">{valor}</div>
      </div>
    </div>
  );

  if (!href) return <li>{content}</li>;

  return (
    <li>
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {content}
      </a>
    </li>
  );
}
