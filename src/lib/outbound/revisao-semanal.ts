import type { Painel } from "@/lib/crm/telas/painel";
import { siteConfig } from "@/lib/site-config";
import { medirVariantes, type EventoAB, type ResultadoTeste } from "./experimentos";
import type { OutboundDb } from "./orquestrador";
import { dataIso, ehDiaUtil, inicioDoDia, partesBr, somarDias } from "./tempo";

/**
 * Revisão semanal do outbound (Plano Outbound, F11). Toda segunda, a partir das 8h de Brasília (e até sexta, se a
 * segunda foi perdida), o orquestrador gera UMA revisão da semana anterior, grava em `interacoes` (chave
 * `revisao:semanal:<segunda>`, tipo `lembrete`, sem valor novo no enum) e avisa o Thiago no WhatsApp.
 *
 * Determinística: só contagens e as regras de decisão do plano, a partir do que o CRM registrou. Sem IA, sem estimativa.
 * Quando não há dado, a revisão diz "sem dados" e o que falta.
 */

const ROTULO_CANAL: Record<string, string> = { email: "E-mail", dm: "DM do Instagram", whatsapp: "WhatsApp", linkedin: "LinkedIn", ligacao: "Ligação" };
const ROTULO_VARIAVEL: Record<string, string> = { assunto: "assunto", gancho: "gancho", cta: "convite" };
const ROTULO_MOTIVO: Record<string, string> = {
  preco: "preço",
  momento: "não é o momento",
  concorrente: "escolheu outra solução",
  sem_fit: "fora do perfil",
  sem_resposta: "parou de responder",
  interno: "vai resolver internamente",
  valor_percebido: "viu valor e fechou",
  indicacao: "veio por indicação",
  outro: "outro",
};

export type MotivoResultado = { motivo: string; etapa: string; n: number };

export type PeriodoRevisao = { inicio: Date; fim: Date; segunda: string };

/** Semana anterior fechada: de segunda 00:00 a domingo 23:59 de Brasília, relativa à segunda da semana de `agora`. */
export function periodoDaRevisao(agora: Date): PeriodoRevisao {
  const desdeSegunda = (partesBr(agora).diaSemana + 6) % 7;
  const fim = somarDias(inicioDoDia(agora), -desdeSegunda);
  return { inicio: somarDias(fim, -7), fim, segunda: dataIso(fim) };
}

export const chaveDaRevisao = (agora: Date): string => `revisao:semanal:${periodoDaRevisao(agora).segunda}`;

/** Gera na segunda a partir das 8h; se perdeu, ainda gera de terça a sexta (uma vez por semana, pela chave). */
export function revisaoDevida(agora: Date): boolean {
  return ehDiaUtil(agora) && partesBr(agora).hora >= 8;
}

const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
const dia = (d: Date) => {
  const p = partesBr(d);
  return `${String(p.dia).padStart(2, "0")}/${String(p.mes).padStart(2, "0")}`;
};

export type ResumoCanal = { canal: string; enviados: number; respostas: number; reunioes: number };

/** O que aconteceu no período, por canal: envios, respostas e reuniões marcadas. */
export function resumoDaSemana(eventos: readonly EventoAB[], p: Pick<PeriodoRevisao, "inicio" | "fim">): ResumoCanal[] {
  const m = new Map<string, ResumoCanal>();
  const linha = (c: string) => m.get(c) ?? m.set(c, { canal: c, enviados: 0, respostas: 0, reunioes: 0 }).get(c)!;
  for (const e of eventos) {
    if (e.data < p.inicio || e.data >= p.fim) continue;
    if (e.tipo === "enviado" && e.direcao === "saida") linha(e.canal).enviados++;
    else if (e.tipo === "respondido" && e.direcao === "entrada") linha(e.canal).respostas++;
    else if (e.tipo === "agendou") linha(e.canal).reunioes++;
  }
  return [...m.values()].sort((a, b) => b.enviados - a.enviados || a.canal.localeCompare(b.canal));
}

export type EntradaRevisao = {
  periodo: PeriodoRevisao;
  painel: Painel;
  eventos: readonly EventoAB[];
  motivos: readonly MotivoResultado[];
  /** Testes A/B já medidos (padrão: mede a partir dos eventos). */
  testes?: readonly ResultadoTeste[];
};

export type Revisao = { semana: string; texto: string; resumo: string };

function linhaDoTeste(t: ResultadoTeste): string {
  const rotulo = `${ROTULO_CANAL[t.canal] ?? t.canal}, ${ROTULO_VARIAVEL[t.variavel] ?? t.variavel}`;
  const partes = t.linhas.map((l) => `${l.variante} ${l.taxaResposta === null ? "sem dados" : pct(l.taxaResposta * 100)} (${l.respostas}/${l.envios} respostas, ${l.reunioes} reuniões)`);
  const veredito =
    t.status === "vencedora" ? `vencedora: ${t.vencedora}` : t.status === "empate" ? "empate, segue o teste" : "em teste, falta amostra (30 envios por variante)";
  return `- ${rotulo}: ${partes.join(" contra ")}. ${veredito}.`;
}

