import Image from "next/image";
import { ConversionCTA } from "@/components/ConversionCTA";
import { VideoTestimonial } from "@/components/VideoTestimonial";
import { Icon } from "@/components/ui/Icon";
import { Faq } from "@/components/ui/Faq";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { depoimentosVideo, fundador } from "@/lib/content";
import { siteConfig } from "@/lib/site-config";

/**
 * Template compartilhado das landing pages de consultoria — extraído em
 * 05/08/2026 para permitir LPs dedicadas por palavra-chave do Google Ads
 * (correspondência exata entre a busca e o H1/título) sem duplicar as
 * ~550 linhas de prova social, método e FAQ, que já convertem e não
 * precisam variar por palavra-chave.
 *
 * Só o topo (eyebrow/H1/subtítulo) e a origem da newsletter mudam por
 * página — ver `Projeto IA/.../Plano de Posicionamento e Esteira`, seção
 * "Mídia paga", item "4 · página".
 */

/** Destino do anúncio do Google Ads. Ver `Projeto IA/Frente C - Landing Page`. */
const DIAGNOSTICO_URL = "/diagnostico-maturidade-empresarial.html";

/** Monta o link do WhatsApp com a mensagem pré-preenchida já marcada com o
 * código curto da LP de origem (ex: "[LP1]") — permite identificar, na
 * própria conversa, de qual página/anúncio o lead veio, sem depender de
 * UTM (que se perde ao abrir o WhatsApp). */
function whatsappHref(mensagem: string, origemTag: string) {
  const texto = `${mensagem} ${origemTag}`;
  return `https://wa.me/${siteConfig.contact.phoneRaw}?text=${encodeURIComponent(texto)}`;
}

const paraQuem = [
  "Sua empresa fatura entre R$ 500 mil e R$ 5 milhões por ano e cresceu mais rápido que a organização interna.",
  "A operação trava quando você não está — tudo passa por você.",
  "Você decide no feeling, sem indicadores claros para acompanhar o negócio.",
  "As vendas oscilam demais, sem um processo comercial que se sustente.",
  "Falta tempo para pensar a estratégia porque o dia a dia consome tudo.",
  "Você já pensou em contratar um braço direito ou estruturar uma diretoria, mas não sabe por onde começar.",
];

/** As mesmas 6 áreas/ícones de `content.ts` (`pilares`), só que com sintoma
 * (framing de dor) em vez de descrição — mantém os nomes idênticos ao resto
 * do site (diagnóstico, home, llms.txt) de propósito. */
const pilares = [
  {
    icon: "target",
    area: "Fluxo de Alta Performance",
    sintoma:
      "O dia a dia é apagar incêndio — sem processo no papel, tudo depende de quem está por perto.",
  },
  {
    icon: "building",
    area: "Arquitetura do Crescimento",
    sintoma:
      "Ninguém sabe exatamente quem decide o quê — a estrutura cresceu no impulso, não com propósito.",
  },
  {
    icon: "compass",
    area: "Objetivos Estratégicos",
    sintoma:
      "A visão existe só na cabeça do dono — o time trabalha duro, mas em direções diferentes.",
  },
  {
    icon: "trending-up",
    area: "Métricas de Sucesso",
    sintoma:
      "Faturamento sobe e o dono não sabe dizer se a empresa está saudável de verdade.",
  },
  {
    icon: "tools",
    area: "Gestão de Desafios",
    sintoma:
      "Todo imprevisto vira crise — sem plano, sem reserva, sem saber quem decide.",
  },
  {
    icon: "rocket",
    area: "Evolução Constante",
    sintoma:
      "A empresa só mantém o que já funciona — sem tempo ou hábito de repensar o próprio negócio.",
  },
];

const implicacoes = [
  "Você não tira uma semana de férias sem a empresa sentir.",
  "Decisões urgentes ficam represadas esperando sua disponibilidade.",
  "Fica difícil contratar gente sênior — ninguém entra num time sem processo.",
  "Se um dia quiser vender a empresa ou sair da operação, o valor dela está preso no seu tempo, não no negócio.",
];

/** Depoimentos em vídeo (Frente B), distribuídos em pontos diferentes da
 * página. Conteúdo compartilhado em `lib/content.ts` (`depoimentosVideo`) —
 * as mesmas legendas são reaproveitadas nas seções "O impacto do nosso
 * método" da Home, Institucional e Serviços. */
