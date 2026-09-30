import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { HeroCarousel } from "@/components/HeroCarousel";
import { PostCard } from "@/components/blog/PostCard";
import { MaterialCard } from "@/components/materials/MaterialCard";
import { getPublishedMaterials, getPublishedPosts } from "@/lib/payload";
import { getLatestVideos } from "@/lib/youtube";
import { InstagramFeed } from "@/components/InstagramFeed";
import { GoogleReviewsHome } from "@/components/GoogleReviewsHome";
import { VideoTestimonial } from "@/components/VideoTestimonial";
import { depoimentosVideo, sistemasVideo, type SistemaVideo } from "@/lib/content";
import { SistemaCard } from "@/components/SistemaCard";
import { servicosMenu, siteConfig } from "@/lib/site-config";

const numeros = [
  {
    valor: "19",
    label: "anos de experiência",
    desc: "Operação comercial em grandes empresas e 7 anos como dono de PME: gestão vivida na prática.",
    icon: "briefcase",
  },
  {
    valor: "6",
    label: "pilares no método Gestão 360",
    desc: "Vendas, marketing, liderança, processos, finanças e cultura — integrados em um só método.",
    icon: "compass",
  },
  {
    valor: "PMEs",
    label: "nosso foco",
    desc: "Soluções desenhadas para a realidade das pequenas e médias empresas brasileiras.",
    icon: "trending-up",
  },
  {
    valor: "IA",
    label: "sistemas sob medida",
    desc: "Sistemas e automações com IA em produção, construídos dentro da consultoria para ganhar tempo e cortar custo.",
    icon: "bulb",
  },
];

/** Sistemas em destaque na home; a lista completa fica em /solucoes-com-ia. */
const sistemasDestaque = ["ea-flow", "ea-post", "contratos"]
  .map((slug) => sistemasVideo.find((s) => s.slug === slug))
  .filter((s): s is SistemaVideo => Boolean(s));

const servicos = servicosMenu.slice(0, 4);

export const revalidate = 60;

