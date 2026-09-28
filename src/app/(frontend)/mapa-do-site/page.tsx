import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/layout/PageHero";
import { servicosMenu } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Mapa do Site",
  description: "Todas as páginas da Empresarial Academy em um só lugar.",
  alternates: { canonical: "/mapa-do-site" },
};

const groups = [
  {
    title: "Institucional",
    links: [
      { label: "Início", href: "/" },
      { label: "Institucional", href: "/institucional" },
      { label: "Contato", href: "/contato" },
      { label: "Perguntas Frequentes", href: "/faq" },
      { label: "Depoimentos", href: "/depoimentos" },
    ],
  },
  {
    title: "Serviços",
    links: [
      { label: "Serviços", href: "/servicos" },
      ...servicosMenu.map((s) => ({ label: s.title, href: s.href })),
      { label: "Soluções com IA", href: "/solucoes-com-ia" },
    ],
  },
  {
    title: "Conteúdo",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Materiais Gratuitos", href: "/materiais" },
      {
        label: "Diagnóstico de Maturidade Empresarial",
        href: "/diagnostico-maturidade-empresarial.html",
      },
      { label: "Busca", href: "/busca" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Política de Privacidade", href: "/privacidade" },
      { label: "Termos de Uso", href: "/termos" },
    ],
  },
];

export default function MapaDoSite() {
  return (
    <main>
      <PageHero
        title="Mapa do site"
        subtitle="Encontre rapidamente qualquer página da Empresarial Academy."
        crumbs={[{ label: "Mapa do Site" }]}
      />
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((g) => (
            <div key={g.title}>
              <h2 className="font-[var(--font-heading)] text-sm font-semibold uppercase tracking-wide text-gold-ink">
                {g.title}
              </h2>
              <ul className="mt-4 space-y-2">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-navy transition-colors hover:text-gold"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
