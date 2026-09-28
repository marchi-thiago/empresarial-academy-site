import type { SistemaVideo } from "@/lib/content";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";

/** Cartão de um sistema: vídeo (quando já publicado), o problema e o que muda. */
export function SistemaCard({ sistema }: { sistema: SistemaVideo }) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-line bg-white p-6">
      {sistema.youtubeId ? <YouTubeEmbed id={sistema.youtubeId} title={sistema.nome} /> : null}
      <h3 className="text-lg font-semibold text-navy">{sistema.nome}</h3>
      <dl className="space-y-3 text-sm leading-relaxed">
        <div>
          <dt className="font-semibold text-gold-ink">O problema</dt>
          <dd className="text-gray">{sistema.problema}</dd>
        </div>
        <div>
          <dt className="font-semibold text-gold-ink">O que muda</dt>
          <dd className="text-gray">{sistema.resultado}</dd>
        </div>
      </dl>
    </article>
  );
}

/** JSON-LD VideoObject dos sistemas que já têm vídeo publicado. */
export function sistemasVideoJsonLd(sistemas: SistemaVideo[]) {
  return sistemas
    .filter((s) => s.youtubeId && s.publicadoEm)
    .map((s) => ({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: `${s.nome}: ${s.resultado}`,
      description: `${s.problema} ${s.resultado}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${s.youtubeId}/hqdefault.jpg`,
      uploadDate: s.publicadoEm,
      embedUrl: `https://www.youtube-nocookie.com/embed/${s.youtubeId}`,
    }));
}
