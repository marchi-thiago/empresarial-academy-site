import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

// Crawlers de IA explicitamente permitidos (GEO/LLMO/AEO):
// queremos que ChatGPT, Claude, Gemini, Perplexity e Copilot entendam o site.
const aiBots = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "Bingbot",
  "CCBot",
  "cohere-ai",
  "Meta-ExternalAgent",
  "DuckDuckBot",
];

export default function robots(): MetadataRoute.Robots {
  const common = { allow: "/", disallow: ["/admin", "/api", "/conversa", "/r/", "/o/"] };
  return {
    rules: [
      { userAgent: "*", ...common },
      ...aiBots.map((userAgent) => ({ userAgent, ...common })),
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
