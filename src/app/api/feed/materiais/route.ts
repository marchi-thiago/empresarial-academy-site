import { NextResponse } from "next/server";
import { getPublishedMaterials } from "@/lib/payload";
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
    const { docs: materials } = await getPublishedMaterials(100);
    const now = new Date().toUTCString();

    const itemsXml = materials
      .map((mat) => {
        const matUrl = `${siteConfig.url}/materiais/${mat.slug}`;
        const pubDate = mat.publishedAt
          ? new Date(mat.publishedAt).toUTCString()
          : now;
        const cover =
          typeof mat.coverImage === "object" && mat.coverImage?.url
            ? mat.coverImage.url.startsWith("http")
              ? mat.coverImage.url
              : `${siteConfig.url}${mat.coverImage.url}`
            : null;

        const enclosureTag = cover
          ? `\n      <enclosure url="${escapeXml(cover)}" type="image/jpeg" length="0" />`
          : "";

        return `    <item>
      <title><![CDATA[${mat.title}]]></title>
      <link>${matUrl}</link>
      <guid isPermaLink="true">${matUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${mat.description || mat.title}]]></description>${enclosureTag}
    </item>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Materiais Gratuitos | Empresarial Academy</title>
    <link>${siteConfig.url}/materiais</link>
    <description>E-books, planilhas, templates e checklists gratuitos para acelerar a gestão da sua empresa.</description>
    <language>pt-BR</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${siteConfig.url}/api/feed/materiais" rel="self" type="application/rss+xml" />
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
    console.error("Erro ao gerar feed RSS dos materiais:", error);
    return new NextResponse("Erro ao gerar feed RSS", { status: 500 });
  }
}

