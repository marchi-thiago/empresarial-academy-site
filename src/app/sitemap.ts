import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";
import { getPublishedPosts } from "@/lib/payload";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    "",
    "/institucional",
    "/servicos",
    "/servicos/curso-gestao-360",
    "/servicos/mentorias",
    "/servicos/palestras",
    "/servicos/consultoria",
    "/solucoes-com-ia",
    "/consultoria-pme",
    "/livro-gestao-360",
    "/diagnostico-maturidade-empresarial.html",
    "/materiais",
    "/blog",
    "/contato",
    "/depoimentos",
    "/faq",
    "/mapa-do-site",
    "/privacidade",
    "/termos",
  ];

  const now = new Date();
  const base: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: now,
    changeFrequency: route === "/blog" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));

  // Artigos do blog (dinâmico via CMS).
  try {
    const { docs: posts } = await getPublishedPosts(100);
    for (const post of posts) {
      base.push({
        url: `${siteConfig.url}/blog/${post.slug}`,
        lastModified: post.updatedAt ? new Date(post.updatedAt) : now,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch {
    // Em build sem banco disponível, mantém apenas as rotas estáticas.
  }

  return base;
}
