import type { Metadata } from "next";
import Link from "next/link";
import { depoimentosVideo } from "@/lib/content";

/**
 * Página da oferta da campanha Planejamento 2027 (27/10/2026 a 10/01/2027). Fonte da oferta:
 * Marketing/Posts/Campanha Planejamento 2027/plano-campanha.md. Sem preço: condições só no bate-papo
 * (decisão do Thiago, 27/10/2026). A urgência muda sozinha depois de 04/12 (turma de dezembro fecha).
 * O material é o guia "Planejamento 2027: guia completo e plano em 1 página"; as áreas e perguntas abaixo saem de
 * Marketing/Posts/Campanha Planejamento 2027/material-plano-2027/conteudo.py (decisão 7 de Agentes/PROJETO-CAMPANHA-2027.md).
 */
export const metadata: Metadata = {
  title: "Planejamento Empresarial 2027 | Entre em 2027 com o plano pronto",
  description:
    "Consultoria de Planejamento Empresarial 2027: diagnóstico com números reais, metas apoiadas no caixa, plano comercial, estrutura e plano de 90 dias com acompanhamento.",
};

export const revalidate = 3600;

const UTM = "utm_source=site&utm_medium=lp&utm_campaign=2027";
const CONVERSA = `/conversa?${UTM}`;
const MATERIAL = `/materiais/plano-2027-em-1-pagina?${UTM}`;

const ETAPAS = [
  { titulo: "Diagnóstico", texto: "Leitura da empresa nos 6 pilares do método Gestão 360, com números reais.", entrega: "Raio-x de onde a empresa trava hoje." },
  { titulo: "Construção do plano", texto: "Encontros com você e com quem decide junto.", entrega: "Metas de 2027 apoiadas no caixa, orçamento, plano comercial, estrutura e responsáveis." },
  { titulo: "Plano de 90 dias", texto: "Prioridades de janeiro a março, com indicadores.", entrega: "Plano de ação e painel de acompanhamento configurado." },
  { titulo: "Implantação (opcional)", texto: "Acompanhamento de janeiro a março.", entrega: "O plano saindo do papel, semana a semana." },
];

const MATERIAL_TITULO = "Planejamento 2027: guia completo e plano em 1 página";

// As 7 áreas do guia, cada uma ligada a um pilar do Gestão 360, com a pergunta-chave (conteudo.py).
const AREAS = [
  { nome: "Estratégia e direção", pilar: "Arquitetura do Crescimento", pergunta: "O que a empresa vai deixar de fazer para crescer com foco?" },
  { nome: "Comercial e vendas", pilar: "Objetivos Estratégicos", pergunta: "Quantas propostas por semana a meta exige?" },
  { nome: "Marketing", pilar: "Evolução Constante", pergunta: "Quantos contatos qualificados o comercial precisa por mês?" },
  { nome: "Financeiro e caixa", pilar: "Métricas de Sucesso", pergunta: "A meta de faturamento cabe na margem e no caixa?" },
  { nome: "Operações e processos", pilar: "Fluxo de Alta Performance", pergunta: "Quais 3 processos mais geram retrabalho?" },
  { nome: "Pessoas e liderança", pilar: "Gestão de Desafios", pergunta: "Quem decide o quê sem passar pelo dono?" },
  { nome: "Tecnologia e IA na rotina", pilar: "Evolução Constante", pergunta: "Que tarefa repetitiva já tem processo e pode ser automatizada?" },
];

const PARA_QUEM = [
  "Sua empresa cresceu e a casa desorganizou.",
  "Você corre o ano inteiro e não sabe direito o que funcionou.",
  "A meta do ano é a do ano passado mais um percentual.",
  "Tudo passa por você, e o plano costuma morrer em fevereiro.",
];

function turma(agora = new Date()): string {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
  return hoje <= "2026-12-04"
    ? "Para ter o plano pronto antes do Natal, o trabalho começa até 04/12. A agenda de dezembro comporta poucas empresas. Depois disso abre a turma de janeiro, com início até 15/01."
    : "A turma de dezembro já fechou. A turma de janeiro tem poucas vagas e começa até 15/01, para o plano ficar pronto no começo de fevereiro.";
}

function Cta({ className = "" }: { className?: string }) {
  return (
    <Link
      href={CONVERSA}
      className={`inline-flex items-center justify-center rounded-lg bg-gold px-6 py-3 font-heading text-base font-semibold tracking-wide text-navy transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${className}`}
    >
      Agendar um bate-papo rápido e gratuito
    </Link>
  );
}

