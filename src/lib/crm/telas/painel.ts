import type { ResultadoTeste } from "@/lib/outbound/experimentos";
import { CANAIS_ENTREGA, ETAPAS, type Etapa } from "../tipos";
import { estadoInicial, type LeadSlim } from "./cartao";
import { REGRA_DE_DECISAO, ROTULO_META, type Metas } from "./metas";

/**
 * Painel do CRM (Plano Outbound, seção 5 e 4). Função pura: só conta o que
 * existe no banco, nada estimado. Quando não há base para uma meta, devolve
 * `real: null` e diz o que falta.
 */

/** Interações agrupadas por lead, canal, direção, tipo e intenção (SQL GROUP BY). */
export type AgregadoInteracao = {
  leadId: number;
  canal: string;
  direcao: string;
  tipo: string;
  /** metadados.intencao da resposta (F5); null se não classificada. */
  intencao: string | null;
  /** metadados.desfecho do botão "Reunião feita" (F8); ausente ou null nas demais interações. */
  desfecho?: string | null;
  n: number;
};

export type LinhaFunil = { etapa: Etapa; agora: number };
export type PassoFunil = { rotulo: string; chegaram: number; conversao: number | null };

export type LinhaCanal = {
  canal: string;
  rotulo: string;
  enviados: number;
  entregues: number | null;
  abertos: number | null;
  cliques: number | null;
  respostas: number;
  reunioes: number;
};

export type LinhaGrupo = { nome: string; leads: number; contatados: number; respostas: number; reunioes: number; vendas: number };
export type LinhaOrigem = { canal: string; toque: string; total: number };

export type LinhaMeta = {
  chave: keyof Metas;
  rotulo: string;
  meta: number;
  /** Porcentagem real, ou null quando ainda não há dado. */
  real: number | null;
  numerador: number;
  denominador: number;
  situacao: "na_meta" | "abaixo" | "sem_dados";
  /** Por que não há dado (quando situacao = sem_dados). */
  faltando?: string;
  /** Regra de decisão do plano, mostrada quando está abaixo. */
  regra: string;
  amostraPequena: boolean;
};

export type Painel = {
  totais: { leads: number; contatados: number; respostas: number; reunioes: number; vendas: number };
  temperaturas: { frio: number; morno: number; engajado: number };
  porEtapa: LinhaFunil[];
  funil: PassoFunil[];
  canais: LinhaCanal[];
  segmentos: LinhaGrupo[];
  campanhas: LinhaGrupo[];
  origemReunioes: LinhaOrigem[];
  origemVendas: LinhaOrigem[];
  metas: LinhaMeta[];
  /** Testes A/B medidos (F11) e a última revisão semanal gerada; preenchidos pela tela, fora de `montarPainel`. */
  testesAB?: ResultadoTeste[];
  revisao?: { semana: string; texto: string } | null;
};

const AMOSTRA_MINIMA = 30;
const ROTULO_CANAL: Record<string, string> = { email: "E-mail", whatsapp: "WhatsApp", dm: "DM do Instagram", linkedin: "LinkedIn", ligacao: "Ligação" };

type Flags = { contatado: boolean; respondeu: boolean; reuniao: boolean; feita: boolean; proposta: boolean; venda: boolean };

const add = <K>(m: Map<K, Set<number>>, k: K, id: number) => {
  const s = m.get(k);
  if (s) s.add(id);
  else m.set(k, new Set([id]));
};
const tam = (m: Map<string, Set<number>>, k: string) => m.get(k)?.size ?? 0;

