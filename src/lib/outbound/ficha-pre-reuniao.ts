import { campoDoDossie, decisorDoDossie } from "@/lib/crm/telas/dossie";
import type { InteracaoFila } from "@/lib/crm/telas/fila";
import { dataHoraBr } from "@/lib/crm/telas/tempo";

/**
 * Ficha pré-reunião (Plano Outbound, seção 8). Gerada de forma DETERMINÍSTICA a partir do dossiê, das
 * interações (sinais de engajamento) e da régua de faturamento, sem IA: o site roda na Vercel e a IA do
 * projeto (`agy`) só roda no PC do Thiago (decisão 1 do plano).
 * ponytail: texto de IA para a ficha fica para o Hunter (melhoria futura registrada no PROJECT_STATUS).
 */

/** Régua de qualificação: consultoria PME sustentável custa de 0,5% a 2,5% do faturamento anual do cliente. */
export const REGUA = { min: 0.005, max: 0.025 } as const;

/**
 * Ofertas de referência da reunião (esteira de 04/08/2026). O próximo passo pedido no fim da reunião é
 * decisão do Thiago (docs/outbound/PENDENCIAS-THIAGO.md, item 19): ajustar aqui quando ele decidir.
 */
export const OFERTAS_REGUA = [
  { papel: "alvo", nome: "Implantação Gestão 360", investimento: 20_700 },
  { papel: "recuo", nome: "Diagnóstico Executivo", investimento: 5_900 },
] as const;

export type FaixaDaOferta = { papel: "alvo" | "recuo"; nome: string; investimento: number; fatMin: number; fatMax: number };

/** Faturamento anual em que o investimento da oferta fica entre 2,5% (mínimo) e 0,5% (confortável). */
export function faixaPorOferta(): FaixaDaOferta[] {
  return OFERTAS_REGUA.map((o) => ({ ...o, fatMin: Math.round(o.investimento / REGUA.max), fatMax: Math.round(o.investimento / REGUA.min) }));
}

const UNIDADE: Record<string, number> = { k: 1e3, mil: 1e3, mi: 1e6, milhao: 1e6, milhoes: 1e6 };
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Faturamento anual a partir de texto livre do dossiê ("R$ 1,2 milhão", "800 mil por mês", "1.200.000",
 * "R$ 500 mil a R$ 1 mi"). Faixa vira ponto médio. Devolve null se não achar número.
 */
export function lerFaturamentoAnual(texto: string | null): number | null {
  if (!texto) return null;
  const t = semAcento(texto.toLowerCase());
  const achados = [...t.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s*(milhoes|milhao|mil|mi|k)?(?![a-z])/g)];
  if (achados.length === 0) return null;
  const valores = achados.slice(0, 2).map((m) => ({ n: Number(`${m[1].replace(/\./g, "")}.${m[2] ?? "0"}`), un: m[3] ? UNIDADE[m[3]] : null }));
  // "500 a 800 mil": a unidade do último número vale para o primeiro.
  const unComum = valores.find((v) => v.un)?.un ?? 1;
  const nums = valores.map((v) => v.n * (v.un ?? unComum));
  let anual = nums.reduce((s, x) => s + x, 0) / nums.length;
  if (/\b(por mes|ao mes|mensal|mensais|\/mes)\b/.test(t)) anual *= 12;
  return anual > 0 ? Math.round(anual) : null;
}

