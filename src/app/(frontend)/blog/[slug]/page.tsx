import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { draftMode } from "next/headers";
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";
import { EaRichText } from "@/components/EaRichText";
import { PageHero } from "@/components/layout/PageHero";
import { LikeDislike } from "@/components/blog/LikeDislike";
import { AgendarConversaCta } from "@/components/cta/AgendarConversaCta";
import { getPostBySlug } from "@/lib/payload";
import { siteConfig } from "@/lib/site-config";
import { formatDatePtBR } from "@/lib/format";

export const revalidate = 60;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { isEnabled: isDraft } = await draftMode();
  const post = await getPostBySlug(slug, { draft: isDraft });
  if (!post) return { title: "Artigo não encontrado" };

  const seo = post.seo ?? {};
  const cover = typeof post.coverImage === "object" ? post.coverImage : null;

  return {
    title: seo.metaTitle || post.title,
    description: seo.metaDescription || post.excerpt || undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: seo.metaTitle || post.title,
      description: seo.metaDescription || post.excerpt || undefined,
      publishedTime: post.publishedAt ?? undefined,
      images: cover?.url ? [{ url: cover.url }] : undefined,
    },
  };
}

export default async function PostPage({ params }: Params) {
  const { slug } = await params;
  const { isEnabled: isDraft } = await draftMode();
  const post = await getPostBySlug(slug, { draft: isDraft });
  if (!post) notFound();

  const cover = typeof post.coverImage === "object" ? post.coverImage : null;
  const category =
    typeof post.category === "object" && post.category ? post.category : null;
  const author =
    typeof post.author === "object" && post.author ? post.author : null;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    datePublished: post.publishedAt ?? undefined,
    description: post.excerpt ?? undefined,
    image: cover?.url ? `${siteConfig.url}${cover.url}` : undefined,
    author: { "@type": "Person", name: author?.name || siteConfig.founder },
    publisher: { "@type": "Organization", name: siteConfig.name },
  };

  return (
    <main>
      <PageHero
        title={post.title}
        subtitle={post.excerpt ?? undefined}
        crumbs={[{ label: "Blog", href: "/blog" }, { label: post.title }]}
        image={cover?.url ?? "/images/banner-blog.jpg"}
        imageAlt={cover?.alt ?? post.title}
      />

      <article className="mx-auto max-w-3xl px-6 py-16">
        <AgendarConversaCta className="mb-10" />

        <div className="flex items-center gap-3 text-sm text-gray">
          {category && (
            <span className="rounded-full bg-surface px-3 py-1 font-medium text-navy">
              {category.name}
            </span>
          )}
          <time dateTime={post.publishedAt ?? undefined}>
            {formatDatePtBR(post.publishedAt)}
          </time>
          {author?.name && <span>· por {author.name}</span>}
        </div>

        {isDraft && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold-ink/40 bg-surface px-4 py-2 text-sm text-navy">
            <span>Pré-visualização (rascunho) — assim ficará no site ao publicar.</span>
            <a
              href={`/preview/exit?redirect=/blog/${post.slug}`}
              className="font-semibold text-gold-ink hover:underline"
            >
              Sair da pré-visualização
            </a>
          </div>
        )}

        <div className="prose-ea mt-10">
          {post.content && (
            <EaRichText data={post.content as unknown as SerializedEditorState} />
          )}
        </div>

        <div className="mt-12 border-t border-line pt-8 text-center">
          <p className="mb-3 text-sm text-gray">Esse conteúdo te ajudou?</p>
          <LikeDislike
            collection="posts"
            slug={post.slug ?? ""}
            initialLikes={post.likes ?? 0}
            initialDislikes={post.dislikes ?? 0}
          />
        </div>

        <div className="mt-8 border-t border-line pt-8">
          <Link
            href="/blog"
            className="text-sm font-semibold text-gold-ink hover:underline"
          >
            ← Voltar para o blog
          </Link>
        </div>
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
    </main>
  );
}
