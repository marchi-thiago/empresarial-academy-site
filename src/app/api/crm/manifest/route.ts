/**
 * Manifesto do atalho "Adicionar à Tela de Início" do iPhone/Android: abre a Fila do dia
 * do CRM em tela cheia. Público de propósito (o navegador busca sem cookie); a Fila em si
 * continua exigindo login.
 */
export const dynamic = "force-static";

export function GET() {
  const manifesto = {
    name: "EA Leads: Fila do dia",
    short_name: "Fila do dia",
    description: "CRM da Empresarial Academy: o que fazer hoje.",
    id: "/eahub/crm/fila",
    start_url: "/eahub/crm/fila",
    scope: "/eahub/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    background_color: "#1D2B3C",
    theme_color: "#1D2B3C",
    icons: [
      { src: "/crm/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/crm/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/crm/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifesto), { headers: { "content-type": "application/manifest+json; charset=utf-8" } });
}