const depoimentoFabio = depoimentosVideo.fabio;
const depoimentoDaniella = depoimentosVideo.daniella;
const depoimentoErik = depoimentosVideo.erik;

/** Faixa de credenciais abaixo da bio do fundador (trajetória + formação).
 * Badges tipográficos, não logos rasterizados — o projeto não tem os
 * arquivos oficiais de marca de terceiros ainda; ver PROJECT_STATUS.md
 * sobre a pendência de logos reais (VIVO/Atento/AllCom/FGV/Six Sigma/WCES). */
const credenciais = [
  "Ex-Telefônica VIVO",
  "Ex-Atento",
  "Ex-AllCom Telecom",
  "MBA Gerenciamento de Projetos · FGV",
  "Green Belt · Lean Six Sigma",
  "Dupla Certificação Internacional em Cientista da Experiência do Cliente · WCES (Utah)",
];

function LogoBar() {
  return (
    <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-6">
      {credenciais.map((c) => (
        <li
          key={c}
          className="text-xs font-semibold uppercase tracking-wide text-gray/70"
        >
          {c}
        </li>
      ))}
    </ul>
  );
}

const metodoBullets = [
  "Diagnóstico dos pontos que mais travam o crescimento hoje.",
  "Plano de ação priorizado, com responsáveis e prazos.",
  "Indicadores (KPIs) para você acompanhar o negócio com clareza.",
  "Acompanhamento próximo, ajustando a rota mês a mês.",
];

const passos = [
  {
    n: "01",
    titulo: "Faça o diagnóstico gratuito",
    desc: "30 perguntas rápidas. Você recebe na hora uma pontuação por área e um feedback gratuito com plano de ação inicial para impulsionar o seu negócio.",
  },
  {
    n: "02",
    titulo: "Converse com o Thiago",
    desc: "Uma conversa de diagnóstico estratégico (30 a 40 min), sem custo, para entender seu momento e o caminho mais rápido.",
  },
  {
    n: "03",
    titulo: "Receba um plano sob medida",
    desc: "A proposta de consultoria certa para a sua empresa, com escopo, indicadores e acompanhamento.",
  },
];

