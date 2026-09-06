import { getPublishedPosts } from "@/lib/payload";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const { docs: posts } = await getPublishedPosts(50);
  const base = siteConfig.url;

  const items = posts
    .map((post) => {
      const url = `${base}/blog/${post.slug}`;
      const date = post.publishedAt
        ? new Date(post.publishedAt).toUTCString()
        : "";
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      ${post.excerpt ? `<description>${escapeXml(post.excerpt)}</description>` : ""}
      ${date ? `<pubDate>${date}</pubDate>` : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(siteConfig.name)} — Blog</title>
    <link>${base}/blog</link>
    <description>${escapeXml(siteConfig.description)}</description>
    <language>pt-BR</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
