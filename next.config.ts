import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // Mídia (capas, imagens do editor, etc.) fica no Cloudflare R2
    // (S3-compatível) — sem isso o next/image recusa carregar qualquer
    // imagem de lá (URLs vêm como `${endpoint}/${bucket}/${arquivo}`,
    // path-style — ver @payloadcms/storage-s3/generateURL.js).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "5ce1f9a7546634eeba9b1cc823111fe5.r2.cloudflarestorage.com",
        pathname: "/empresarial-academy-media/**",
      },
      // Payload monta a URL de mídia como ABSOLUTA (`${siteConfig.url}/api/
      // media/file/...`) — o next/image trata QUALQUER URL absoluta como
      // "externa" e exige remotePatterns, mesmo sendo o próprio domínio do
      // site. Sem isso, next/image rejeita com INVALID_IMAGE_OPTIMIZE_REQUEST.
      {
        protocol: "https",
        hostname: "empresarialacademy.com",
        pathname: "/api/media/file/**",
      },
    ],
  },
  async redirects() {
    return [
      // URLs do site antigo (construtor da Hostinger, tudo sob /pages/) ainda indexadas no Google.
      { source: "/pages/sobre", destination: "/institucional", permanent: true },
      { source: "/pages/contato", destination: "/contato", permanent: true },
      { source: "/pages/blog", destination: "/blog", permanent: true },
      { source: "/pages/servicos", destination: "/servicos", permanent: true },
      { source: "/pages/:path*", destination: "/", permanent: true },
      // O admin foi renomeado para "EA HUB" e movido de /admin para /eahub.
      // Mantém favoritos/links antigos funcionando.
      { source: "/admin", destination: "/eahub", permanent: false },
      { source: "/admin/:path*", destination: "/eahub/:path*", permanent: false },
      // Redirecionamento amigável para o Feed RSS do blog
      { source: "/feed", destination: "/feed.xml", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        // Headers de segurança apenas no site público (o /eahub do Payload tem o seu próprio tratamento).
        source: "/((?!eahub|admin|api).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withPayload(nextConfig);