const brl = (n: number) => {
  if (n >= 1e6) return `R$ ${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 1e3) return `R$ ${Math.round(n / 1e3).toLocaleString("pt-BR")} mil`;
  return `R$ ${n.toLocaleString("pt-BR")}`;
};

/** Onde o faturamento do lead cai na régua de cada oferta e o que isso sugere para o fim da reunião. */
export function avaliarRegua(faturamentoAnual: number | null): { linhas: string[]; sugestao: string } {
  const faixas = faixaPorOferta();
  const linhas = faixas.map(
    (f) => `${f.papel === "alvo" ? "Alvo" : "Recuo"}, ${f.nome} (${brl(f.investimento)}): cabe com faturamento anual de ${brl(f.fatMin)} (2,5%) a ${brl(f.fatMax)} (0,5%).`,
  );
  if (faturamentoAnual === null) {
    return { linhas, sugestao: "Faturamento não informado no dossiê. Pergunte na reunião e confira a régua antes de falar de preço." };
  }
  const [alvo, recuo] = faixas;
  const lido = `Faturamento anual lido do dossiê: cerca de ${brl(faturamentoAnual)}.`;
  if (faturamentoAnual >= alvo.fatMin) {
    return { linhas, sugestao: `${lido} Dentro da régua da oferta alvo (${alvo.nome}).` };
  }
  if (faturamentoAnual >= recuo.fatMin) {
    return { linhas, sugestao: `${lido} Abaixo da régua da oferta alvo: o investimento passaria de 2,5% do faturamento. Conduza para o recuo (${recuo.nome}).` };
  }
  return { linhas, sugestao: `${lido} Abaixo da régua das duas ofertas: tende a ser caso de Trilha, não de consultoria recorrente. Qualifique antes de apresentar preço.` };
}

const SINAIS: Record<string, string> = {
  aberto: "abriu o e-mail",
  clicado: "clicou no link",
  deu_play: "assistiu ao vídeo",
  abriu_pagina: "abriu uma página nossa",
  lido: "leu a mensagem",
  respondido: "respondeu",
  agendou: "agendou a reunião",
};

const ROTULO_CANAL: Record<string, string> = { dm: "DM", email: "e-mail", whatsapp: "WhatsApp", ligacao: "ligação", linkedin: "LinkedIn", sistema: "o site" };

/** "abriu o e-mail (2x), clicou no link, respondeu por DM": o que o lead fez nos últimos 14 dias. */
export function sinaisDeEngajamento(interacoes: InteracaoFila[], agora: Date, dias = 14): string[] {
  const desde = agora.getTime() - dias * 86_400_000;
  const contagem = new Map<string, number>();
  for (const i of interacoes) {
    if (i.direcao !== "entrada" || !SINAIS[i.tipo] || Date.parse(i.data) < desde) continue;
    const rotulo = i.tipo === "respondido" || i.tipo === "lido" ? `${SINAIS[i.tipo]} por ${ROTULO_CANAL[i.canal] ?? i.canal}` : SINAIS[i.tipo];
    contagem.set(rotulo, (contagem.get(rotulo) ?? 0) + 1);
  }
  return [...contagem].map(([r, n]) => (n > 1 ? `${r} (${n}x)` : r));
}

/** 4 perguntas no método SPIN; a de Problema parte da dor provável do dossiê, quando houver. */
export function perguntasSpin(dor: string | null): string[] {
  return [
    "Situação: como está dividido o dia a dia hoje? Quem cuida de vendas, de entrega e do financeiro?",
    dor
      ? `Problema: o dossiê aponta como dor provável "${dor}". Isso é real aí? Quando acontece, o que trava primeiro?`
      : "Problema: o que mais te toma tempo ou dinheiro hoje e que você gostaria de ver resolvido em 90 dias?",
    "Implicação: se isso seguir igual por mais 12 meses, o que acontece com o faturamento, com a margem e com a sua rotina?",
    "Necessidade: se esse ponto estivesse resolvido, o que você faria com o tempo e o caixa que sobrariam?",
  ];
}

export type EntradaFicha = {
  nome: string;
  empresa: string | null;
  segmento?: string | null;
  dossie: unknown;
  temperatura: string;
  pontos: number;
  interacoes: InteracaoFila[];
  reuniaoEm: Date | null;
  agora: Date;
};

export type Ficha = { titulo: string; texto: string };

export function montarFicha(e: EntradaFicha): Ficha {
  const decisor = decisorDoDossie(e.dossie);
  const dor = campoDoDossie(e.dossie, "dorprovavel") ?? campoDoDossie(e.dossie, "dor");
  const segmento = e.segmento ?? campoDoDossie(e.dossie, "segmento");
  const gancho = campoDoDossie(e.dossie, "gancho");
  const prova = campoDoDossie(e.dossie, "prova");
  const faturamento = lerFaturamentoAnual(campoDoDossie(e.dossie, "faturamento"));
  const sinais = sinaisDeEngajamento(e.interacoes, e.agora);
  const regua = avaliarRegua(faturamento);

  const quando = e.reuniaoEm ? `, ${dataHoraBr(e.reuniaoEm)}` : "";
  const quem = [decisor ?? e.nome, e.empresa].filter(Boolean).join(", ");
  const titulo = `Ficha pré-reunião: ${e.empresa ?? e.nome}${quando}`;

  const linhas = [
    titulo,
    "",
    `Quem: ${quem}${segmento ? `. Segmento: ${segmento}` : ""}.`,
    "",
    "Dor provável:",
    dor ?? "O dossiê não traz dor provável. Descubra na fase de Problema.",
    ...(gancho ? ["", `Gancho que usamos: ${gancho}`] : []),
    ...(prova ? [`Prova escolhida: ${prova}`] : []),
    "",
    `Engajamento: ${e.temperatura} (${e.pontos} ${e.pontos === 1 ? "ponto" : "pontos"} na semana).`,
    sinais.length ? `Nos últimos 14 dias o lead ${sinais.join(", ")}.` : "Sem sinal de engajamento registrado nos últimos 14 dias.",
    "",
    "Faixa de faturamento (régua de 0,5% a 2,5% do faturamento anual):",
    ...regua.linhas,
    regua.sugestao,
    "",
    "Perguntas sugeridas (SPIN):",
    ...perguntasSpin(dor).map((p, i) => `${i + 1}. ${p}`),
    "",
    "Roteiro completo: docs/outbound/ROTEIRO-REUNIAO.md. O pedido do fim da reunião ainda depende da sua decisão (hipótese: Implantação Gestão 360, recuo no Diagnóstico Executivo).",
  ];
  return { titulo, texto: linhas.join("\n") };
}
