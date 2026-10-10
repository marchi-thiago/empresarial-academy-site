import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PageHero } from "@/components/layout/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "EA Post — Gerenciador e Publicador de Mídias Sociais com IA",
  description:
    "EA Post: Planejamento, criação e publicação automatizada de vídeos e conteúdos para TikTok, Instagram, YouTube e LinkedIn em um só lugar.",
  alternates: { canonical: "/ea-post" },
};

export default function Page() {
  const whatsapp = `https://wa.me/${siteConfig.contact.phoneRaw}?text=${encodeURIComponent(
    "Olá! Gostaria de saber mais sobre o EA Post e a automação de mídias sociais.",
  )}`;

  return (
    <main>
      <PageHero
        title="EA Post"
        subtitle="Gerenciador e publicador oficial de conteúdos e mídias sociais da Empresarial Academy com IA."
        crumbs={[
          { label: "Soluções com IA", href: "/solucoes-com-ia" },
          { label: "EA Post" },
        ]}
      />

      {/* Hero / Apresentação do Produto */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-block rounded-full bg-gold/15 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-gold-dark">
              Plataforma Oficial Empresarial Academy
            </span>
            <h1 className="mt-4 text-3xl font-bold text-navy sm:text-4xl">
              Presença multicanal ativa com automação inteligente
            </h1>
            <p className="mt-4 text-base leading-relaxed text-gray">
              O <strong>EA Post</strong> é a aplicação desenvolvida para gerenciar, aprovar e publicar
              conteúdos nas principais redes sociais — incluindo <strong>TikTok</strong>, <strong>Instagram</strong>,
              <strong> YouTube Shorts</strong>, <strong>Facebook</strong> e <strong>LinkedIn</strong>.
            </p>
            <p className="mt-3 text-base leading-relaxed text-gray">
              Projetado para eliminar a sobrecarga operacional dos negócios, o EA Post integra inteligência
              artificial para redação de copies, diagramação visual e envio direto de publicações via APIs oficiais,
              mantendo a governança e o controle de aprovação nas mãos do gestor.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button href="https://ea-social-engine.vercel.app/admin" external variant="primary" size="lg">
                Acessar o EA Post
              </Button>
              <Button href={whatsapp} external variant="outline" size="lg">
                Falar com Especialista
              </Button>
              <Button href="/solucoes-com-ia" variant="outline" size="lg">
                Ver Outras Soluções
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-light/60 bg-white shadow-xl">
            <div className="border-b border-gray-light/40 bg-navy px-4 py-3 text-xs font-medium text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                EA Post · Central de Publicação
              </span>
              <span className="text-white/60">TikTok API Integrated</span>
            </div>
            <div className="p-6">
              <YouTubeEmbed id="FEACKl-BQWc" title="Demonstração do EA Post" />
              <p className="mt-3 text-center text-xs text-gray">
                Demonstração em vídeo do EA Post: geração de peças e fluxo de publicação.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Integração com o TikTok */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            title="Integração Oficial com o TikTok"
            subtitle="Como o EA Post utiliza a TikTok Content Posting API e o Login Kit para potencializar seus vídeos."
            align="center"
          />

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-gray-light/60 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-navy text-xl text-gold font-bold">
                01
              </div>
              <h3 className="mt-4 text-lg font-bold text-navy">Autenticação Segura (Login Kit)</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray">
                Conecte com segurança seu perfil oficial do TikTok utilizando os protocolos OAuth 2.0 padrão da plataforma, sem expor senhas.
              </p>
            </div>

            <div className="rounded-xl border border-gray-light/60 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-navy text-xl text-gold font-bold">
                02
              </div>
              <h3 className="mt-4 text-lg font-bold text-navy">Publicação Direta de Vídeo</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray">
                Envio automático e agendamento de vídeos verticais (9:16) diretamente para a sua conta comercial do TikTok via API oficial.
              </p>
            </div>

            <div className="rounded-xl border border-gray-light/60 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-navy text-xl text-gold font-bold">
                03
              </div>
              <h3 className="mt-4 text-lg font-bold text-navy">Central de Aprovação</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray">
                Revise legendas, títulos e mídias antes de qualquer disparo. Nada é publicado sem a validação expressa do responsável.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recursos e Benefícios */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          title="Recursos do EA Post"
          subtitle="Desenvolvido para máxima consistência nas redes sem perder tempo operacional."
        />
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-l-2 border-gold pl-4">
            <h4 className="font-bold text-navy">Multi-rede Nativo</h4>
            <p className="mt-1 text-sm text-gray">
              Uma única gravação desdobrada para TikTok, Reels, YouTube Shorts, LinkedIn e Facebook.
            </p>
          </div>
          <div className="border-l-2 border-gold pl-4">
            <h4 className="font-bold text-navy">Copies e Roteiros</h4>
            <p className="mt-1 text-sm text-gray">
              Legendas adaptadas ao tom de cada canal com auxílio de modelos de linguagem de ponta.
            </p>
          </div>
          <div className="border-l-2 border-gold pl-4">
            <h4 className="font-bold text-navy">Auditoria e Métricas</h4>
            <p className="mt-1 text-sm text-gray">
              Acompanhamento detalhado do histórico de publicação e confirmação de entrega por rede.
            </p>
          </div>
          <div className="border-l-2 border-gold pl-4">
            <h4 className="font-bold text-navy">Privacidade e LGPD</h4>
            <p className="mt-1 text-sm text-gray">
              Total conformidade com leis de dados e diretrizes de desenvolvedor do TikTok e da Meta.
            </p>
          </div>
        </div>
      </section>

      {/* Seção Legal / Transparência */}
      <section className="bg-navy text-white py-14">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h3 className="text-xl font-bold">Transparência e Conformidade</h3>
          <p className="mt-3 text-sm text-white/80">
            O EA Post é um produto operado pela <strong>{siteConfig.name}</strong> (CNPJ {siteConfig.cnpj}).
            Para informações sobre o uso de dados, consulte nossa documentação legal:
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm font-semibold">
            <Link href="/privacidade" className="text-gold hover:text-gold-light underline">
              Política de Privacidade do EA Post
            </Link>
            <span className="text-white/40">·</span>
            <Link href="/termos" className="text-gold hover:text-gold-light underline">
              Termos de Uso do EA Post
            </Link>
            <span className="text-white/40">·</span>
            <Link href="/exclusao-de-dados" className="text-gold hover:text-gold-light underline">
              Instruções para Exclusão de Dados
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
