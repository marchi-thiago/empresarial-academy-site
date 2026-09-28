import { createHmac } from "crypto";
import type { BasePayload } from "payload";
import { sendMail } from "@/lib/email";
import { siteConfig } from "@/lib/site-config";
import { getWeakestPillar, type PillarName } from "@/lib/lead-scoring";

/**
 * Sequência de nutrição pós-diagnóstico (meio de funil).
 *
 * O lead que conclui o Diagnóstico de Maturidade recebe, além do e-mail de
 * resultado imediato (diagnostic-email.ts), 3 toques automáticos personalizados
 * pelo pilar mais fraco:
 *   E1 (D+2) — o que o pilar fraco está custando + 3 ações práticas;
 *   E2 (D+5) — como o Gestão 360 trabalha esse pilar (ponte dor→método);
 *   E3 (D+7) — convite direto para a Chamada de Diagnóstico Estratégico.
 *
 * Disparo: rota de cron /api/cron/nutricao (Vercel Cron, diário).
 * LGPD: somente leads com consentimento; todo e-mail traz link de descadastro
 * (/api/nutricao/sair) que marca `nurtureOptOut` no lead.
 */

// Manter em sincronia com src/components/CalendlyEmbed.tsx.
export const CALENDLY_URL =
  "https://calendly.com/thiago-empresarialacademy/new-meeting";

const FROM = "Empresarial Academy <contato@empresarialacademy.com>";
const REPLY_TO = siteConfig.contact.email;

