import { NextResponse } from "next/server";
import { getPublishedPosts } from "@/lib/payload";
import { siteConfig } from "@/lib/site-config";

export const revalidate = 300;

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

export async function GET() {
  try {
    const { docs: posts } = await getPublishedPosts(100);
    const now = new Date().toUTCString();

    const itemsXml = posts
      .map((post) => {
        const postUrl = `${siteConfig.url}/blog/${post.slug}`;
        const pubDate = post.publishedAt
          ? new Date(post.publishedAt).toUTCString()
          : now;
        const cover =
          typeof post.coverImage === "object" && post.coverImage?.url
            ? post.coverImage.url.startsWith("http")
              ? post.coverImage.url
              : `${siteConfig.url}${post.coverImage.url}`
            : null;

        const enclosureTag = cover
          ? `\n      <enclosure url="${escapeXml(cover)}" type="image/jpeg" length="0" />`
          : "";

        return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${post.excerpt || post.title}]]></description>${enclosureTag}
    </item>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog | Empresarial Academy</title>
    <link>${siteConfig.url}/blog</link>
    <description>${escapeXml(siteConfig.description)}</description>
    <language>pt-BR</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${siteConfig.url}/api/feed/blog" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Erro ao gerar feed RSS do blog:", error);
    return new NextResponse("Erro ao gerar feed RSS", { status: 500 });
  }
}
