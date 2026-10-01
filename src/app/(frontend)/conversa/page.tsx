import type { Metadata } from "next";
import Image from "next/image";
import { ConversaCliente } from "@/components/conversa/ConversaCliente";
import { depoimentosVideo } from "@/lib/content";
import { getPayloadClient } from "@/lib/payload";
import { resolverProva, urlDoCalendly } from "@/lib/outbound/conversa";
import { carregarConversa, tokenValido, type DadosDaConversa } from "@/lib/outbound/conversa-servidor";
import { regraFixa } from "@/lib/outbound/dia-sugerido";

/**
 * Página de destino de todo link do outbound: /conversa?t=<tokenConversa>. Sem menu e sem rodapé de navegação
 * (o SiteChrome a trata como página enxuta). Vídeo de prova do segmento no topo e o Calendly embutido, com nome
 * e e-mail preenchidos e abrindo no dia sugerido. Token ausente ou inválido: a mesma página, sem prefill.
 */

export const metadata: Metadata = {
  title: "Conversa de 20 minutos",
  description: "Escolha o melhor horário para uma conversa de 20 minutos com a Empresarial Academy.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string | string[] }> }) {
  const { t } = await searchParams;
  const token = typeof t === "string" && tokenValido(t) ? t : null;

  let lead: DadosDaConversa | null = null;
  if (token) {
    try {
      lead = await carregarConversa(await getPayloadClient(), token);
    } catch {
      lead = null; // sem banco, a página segue genérica
    }
  }

  const prova = depoimentosVideo[resolverProva(lead?.dossie)];
  const dia = lead?.dia ?? { dia: regraFixa(new Date()).dia, hora: "15:00" };
  const calendly = urlDoCalendly({ nome: lead?.nome, email: lead?.email, dia: dia.dia });
  const primeiroNome = lead?.nome?.trim().split(/\s+/)[0];

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-gold/30 bg-navy text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Image src="/logo-empresarial-academy.png" alt="" width={64} height={61} className="h-11 w-auto" priority />
          <p className="text-sm leading-tight">
            <span className="block font-heading font-semibold">Empresarial Academy</span>
            <span className="block text-white/80">Consultoria empresarial com IA</span>
          </p>
        </div>
      </header>

      <main id="conteudo-conversa" className="mx-auto max-w-3xl px-4 pb-12 pt-8">
        <h1 className="font-heading text-2xl font-bold leading-snug text-navy md:text-3xl">
          {primeiroNome ? `${primeiroNome}, vamos conversar por 20 minutos?` : "Vamos conversar por 20 minutos?"}
        </h1>
        <p className="mb-8 mt-3 text-base leading-relaxed text-gray">
          Antes de escolher o horário, veja o relato de quem já passou pelo método. {prova.name}, {prova.role.toLowerCase()}, conta como foi.
        </p>

        <ConversaCliente
          token={lead ? token : null}
          video={prova.video}
          poster={prova.poster}
          legenda={`${prova.name}, ${prova.role}`}
          calendlyUrl={calendly}
          nome={lead?.nome ?? null}
          email={lead?.email ?? null}
        />

        <p className="mt-10 text-center text-xs leading-relaxed text-gray">
          Empresarial Academy · CNPJ 52.281.916/0001-60 ·{" "}
          <a href="/privacidade" className="underline">
            Política de privacidade
          </a>
        </p>
      </main>
    </div>
  );
}