const NAVY = "#1D2B3C";
const GOLD = "#C1A160";
const INK = "#15191f";
const GRAY = "#5b626e";
const LINE = "#d9dce1";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Token de descadastro (HMAC do id+e-mail com o PAYLOAD_SECRET). */
export function optOutToken(leadId: string | number, email: string): string {
  const secret = process.env.PAYLOAD_SECRET || "dev-secret";
  return createHmac("sha256", secret)
    .update(`${leadId}:${(email || "").toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

export function optOutUrl(leadId: string | number, email: string): string {
  return `${siteConfig.url}/api/nutricao/sair?l=${encodeURIComponent(String(leadId))}&t=${optOutToken(leadId, email)}`;
}


/**
 * Modelo editável no admin (coleção `email-templates`, EA Leads). Chave
 * `tema:<slug>` ou `pilar:<nome do pilar>`. Campo vazio = vale o texto padrão
 * deste arquivo, então o envio nunca depende do modelo existir.
 */
export type NurtureTemplate = {
  chave: string;
  ativo?: boolean | null;
  tema?: string | null;
  assuntoPrimeiro?: string | null;
  assuntoSegundo?: string | null;
  assuntoTerceiro?: string | null;
  corpoPrimeiro?: string | null;
  corpoSegundo?: string | null;
  corpoTerceiro?: string | null;
  sinais?: string | null;
  acoes?: string | null;
  metodo?: string | null;
};
export type NurtureTemplates = Map<string, NurtureTemplate>;

const linhas = (s?: string | null) =>
  (s ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

/** Modelos do admin. Nunca lança: sem tabela ou sem banco, devolve vazio e vale o padrão. */
export async function loadNurtureTemplates(payload: BasePayload): Promise<NurtureTemplates> {
  try {
    const { docs } = await payload.find({ collection: "email-templates", limit: 200, depth: 0, overrideAccess: true });
    return new Map((docs as NurtureTemplate[]).map((d) => [d.chave, d]));
  } catch (e) {
    console.warn("[nurture] modelos do admin indisponíveis, usando o padrão:", e);
    return new Map();
  }
}

type PillarCopy = {
  /** E1 — o custo prático de o pilar estar fraco. */
  custo: string[];
  /** E1 — por onde começar nesta semana. */
  acoes: string[];
  /** E2 — como a consultoria trabalha o pilar. */
  metodo: string;
  assuntoPrimeiro?: string;
  assuntoSegundo?: string;
};

function pillarCopyCom(base: PillarCopy, t?: NurtureTemplate): PillarCopy {
  if (!t) return base;
  const custo = linhas(t.sinais);
  const acoes = linhas(t.acoes);
  return {
    custo: custo.length ? custo : base.custo,
    acoes: acoes.length ? acoes : base.acoes,
    metodo: t.metodo?.trim() || base.metodo,
    assuntoPrimeiro: t.assuntoPrimeiro?.trim() || base.assuntoPrimeiro,
    assuntoSegundo: t.assuntoSegundo?.trim() || base.assuntoSegundo,
  };
}

export const PILLAR_COPY: Record<PillarName, PillarCopy> = {
  "Fluxo de Alta Performance": {
    custo: [
      "O dia a dia é definido por quem está apagando o incêndio da vez, não por um plano.",
      "A operação trava assim que você se ausenta: nenhum processo sobrevive sem você por perto.",
      "O mesmo gargalo trava a empresa toda semana, e ninguém ataca a causa, só o sintoma.",
    ],
    acoes: [
      "Mapeie em uma folha o processo que mais gera dor hoje, do início ao fim.",
      "Defina por escrito o que cada pessoa pode decidir sozinha, sem te acionar.",
      "Identifique o único gargalo que mais trava o fluxo esta semana e ataque só ele.",
    ],
    metodo:
      "No pilar Fluxo de Alta Performance, a consultoria mapeia os processos críticos, define alçadas de decisão e aplica análise de gargalo para atacar a real restrição do crescimento, não o sintoma que aparece por cima. O objetivo é uma operação que roda sem depender da sua presença o tempo todo.",
  },
  "Arquitetura do Crescimento": {
    custo: [
      "Contratação no feeling traz gente errada para o time, e ninguém percebe até custar caro.",
      "Sem 1:1 nem feedback, problema de pessoas fica guardado até explodir.",
      "\"Somos uma família\" vira desculpa para adiar decisões difíceis de gestão.",
    ],
    acoes: [
      "Desenhe um organograma simples com o principal responsável por cada área.",
      "Marque um 1:1 de 30 minutos com cada pessoa-chave do time esta semana.",
      "Defina um roteiro mínimo de entrevista para a próxima contratação.",
    ],
    metodo:
      "No pilar Arquitetura do Crescimento, a consultoria estrutura organograma, recrutamento e rituais de gestão de pessoas (1:1, feedback, avaliação). O objetivo é uma estrutura que sustenta o crescimento, e não uma que trava porque ninguém sabe seu papel.",
  },
  "Objetivos Estratégicos": {
    custo: [
      "Cada área rema numa direção, e o esforço não converte em resultado porque falta foco comum.",
      "A empresa entra em toda oportunidade que aparece, e nenhuma delas anda de verdade.",
      "Ninguém no time sabe repetir os objetivos da empresa, porque eles só existem na sua cabeça.",
    ],
    acoes: [
      "Escreva os 3 objetivos mais importantes para os próximos 90 dias.",
      "Desdobre um desses objetivos em uma meta clara para cada área.",
      "Escolha uma iniciativa fora do foco atual e diga não a ela esta semana.",
    ],
    metodo:
      "No pilar Objetivos Estratégicos, a consultoria transforma a visão em metas desdobradas por área, com rituais de acompanhamento e critério claro para dizer não ao que não serve à estratégia. O objetivo é o time inteiro remando na mesma direção, com foco, não só esforço.",
  },
  "Métricas de Sucesso": {
    custo: [
      "Faturamento sobe, mas ninguém sabe dizer se sobra dinheiro de verdade no fim do mês.",
      "As decisões se apoiam em achismo, porque os números estão espalhados ou desatualizados.",
      "O mesmo problema se repete porque a causa raiz nunca é investigada: só o sintoma é tratado.",
    ],
    acoes: [
      "Liste de 5 a 8 métricas de sanidade (margem, caixa, retenção), não só faturamento bruto.",
      "Separe, mesmo que numa planilha, o resultado (DRE) do saldo em caixa.",
      "Escolha o problema mais recorrente do negócio e investigue a causa raiz dele.",
    ],
    metodo:
      "No pilar Métricas de Sucesso, a consultoria implanta o painel de indicadores de sanidade, separa resultado de caixa e estrutura a rotina de decisão com dado, inclusive a investigação de causa raiz dos problemas recorrentes. O objetivo é decidir com número, não com ego nem com feeling.",
  },
  "Gestão de Desafios": {
    custo: [
      "Todo imprevisto pega a empresa de surpresa, e o caixa sente na hora.",
      "Numa situação grave, ninguém sabe exatamente quem decide o quê, e o tempo se perde na confusão.",
      "O mesmo tipo de crise se repete, porque nada muda depois que ela passa.",
    ],
    acoes: [
      "Liste os 5 principais riscos do negócio: o que pode dar errado e o tamanho do impacto.",
      "Comece, ainda que pequeno, a separar um valor mensal para reserva de emergência.",
      "Defina por escrito quem decide o quê numa situação grave, mesmo que seja só você e um sócio.",
    ],
    metodo:
      "No pilar Gestão de Desafios, a consultoria estrutura mapa de risco, reserva financeira, protocolo de decisão em crise e revisão pós-evento. O objetivo é uma empresa preparada para o imprevisto, e não uma que reage no desespero cada vez que ele aparece.",
  },
  "Evolução Constante": {
    custo: [
      "Todo o tempo vai para manter a operação rodando, e não sobra espaço para pensar no que vem depois.",
      "O erro é escondido ou punido, então o time para de testar coisas novas.",
      "A empresa só percebe a mudança do mercado quando o impacto já chegou.",
    ],
    acoes: [
      "Reserve algumas horas por mês só para pensar em melhoria, fora da operação do dia a dia.",
      "Depois do próximo teste ou projeto, registre a lição aprendida, tenha dado certo ou não.",
      "Pergunte à liderança: o que faríamos diferente se fôssemos o concorrente?",
    ],
    metodo:
      "No pilar Evolução Constante, a consultoria cria o hábito de questionar o próprio modelo de negócio, investir em capacitação contínua e tratar o erro como aprendizado, não como falha. O objetivo é uma empresa que se atualiza antes de ser obrigada pelo mercado.",
  },
};

const GENERIC_ACOES = [
  "Escolha o pilar que mais dói hoje e concentre a energia nele por 90 dias.",
  "Defina 3 indicadores simples para acompanhar o avanço.",
  "Implante uma reunião mensal de resultados com hora fixa.",
];

export type NurtureInput = {
  leadId: string | number;
  name: string;
  email: string;
  company?: string;
  /** Campo `details` do lead (scores do diagnóstico). */
  details?: Record<string, unknown> | null;
};

type Parsed = { weakest: { name: PillarName; pct: number } | null; firstName: string };

function parseLead(input: NurtureInput): Parsed {
  const firstName =
    (input.name || "").trim().split(/\s+/)[0] || "empreendedor(a)";
  return { weakest: getWeakestPillar(input.details), firstName };
}

function shell(opts: {
  preheader: string;
  bodyHtml: string;
  unsubscribe: string;
  /** Rodapé "por que você recebe": padrão é o do Diagnóstico. */
  motivo?: string;
}): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f6f5f1;font-family:Arial,Helvetica,sans-serif;color:${INK}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${LINE};border-radius:14px;overflow:hidden">
  <tr><td style="background:${NAVY};padding:20px 28px">
    <div style="color:${GOLD};font-weight:700;letter-spacing:.5px;font-size:13px">EMPRESARIAL ACADEMY</div>
  </td></tr>
  <tr><td style="padding:26px 28px">${opts.bodyHtml}</td></tr>
  <tr><td style="padding:0 28px 26px">
    <div style="border-top:1px solid ${LINE};padding-top:16px">
      <p style="margin:0;font-size:14px;color:${INK}"><strong>Thiago Marchi</strong> · Empresarial Academy</p>
      <p style="margin:4px 0 0;font-size:13px;color:${GRAY}">Método para crescer. Gestão para permanecer.</p>
    </div>
  </td></tr>
</table>
<p style="max-width:560px;margin:14px auto 0;font-size:11px;color:#9aa0a8;text-align:center;line-height:1.5">
  ${opts.motivo ?? "Você recebe estes acompanhamentos porque concluiu o Diagnóstico de Maturidade em"}
  <a href="${siteConfig.url}" style="color:#9aa0a8">empresarialacademy.com</a>.<br>
  Não quer mais receber? <a href="${opts.unsubscribe}" style="color:#9aa0a8">Sair da lista</a>.
</p>
</td></tr></table>
</body></html>`;
}

const goldButton = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="border-radius:10px;background:${GOLD}">
      <a href="${href}" style="display:inline-block;padding:14px 26px;color:${NAVY};font-weight:700;font-size:15px;text-decoration:none">${esc(label)} &rarr;</a>
    </td>
  </tr></table>`;

const bullets = (items: string[]) =>
  `<ul style="margin:0 0 18px;padding-left:20px">${items
    .map(
      (i) =>
        `<li style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${INK}">${esc(i)}</li>`,
    )
    .join("")}</ul>`;

function waUrl(text: string): string {
  return `https://wa.me/${siteConfig.contact.phoneRaw}?text=${encodeURIComponent(text)}`;
}