const faqItems = [
  {
    q: "Como funciona o contrato — tem fidelidade?",
    a: "O acompanhamento é mensal, com escopo e prazo definidos já na proposta, alinhados ao seu momento e objetivo — nada de contrato genérico de longo prazo empurrado goela abaixo. Se o caminho combinado não estiver funcionando, isso é conversado e ajustado, não engessado. Os detalhes exatos de prazo e formato são fechados na conversa de diagnóstico, depois de entender a sua empresa.",
  },
  {
    q: "O que está incluso no acompanhamento mensal?",
    a: "Reuniões periódicas com o próprio fundador, indicadores (KPIs) para acompanhar o negócio com clareza, plano de ação priorizado com responsáveis e prazos, e suporte para as decisões que aparecem entre um encontro e outro — não é um relatório único e um adeus. O escopo exato é ajustado ao tamanho e à necessidade da sua empresa na proposta.",
  },
  {
    q: "Como é o primeiro mês de consultoria, na prática?",
    a: "Começa pelo diagnóstico aprofundado das seis áreas do negócio, para identificar com precisão onde estão os maiores travamentos. A partir disso, é montado o plano de ação priorizado — com responsáveis, prazos e os primeiros indicadores — para que as primeiras mudanças já comecem a rodar dentro do próprio mês, em vez de ficar só no diagnóstico.",
  },
  {
    q: "Preciso ter a empresa organizada para começar?",
    a: "Não. É justamente para organizar que a consultoria existe. O diagnóstico mostra o ponto de partida.",
  },
  {
    q: "É presencial ou online?",
    a: "As duas formas. Definimos conforme a necessidade do seu negócio: presencial na Grande São Paulo e online para todo o Brasil.",
  },
  {
    q: "Quanto tempo até ver resultado?",
    a: "O plano prioriza ações de impacto rápido já nas primeiras semanas, dentro de um ciclo estruturado de acompanhamento.",
  },
  {
    q: "O diagnóstico gratuito tem pegadinha?",
    a: "Não. Você responde, recebe o resultado e um feedback gratuito na hora, com plano de ação inicial, e decide se quer conversar. Sem compromisso.",
  },
  {
    q: "O que acontece se eu não fizer nada agora?",
    a: "Nada — a decisão é sua. Mas empresa que cresce sem estrutura tende a travar no mesmo padrão: o dono continua sendo o gargalo, e resolver não fica mais fácil com o tempo. O diagnóstico é grátis; decidir agir depois da leitura é com você.",
  },
  {
    q: "Como sei se o problema é falta de método, e não falta de sorte ou mercado ruim?",
    a: "Na prática, quase sempre dá para diferenciar: se a operação trava sempre que você se ausenta, se o resultado vem de um jeito diferente todo mês, e se a equipe espera você decidir tudo — isso é estrutura, não mercado. O diagnóstico ajuda a enxergar isso com clareza, antes de qualquer decisão.",
  },
  {
    q: "Já tentei consultoria antes e não funcionou. Por que seria diferente agora?",
    a: "Consultoria genérica costuma entregar teoria sem aplicação prática. Aqui o método nasce da vivência real — 7 anos como sócio-proprietário de uma PME e quase duas décadas estruturando operações comerciais em empresas como Telefônica VIVO e Grupo Allcom — e o acompanhamento é próximo, mês a mês, não um relatório único. A diferença está na execução, não só no diagnóstico.",
  },
  {
    q: "Preciso decidir tudo já na primeira conversa?",
    a: "Não. A Chamada de Diagnóstico Estratégico serve para entender o seu momento e mostrar o caminho possível. A decisão de seguir com a consultoria é sua, sem pressão.",
  },
  {
    q: "Minhas informações ficam seguras?",
    a: "Sim. Os dados da sua empresa são tratados com confidencialidade, conforme a nossa Política de Privacidade, e usados só para construir o seu diagnóstico e a eventual proposta.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

/** Vídeo institucional mudo que era o hero de todas as LPs até 02/09/2026 —
 * segue como padrão nas páginas que ainda não têm apresentação gravada. */
const HERO_PADRAO = {
  src: "/videos/consultoria-pme-hero.mp4",
  poster: "/images/thiago-consultoria-hero.jpg",
  legenda: "Trecho de um vídeo aula do método Gestão 360.",
  comSom: false,
};

export function ConsultoriaLPTemplate({
  eyebrow,
  h1,
  subtitle,
  newsletterOrigem,
  origemTag,
  hero = HERO_PADRAO,
}: {
  eyebrow: string;
  h1: string;
  subtitle: string;
  newsletterOrigem: string;
  /** Código curto da LP para identificar a origem do lead na mensagem do
   * WhatsApp (ex: "[LP1]", "[LP2]", "[PME]"). */
  origemTag: string;
  /** Vídeo do herói. As páginas com apresentação própria gravada passam
   * `comSom: true` — aí o vídeo não dá autoplay nem loop, porque tem
   * narração: quem chega decide assistir, com os controles à mão. */
  hero?: {
    src: string;
    poster: string;
    legenda: string;
    comSom?: boolean;
  };
}) {
  const WHATSAPP_LEAD = whatsappHref(
    "Olá! Vim pelo site e quero falar sobre a consultoria para a minha empresa.",
    origemTag,
  );
  const WHATSAPP_EXECUTIVO = whatsappHref(
    "Olá! Vim pelo site e quero saber mais sobre o Diagnóstico Executivo 360.",
    origemTag,
  );

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* 1. Herói — mesma altura/proporção do PageHero usado no resto do site */}
      <section className="relative isolate flex min-h-[400px] flex-col justify-center overflow-hidden bg-navy text-white md:min-h-[500px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_70%_0%,#2e4358_0%,transparent_70%)]"
        />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-6 py-8 md:grid-cols-2 md:gap-12 md:py-10">
          <div className="text-center md:text-left">
            <p className="font-[var(--font-heading)] text-sm font-semibold uppercase tracking-wide text-gold">
              {eyebrow}
            </p>
            <h1 className="mx-auto mt-4 max-w-xl text-3xl font-bold leading-tight md:mx-0 md:text-4xl">
              {h1}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-white/80 md:mx-0">
              {subtitle}
            </p>
            <div className="mt-6 flex justify-center md:justify-start">
              <ConversionCTA href={DIAGNOSTICO_URL} size="lg">
                Quero meu diagnóstico gratuito agora
              </ConversionCTA>
            </div>
            <p className="mt-3 text-base text-white/70">
              Prefere conversar direto?{" "}
              <a
                href={WHATSAPP_LEAD}
                target="_blank"
                rel="noopener"
                className="font-semibold text-gold underline underline-offset-2 hover:text-gold-light"
              >
                Fale no WhatsApp
              </a>
              , sem passar pelo questionário.
            </p>
            <p className="mt-3 text-base text-white/60">
              Sócio-proprietário de uma PME por 7 anos · MBA em Gerenciamento
              de Projetos pela FGV · Green
              Belt em Lean Six Sigma · 19 anos estruturando operações
              comerciais na Telefônica VIVO, Atento e Grupo Allcom
            </p>
          </div>
          <div>
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/15">
              <video
                key={hero.src}
                src={hero.src}
                poster={hero.poster}
                autoPlay={!hero.comSom}
                muted={!hero.comSom}
                loop={!hero.comSom}
                controls={hero.comSom}
                playsInline
                preload={hero.comSom ? "none" : "auto"}
                aria-label={`${fundador.nome}, ${fundador.cargo}`}
                className="absolute inset-0 h-full w-full bg-navy object-contain"
              />
            </div>
            <p className="mt-2 text-center text-xs text-white/50 md:text-left">
              {hero.legenda}
            </p>
          </div>
        </div>
      </section>

      {/* 2. Para quem é */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading title="Feito para o dono que quer profissionalizar a empresa" />
        <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paraQuem.map((item) => (
            <li
              key={item}
              className="flex gap-3 rounded-xl border border-line bg-white p-5 text-navy"
            >
              <span className="mt-0.5 text-gold-ink" aria-hidden>
                ✔
              </span>
              <span className="text-base leading-snug">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. O problema (+ implicação) */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeading
            title="Quando a empresa cresce sem estrutura, o dono vira o gargalo"
            align="center"
          />
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pilares.map((p) => (
              <li
                key={p.area}
                className="rounded-xl border border-line bg-surface p-7"
              >
                <Icon name={p.icon} className="h-9 w-9 text-gold-ink" />
                <h3 className="mt-4 text-lg font-semibold text-navy">{p.area}</h3>
                <p className="mt-2 text-base text-gray">{p.sintoma}</p>
              </li>
            ))}
          </ul>

          <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-line bg-surface p-7">
            <p className="font-semibold text-navy">
              Isso tem um custo real. Enquanto a gestão depende só de você:
            </p>
            <ul className="mt-4 space-y-3">
              {implicacoes.map((item) => (
                <li key={item} className="flex gap-3 text-base text-gray">
                  <span className="mt-0.5 text-gold-ink" aria-hidden>
                    —
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mx-auto mt-10 max-w-2xl text-center text-lg font-semibold text-navy">
            O problema quase nunca é falta de esforço. É falta de método.
          </p>
        </div>
      </section>

      {/* Prova social #1 */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeading
            title="Esse tipo de travamento não é só seu"
            subtitle="Veja como foi para quem já passou por isso:"
            align="center"
          />
          <div className="mx-auto mt-10 grid max-w-4xl items-center gap-8 md:grid-cols-[320px_1fr]">
            <div className="mx-auto w-full max-w-sm md:mx-0">
              <VideoTestimonial
                video={depoimentoFabio.video}
                poster={depoimentoFabio.poster}
                name={depoimentoFabio.name}
                role={depoimentoFabio.role}
                caption={false}
              />
            </div>
            <div className="text-center md:text-left">
              <p className="text-sm font-semibold text-gold-ink">
                {depoimentoFabio.name} · {depoimentoFabio.role}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-navy">
                {depoimentoFabio.chamada}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-gray">{depoimentoFabio.texto}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. A virada — método Gestão 360 (+ need-payoff) */}
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeading
            title="Gestão 360: método para crescer, gestão para permanecer"
            invert
          />
          <p className="mt-6 max-w-3xl text-lg text-gold-light">
            Imagine o oposto: você decide com número na mesa, não no feeling.
            Sua equipe resolve o dia a dia sem te acionar toda hora. Sua agenda
            tem espaço para pensar o próximo passo do negócio — não só apagar
            incêndio.
          </p>
          <p className="mt-6 max-w-3xl text-white/80">
            O Gestão 360 é a nossa metodologia proprietária. Integra as seis
            frentes que sustentam uma empresa sólida — estratégia, vendas,
            marketing, liderança, processos e finanças — em um modelo prático,
            feito para sair do papel.
          </p>
          <p className="mt-8 text-white/80">
            Na consultoria, o Gestão 360 é aplicado dentro da sua empresa, com:
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {metodoBullets.map((b) => (
              <li key={b} className="flex gap-3 text-white/80">
                <span className="text-gold" aria-hidden>
                  ✓
                </span>
                <span className="text-base">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Prova social #2 */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeading title="O método na prática" align="center" />
          <div className="mx-auto mt-10 grid max-w-4xl items-center gap-8 md:grid-cols-[320px_1fr]">
            <div className="mx-auto w-full max-w-sm md:mx-0">
              <VideoTestimonial
                video={depoimentoDaniella.video}
                poster={depoimentoDaniella.poster}
                name={depoimentoDaniella.name}
                role={depoimentoDaniella.role}
                caption={false}
              />
            </div>
            <div className="text-center md:text-left">
              <p className="text-sm font-semibold text-gold-ink">
                {depoimentoDaniella.name} · {depoimentoDaniella.role}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-navy">
                {depoimentoDaniella.chamada}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-gray">{depoimentoDaniella.texto}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Como funciona */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading title="Um caminho simples para começar" align="center" />
        <ol className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-6">
          <div
            aria-hidden
            className="pointer-events-none absolute left-[16.667%] right-[16.667%] top-8 hidden h-0.5 -translate-y-1/2 bg-gold/40 md:block"
          />
          {passos.map((p, i) => (
            <li key={p.n} className="relative">
              <div className="flex flex-col items-center text-center">
                <span className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-navy font-[var(--font-heading)] text-2xl font-bold text-gold-ink shadow-lg ring-4 ring-surface">
                  {p.n}
                </span>
                <div className="mt-5 rounded-2xl border border-line bg-white p-6">
                  <h3 className="text-lg font-semibold text-navy">
                    {p.titulo}
                  </h3>
                  <p className="mt-2 text-base text-gray">{p.desc}</p>
                </div>
              </div>
              {i < passos.length - 1 && (
                <span
                  aria-hidden
                  className="mx-auto -mb-2 mt-4 flex h-8 w-8 items-center justify-center text-gold-ink md:hidden"
                >
                  <Icon name="arrow-down" className="h-6 w-6" />
                </span>
              )}
            </li>
          ))}
        </ol>
        <div className="mt-12 text-center">
          <ConversionCTA href={DIAGNOSTICO_URL} size="lg">
            Descobrir onde minha empresa está travando
          </ConversionCTA>
        </div>
      </section>

      {/* 6. Quem conduz */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1fr]">
          <Image
            src="/images/thiago-marchi.jpg"
            alt={`${fundador.nome}, ${fundador.cargo}`}
            width={520}
            height={347}
            className="rounded-2xl shadow-2xl"
          />
          <div>
            <SectionHeading title="Quem vai trabalhar ao seu lado" />
            {fundador.bio.map((paragrafo, i) => (
              <p key={i} className="mt-6 text-base leading-relaxed text-gray first:mt-6">
                {i === 0 ? (
                  <>
                    {paragrafo.split(fundador.nome)[0]}
                    <strong className="text-navy">{fundador.nome}</strong>
                    {paragrafo.split(fundador.nome)[1]}
                  </>
                ) : (
                  paragrafo
                )}
              </p>
            ))}
            <p className="mt-4 text-base font-semibold text-navy">
              Quem vai atender você é o próprio fundador — não existe
              consultor designado.
            </p>
            <LogoBar />
          </div>
        </div>
      </section>

      {/* Prova social #3 */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeading title="Resultado de quem decidiu agir" align="center" />
          <div className="mx-auto mt-10 grid max-w-4xl items-center gap-8 md:grid-cols-[320px_1fr]">
            <div className="mx-auto w-full max-w-sm md:mx-0">
              <VideoTestimonial
                video={depoimentoErik.video}
                poster={depoimentoErik.poster}
                name={depoimentoErik.name}
                role={depoimentoErik.role}
                caption={false}
              />
            </div>
            <div className="text-center md:text-left">
              <p className="text-sm font-semibold text-gold-ink">
                {depoimentoErik.name} · {depoimentoErik.role}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-navy">
                {depoimentoErik.chamada}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-gray">{depoimentoErik.texto}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6.5 Diagnóstico Executivo — caminho pago para quem quer ir mais rápido */}
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="font-[var(--font-heading)] text-sm font-semibold uppercase tracking-wide text-gold">
                Para quem não quer esperar
              </p>
              <h2 className="mt-3 text-2xl font-bold md:text-3xl">
                Diagnóstico Executivo 360
              </h2>
              <p className="mt-5 text-white/80">
                Um dia de imersão com Thiago Marchi, presencial ou online, com
                você e a sua liderança. Em vez do questionário, uma conversa
                aprofundada sobre os seis pilares do Gestão 360 — com
                relatório executivo, prioridades claras e um plano de 90 dias
                que a sua empresa já pode começar a aplicar sozinha.
              </p>
              <ul className="mt-6 space-y-3 text-base text-white/80">
                <li className="flex gap-3">
                  <span className="text-gold" aria-hidden>✓</span>
                  <span>Relatório executivo com prioridades e plano de 90 dias</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-gold" aria-hidden>✓</span>
                  <span>Devolutiva com você e as principais lideranças</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-gold" aria-hidden>✓</span>
                  <span>Acesso ao painel de acompanhamento por 3 meses</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-gold" aria-hidden>✓</span>
                  <span>Valor abatido integralmente se você contratar a consultoria em até 30 dias</span>
                </li>
              </ul>
              <div className="mt-8">
                <ConversionCTA href={WHATSAPP_EXECUTIVO} size="lg" eventName="cta_diagnostico_executivo">
                  Quero saber mais sobre o Diagnóstico Executivo
                </ConversionCTA>
              </div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-7">
              <p className="text-sm font-semibold uppercase tracking-wide text-gold">
                Para quem prefere começar sem custo
              </p>
              <p className="mt-3 text-white/80">
                Se você quer testar o caminho antes de investir, o Diagnóstico
                de Maturidade gratuito e a Chamada de Diagnóstico Estratégico
                seguem disponíveis — sem custo, sem compromisso.
              </p>
              <div className="mt-6">
                <ConversionCTA href={DIAGNOSTICO_URL} size="md" eventName="cta_diagnostico_gratuito_secundario">
                  Fazer o diagnóstico gratuito
                </ConversionCTA>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. CTA final */}
      <section className="bg-surface">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <SectionHeading
            title="Descubra em minutos onde a sua empresa está"
            align="center"
          />
          <p className="mx-auto mt-4 max-w-2xl text-gray">
            Faça o diagnóstico gratuito de maturidade e receba uma leitura
            clara das seis áreas do seu negócio, com um feedback gratuito e
            um plano de ação inicial para impulsionar o seu crescimento — sem
            custo e sem compromisso.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-base text-gray">
            O acompanhamento é próximo e o número de empresas atendidas por vez
            é limitado, para manter a qualidade — quanto antes você fizer o
            diagnóstico, antes garante o seu lugar na agenda.
          </p>
          <div className="mt-9 flex justify-center">
            <ConversionCTA href={DIAGNOSTICO_URL} size="lg">
              Começar agora — é grátis
            </ConversionCTA>
          </div>
          <p className="mt-5 text-base text-gray">
            Já sabe que precisa de ajuda?{" "}
            <a
              href={WHATSAPP_LEAD}
              target="_blank"
              rel="noopener"
              className="font-semibold text-gold-ink underline underline-offset-2 hover:text-navy"
            >
              Fale direto no WhatsApp
            </a>
            .
          </p>
        </div>
      </section>

      {/* 8. FAQ */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          title="Perguntas frequentes"
          align="center"
        />
        <div className="mt-12">
          <Faq items={faqItems} />
        </div>
      </section>

      {/* 9. Ainda não é o momento — conteúdo gratuito (newsletter + blog) */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-2xl border border-line bg-surface px-6 py-10 sm:px-10">
            <div className="mx-auto grid max-w-4xl items-center gap-8 lg:grid-cols-[1fr_1fr]">
              <div>
                <p className="font-[var(--font-heading)] text-sm font-semibold uppercase tracking-wide text-gold-ink">
                  Ainda não é o momento de conversar?
                </p>
                <h2 className="mt-2 text-xl font-bold text-navy">
                  Comece pelo conteúdo gratuito
                </h2>
                <p className="mt-3 text-sm text-gray">
                  Enquanto decide, acompanhe artigos práticos de gestão, vendas e
                  liderança no blog, ou assine a newsletter e receba novidades
                  direto no seu e-mail.
                </p>
              </div>
              <NewsletterForm origem={newsletterOrigem} compact />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
