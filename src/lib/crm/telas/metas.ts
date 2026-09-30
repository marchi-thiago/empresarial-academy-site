/**
 * Metas iniciais do plano (Plano Outbound, seção 4). São hipóteses: o Thiago
 * edita no global `crm-config` (grupo "Metas") depois das 2 semanas do piloto.
 * Valores em porcentagem.
 */
export type Metas = {
  entregaEmail: number;
  respostaDm: number;
  respostaEmail: number;
  respostaWhatsapp: number;
  respostasPositivas: number;
  reuniaoMarcada: number;
  comparecimento: number;
  reuniaoComProximoPasso: number;
};

export const METAS_PADRAO: Metas = {
  entregaEmail: 95,
  respostaDm: 10,
  respostaEmail: 3,
  respostaWhatsapp: 10,
  respostasPositivas: 30,
  reuniaoMarcada: 2,
  comparecimento: 70,
  reuniaoComProximoPasso: 50,
};

export function resolverMetas(doc?: Partial<Record<keyof Metas, number | null>> | null): Metas {
  const out = { ...METAS_PADRAO };
  if (!doc) return out;
  for (const k of Object.keys(out) as (keyof Metas)[]) {
    const v = doc[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100) out[k] = v;
  }
  return out;
}

/** Texto do plano: o que fazer se a meta não for batida depois de 2 semanas. */
export const REGRA_DE_DECISAO: Record<keyof Metas, string> = {
  entregaEmail: "Parar o e-mail; revisar DKIM, lista e conteúdo.",
  respostaDm: "Trocar gancho e variante; revisar segmento.",
  respostaEmail: "Trocar assunto e gancho (teste A/B).",
  respostaWhatsapp: "Revisar texto e horário; conferir saúde do chip.",
  respostasPositivas: "Revisar oferta e prova por segmento.",
  reuniaoMarcada: "Revisar CTA, página /conversa e velocidade de resposta.",
  comparecimento: "Reforçar lembretes; revisar qualificação.",
  reuniaoComProximoPasso: "Revisar roteiro da reunião e ICP.",
};

export const ROTULO_META: Record<keyof Metas, string> = {
  entregaEmail: "Entrega de e-mail",
  respostaDm: "Resposta à DM",
  respostaEmail: "Resposta ao e-mail",
  respostaWhatsapp: "Resposta ao WhatsApp",
  respostasPositivas: "Respostas positivas (das respostas)",
  reuniaoMarcada: "Reunião marcada (dos contatados)",
  comparecimento: "Comparecimento às reuniões",
  reuniaoComProximoPasso: "Reuniões com próximo passo",
};
