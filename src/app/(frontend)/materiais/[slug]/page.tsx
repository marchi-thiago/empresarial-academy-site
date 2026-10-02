import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { draftMode } from "next/headers";
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";
import { EaRichText } from "@/components/EaRichText";
import { PageHero } from "@/components/layout/PageHero";
import { LikeDislike } from "@/components/blog/LikeDislike";
import { AgendarConversaCta } from "@/components/cta/AgendarConversaCta";
import { MaterialCard } from "@/components/materials/MaterialCard";
import { DownloadButton } from "@/components/materials/DownloadButton";
import {
  getMaterialBySlug,
  getPublishedMaterials,
} from "@/lib/payload";
import { kindLabel } from "@/lib/materials";
import { siteConfig } from "@/lib/site-config";

export const revalidate = 60;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { isEnabled: isDraft } = await draftMode();
  const material = await getMaterialBySlug(slug, { draft: isDraft });
  if (!material) return { title: "Material não encontrado" };
  const seo = material.seo ?? {};
  return {
    title: seo.metaTitle || material.title,
    description: seo.metaDescription || material.description || undefined,
    alternates: { canonical: `/materiais/${material.slug}` },
  };
}

export default async function MaterialPage({ params }: Params) {
  const { slug } = await params;
  const { isEnabled: isDraft } = await draftMode();
  const material = await getMaterialBySlug(slug, { draft: isDraft });
  if (!material) notFound();

  const cover = typeof material.coverImage === "object" ? material.coverImage : null;
  const category =
    typeof material.category === "object" && material.category
      ? material.category
      : null;

  // Relacionados (mesma categoria, exceto o atual).
  const { docs: all } = await getPublishedMaterials(60);
  const related = all
    .filter((m) => {
      if (m.id === material.id) return false;
      const aCat =
        typeof m.category === "object" && m.category ? m.category.id : m.category;
      return category ? aCat === category.id : false;
    })
    .slice(0, 3);

  return (
    <main>
      <PageHero
        title={material.title}
        subtitle={material.description ?? undefined}
        crumbs={[
          { label: "Materiais", href: "/materiais" },
          { label: material.title },
        ]}
      />

      <section className="mx-auto max-w-6xl px-6 py-16">
        <AgendarConversaCta className="mb-10" />

        {isDraft && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold-ink/40 bg-surface px-4 py-2 text-sm text-navy">
            <span>Pré-visualização (rascunho) — assim ficará no site ao publicar.</span>
            <a
              href={`/preview/exit?redirect=/materiais/${material.slug}`}
              className="font-semibold text-gold-ink hover:underline"
            >
              Sair da pré-visualização
            </a>
          </div>
        )}
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-navy">
            {cover?.url ? (
              <Image
                src={cover.url}
                alt={cover.alt ?? material.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-7xl" aria-hidden>
                📘
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-gold px-3 py-1 font-semibold text-navy">
                {kindLabel(material.kind)}
              </span>
              {category && <span className="text-gray">{category.name}</span>}
              {material.version && (
                <span className="text-gray">· {material.version}</span>
              )}
            </div>

            {material.description && (
              <p className="mt-5 text-gray">{material.description}</p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <DownloadButton slug={material.slug ?? ""} title={material.title} primary />
              <span className="text-sm text-gray">
                {material.downloads ?? 0} downloads
              </span>
            </div>

            {/* Compartilhar */}
            <div className="mt-8 flex items-center gap-3 text-sm text-gray">
              <span>Compartilhar:</span>
              <a
                className="hover:text-gold"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(`${material.title} — ${siteConfig.url}/materiais/${material.slug}`)}`}
              >
                WhatsApp
              </a>
              <a
                className="hover:text-gold"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${siteConfig.url}/materiais/${material.slug}`)}`}
              >
                LinkedIn
              </a>
            </div>
          </div>
        </div>

        {material.content ? (
          <div className="prose-ea mx-auto mt-14 max-w-3xl">
            <EaRichText data={material.content as unknown as SerializedEditorState} />
          </div>
        ) : null}

        {related.length > 0 && (
          <div className="mt-20">
            <h2 className="text-xl font-bold text-navy">Materiais relacionados</h2>
            <span aria-hidden className="mt-3 block h-px w-24 bg-gold" />
            <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((m) => (
                <li key={m.id}>
                  <MaterialCard material={m} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-16 border-t border-line pt-8 text-center">
          <p className="mb-3 text-sm text-gray">Esse material te ajudou?</p>
          <LikeDislike
            collection="materials"
            slug={material.slug ?? ""}
            initialLikes={material.likes ?? 0}
            initialDislikes={material.dislikes ?? 0}
          />
        </div>

        <div className="mt-8">
          <Link
            href="/materiais"
            className="text-sm font-semibold text-gold-ink hover:underline"
          >
            ← Voltar para a Central de Materiais
          </Link>
        </div>
      </section>
    </main>
  );
}
