import { linkBuscaLinkedin } from "./contato";
import { decisorDoDossie, linkedinDoDossie, notaLinkedinDoKit } from "./dossie";
import type { InteracaoFila, LeadFila } from "./fila";
import { fimDoDia, inicioDoDia } from "./tempo";

/**
 * Fila do LinkedIn semiautomático (Plano Outbound, seção 10 - F10).
 * Funções puras: recebe leads e interações, monta a fila filtrável
 * (pendentes, enviados, aceitos) e calcula os limites anti-ban da conta gratuita.
 *
 * Regras:
 * - ZERO automação no LinkedIn (o Thiago clica manualmente).
 * - Nota de até 200 caracteres (limite da conta gratuita).
 * - Sem travessão na nota (trocado por hífen).
 * - Até 15 convites/dia e ~100/semana.
 */

export const LIMITE_CONVITES_DIA = 15;
export const LIMITE_CONVITES_SEMANA = 100;

export type StatusLinkedin = "nao_enviado" | "convite_enviado" | "aceito";

export type OrigemLinkedin = "decisor_dossie" | "seguidor_ea" | "ambos";

export type ItemFilaLinkedin = {
  leadId: number;
  nome: string;
  decisor: string;
  empresa: string | null;
  segmento: string | null;
  etapa: string;
  temperatura: string;
  pontos: number;
  statusLinkedin: StatusLinkedin;
  linkedinUrl: string;
  linkedinDireto: boolean;
  nota: string | null;
  origem: OrigemLinkedin;
  emCadenciaD2: boolean;
  enviadoEm?: string | null;
  aceitoEm?: string | null;
  whatsapp: string | null;
  instagram: string | null;
  email: string | null;
};

export type ContadoresLinkedin = {
  enviadosHoje: number;
  limiteDiario: number;
  restantesHoje: number;
  enviadosSemana: number;
  limiteSemanal: number;
  restantesSemana: number;
  atingiuLimiteDiario: boolean;
  atingiuLimiteSemanal: boolean;
};

export type FilaLinkedin = {
  pendentes: ItemFilaLinkedin[];
  enviados: ItemFilaLinkedin[];
  aceitos: ItemFilaLinkedin[];
  todos: ItemFilaLinkedin[];
  contadores: ContadoresLinkedin;
};

/** Remove travessões (— e –) substituindo por hífen e trunca em no máximo max caracteres (padrão 200). */
export function limparNotaLinkedin(texto: string | null | undefined, max = 200): string | null {
  if (!texto) return null;
  const limpo = texto
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!limpo) return null;
  if (limpo.length <= max) return limpo;
  return limpo.slice(0, max).trim();
}

/**
 * Marca que a importação da lista de seguidores da página da EA no LinkedIn grava em `fonteCaptacao`
 * (ou `source`). Tem de ser explícita: "seguidores" sozinho é também o jeito como o Hunter descreve
 * a captação de seguidores de PERFIS DE CONCORRENTES, e esses não são seguidores da EA.
 */
export const MARCA_SEGUIDOR_EA = "seguidor_pagina_ea";

/** O lead veio da lista de seguidores da página da EA (marca explícita em fonteCaptacao, source ou campanha). */
export function ehSeguidorEa(lead: { fonteCaptacao?: string | null; source?: string | null; campanha?: string | null; origem?: string | null }): boolean {
  return [lead.fonteCaptacao, lead.source, lead.campanha, lead.origem].some((v) => (v ?? "").toLowerCase().includes(MARCA_SEGUIDOR_EA));
}

/** Verifica se o dossiê tem decisor identificado ou link de perfil. */
export function temDecisorDossie(dossie: unknown): boolean {
  return Boolean(decisorDoDossie(dossie) || linkedinDoDossie(dossie));
}

/** Verifica se o lead é candidato à fila do LinkedIn (decisor no dossiê OU seguidor da página). */
export function ehCandidatoLinkedin(lead: { dossie?: unknown; fonteCaptacao?: string | null; source?: string | null; campanha?: string | null; origem?: string | null }): boolean {
  return temDecisorDossie(lead.dossie) || ehSeguidorEa(lead);
}

const t = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

// Mesmos tipos que o CRM já tem (enviado = convite enviado; entregue = convite aceito): nenhum valor novo no enum do banco.
const ehEnvioLinkedin = (i: InteracaoFila) => i.canal === "linkedin" && i.direcao === "saida" && i.tipo === "enviado";

const ehAceiteLinkedin = (i: InteracaoFila) => i.canal === "linkedin" && i.tipo === "entregue";