/**
 * Monta o e-mail da etapa (1..3). Puro/testável — não envia.
 */
export function renderNurtureEmail(
  step: 1 | 2 | 3,
  input: NurtureInput,
  modelos?: NurtureTemplates,
): { subject: string; html: string; text: string } {
  const { weakest, firstName } = parseLead(input);
  const unsubscribe = optOutUrl(input.leadId, input.email);
  const pilar = weakest?.name ?? null;
  const copy = pilar ? pillarCopyCom(PILLAR_COPY[pilar], modelos?.get(`pilar:${pilar}`)) : null;
  const pilarTxt = pilar ? `${pilar}${weakest ? ` (${weakest.pct}%)` : ""}` : "";

  if (step === 1) {
    const subject = pilar
      ? (copy?.assuntoPrimeiro ?? `Sobre o seu pilar de ${pilar}: por onde começar`)
      : "Por onde começar depois do seu diagnóstico";
    const intro = pilar
      ? `No seu diagnóstico, o pilar que mais pediu atenção foi <strong>${esc(pilarTxt)}</strong>. Na prática, é isso que ele costuma custar para uma empresa do seu porte:`
      : `Depois do diagnóstico, o passo mais importante é transformar o resultado em ação. Na prática:`;
    const custo = copy ? bullets(copy.custo) : "";
    const acoes = copy ? copy.acoes : GENERIC_ACOES;
    const bodyHtml = `
      <p style="margin:0 0 12px;font-size:16px">Olá, ${esc(firstName)},</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6">${intro}</p>
      ${custo}
      <p style="margin:0 0 10px;font-size:15px;line-height:1.6"><strong>Três ações para começar ainda esta semana:</strong></p>
      ${bullets(acoes)}
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6">
        Se quiser, me conte por WhatsApp qual dessas ações faz mais sentido no seu momento: respondo pessoalmente.
      </p>
      ${goldButton(waUrl(`Olá! Recebi o e-mail sobre o pilar de ${pilar || "gestão"} e quero conversar sobre por onde começar.`), "Falar no WhatsApp")}`;
    const text = [
      `Olá, ${firstName},`,
      ``,
      pilar
        ? `No seu diagnóstico, o pilar que mais pediu atenção foi ${pilarTxt}.`
        : `Depois do diagnóstico, o passo mais importante é transformar o resultado em ação.`,
      ``,
      `Três ações para começar esta semana:`,
      ...acoes.map((a) => `- ${a}`),
      ``,
      `Quer conversar sobre por onde começar? ${waUrl("Olá! Quero conversar sobre o meu diagnóstico.")}`,
    ].join("\n");
    return { subject, html: shell({ preheader: "Três ações práticas para o pilar que mais pediu atenção no seu diagnóstico.", bodyHtml, unsubscribe }), text };
  }

  if (step === 2) {
    const subject = pilar
      ? (copy?.assuntoSegundo ?? `Como destravamos ${pilar} na prática`)
      : "Como funciona a consultoria Gestão 360";
    const metodo = copy
      ? copy.metodo
      : "A consultoria aplica a metodologia Gestão 360 dentro da sua empresa: diagnóstico aprofundado, plano de ação trimestral priorizado por impacto, implantação com sistemas e automações com IA feitos sob medida, painel de indicadores e acompanhamento mensal.";
    const bodyHtml = `
      <p style="margin:0 0 12px;font-size:16px">Olá, ${esc(firstName)},</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6">
        Muita gente conclui o diagnóstico, concorda com o resultado, e a rotina engole o plano.
        É exatamente esse o problema que a consultoria resolve.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${GOLD};border-radius:12px;background:#faf7ef;margin:0 0 18px">
        <tr><td style="padding:18px 20px">
          <div style="color:${GRAY};font-size:12px;letter-spacing:.5px;text-transform:uppercase">Metodologia Gestão 360</div>
          <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:${INK}">${esc(metodo)}</p>
        </td></tr>
      </table>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6">
        O trabalho é conduzido por mim, Thiago Marchi, com 7 anos como sócio-proprietário de uma PME e 19 anos
        estruturando operações comerciais em empresas como Telefônica VIVO e Grupo Allcom.
        Sem teoria distante: plano, indicadores, sistemas sob medida e acompanhamento, dentro da sua realidade.
      </p>
      ${goldButton(`${siteConfig.url}/servicos/consultoria`, "Conhecer a consultoria")}
      <p style="margin:14px 0 0;font-size:13px;color:${GRAY}">
        Prefere conversar direto? <a href="${waUrl("Olá! Quero entender como a consultoria funcionaria na minha empresa.")}" style="color:#8a6a1f;font-weight:600">Me chame no WhatsApp</a>.
      </p>`;
    const text = [
      `Olá, ${firstName},`,
      ``,
      `Muita gente conclui o diagnóstico, concorda com o resultado, e a rotina engole o plano. É esse o problema que a consultoria resolve.`,
      ``,
      metodo,
      ``,
      `Conheça a consultoria: ${siteConfig.url}/servicos/consultoria`,
      `Ou me chame no WhatsApp: ${waUrl("Olá! Quero entender como a consultoria funcionaria na minha empresa.")}`,
    ].join("\n");
    return { subject, html: shell({ preheader: "Do diagnóstico ao plano em execução: como a metodologia Gestão 360 trabalha o seu pilar.", bodyHtml, unsubscribe }), text };
  }

  // step === 3
  const subject = "Vamos olhar o seu diagnóstico juntos? (30 min, sem custo)";
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:16px">Olá, ${esc(firstName)},</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6">
      Quero te fazer um convite direto: uma <strong>Chamada de Diagnóstico Estratégico</strong>:
      30 a 40 minutos, online, sem custo e sem compromisso.
    </p>
    <p style="margin:0 0 10px;font-size:15px;line-height:1.6">Nessa conversa, você sai com:</p>
    ${bullets([
      "A leitura do seu resultado, pilar a pilar, com o que priorizar primeiro;",
      "O caminho mais curto para o próximo nível de maturidade da sua empresa;",
      "Clareza sobre se (e como) a consultoria faz sentido para o seu momento.",
    ])}
    ${goldButton(CALENDLY_URL, "Escolher um horário")}
    <p style="margin:14px 0 0;font-size:13px;color:${GRAY}">
      Se preferir, <a href="${waUrl("Olá! Fiz o Diagnóstico de Maturidade e quero agendar a conversa estratégica.")}" style="color:#8a6a1f;font-weight:600">me chame no WhatsApp</a> que combinamos por lá.
    </p>`;
  const text = [
    `Olá, ${firstName},`,
    ``,
    `Convite direto: uma Chamada de Diagnóstico Estratégico: 30 a 40 minutos, online, sem custo e sem compromisso.`,
    ``,
    `Você sai com a leitura do seu resultado pilar a pilar, o que priorizar primeiro e clareza sobre se a consultoria faz sentido para o seu momento.`,
    ``,
    `Escolha um horário: ${CALENDLY_URL}`,
    `Ou me chame no WhatsApp: ${waUrl("Olá! Quero agendar a conversa estratégica.")}`,
  ].join("\n");
  return { subject, html: shell({ preheader: "30 minutos para transformar o seu diagnóstico em um plano, sem custo.", bodyHtml, unsubscribe }), text };
}

// ——— Nutrição por tema (leads de download de material — não diagnóstico) ———
//
// Mesma cadência D+2/D+5/D+7, mas trilha pelo TEMA do material baixado em vez
// do pilar mais fraco do diagnóstico (esses leads nunca fizeram o
// diagnóstico). Objetivo declarado (Thiago, 27/09/2026): levar pro
// Diagnóstico de Maturidade Empresarial e, na sequência, pra Chamada.

type CategoryCopy = {
  /** Nome do tema com acento, pra texto e assunto (o slug não tem: "lideranca"). */
  tema?: string;
  assuntoPrimeiro?: string;
  /** E2 — assunto próprio quando "Como o Gestão 360 trabalha <tema>" soa mal. */
  assuntoSegundo?: string;
  /** E1 — 3 sinais de que o tema está fraco na empresa. */
  sinais: string[];
  /** E1 — por onde começar nesta semana. */
  acoes: string[];
  /** E2 — ponte do tema pro método Gestão 360. */
  metodo: string;
};

function categoryCopyCom(base: CategoryCopy, t?: NurtureTemplate): CategoryCopy {
  if (!t) return base;
  const sinais = linhas(t.sinais);
  const acoes = linhas(t.acoes);
  return {
    tema: t.tema?.trim() || base.tema,
    assuntoPrimeiro: t.assuntoPrimeiro?.trim() || base.assuntoPrimeiro,
    assuntoSegundo: t.assuntoSegundo?.trim() || base.assuntoSegundo,
    sinais: sinais.length ? sinais : base.sinais,
    acoes: acoes.length ? acoes : base.acoes,
    metodo: t.metodo?.trim() || base.metodo,
  };
}

export const CATEGORY_COPY: Record<string, CategoryCopy> = {
  gestao: {
    tema: "gestão",
    assuntoSegundo: "Como o Gestão 360 tira a operação das suas costas",
    sinais: [
      "A empresa trava quando você se ausenta, porque as decisões passam todas por você.",
      "O mesmo problema volta toda semana, e a equipe só apaga o incêndio da vez.",
      "Cada pessoa faz a mesma tarefa de um jeito, e ninguém sabe dizer qual é o certo.",
    ],
    acoes: [
      "Escolha o processo que mais gera retrabalho hoje e desenhe numa folha, do início ao fim.",
      "Escreva o que cada pessoa-chave pode decidir sozinha, sem precisar te chamar.",
      "Marque uma reunião semanal de 30 minutos, com hora fixa, só para olhar os números.",
    ],
    metodo:
      "No pilar Fluxo de Alta Performance do Gestão 360, a consultoria mapeia os processos críticos, define quem decide o quê e ataca o gargalo que mais segura o crescimento. O objetivo é uma operação que roda com rotina e indicador, sem depender da sua presença o dia inteiro.",
  },
  vendas: {
    tema: "vendas",
    assuntoSegundo: "Como o Gestão 360 transforma vendas em processo",
    sinais: [
      "O faturamento do mês depende de um ou dois vendedores, ou de você mesmo.",
      "Ninguém sabe dizer quantos contatos viram proposta e quantas propostas viram venda.",
      "A meta é um número no fim do mês, sem acompanhamento semanal de como chegar lá.",
    ],
    acoes: [
      "Liste as etapas da sua venda, do primeiro contato ao fechamento, e conte quantos negócios estão em cada uma.",
      "Calcule a taxa de conversão de proposta para venda dos últimos 3 meses.",
      "Divida a meta do mês em metas semanais e acompanhe toda segunda-feira.",
    ],
    metodo:
      "Nos pilares Objetivos Estratégicos e Métricas de Sucesso do Gestão 360, a consultoria desdobra a meta comercial em metas por etapa, monta o painel do funil e cria a rotina de acompanhamento com o time. O objetivo é vender por processo, não por esforço de uma pessoa só.",
  },
  lideranca: {
    tema: "liderança",
    assuntoSegundo: "Como o Gestão 360 estrutura a liderança da sua empresa",
    sinais: [
      "Você é o único que cobra resultado, e o time espera a sua ordem para agir.",
      "Problema de pessoas fica guardado até explodir, porque não existe conversa de acompanhamento.",
      "A contratação é feita no feeling e o erro só aparece meses depois.",
    ],
    acoes: [
      "Marque uma conversa individual de 30 minutos com cada pessoa-chave nesta semana.",
      "Escreva o que você espera de cada função em três frases, e combine com quem ocupa.",
      "Defina um roteiro simples de entrevista antes da próxima contratação.",
    ],
    metodo:
      "No pilar Arquitetura do Crescimento do Gestão 360, a consultoria estrutura organograma, papéis, recrutamento e os rituais de gestão de pessoas (conversas individuais, feedback e avaliação). O objetivo é um time que assume responsabilidade, em vez de esperar a sua decisão para tudo.",
  },
  financeiro: {
    sinais: [
      "O saldo em caixa some rápido, mas ninguém sabe apontar exatamente pra onde foi.",
      "O preço é definido no feeling, sem saber ao certo o ponto de equilíbrio de cada produto/serviço.",
      "O fim do mês é sempre uma surpresa, boa ou ruim, em vez de uma previsão.",
    ],
    acoes: [
      "Separe o resultado (DRE) do saldo em caixa: são coisas diferentes, e misturar os dois engana.",
      "Calcule o ponto de equilíbrio: quanto a empresa precisa faturar só pra não ter prejuízo.",
      "Projete o fluxo de caixa das próximas 4 semanas, mesmo que numa planilha simples.",
    ],
    metodo:
      "No pilar de Métricas de Sucesso do Gestão 360, a consultoria implanta o painel de indicadores financeiros, separa resultado de caixa e estrutura a rotina de decisão com número, inclusive precificação e ponto de equilíbrio por produto/serviço. O objetivo é decidir com dado, não com a sensação de que “deu pra fechar o mês”.",
  },
};

const GENERIC_CATEGORY_COPY: CategoryCopy = {
  sinais: [
    "O problema se repete mês após mês, e o motivo real nunca é investigado.",
    "As decisões dependem de quem está mais disponível no momento, não de um processo.",
    "Falta um indicador simples pra saber se essa área está melhorando ou piorando.",
  ],
  acoes: [
    "Escreva em uma frase qual é o principal problema dessa área hoje.",
    "Escolha um único indicador simples pra acompanhar essa área nas próximas semanas.",
    "Defina o primeiro passo prático, algo que dê pra começar ainda esta semana.",
  ],
  metodo:
    "A metodologia Gestão 360 trabalha essa área dentro do plano de ação priorizado por impacto, com indicadores e acompanhamento mensal. Não é teoria solta: é plano dentro da realidade da sua empresa.",
};

export type CategoryNurtureInput = {
  leadId: string | number;
  name: string;
  email: string;
  /** Slug da categoria (material-categories.slug), ex.: "financeiro". */
  category: string;
  /** Nome de exibição de reserva quando o tema não tem `tema` em CATEGORY_COPY. */
  categoryLabel: string;
};

function parseCategoryLead(input: CategoryNurtureInput): { firstName: string } {
  const firstName = (input.name || "").trim().split(/\s+/)[0] || "empreendedor(a)";
  return { firstName };
}

/** Monta o e-mail da etapa (1..3) da nutrição por tema. Puro/testável, não envia. */
export function renderCategoryNurtureEmail(
  step: 1 | 2 | 3,
  input: CategoryNurtureInput,
  modelos?: NurtureTemplates,
): { subject: string; html: string; text: string } {
  const { firstName } = parseCategoryLead(input);
  const unsubscribe = optOutUrl(input.leadId, input.email);
  const copy = categoryCopyCom(
    CATEGORY_COPY[input.category] ?? GENERIC_CATEGORY_COPY,
    modelos?.get(`tema:${input.category}`),
  );
  const tema = copy.tema ?? input.categoryLabel.toLowerCase();
  const Tema = tema.replace(/^./u, (c) => c.toUpperCase());
  const motivo = `Você recebe estes e-mails porque baixou um material sobre ${esc(tema)} em`;

  if (step === 1) {
    const subject = copy.assuntoPrimeiro ?? `${Tema}: 3 sinais de que vale olhar com mais cuidado`;
    const bodyHtml = `
      <p style="margin:0 0 12px;font-size:16px">Olá, ${esc(firstName)},</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6">
        Você baixou nosso material sobre ${esc(tema)}. Se foi atrás disso, provavelmente é um ponto de atenção
        real na sua empresa agora. Três sinais comuns de que essa área precisa de estrutura:
      </p>
      ${bullets(copy.sinais)}
      <p style="margin:0 0 10px;font-size:15px;line-height:1.6"><strong>Por onde começar ainda esta semana:</strong></p>
      ${bullets(copy.acoes)}
      ${goldButton(waUrl(`Olá! Baixei o material de ${tema} e quero entender melhor a situação da minha empresa.`), "Falar no WhatsApp")}`;
    const text = [
      `Olá, ${firstName},`,
      ``,
      `Você baixou nosso material sobre ${tema}. Três sinais comuns de que essa área precisa de estrutura:`,
      ...copy.sinais.map((s) => `- ${s}`),
      ``,
      `Por onde começar esta semana:`,
      ...copy.acoes.map((a) => `- ${a}`),
    ].join("\n");
    return {
      subject,
      html: shell({ preheader: `Três sinais práticos sobre ${tema} na sua empresa.`, bodyHtml, unsubscribe, motivo }),
      text,
    };
  }

  if (step === 2) {
    const subject = copy.assuntoSegundo ?? `Como o Gestão 360 trabalha ${tema}`;
    const bodyHtml = `
      <p style="margin:0 0 12px;font-size:16px">Olá, ${esc(firstName)},</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6">
        Um material sozinho ajuda, mas não resolve: a rotina engole o que não vira processo.
        É esse o problema que o Diagnóstico de Maturidade Empresarial começa a resolver.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${GOLD};border-radius:12px;background:#faf7ef;margin:0 0 18px">
        <tr><td style="padding:18px 20px">
          <div style="color:${GRAY};font-size:12px;letter-spacing:.5px;text-transform:uppercase">Metodologia Gestão 360</div>
          <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:${INK}">${esc(copy.metodo)}</p>
        </td></tr>
      </table>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6">
        O Diagnóstico é gratuito, leva poucos minutos e mostra onde a gestão da sua empresa está segurando
        o crescimento. Não só em ${esc(tema)}: no negócio inteiro.
      </p>
      ${goldButton(`${siteConfig.url}/diagnostico-maturidade-empresarial`, "Fazer o Diagnóstico gratuito")}`;
    const text = [
      `Olá, ${firstName},`,
      ``,
      `Um material sozinho ajuda, mas não resolve: a rotina engole o que não vira processo.`,
      ``,
      copy.metodo,
      ``,
      `Faça o Diagnóstico gratuito: ${siteConfig.url}/diagnostico-maturidade-empresarial`,
    ].join("\n");
    return {
      subject,
      html: shell({ preheader: `Do material ao plano em execução: como o Gestão 360 trabalha ${tema}.`, bodyHtml, unsubscribe, motivo }),
      text,
    };
  }

  // step === 3
  const subject = "Vamos conversar 30 minutos, sem custo?";
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:16px">Olá, ${esc(firstName)},</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6">
      Convite direto: uma <strong>Chamada de Diagnóstico Estratégico</strong>. São 30 a 40 minutos, online,
      sem custo e sem compromisso, para olharmos juntos a sua empresa, começando por ${esc(tema)}.
    </p>
    ${goldButton(CALENDLY_URL, "Escolher um horário")}
    <p style="margin:14px 0 0;font-size:13px;color:${GRAY}">
      Se preferir, <a href="${waUrl(`Olá! Baixei o material de ${tema} e quero agendar a conversa estratégica.`)}" style="color:#8a6a1f;font-weight:600">me chame no WhatsApp</a> que combinamos por lá.
    </p>`;
  const text = [
    `Olá, ${firstName},`,
    ``,
    `Convite direto: uma Chamada de Diagnóstico Estratégico. São 30 a 40 minutos, online, sem custo e sem compromisso.`,
    ``,
    `Escolha um horário: ${CALENDLY_URL}`,
  ].join("\n");
  return { subject, html: shell({ preheader: "30 minutos para transformar seu material em um plano, sem custo.", bodyHtml, unsubscribe, motivo }), text };
}