/** Monta o texto da revisão. Pura: mesmo dado, mesmo texto. */
export function montarRevisao(e: EntradaRevisao): Revisao {
  const { periodo, painel } = e;
  const ultimoDia = somarDias(periodo.fim, -1);
  const semana = `${dia(periodo.inicio)} a ${dia(ultimoDia)}`;
  const resumo = resumoDaSemana(e.eventos, periodo);
  const total = resumo.reduce((s, c) => ({ e: s.e + c.enviados, r: s.r + c.respostas, m: s.m + c.reunioes }), { e: 0, r: 0, m: 0 });

  const linhas: string[] = [`Revisão semanal do outbound, semana de ${semana}`, ""];

  linhas.push("Na semana");
  if (resumo.length === 0) linhas.push("- Nenhum envio, resposta ou reunião registrados.");
  for (const c of resumo) linhas.push(`- ${ROTULO_CANAL[c.canal] ?? c.canal}: envios ${c.enviados}, respostas ${c.respostas}, reuniões marcadas ${c.reunioes}`);

  linhas.push("", "Metas contra o real (acumulado do piloto)");
  for (const m of painel.metas) {
    if (m.real === null) linhas.push(`- ${m.rotulo}: sem dados${m.faltando ? ` (${m.faltando})` : ""}`);
    else linhas.push(`- ${m.rotulo}: ${pct(m.real)} contra meta de ${pct(m.meta)}, ${m.situacao === "na_meta" ? "na meta" : "abaixo"}${m.amostraPequena ? " (amostra pequena)" : ""}`);
  }

  const melhores = [...painel.segmentos].filter((s) => s.respostas > 0 || s.reunioes > 0).sort((a, b) => b.reunioes - a.reunioes || b.respostas - a.respostas || b.contatados - a.contatados).slice(0, 3);
  linhas.push("", "Segmentos com mais retorno (acumulado)");
  if (melhores.length === 0) linhas.push("- Ainda sem resposta ou reunião por segmento.");
  else for (const s of melhores) linhas.push(`- ${s.nome}: ${s.contatados} contatados, ${s.respostas} respostas, ${s.reunioes} reuniões`);

  const testes = e.testes ?? medirVariantes(e.eventos);
  linhas.push("", "Testes A/B (ganchos, assuntos e convites)");
  if (testes.length === 0) linhas.push("- Nenhuma variante com envio registrado ainda.");
  else for (const t of testes) linhas.push(linhaDoTeste(t));

  linhas.push("", "Motivos dos resultados (ganho e não fechar agora)");
  if (e.motivos.length === 0) linhas.push("- Nenhum motivo registrado ainda.");
  else for (const x of e.motivos.slice(0, 5)) linhas.push(`- ${ROTULO_MOTIVO[x.motivo] ?? x.motivo}: ${x.n}${x.etapa === "ganho" ? " (ganho)" : ""}`);

  linhas.push("", "Tempo de resposta: ainda não medido (depende da resposta rápida, frente F5).");

  const abaixo = painel.metas.find((m) => m.situacao === "abaixo");
  linhas.push("", "Decisão da semana");
  linhas.push(abaixo ? `- ${abaixo.rotulo} está abaixo da meta. ${abaixo.regra} Mude uma variável por vez.` : "- Nenhuma meta abaixo com dado suficiente. Mantenha o ritmo e meça de novo na próxima segunda.");

  const resumoCurto =
    `Revisão semanal do outbound (${semana}): envios ${total.e}, respostas ${total.r}, reuniões marcadas ${total.m}. ` +
    (abaixo ? `Meta abaixo: ${abaixo.rotulo}. ` : "Nenhuma meta abaixo com dado suficiente. ") +
    `Detalhes no painel: ${siteConfig.url}/eahub/crm/painel`;

  return { semana, texto: linhas.join("\n"), resumo: resumoCurto };
}

export type DepsRevisao = {
  agora: Date;
  db: Pick<OutboundDb, "lerMarcador" | "criarMarcador">;
  carregar: (desde: Date) => Promise<Pick<EntradaRevisao, "painel" | "eventos" | "motivos">>;
  avisar?: (texto: string) => Promise<boolean>;
};

export type ResultadoRevisao = { status: "fora_do_horario" | "ja_gerada" | "gerada"; chave: string; avisou?: boolean };

/** Gera a revisão da semana uma única vez (a chave é o claim) e avisa o Thiago. Repetir a chamada não repete nada. */
export async function rodarRevisaoSemanal(d: DepsRevisao): Promise<ResultadoRevisao> {
  const chave = chaveDaRevisao(d.agora);
  if (!revisaoDevida(d.agora)) return { status: "fora_do_horario", chave };
  if (await d.db.lerMarcador(chave)) return { status: "ja_gerada", chave };

  const periodo = periodoDaRevisao(d.agora);
  // 60 dias para o acumulado dos testes A/B; o resumo da semana filtra o período sozinho.
  const dados = await d.carregar(somarDias(periodo.fim, -60));
  const r = montarRevisao({ periodo, ...dados });
  if (!(await d.db.criarMarcador(chave, { revisao: true, semana: r.semana, texto: r.texto, resumo: r.resumo, geradaEm: d.agora.toISOString() }))) {
    return { status: "ja_gerada", chave };
  }
  const avisou = d.avisar ? await d.avisar(r.resumo) : false;
  return { status: "gerada", chave, avisou };
}