export function montarPainel(leads: LeadSlim[], agregado: AgregadoInteracao[], metas: Metas): Painel {
  // Índices por (canal|tipo[|direcao]) → leads distintos.
  const idx = new Map<string, Set<number>>();
  const pos = new Set<number>();
  const classificadas = new Set<number>();
  /** Leads com resultado de reunião registrado pelo botão "Reunião feita" (F8). */
  const comResultado = new Set<number>();
  const compareceu = new Set<number>();
  const comProximoPasso = new Set<number>();
  for (const a of agregado) {
    if (a.n <= 0) continue;
    if (a.desfecho) {
      comResultado.add(a.leadId);
      if (a.desfecho !== "reagendou") compareceu.add(a.leadId);
      if (["proposta_a_enviar", "proposta_enviada", "ganho"].includes(a.desfecho)) comProximoPasso.add(a.leadId);
    }
    add(idx, `${a.canal}|${a.tipo}|${a.direcao}`, a.leadId);
    add(idx, `*|${a.tipo}|${a.direcao}`, a.leadId);
    if (a.tipo === "respondido" && a.direcao === "entrada" && a.intencao) {
      classificadas.add(a.leadId);
      if (a.intencao === "positiva" || a.intencao === "duvida") pos.add(a.leadId);
    }
  }

  const flags = new Map<number, Flags>();
  for (const l of leads) {
    const entregaMexida = CANAIS_ENTREGA.some((c) => l.entrega[c] !== estadoInicial(c));
    const contatado =
      Boolean(l.primeiroToqueEm) ||
      entregaMexida ||
      ["em_cadencia", "engajado", "respondeu", "reuniao_marcada", "reuniao_feita", "proposta_enviada", "ganho"].includes(l.etapa) ||
      idx.get("*|enviado|saida")?.has(l.id) === true ||
      idx.get("*|resultado_ligacao|saida")?.has(l.id) === true;
    const respondeu = idx.get("*|respondido|entrada")?.has(l.id) === true || ["respondeu", "reuniao_marcada", "reuniao_feita", "proposta_enviada", "ganho"].includes(l.etapa);
    const reuniao = Boolean(l.reuniaoCanal) || idx.get("*|agendou|entrada")?.has(l.id) === true || idx.get("*|agendou|saida")?.has(l.id) === true || ["reuniao_marcada", "reuniao_feita", "proposta_enviada", "ganho"].includes(l.etapa);
    const feita = ["reuniao_feita", "proposta_enviada", "ganho"].includes(l.etapa);
    const proposta = ["proposta_enviada", "ganho"].includes(l.etapa);
    const venda = l.etapa === "ganho" || Boolean(l.vendaCanal);
    flags.set(l.id, { contatado, respondeu, reuniao, feita, proposta, venda });
  }
  const f = (l: LeadSlim) => flags.get(l.id)!;

  // Funil: quem chegou a cada passo. O passo seguinte implica os anteriores (propagação para trás),
  // então a contagem nunca sobe ao avançar e a conversão nunca passa de 100%.
  const n = leads.length;
  const passos: { rotulo: string; teste: (l: LeadSlim) => boolean }[] = [
    { rotulo: "Captado", teste: () => true },
    { rotulo: "Qualificado", teste: (l) => l.etapa !== "captado" || f(l).contatado },
    { rotulo: "Em cadência", teste: (l) => f(l).contatado },
    { rotulo: "Respondeu", teste: (l) => f(l).respondeu },
    { rotulo: "Reunião marcada", teste: (l) => f(l).reuniao },
    { rotulo: "Reunião feita", teste: (l) => f(l).feita },
    { rotulo: "Proposta enviada", teste: (l) => f(l).proposta },
    { rotulo: "Ganho", teste: (l) => f(l).venda },
  ];
  const nivel = (l: LeadSlim) => {
    let maior = -1;
    passos.forEach((p, i) => {
      if (p.teste(l)) maior = i;
    });
    return maior;
  };
  const niveis = leads.map(nivel);
  const funil: PassoFunil[] = passos.map((p, i) => {
    const chegaram = niveis.filter((x) => x >= i).length;
    const anterior = i === 0 ? null : niveis.filter((x) => x >= i - 1).length;
    return { rotulo: p.rotulo, chegaram, conversao: anterior ? (chegaram / anterior) * 100 : null };
  });

  const porEtapa: LinhaFunil[] = ETAPAS.map((etapa) => ({ etapa, agora: leads.filter((l) => l.etapa === etapa).length }));

  // Por canal.
  const enviadosPorCanal = new Map<string, Set<number>>();
  for (const l of leads) {
    for (const c of CANAIS_ENTREGA) {
      if (l.entrega[c] !== estadoInicial(c)) add(enviadosPorCanal, c, l.id);
    }
  }
  const uniao = (...ss: (Set<number> | undefined)[]) => new Set(ss.flatMap((s) => (s ? [...s] : [])));
  const leadsPorEstado = (c: (typeof CANAIS_ENTREGA)[number], estados: string[]) =>
    new Set(leads.filter((l) => estados.includes(l.entrega[c])).map((l) => l.id));
  const ids = (c: string, tipo: string, dir = "saida") => idx.get(`${c}|${tipo}|${dir}`);
  const enviadosDe = (c: string) =>
    uniao(ids(c, "enviado"), enviadosPorCanal.get(c), c === "ligacao" ? ids("ligacao", "resultado_ligacao") : undefined);
  const reunioesDe = (c: string) => leads.filter((l) => l.reuniaoCanal === c).length;

  const canais: LinhaCanal[] = [
    (() => {
      const enviados = enviadosDe("email");
      const entregues = uniao(ids("email", "entregue"), ids("email", "aberto"), ids("email", "clicado"), leadsPorEstado("email", ["entregue", "aberto", "clicado"]));
      const abertos = uniao(ids("email", "aberto"), ids("email", "clicado"), leadsPorEstado("email", ["aberto", "clicado"]));
      const cliques = uniao(ids("email", "clicado"), leadsPorEstado("email", ["clicado"]));
      return { canal: "email", rotulo: ROTULO_CANAL.email, enviados: enviados.size, entregues: entregues.size, abertos: abertos.size, cliques: cliques.size, respostas: tam(idx, "email|respondido|entrada"), reunioes: reunioesDe("email") };
    })(),
    (() => {
      const enviados = enviadosDe("whatsapp");
      const entregues = uniao(ids("whatsapp", "entregue"), ids("whatsapp", "lido"), leadsPorEstado("whatsapp", ["entregue", "lido"]));
      const lidos = uniao(ids("whatsapp", "lido"), leadsPorEstado("whatsapp", ["lido"]));
      const cliques = ids("whatsapp", "clicado");
      return { canal: "whatsapp", rotulo: ROTULO_CANAL.whatsapp, enviados: enviados.size, entregues: entregues.size, abertos: lidos.size, cliques: cliques?.size ?? 0, respostas: tam(idx, "whatsapp|respondido|entrada"), reunioes: reunioesDe("whatsapp") };
    })(),
    (() => {
      const enviados = enviadosDe("dm");
      const vistas = uniao(ids("dm", "lido"), leadsPorEstado("dm", ["vista"]));
      return { canal: "dm", rotulo: ROTULO_CANAL.dm, enviados: enviados.size, entregues: null, abertos: vistas.size, cliques: null, respostas: tam(idx, "dm|respondido|entrada"), reunioes: reunioesDe("dm") };
    })(),
    (() => {
      const enviados = enviadosDe("linkedin");
      const aceitos = uniao(ids("linkedin", "entregue"), leadsPorEstado("linkedin", ["aceito"]));
      return { canal: "linkedin", rotulo: ROTULO_CANAL.linkedin, enviados: enviados.size, entregues: aceitos.size, abertos: null, cliques: null, respostas: tam(idx, "linkedin|respondido|entrada"), reunioes: reunioesDe("linkedin") };
    })(),
    (() => {
      const feitas = enviadosDe("ligacao");
      return { canal: "ligacao", rotulo: ROTULO_CANAL.ligacao, enviados: feitas.size, entregues: null, abertos: null, cliques: null, respostas: 0, reunioes: reunioesDe("ligacao") };
    })(),
  ];

  // Por segmento e por campanha.
  const agrupar = (chave: (l: LeadSlim) => string | null, vazio: string): LinhaGrupo[] => {
    const m = new Map<string, LinhaGrupo>();
    for (const l of leads) {
      const nome = chave(l) ?? vazio;
      const g = m.get(nome) ?? { nome, leads: 0, contatados: 0, respostas: 0, reunioes: 0, vendas: 0 };
      g.leads++;
      const fl = f(l);
      if (fl.contatado) g.contatados++;
      if (fl.respondeu) g.respostas++;
      if (fl.reuniao) g.reunioes++;
      if (fl.venda) g.vendas++;
      m.set(nome, g);
    }
    return [...m.values()].sort((a, b) => b.leads - a.leads || a.nome.localeCompare(b.nome, "pt-BR"));
  };

  // Origem das reuniões e das vendas (qual canal e qual toque geraram).
  const origem = (canal: (l: LeadSlim) => string | null, toque: (l: LeadSlim) => string | null, conta: (l: LeadSlim) => boolean): LinhaOrigem[] => {
    const m = new Map<string, LinhaOrigem>();
    for (const l of leads.filter(conta)) {
      const c = canal(l) ?? "sem_origem";
      const t = toque(l) ?? "";
      const k = `${c}|${t}`;
      const o = m.get(k) ?? { canal: c, toque: t, total: 0 };
      o.total++;
      m.set(k, o);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  };

  // Metas contra o real.
  const todosContatados = leads.filter((l) => f(l).contatado).length;
  const meta = (chave: keyof Metas, numerador: number, denominador: number, faltando: string): LinhaMeta => {
    const base = { chave, rotulo: ROTULO_META[chave], meta: metas[chave], numerador, denominador, regra: REGRA_DE_DECISAO[chave], amostraPequena: denominador < AMOSTRA_MINIMA };
    if (denominador <= 0) return { ...base, real: null, situacao: "sem_dados", faltando };
    const real = (numerador / denominador) * 100;
    return { ...base, real, situacao: real >= metas[chave] ? "na_meta" : "abaixo" };
  };
  const respostaDe = (c: string) => {
    const env = enviadosDe(c);
    const resp = idx.get(`${c}|respondido|entrada`);
    const num = resp ? [...resp].filter((id) => env.has(id)).length : 0;
    return { num, den: env.size };
  };
  const emailEnv = enviadosDe("email").size;
  const emailDevolvidos = uniao(ids("email", "bounce"), leadsPorEstado("email", ["devolvido"])).size;
  const dm = respostaDe("dm");
  const em = respostaDe("email");
  const wa = respostaDe("whatsapp");
  const classif = classificadas.size;

  const linhasMeta: LinhaMeta[] = [
    meta("entregaEmail", Math.max(0, emailEnv - emailDevolvidos), emailEnv, "Nenhum e-mail enviado ainda (F6)."),
    meta("respostaDm", dm.num, dm.den, "Nenhuma DM registrada no CRM ainda."),
    meta("respostaEmail", em.num, em.den, "Nenhum e-mail enviado ainda (F6)."),
    meta("respostaWhatsapp", wa.num, wa.den, "Nenhum WhatsApp enviado ainda (F9)."),
    meta("respostasPositivas", pos.size, classif, "As respostas ainda não são classificadas (F5)."),
    meta("reuniaoMarcada", leads.filter((l) => f(l).contatado && f(l).reuniao).length, todosContatados, "Nenhum lead contatado ainda."),
    meta("comparecimento", compareceu.size, comResultado.size, "Nenhuma reunião com resultado registrado no botão \"Reunião feita\" ainda."),
    meta("reuniaoComProximoPasso", comProximoPasso.size, compareceu.size, "Nenhuma reunião feita com resultado registrado ainda."),
  ];

  return {
    totais: {
      leads: n,
      contatados: todosContatados,
      respostas: leads.filter((l) => f(l).respondeu).length,
      reunioes: leads.filter((l) => f(l).reuniao).length,
      vendas: leads.filter((l) => f(l).venda).length,
    },
    temperaturas: {
      frio: leads.filter((l) => l.temperatura === "frio").length,
      morno: leads.filter((l) => l.temperatura === "morno").length,
      engajado: leads.filter((l) => l.temperatura === "engajado").length,
    },
    porEtapa,
    funil,
    canais,
    segmentos: agrupar((l) => l.segmento, "Sem segmento"),
    campanhas: agrupar((l) => l.campanha, "Sem campanha"),
    origemReunioes: origem((l) => l.reuniaoCanal, (l) => l.reuniaoToque, (l) => f(l).reuniao),
    origemVendas: origem((l) => l.vendaCanal, (l) => l.vendaToque, (l) => f(l).venda),
    metas: linhasMeta,
  };
}