// ——— Nutrição por área de atuação (leads captados pelo EA Hunter) ———
//
// Texto livre por área, todo no admin (modelos `area:<segmento>`, reserva
// `area:generico`); portado do fluxo de e-mail que existia no EA Flow. Sem
// modelo, ou com o modelo desligado (`ativo`), não envia: o lead do Hunter
// não deu consentimento e ligar é decisão de base legal do Thiago.

export type AreaNurtureInput = { leadId: string | number; name: string; email: string; area?: string | null };

/** Modelo que vale pra área (o da área se existir, senão o genérico). */
export function modeloDaArea(area: string | null | undefined, modelos?: NurtureTemplates): NurtureTemplate | undefined {
  return (area ? modelos?.get(`area:${area}`) : undefined) ?? modelos?.get("area:generico");
}

function paragrafos(texto: string): string {
  return texto
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const html = esc(p)
        .replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:#8a6a1f;font-weight:600">${u}</a>`)
        .replace(/\r?\n/g, "<br>");
      return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${html}</p>`;
    })
    .join("");
}

/** E1..E3 da área. Null quando o modelo não tem texto pra essa etapa. Puro/testável, não envia. */
export function renderAreaNurtureEmail(
  step: 1 | 2 | 3,
  input: AreaNurtureInput,
  modelos?: NurtureTemplates,
): { subject: string; html: string; text: string } | null {
  const m = modeloDaArea(input.area, modelos);
  const assunto = [m?.assuntoPrimeiro, m?.assuntoSegundo, m?.assuntoTerceiro][step - 1]?.trim();
  const corpo = [m?.corpoPrimeiro, m?.corpoSegundo, m?.corpoTerceiro][step - 1]?.trim();
  if (!assunto || !corpo) return null;
  const nome = (input.name || "").trim().split(/\s+/)[0] || "tudo bem";
  const preencher = (s: string) => s.replace(/\{\{\s*nome\s*\}\}/g, nome);
  const text = preencher(corpo);
  return {
    subject: preencher(assunto),
    html: shell({
      preheader: text.split(/\r?\n/).find((l) => l.trim() && !/^oi\b|^olá\b/i.test(l.trim()))?.slice(0, 120) ?? "",
      bodyHtml: paragrafos(text),
      unsubscribe: optOutUrl(input.leadId, input.email),
      motivo: "Você recebe este e-mail porque a Empresarial Academy conversou com a sua empresa pelo Instagram. Saiba mais em",
    }),
    text,
  };
}

export async function sendAreaNurtureEmail(
  step: 1 | 2 | 3,
  input: AreaNurtureInput,
  modelos?: NurtureTemplates,
): Promise<{ ok: boolean; via: string }> {
  try {
    if (!input.email) return { ok: false, via: "no-email" };
    const mail = renderAreaNurtureEmail(step, input, modelos);
    if (!mail) return { ok: false, via: "no-template" };
    const result = await sendMail({ to: input.email, from: FROM, replyTo: REPLY_TO, ...mail });
    const { logEmailSend } = await import("@/lib/email-log");
    await logEmailSend({
      type: `nurture-${step}` as const,
      to: input.email,
      subject: mail.subject,
      ok: result.ok,
      via: result.via,
      leadId: input.leadId,
    });
    return result;
  } catch (e) {
    console.error("[nurture-email] exceção (área):", e);
    return { ok: false, via: "exception" };
  }
}

export async function sendCategoryNurtureEmail(
  step: 1 | 2 | 3,
  input: CategoryNurtureInput,
  modelos?: NurtureTemplates,
): Promise<{ ok: boolean; via: string }> {
  try {
    if (!input.email) return { ok: false, via: "no-email" };
    const mail = renderCategoryNurtureEmail(step, input, modelos);
    const result = await sendMail({
      to: input.email,
      from: FROM,
      replyTo: REPLY_TO,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    const { logEmailSend } = await import("@/lib/email-log");
    await logEmailSend({
      // Reusa o mesmo tipo de log da nutrição por pilar -- é a mesma
      // categoria de evento (nutrição automática), só muda o conteúdo.
      // Criar um enum novo exigiria migração de coluna select no Postgres.
      type: `nurture-${step}` as const,
      to: input.email,
      subject: mail.subject,
      ok: result.ok,
      via: result.via,
      leadId: input.leadId,
    });
    return result;
  } catch (e) {
    console.error("[nurture-email] exceção (categoria):", e);
    return { ok: false, via: "exception" };
  }
}

export async function sendNurtureEmail(
  step: 1 | 2 | 3,
  input: NurtureInput,
  modelos?: NurtureTemplates,
): Promise<{ ok: boolean; via: string }> {
  try {
    if (!input.email) return { ok: false, via: "no-email" };
    const mail = renderNurtureEmail(step, input, modelos);
    const result = await sendMail({
      to: input.email,
      from: FROM,
      replyTo: REPLY_TO,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    const { logEmailSend } = await import("@/lib/email-log");
    await logEmailSend({
      type: `nurture-${step}` as const,
      to: input.email,
      subject: mail.subject,
      ok: result.ok,
      via: result.via,
      leadId: input.leadId,
    });
    return result;
  } catch (e) {
    console.error("[nurture-email] exceção:", e);
    return { ok: false, via: "exception" };
  }
}
