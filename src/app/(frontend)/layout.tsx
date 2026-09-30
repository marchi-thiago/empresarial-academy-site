import type { Metadata, Viewport } from "next";
import { Montserrat, Open_Sans, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/lib/site-config";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { Analytics } from "@/components/Analytics";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  display: "swap",
});

// Fonte de display (serifada) usada no banner animado de /materiais ("E-books 360").
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `Consultoria Empresarial com IA | ${siteConfig.name}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.founder }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: siteConfig.name,
    title: `Consultoria Empresarial com IA | ${siteConfig.name}`,
    description: siteConfig.description,
    url: siteConfig.url,
  },
  twitter: {
    card: "summary_large_image",
    title: `Consultoria Empresarial com IA | ${siteConfig.name}`,
    description: siteConfig.description,
  },
  keywords: [
    "consultoria empresarial",
    "consultoria empresarial com IA",
    "consultoria de gestão empresarial",
    "automação com IA para empresas",
    "inteligência artificial para pequenas empresas",
    "mentoria de negócios",
    "gestão empresarial",
    "Gestão 360",
    "Empresarial Academy",
    "Thiago Marchi",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1D2B3C",
  colorScheme: "light",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.name,
  slogan: siteConfig.slogan,
  description: siteConfig.description,
  knowsAbout: [
    "Consultoria empresarial",
    "Gestão de pequenas e médias empresas",
    "Inteligência artificial aplicada a negócios",
    "Automação de processos",
    "Indicadores de desempenho (KPIs)",
    "Gestão 360",
  ],
  url: siteConfig.url,
  logo: `${siteConfig.url}/logo-empresarial-academy.png`,
  email: siteConfig.contact.email,
  telephone: siteConfig.contact.phone,
  founder: { "@type": "Person", name: siteConfig.founder },
  address: {
    "@type": "PostalAddress",
    addressLocality: "São Paulo",
    addressRegion: "SP",
    addressCountry: "BR",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: siteConfig.contact.phone,
    email: siteConfig.contact.email,
    contactType: "customer service",
    areaServed: "BR",
    availableLanguage: "Portuguese",
  },
  sameAs: [
    siteConfig.social.instagram,
    siteConfig.social.linkedin,
    siteConfig.social.facebook,
    siteConfig.social.youtube,
    siteConfig.social.linktree,
    siteConfig.social.tiktok,
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.name,
  url: siteConfig.url,
  inLanguage: "pt-BR",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteConfig.url}/busca?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${montserrat.variable} ${openSans.variable} ${cormorant.variable}`}
      // O script abaixo grava data-theme no <html> antes da hidratação;
      // sem isto o React acusa divergência entre servidor e cliente.
      suppressHydrationWarning
    >
      <head>
        {/* Aplica o tema ANTES da primeira pintura — evita o flash branco
            ao abrir o site no modo escuro. Precisa ser síncrono e inline. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('ea-theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-navy focus:px-4 focus:py-2 focus:text-white"
        >
          Pular para o conteúdo
        </a>
        <SiteChrome>{children}</SiteChrome>
        <Analytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </body>
    </html>
  );
}