/** Calcula os contadores de limites da conta gratuita do LinkedIn (15/dia, 100/semana). */
export function calcularContadoresLinkedin(interacoes: InteracaoFila[], agora: Date): ContadoresLinkedin {
  const iniHoje = inicioDoDia(agora).getTime();
  const fimHoje = fimDoDia(agora).getTime();
  const iniSemana = agora.getTime() - 7 * 86_400_000;

  let enviadosHoje = 0;
  let enviadosSemana = 0;

  for (const i of interacoes) {
    if (!ehEnvioLinkedin(i)) continue;
    const time = t(i.data);
    if (Number.isNaN(time)) continue;
    if (time >= iniHoje && time <= fimHoje) enviadosHoje++;
    if (time >= iniSemana) enviadosSemana++;
  }

  const restantesHoje = Math.max(0, LIMITE_CONVITES_DIA - enviadosHoje);
  const restantesSemana = Math.max(0, LIMITE_CONVITES_SEMANA - enviadosSemana);

  return {
    enviadosHoje,
    limiteDiario: LIMITE_CONVITES_DIA,
    restantesHoje,
    enviadosSemana,
    limiteSemanal: LIMITE_CONVITES_SEMANA,
    restantesSemana,
    atingiuLimiteDiario: enviadosHoje >= LIMITE_CONVITES_DIA,
    atingiuLimiteSemanal: enviadosSemana >= LIMITE_CONVITES_SEMANA,
  };
}

/**
 * Monta a Fila do LinkedIn a partir dos leads candidatos e interações recentes.
 */
export function montarFilaLinkedin(leads: LeadFila[], interacoes: InteracaoFila[], agora: Date): FilaLinkedin {
  const porLead = new Map<number, InteracaoFila[]>();
  for (const i of interacoes) {
    const arr = porLead.get(i.leadId);
    if (arr) arr.push(i);
    else porLead.set(i.leadId, [i]);
  }
  for (const arr of porLead.values()) {
    arr.sort((a, b) => t(b.data) - t(a.data));
  }

  const contadores = calcularContadoresLinkedin(interacoes, agora);

  const todos: ItemFilaLinkedin[] = [];
  const pendentes: ItemFilaLinkedin[] = [];
  const enviados: ItemFilaLinkedin[] = [];
  const aceitos: ItemFilaLinkedin[] = [];

  for (const l of leads) {
    const temDecisor = temDecisorDossie(l.dossie);
    const seguidor = ehSeguidorEa(l);
    if (!temDecisor && !seguidor) continue;

    const intersLead = porLead.get(l.id) ?? [];
    const ultimoEnvio = intersLead.find(ehEnvioLinkedin);
    const ultimoAceite = intersLead.find(ehAceiteLinkedin);

    // Status: aceito > convite_enviado > nao_enviado
    let statusLinkedin: StatusLinkedin = "nao_enviado";
    const statusNoContato = l.entrega?.linkedin;
    if (statusNoContato === "aceito" || ultimoAceite) {
      statusLinkedin = "aceito";
    } else if (statusNoContato === "convite_enviado" || ultimoEnvio) {
      statusLinkedin = "convite_enviado";
    }

    const direto = linkedinDoDossie(l.dossie);
    const decisor = decisorDoDossie(l.dossie) ?? l.nome;
    const notaBruta = notaLinkedinDoKit(l.kit);
    const nota = limparNotaLinkedin(notaBruta, 200);

    const origem: OrigemLinkedin = temDecisor && seguidor ? "ambos" : temDecisor ? "decisor_dossie" : "seguidor_ea";
    const emCadenciaD2 = l.proximoCanal === "linkedin" && !l.pausada;

    const item: ItemFilaLinkedin = {
      leadId: l.id,
      nome: l.nome,
      decisor,
      empresa: l.empresa,
      segmento: l.segmento,
      etapa: l.etapa,
      temperatura: l.temperatura,
      pontos: l.pontos,
      statusLinkedin,
      linkedinUrl: direto ?? linkBuscaLinkedin(decisor, l.empresa),
      linkedinDireto: Boolean(direto),
      nota,
      origem,
      emCadenciaD2,
      enviadoEm: ultimoEnvio?.data ?? null,
      aceitoEm: ultimoAceite?.data ?? null,
      whatsapp: l.whatsapp,
      instagram: l.instagram,
      email: l.email,
    };

    todos.push(item);
    if (statusLinkedin === "nao_enviado") pendentes.push(item);
    else if (statusLinkedin === "convite_enviado") enviados.push(item);
    else if (statusLinkedin === "aceito") aceitos.push(item);
  }

  // Ordenação:
  // - Pendentes: quem está no D2 da cadência primeiro, depois por pontos de engajamento (mais engajados primeiro).
  pendentes.sort((a, b) => Number(b.emCadenciaD2) - Number(a.emCadenciaD2) || b.pontos - a.pontos || a.nome.localeCompare(b.nome));
  // - Enviados: enviados mais recentemente primeiro.
  enviados.sort((a, b) => (t(b.enviadoEm) || 0) - (t(a.enviadoEm) || 0) || b.pontos - a.pontos);
  // - Aceitos: aceitos mais recentemente primeiro.
  aceitos.sort((a, b) => (t(b.aceitoEm) || 0) - (t(a.aceitoEm) || 0) || b.pontos - a.pontos);
  // - Todos: pendentes no topo, depois enviados, depois aceitos.
  todos.sort((a, b) => {
    const pesoStatus = { nao_enviado: 0, convite_enviado: 1, aceito: 2 };
    if (pesoStatus[a.statusLinkedin] !== pesoStatus[b.statusLinkedin]) {
      return pesoStatus[a.statusLinkedin] - pesoStatus[b.statusLinkedin];
    }
    return b.pontos - a.pontos;
  });

  return { pendentes, enviados, aceitos, todos, contadores };
}
