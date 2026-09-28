import Link from "next/link";
import Image from "next/image";
import {
  legalNav,
  mainNav,
  servicosMenu,
  siteConfig,
} from "@/lib/site-config";
import { NewsletterForm } from "@/components/forms/NewsletterForm";

const year = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="bg-navy text-white">
      <div className="border-b border-white/10 bg-navy-light/40">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 py-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="font-[var(--font-heading)] text-sm uppercase tracking-[0.2em] text-gold">
              Conhecimento que Impulsiona
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Receba nossos conteúdos por e-mail
            </h2>
            <p className="mt-3 max-w-md text-sm text-white/70">
              Novos artigos do blog, materiais gratuitos e dicas práticas de
              gestão direto na sua caixa de entrada — sem spam, cancele quando
              quiser.
            </p>
          </div>
          <NewsletterForm origem="Newsletter" />
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        {/* Marca */}
        <div>
          <Image
            src="/logo-footer.png"
            alt="Empresarial Academy"
            width={160}
            height={160}
            className="h-36 w-36"
          />
          <p className="mt-4 max-w-xs text-sm text-white/70">
            Consultoria empresarial com IA para PMEs. Método para crescer.
            Gestão para permanecer.
          </p>
          <p className="mt-4 font-[var(--font-heading)] text-sm text-gold">
            {siteConfig.slogan}
          </p>
          <div className="mt-5 flex gap-4">
            <SocialLink href={siteConfig.social.instagram} label="Instagram">
              <path d="M12 2c2.7 0 3 0 4.1.06 1 .05 1.6.2 2 .35.5.2.9.45 1.3.85.4.4.65.8.85 1.3.15.4.3 1 .35 2C20.99 8.7 21 9 21 12s0 3.3-.06 4.4c-.05 1-.2 1.6-.35 2-.2.5-.45.9-.85 1.3-.4.4-.8.65-1.3.85-.4.15-1 .3-2 .35C15.3 22 15 22 12 22s-3.3 0-4.4-.06c-1-.05-1.6-.2-2-.35a3.6 3.6 0 01-1.3-.85 3.6 3.6 0 01-.85-1.3c-.15-.4-.3-1-.35-2C3 15.3 3 15 3 12s0-3.3.06-4.4c.05-1 .2-1.6.35-2 .2-.5.45-.9.85-1.3.4-.4.8-.65 1.3-.85.4-.15 1-.3 2-.35C8.7 2 9 2 12 2zm0 5a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6zm5.3-3.1a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z" />
            </SocialLink>
            <SocialLink href={siteConfig.social.linkedin} label="LinkedIn">
              <path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 9h4v12H3V9zm6 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21H17.5v-5.5c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H9V9z" />
            </SocialLink>
            <SocialLink href={siteConfig.social.facebook} label="Facebook">
              <path d="M22 12a10 10 0 10-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.45 2.9h-2.35v7A10 10 0 0022 12z" />
            </SocialLink>
            <SocialLink href={siteConfig.social.youtube} label="YouTube">
              <path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 00-1.7-1.7C19.4 5.2 12 5.2 12 5.2s-7.4 0-8.9.4A2.5 2.5 0 001.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7c.2.9.9 1.5 1.7 1.7 1.5.4 8.9.4 8.9.4s7.4 0 8.9-.4a2.5 2.5 0 001.7-1.7c.4-1.5.4-4.7.4-4.7zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z" />
            </SocialLink>
            <SocialLink href={siteConfig.social.linktree} label="Linktree — todos os links">
              <path d="M11 2h2v6.2l4.4-4.4 1.4 1.4-4.4 4.4H22v2h-6.2l4.4 4.4-1.4 1.4-5.8-5.8V22h-2v-9.8l-5.8 5.8-1.4-1.4 4.4-4.4H2v-2h6.2L3.8 5.6l1.4-1.4L11 8.2V2z" />
            </SocialLink>
          </div>
        </div>

        {/* Navegação */}
        <FooterCol title="Navegação">
          {mainNav.map((i) => (
            <FooterLink key={i.href} href={i.href}>
              {i.label}
            </FooterLink>
          ))}
          <FooterLink href="/depoimentos">Depoimentos</FooterLink>
          <FooterLink href="/faq">FAQ</FooterLink>
          <FooterLink href="/mapa-do-site">Mapa do Site</FooterLink>
          <li>
            <a
              href="/diagnostico-maturidade-empresarial.html"
              className="text-sm font-semibold text-gold transition-colors hover:text-gold-light"
            >
              Diagnóstico gratuito →
            </a>
          </li>
        </FooterCol>

        {/* Serviços */}
        <FooterCol title="Serviços">
          {servicosMenu.map((s) => (
            <FooterLink key={s.href} href={s.href}>
              {s.title}
            </FooterLink>
          ))}
        </FooterCol>

        {/* Contato */}
        <FooterCol title="Contato">
          <li className="text-sm text-white/70">{siteConfig.contact.address}</li>
          <li>
            <a
              href={`tel:${siteConfig.contact.phoneRaw}`}
              className="text-sm text-white/70 transition-colors hover:text-gold"
            >
              {siteConfig.contact.phone}
            </a>
          </li>
          <li>
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="text-sm text-white/70 transition-colors hover:text-gold"
            >
              {siteConfig.contact.email}
            </a>
          </li>
        </FooterCol>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-5 text-center text-xs text-white/60 sm:flex-row">
          <p>
            © {year} {siteConfig.name} — CNPJ {siteConfig.cnpj}. Todos os
            direitos reservados.
          </p>
          <ul className="flex gap-4">
            {legalNav.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="transition-colors hover:text-gold">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-[var(--font-heading)] text-sm font-semibold uppercase tracking-wide text-gold">
        {title}
      </h3>
      <ul className="mt-4 space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-white/70 transition-colors hover:text-gold"
      >
        {children}
      </Link>
    </li>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:border-gold hover:text-gold"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        {children}
      </svg>
    </a>
  );
}