export default function Page() {
  const prova = depoimentosVideo.fabio;
  return (
    <div className="bg-surface">
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-4xl px-4 py-14 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold">Planejamento Empresarial 2027</p>
          <h1 className="mt-3 font-heading text-3xl font-bold leading-tight md:text-5xl">
            Entre em 2027 com o plano pronto, não com uma meta chutada
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/85 md:text-lg">
            A gente monta com você o plano de 2027: olhando os números reais de 2026, com meta que cabe no caixa e um plano de 90
            dias que não morre em fevereiro.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Cta />
            <Link
              href={MATERIAL}
              className="inline-flex items-center justify-center rounded-lg border border-gold/60 px-6 py-3 font-heading text-base font-semibold text-gold transition-colors hover:bg-white/5"
            >
              Baixar o guia gratuito do Planejamento 2027
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-4 pb-16">
        <section aria-labelledby="para-quem" className="mt-12">
          <h2 id="para-quem" className="font-heading text-2xl font-semibold text-navy">
            Para quem é
          </h2>
          <p className="mt-2 text-base text-gray">
            Para dono de empresa com faturamento a partir de R$ 1,2 milhão por ano que se reconhece em pelo menos uma destas frases:
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {PARA_QUEM.map((item) => (
              <li key={item} className="flex gap-3 rounded-xl border border-line bg-white p-4 text-base leading-relaxed text-ink">
                <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="como" className="mt-14">
          <h2 id="como" className="font-heading text-2xl font-semibold text-navy">
            Como funciona
          </h2>
          <p className="mt-2 text-base text-gray">Em 3 a 4 semanas, o plano sai pronto. A implantação é opcional.</p>
          <ol className="mt-6 grid gap-4 md:grid-cols-2">
            {ETAPAS.map((e, i) => (
              <li key={e.titulo} className="rounded-2xl border border-line bg-white p-5">
                <p className="font-heading text-sm font-bold text-gold-ink">Etapa {i + 1}</p>
                <p className="mt-1 font-heading text-lg font-semibold text-navy">{e.titulo}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink">{e.texto}</p>
                <p className="mt-3 text-sm leading-relaxed text-gray">
                  <span className="font-semibold text-navy">Entrega: </span>
                  {e.entrega}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="guia" className="mt-14">
          <h2 id="guia" className="font-heading text-2xl font-semibold text-navy">
            O guia gratuito: {MATERIAL_TITULO}
          </h2>
          <p className="mt-2 text-base text-gray">
            O mesmo caminho do trabalho, para você começar sozinho: balanço de 2026, meta que cabe no caixa, as 3 prioridades do ano,
            plano de 90 dias e rotina semanal. São 7 áreas, cada uma ligada a um pilar do Gestão 360, com perguntas, um indicador e a
            armadilha mais comum.
          </p>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2">
            {AREAS.map((a, i) => (
              <li key={a.nome} className="rounded-xl border border-line bg-white p-4">
                <p className="font-heading text-sm font-bold text-gold-ink">
                  Área {i + 1} · {a.pilar}
                </p>
                <p className="mt-1 font-heading text-base font-semibold text-navy">{a.nome}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink">{a.pergunta}</p>
              </li>
            ))}
          </ol>
          <Link href={MATERIAL} className="mt-5 inline-block font-semibold text-navy underline">
            Baixar o guia e a planilha
          </Link>
        </section>

        <section aria-labelledby="prova" className="mt-14">
          <h2 id="prova" className="font-heading text-2xl font-semibold text-navy">
            {prova.chamada}
          </h2>
          <video
            className="mt-5 w-full rounded-2xl bg-navy"
            src={prova.video}
            poster={prova.poster}
            controls
            preload="none"
            playsInline
          />
          <p className="mt-2 text-sm text-gray">
            {prova.name}, {prova.role}
          </p>
        </section>

        <section aria-labelledby="prazo" className="mt-14 rounded-2xl bg-navy p-6 text-white md:p-8">
          <h2 id="prazo" className="font-heading text-2xl font-semibold">
            O plano só serve se estiver pronto antes de janeiro
          </h2>
          <p className="mt-3 text-base leading-relaxed text-white/85">{turma()}</p>
          <p className="mt-3 text-base leading-relaxed text-white/85">
            No bate-papo, o Thiago entende o momento da sua empresa e explica as condições.
          </p>
          <Cta className="mt-6" />
        </section>

        <p className="mt-10 text-center text-sm leading-relaxed text-gray">
          Prefere começar sozinho?{" "}
          <Link href={MATERIAL} className="font-semibold text-navy underline">
            Baixe o guia gratuito do Planejamento 2027
          </Link>{" "}
          ou{" "}
          <a href="/diagnostico-maturidade-empresarial.html" className="font-semibold text-navy underline">
            faça o diagnóstico gratuito
          </a>
          .
        </p>
      </main>
    </div>
  );
}
