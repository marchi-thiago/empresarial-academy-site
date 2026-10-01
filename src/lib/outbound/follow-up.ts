import { dataIso, inicioDoDia } from "./tempo";

/**
 * Follow-up da proposta (Plano Outbound, seção 8): D2, D5 e D10 depois que o lead entra em "Proposta enviada".
 * Nunca encerra o contato (decisão 6): o último toque deixa a porta aberta com o link do diagnóstico.
 */

export const PASSOS_FOLLOW_UP = [2, 5, 10] as const;
export type PassoFollowUp = (typeof PASSOS_FOLLOW_UP)[number];

/** Dias de calendário (Brasília) entre a proposta e `agora`. */
export function diasDesde(proposta: Date, agora: Date): number {
  return Math.round((inicioDoDia(agora).getTime() - inicioDoDia(proposta).getTime()) / 86_400_000);
}

/** Passo vigente: o maior de D2, D5 e D10 que já chegou. Quem decide se já foi feito é quem chama (chave por passo). */
export function passoVigente(proposta: Date, agora: Date): PassoFollowUp | null {
  const dias = diasDesde(proposta, agora);
  return [...PASSOS_FOLLOW_UP].reverse().find((p) => dias >= p) ?? null;
}

export const chaveFollowUp = (leadId: number, proposta: Date, passo: PassoFollowUp) => `followup:${leadId}:${dataIso(proposta)}:D${passo}`;

export type TextoFollowUp = { assunto: string; texto: string };

export function textoFollowUp(passo: PassoFollowUp, v: { nome: string; empresa: string | null; linkDiagnostico: string }): TextoFollowUp {
  const empresa = v.empresa ? `da ${v.empresa}` : "da sua empresa";
  if (passo === 2) {
    return {
      assunto: "Conseguiu ver a proposta?",
      texto: `Oi, ${v.nome}, tudo bem? Passando para saber se você conseguiu ver a proposta que te enviei. Se surgiu alguma dúvida, me chama que eu respondo ainda hoje.\n\nThiago Marchi`,
    };
  }
  if (passo === 5) {
    return {
      assunto: "A proposta faz sentido para agora?",
      texto: `Oi, ${v.nome}. Queria entender se a proposta faz sentido para o momento ${empresa} ou se a prioridade agora é outra. Pode ser direto comigo: qualquer resposta ajuda.\n\nThiago Marchi`,
    };
  }
  return {
    assunto: "Deixo a porta aberta",
    texto: `Oi, ${v.nome}. Como não tive retorno, imagino que o foco tenha mudado, e tudo bem. Deixo a porta aberta: quando quiser rever a gestão ${empresa}, o diagnóstico gratuito está aqui: ${v.linkDiagnostico}\n\nE se fizer sentido conversar de novo, é só me chamar.\n\nThiago Marchi`,
  };
}