export default async function Home() {
  const [{ docs: latestPosts }, { docs: materiais }, videos] = await Promise.all([
    // Busca um lote maior para poder escolher 1 artigo por categoria (Gestão/
    // Vendas/Liderança), em vez dos 3 mais recentes — que podem cair todos na
    // mesma categoria quando várias publicações saem juntas.
    getPublishedPosts(12),
    getPublishedMaterials(3),
    getLatestVideos(3),
  ]);
  const seenCategories = new Set<string>();
  const posts = latestPosts.filter((post) => {
    const categoryName =
      typeof post.category === "object" && post.category ? post.category.name : null;
    if (!categoryName || seenCategories.has(categoryName)) return false;
    seenCategories.add(categoryName);
    return true;
  });

  return (
    <main>
      {/* HERO — Carrossel de 5 banners */}
      <HeroCarousel />

      {/* Números / credenciais */}
      <section className="bg-navy-light text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          {/* gold-light (não gold): sobre o navy-light desta faixa, o dourado
              padrão fica em 4,14:1 — abaixo do mínimo de 4,5:1 para texto. */}
          <p className="text-center font-[var(--font-heading)] text-sm uppercase tracking-[0.25em] text-gold-light">
            Por que a Empresarial Academy
          </p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {numeros.map((n) => (
              <li
                key={n.label}
                className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold/60 hover:bg-white/10 hover:shadow-xl"
              >
                <Icon
                  name={n.icon}
                  className="h-8 w-8 text-gold transition-transform duration-300 group-hover:scale-110"
                />
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-[var(--font-heading)] text-4xl font-bold text-gold">
                    {n.valor}
                  </span>
                  <span className="text-sm font-semibold text-white/90">
                    {n.label}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  {n.desc}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* PRODUTOS EM DESTAQUE */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-2">
          <ProductCard
            image="/images/curso-gestao-360.jpg"
            tag="Em breve"
            title="Curso Gestão 360"
            text="A máquina de resultados: metodologia prática para organizar processos, multiplicar lucros e liderar com clareza."
            href="/servicos/curso-gestao-360"
          />
          <ProductCard
            image="/images/livro-gestao-360.jpg"
            tag="Em breve"
            title="Livro Gestão 360"
            text="Conhecimento em prática e planejamento em resultado, pensado para a realidade das PMEs."
            href="/livro-gestao-360"
          />
        </div>
      </section>

      {/* SOBRE / FUNDADOR */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-2">
          <Image
            src="/images/thiago-marchi.jpg"
            alt="Thiago Marchi, fundador da Empresarial Academy"
            width={560}
            height={373}
            className="rounded-2xl shadow-lg"
          />
          <div>
            <h2 className="text-2xl font-bold text-navy md:text-3xl">
              Sobre a Empresarial Academy
            </h2>
            <span aria-hidden className="mt-4 block h-px w-24 bg-gold" />
            <p className="mt-6 text-gray">
              Somos uma consultoria empresarial com IA.
              Fundada por{" "}
              <strong className="text-navy">Thiago Marchi</strong>, sócio-proprietário
              de uma PME por 7 anos e com 19 anos estruturando operações
              comerciais em empresas como Telefônica VIVO e Grupo Allcom, a
              Empresarial Academy une método, estratégia e sistemas sob medida
              para gerar mais lucro e controle.
            </p>
            <p className="mt-4 text-gray">
              Nossa missão é impulsionar o crescimento sustentável de pequenas e
              médias empresas, com gestão inteligente e decisões orientadas a
              resultado.
            </p>
            <div className="mt-8">
              <Button href="/institucional" variant="secondary" size="md">
                Conheça nossa história
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* SERVIÇOS */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold text-navy md:text-3xl">
            Soluções completas para o seu crescimento
          </h2>
          <span aria-hidden className="mx-auto mt-4 block h-px w-24 bg-gold" />
          <p className="mx-auto mt-4 max-w-2xl text-gray">
            Foco em melhorar processos, aumentar lucros e fortalecer a liderança.
          </p>
        </div>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {servicos.map((s) => (
            <li
              key={s.href}
              className="group rounded-xl border border-line bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-gold/50 hover:shadow-lg"
            >
              <Icon name={s.icon} className="h-10 w-10 text-gold-ink" />
              <h3 className="mt-4 text-lg font-semibold text-navy">{s.title}</h3>
              <p className="mt-2 text-sm text-gray">{s.desc}</p>
              <Link
                href={s.href}
                className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-gold-ink hover:underline"
              >
                Saiba mais →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* SOLUÇÕES COM IA — sistemas em destaque */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeading
            title="Soluções com IA: o método rodando no dia a dia"
            subtitle="Dentro da consultoria, construímos sistemas e automações sob medida. Estes são alguns que rodam a Empresarial Academy hoje."
            align="center"
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {sistemasDestaque.map((s) => (
              <SistemaCard key={s.slug} sistema={s} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button href="/solucoes-com-ia" variant="secondary" size="md">
              Ver todas as soluções com IA
            </Button>
          </div>
        </div>
      </section>

      {/* O IMPACTO DO NOSSO MÉTODO — prova social em vídeo */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeading title="O impacto do nosso método" align="center" />
          <div className="mx-auto mt-10 grid max-w-4xl items-center gap-8 md:grid-cols-[320px_1fr]">
            <div className="mx-auto w-full max-w-sm md:mx-0">
              <VideoTestimonial
                video={depoimentosVideo.fabio.video}
                poster={depoimentosVideo.fabio.poster}
                name={depoimentosVideo.fabio.name}
                role={depoimentosVideo.fabio.role}
                caption={false}
              />
            </div>
            <div className="text-center md:text-left">
              <p className="text-sm font-semibold text-gold-ink">
                {depoimentosVideo.fabio.name} · {depoimentosVideo.fabio.role}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-navy">
                {depoimentosVideo.fabio.chamada}
              </h3>
              <p className="mt-3 text-sm text-gray">{depoimentosVideo.fabio.texto}</p>
            </div>
          </div>
        </div>
      </section>

      {/* MATERIAIS EM DESTAQUE — "Conhecimento que Impulsiona" */}
      {materiais.length > 0 && (
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <SectionHeading
              title="Conhecimento que Impulsiona"
              subtitle="Comece agora com materiais gratuitos que geram resultado imediato no seu negócio."
            />
            <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {materiais.map((m) => (
                <li key={m.id}>
                  <MaterialCard material={m} />
                </li>
              ))}
            </ul>
            <div className="mt-10">
              <Button href="/materiais" variant="secondary" size="md">
                Ver todos os materiais
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ÚLTIMOS DO BLOG — "Empresarial Academy na Mídia" */}
      {posts.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeading
            title="Direto do nosso blog"
            subtitle="Dicas, estratégias e insights para impulsionar a sua empresa todos os dias."
          />
          <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <Button href="/blog" variant="secondary" size="md">
              Ver todos os artigos
            </Button>
          </div>
        </section>
      )}

      {/* ÚLTIMOS VÍDEOS DO YOUTUBE */}
      {videos.length > 0 && (
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <SectionHeading
              title="Empresarial Academy no YouTube"
              subtitle="Conteúdo em vídeo para impulsionar a sua gestão."
              align="center"
            />
            {/* Centralizado e com largura dos cards limitada: com poucos vídeos
                no canal, uma grade de 3 colunas deixava um vão vazio à direita. */}
            <ul className="mx-auto mt-12 flex max-w-5xl flex-wrap justify-center gap-8 [&>li]:w-full [&>li]:max-w-sm">
              {videos.map((v) => (
                <li key={v.id}>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-shadow hover:shadow-lg"
                  >
                    <div className="relative aspect-video overflow-hidden bg-navy">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={v.thumbnail}
                        alt={v.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-5">
                      <h3 className="text-base font-semibold text-navy group-hover:text-gold-ink">
                        {v.title}
                      </h3>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex justify-center">
              <Button href={siteConfig.social.youtube} variant="secondary" size="md">
                Ver todos os vídeos
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* PROVA SOCIAL — avaliações do Google, seção própria com fundo navy
          (separada do YouTube a pedido do Thiago: YouTube fundo branco,
          avaliações fundo azul). O componente só renderiza se houver
          avaliações reais configuradas. */}
      <GoogleReviewsHome />

      {/* INSTAGRAM */}
      <InstagramFeed />

      {/* CTA FINAL */}
      <section className="bg-navy-light text-white">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">
            Faça uma avaliação gratuita
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">
            Descubra como podemos impulsionar os resultados do seu negócio.
            Conversa sem compromisso.
          </p>
          <div className="mt-6">
            <Button href="/diagnostico-maturidade-empresarial.html" external variant="primary" size="lg">
              Fazer diagnóstico gratuito
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function ProductCard({
  image,
  tag,
  title,
  text,
  href,
}: {
  image: string;
  tag: string;
  title: string;
  text: string;
  href: string;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-gold/50 hover:shadow-xl">
      <div className="relative aspect-[16/9] overflow-hidden">
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute left-4 top-4 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-navy">
          {tag}
        </span>
      </div>
      <div className="p-7">
        <h2 className="text-xl font-semibold text-navy">{title}</h2>
        <p className="mt-2 text-sm text-gray">{text}</p>
        <Link
          href={href}
          className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-gold-ink hover:underline"
        >
          Saiba mais →
        </Link>
      </div>
    </article>
  );
}
