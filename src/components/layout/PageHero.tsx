import Image from "next/image";
import Link from "next/link";
import { HeroVideoPlayer } from "@/components/landing/HeroVideoPlayer";
import { siteConfig } from "@/lib/site-config";

type Crumb = { label: string; href?: string };

export function PageHero({
  title,
  subtitle,
  badge,
  crumbs = [],
  image,
  imageAlt = "",
  video,
}: {
  title: string;
  subtitle?: string;
  /** Selo curto acima do título (ex.: "Em produção — lançamento em breve"). */
  badge?: string;
  crumbs?: Crumb[];
  /**
   * Imagem ilustrativa exibida em card ao lado do título (modelo aprovado
   * pelo cliente): introduz visualmente o que a página oferece. Sem imagem
   * nem vídeo, o banner usa o layout tipográfico centrado.
   */
  image?: string;
  imageAlt?: string;
  /**
   * Vídeo exibido no lugar da imagem (autoplay mudo, em loop). Quando
   * definido, `image` é usado como poster. Ex.: banner de /servicos.
   */
  video?: string;
}) {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Início",
        item: siteConfig.url,
      },
      ...crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: c.label,
        ...(c.href ? { item: `${siteConfig.url}${c.href}` } : {}),
      })),
    ],
  };

  const breadcrumbNav = (
    <nav aria-label="Trilha de navegação" className="mb-5 text-xs text-white/60">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link href="/" className="hover:text-gold">
            Início
          </Link>
        </li>
        {crumbs.map((c) => (
          <li key={c.label} className="flex items-center gap-2">
            <span aria-hidden>/</span>
            {c.href ? (
              <Link href={c.href} className="hover:text-gold">
                {c.label}
              </Link>
            ) : (
              <span className="text-white/80">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );

  return (
    // Altura unificada com o carrossel da Home (min-h 360/400).
    <section className="relative isolate flex min-h-[400px] flex-col justify-center overflow-hidden bg-navy text-white md:min-h-[500px]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_70%_0%,#2e4358_0%,transparent_70%)]"
      />
      {image || video ? (
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-6 py-8 md:grid-cols-2 md:gap-12 md:py-10">
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/15">
            {video ? (
              <HeroVideoPlayer
                src={video}
                poster={image || ""}
                ariaLabel={imageAlt || title}
                autoPlay={true}
                loop={true}
                controls={true}
                comSom={true}
                className="absolute inset-0 h-full w-full bg-navy object-cover"
              />
            ) : (
              <Image
                src={image!}
                alt={imageAlt}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            )}
          </div>
          <div>
            {breadcrumbNav}
            {badge && (
              <span className="mb-3 inline-block rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold">
                {badge}
              </span>
            )}
            <h1 className="text-3xl font-bold leading-tight md:text-4xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-4 max-w-2xl text-white/80">{subtitle}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-6xl px-6 py-10 md:py-12">
          {breadcrumbNav}
          {badge && (
            <span className="mb-3 inline-block rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold">
              {badge}
            </span>
          )}
          <h1 className="max-w-3xl text-3xl font-bold leading-tight md:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 max-w-2xl text-white/80">{subtitle}</p>
          )}
        </div>
      )}
    </section>
  );
}
