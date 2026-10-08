import { DOMINIOS_LIVRES, LIMITES } from "./config";
import { dataIso, emBrasilia, partesBr, somarDias } from "./tempo";

/**
 * Regras do dia de e-mail (Plano Outbound, seção 9): janela, teto, intervalo aleatório,
 * 1 por domínio por dia e pausa por bounce. Puro: o relógio e o sorteio entram por parâmetro.
 */

export type CandidatoEmail = {
  leadId: number;
  toque: string;
  para: string;
  /** Engajado e morno antes do frio. */
  prioridade: number;
  devidoEm: Date;
};

export type EnvioDoDia = { dominio: string; em: Date; proximoEnvioApos?: Date | null; leadId?: number; para?: string };

export type ItemPlano = CandidatoEmail & { dominio: string; horarioPrevisto: Date };

export type Descartado = { leadId: number; motivo: "dominio_no_dia" | "duplicado" | "fora_da_janela" | "teto" };

export type Pausa = "bounce" | "fora_da_janela" | "teto";

export function dominioDe(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

/** Domínio corporativo conta na regra "1 por dia"; provedor gratuito não. */
export const dominioContaNaRegra = (dominio: string) => dominio !== "" && !DOMINIOS_LIVRES.has(dominio);

/** Pausa automática do dia quando o bounce passa de 3%. */
export function pausaPorBounce(enviadosHoje: number, bouncesHoje: number): boolean {
  if (enviadosHoje >= LIMITES.bounceAmostraMin) return bouncesHoje / enviadosHoje > LIMITES.bounceMax;
  return bouncesHoje >= LIMITES.bounceSemAmostra;
}

export const emJanelaDeEmail = (d: Date) => {
  const p = partesBr(d);
  // Todos os dias, inclusive fim de semana (decisão do Thiago, 08/10/2026).
  return p.hora >= LIMITES.janelaEmail.de && p.hora < LIMITES.janelaEmail.ate;
};

/**
 * De quando o plano vale: agora, se estamos na janela; senão o início da próxima janela
 * (hoje às 8h se ainda não abriu; amanhã às 8h se já fechou).
 */
export function referenciaDoPlano(agora: Date): { inicio: Date; naJanela: boolean } {
  if (emJanelaDeEmail(agora)) return { inicio: agora, naJanela: true };
  const abre = emBrasilia(dataIso(agora), `${String(LIMITES.janelaEmail.de).padStart(2, "0")}:00`);
  if (agora.getTime() < abre.getTime()) return { inicio: abre, naJanela: false };
  const prox = somarDias(agora, 1);
  return { inicio: emBrasilia(dataIso(prox), `${String(LIMITES.janelaEmail.de).padStart(2, "0")}:00`), naJanela: false };
}

/**
 * Intervalo até o próximo e-mail, em ms. Espalha o que FALTA do teto até a meta da manhã (`metaEmailAte`),
 * com variação de 60% a 140% da média (média de no máximo 15 min, piso de 1 min). Passou da meta (recuperação do que faltou): ritmo de ~4 min.
 * Nasce com o teto de 50 e a meta de 12h: média de ~5 min, igual ao ritmo do orquestrador (1 e-mail por chamada, a cada 5 min).
 */
export function intervaloParaMeta(de: Date, restante: number, rand: () => number): number {
  const meta = emBrasilia(dataIso(de), `${String(LIMITES.metaEmailAte).padStart(2, "0")}:00`).getTime();
  const folga = meta - de.getTime();
  const media = folga > 0 && restante > 0 ? Math.min(LIMITES.intervaloMaxMin * 60_000, folga / restante) : 4 * 60_000;
  const min = Math.max(60_000, media * 0.6);
  const max = Math.max(min, media * 1.4);
  return Math.round(min + rand() * (max - min));
}

/** Intervalo aleatório de 5 a 15 minutos, em ms (legado: o plano agora usa `intervaloParaMeta`). */
export function intervaloAleatorio(rand: () => number): number {
  const { intervaloMinMin: a, intervaloMaxMin: b } = LIMITES;
  return (a + Math.floor(rand() * (b - a + 1))) * 60_000;
}

export type EntradaPlano = {
  candidatos: CandidatoEmail[];
  /** Envios REAIS do dia do plano (para teto, domínio e intervalo). */
  enviadosHoje: EnvioDoDia[];
  bouncesHoje: number;
  agora: Date;
  teto: number;
  rand: () => number;
};

export type Plano = {
  inicio: Date;
  naJanela: boolean;
  /** A partir de quando o próximo e-mail pode sair (respeita o intervalo desde o último envio real). */
  liberadoEm: Date;
  pausa: Pausa | null;
  itens: ItemPlano[];
  descartados: Descartado[];
};

export function planejarEmails(e: EntradaPlano): Plano {
  const { inicio, naJanela } = referenciaDoPlano(e.agora);
  const dia = dataIso(inicio);
  const hoje = e.enviadosHoje.filter((x) => dataIso(x.em) === dia);
  const base: Plano = { inicio, naJanela, liberadoEm: inicio, pausa: null, itens: [], descartados: [] };

  // Decisão do Thiago (08/10/2026): bounce NÃO pausa o dia; o envio segue até o teto. O alerta (alertas.ts) continua avisando.
  // ponytail: sem freio automático, bounce alto pode queimar a reputação do comercial@; reativar pausaPorBounce aqui se o domínio cair em spam.
  const restante = e.teto - hoje.length;
  if (restante <= 0) return { ...base, pausa: "teto" };

  const dominiosUsados = new Set(hoje.map((x) => x.dominio).filter(dominioContaNaRegra));
  const ultimo = [...hoje].sort((a, b) => b.em.getTime() - a.em.getTime())[0];
  let relogio = inicio.getTime();
  if (ultimo) relogio = Math.max(relogio, ultimo.proximoEnvioApos?.getTime() ?? ultimo.em.getTime() + intervaloParaMeta(ultimo.em, restante, e.rand));
  base.liberadoEm = new Date(relogio);
  const fechaEm = emBrasilia(dia, `${String(LIMITES.janelaEmail.ate).padStart(2, "0")}:00`).getTime();

  const ordenados = [...e.candidatos].sort((a, b) => a.prioridade - b.prioridade || a.devidoEm.getTime() - b.devidoEm.getTime() || a.leadId - b.leadId);
  const leadsVistos = new Set<number>();
  for (const c of ordenados) {
    if (leadsVistos.has(c.leadId)) {
      base.descartados.push({ leadId: c.leadId, motivo: "duplicado" });
      continue;
    }
    leadsVistos.add(c.leadId);
    const dominio = dominioDe(c.para);
    if (dominioContaNaRegra(dominio) && dominiosUsados.has(dominio)) {
      base.descartados.push({ leadId: c.leadId, motivo: "dominio_no_dia" });
      continue;
    }
    if (base.itens.length >= restante) {
      base.descartados.push({ leadId: c.leadId, motivo: "teto" });
      continue;
    }
    if (relogio >= fechaEm) {
      base.descartados.push({ leadId: c.leadId, motivo: "fora_da_janela" });
      continue;
    }
    if (dominioContaNaRegra(dominio)) dominiosUsados.add(dominio);
    base.itens.push({ ...c, dominio, horarioPrevisto: new Date(relogio) });
    relogio += intervaloParaMeta(new Date(relogio), restante - base.itens.length, e.rand);
  }
  return base;
}
