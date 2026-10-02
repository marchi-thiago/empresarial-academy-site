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
 * (o SiteChrome a trata como página enxuta): o foco é agendar. Pergunta de impacto, quem conversa com o lead, o que ele
 * leva do bate-papo, o vídeo de um cliente e o Calendly embutido, com nome e e-mail preenchidos e abrindo no dia
 * sugerido. Token ausente ou inválido: a mesma página, sem prefill. Sem duração prometida: é "bate-papo rápido e gratuito".
 */

export const metadata: Metadata = {
  title: "Bate-papo rápido e gratuito",
  description: "Escolha o melhor horário para um bate-papo rápido e gratuito com a Empresarial Academy.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const LEVA = [
  "Onde está o principal gargalo de gestão da sua empresa.",
  "O que priorizar primeiro, para o esforço render mais.",
  "Onde IA e automação dão retorno na rotina da empresa.",
];

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

  const provaId = resolverProva(lead?.dossie);
  const prova = depoimentosVideo[provaId];
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
        <p className="text-xs font-semibold uppercase tracking-wider text-gold-ink">Bate-papo rápido e gratuito</p>
        <h1 className="mt-2 font-heading text-2xl font-bold leading-snug text-navy md:text-3xl">
          {primeiroNome ? `${primeiroNome}, o` : "O"} que está travando a sua empresa hoje, e por onde começar?
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray">
          Neste bate-papo, o Thiago entende onde a sua empresa deve priorizar e como a IA pode trazer mais resultado. Ele também
          apresenta a Empresarial Academy e o diagnóstico da sua empresa.
        </p>
        <a
          href="#agendar"
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-gold px-6 py-3 font-heading text-base font-semibold tracking-wide text-navy transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Escolher meu horário
        </a>

        <section aria-labelledby="com-quem" className="mt-10">
          <h2 id="com-quem" className="font-heading text-xl font-semibold text-navy">
            Com quem você vai conversar
          </h2>
          <div className="mt-4 flex items-start gap-4 rounded-2xl border border-line bg-white p-4 sm:p-5">
            <Image
              src="/email/thiago.png"
              alt="Thiago Marchi"
              width={144}
              height={144}
              className="h-20 w-20 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0">
              <p className="font-heading text-base font-semibold text-navy">Thiago Marchi</p>
              <p className="text-sm text-gray">Fundador da Empresarial Academy</p>
              <p className="mt-2 text-sm leading-relaxed text-ink">
                7 anos como dono de PME e 19 anos em gestão e vendas, com passagens por Vivo, Atento e Sitallcom. MBA pela FGV e
                Lean Six Sigma Green Belt.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="leva" className="mt-10">
          <h2 id="leva" className="font-heading text-xl font-semibold text-navy">
            O que você leva do bate-papo
          </h2>
          <ul className="mt-4 space-y-3">
            {LEVA.map((item) => (
              <li key={item} className="flex gap-3 text-base leading-relaxed text-ink">
                <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <ConversaCliente
          token={lead ? token : null}
          tituloVideo={
            provaId === "fabio"
              ? "Um cliente conta como organizou a gestão sem depender só do dono"
              : "Um cliente conta como foi trabalhar com a Empresarial Academy"
          }
          video={prova.video}
          poster={prova.poster}
          legenda={`${prova.name}, ${prova.role}`}
          calendlyUrl={calendly}
          nome={lead?.nome ?? null}
          email={lead?.email ?? null}
        />

        <p className="mt-10 text-center text-sm leading-relaxed text-gray">
          Prefere fazer sozinho antes?{" "}
          <a href="/diagnostico-maturidade-empresarial.html" className="font-semibold text-navy underline">
            Faça o diagnóstico gratuito
          </a>
        </p>
        <p className="mt-4 text-center text-xs leading-relaxed text-gray">
          Empresarial Academy · CNPJ 52.281.916/0001-60 ·{" "}
          <a href="/privacidade" className="underline">
            Política de privacidade
          </a>
        </p>
      </main>
    </div>
  );
}
