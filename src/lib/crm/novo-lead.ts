import type { Payload } from "payload";
import { encontrarLead } from "./payload-db";
import { finalDoWhatsapp, normalizarHandle } from "./identificar";
import type { Canal, Direcao, RefLead, Tipo } from "./tipos";

/**
 * Card novo para quem responde pelo EA Flow (DM ou WhatsApp) e ainda não é lead no CRM
 * (decisão do Thiago, 03/11/2026). O lead nasce em Captado, sem base legal: não entra na
 * cadência, na nutrição nem na campanha. O evento `respondido` gravado logo depois o leva
 * para Respondeu e para a Fila do dia.
 */

export type NovoLead = { nome?: string | null; empresa?: string | null };

export type DadosNovoLead = {
  name: string;
  company?: string;
  instagram?: string;
  whatsapp?: string;
  source: string;
  dealStatus: "captado";
};

const limpo = (v: unknown, max: number): string | undefined => {
  const t = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return t ? t.slice(0, max) : undefined;
};

/** Dados do lead a criar, ou null quando o evento não autoriza card novo. Função pura. */
export function dadosDoNovoLead(ev: { canal: Canal; direcao: Direcao; tipo: Tipo; lead: RefLead; novoLead: unknown }): DadosNovoLead | null {
  if (ev.tipo !== "respondido" || ev.direcao !== "entrada") return null;
  if (typeof ev.novoLead !== "object" || ev.novoLead === null || Array.isArray(ev.novoLead)) return null;
  const novo = ev.novoLead as NovoLead;
  const nome = limpo(novo.nome, 120);
  const empresa = limpo(novo.empresa, 120);

  if (ev.canal === "dm") {
    const h = ev.lead.instagram ? normalizarHandle(ev.lead.instagram) : "";
    if (!h) return null;
    return { name: nome ?? `@${h}`, company: empresa, instagram: `@${h}`, source: "EA Flow (Instagram)", dealStatus: "captado" };
  }
  if (ev.canal === "whatsapp") {
    const d = (ev.lead.whatsapp ?? "").replace(/\D/g, "");
    if (!finalDoWhatsapp(d)) return null;
    return { name: nome ?? `+${d}`, company: empresa, whatsapp: d, source: "EA Flow (WhatsApp)", dealStatus: "captado" };
  }
  return null;
}

// Duas mensagens seguidas da mesma pessoa chegam em paralelo: a segunda espera a primeira e acha o lead criado.
const emAndamento = new Map<string, Promise<number>>();

/** Cria o lead (ou devolve o que outra chamada acabou de criar). Retorna o id. */
export async function criarLeadDeResposta(payload: Payload, ref: RefLead, dados: DadosNovoLead): Promise<number> {
  const chave = dados.instagram ?? `wa:${finalDoWhatsapp(dados.whatsapp ?? "")}`;
  const pendente = emAndamento.get(chave);
  if (pendente) return pendente;

  const tarefa = (async () => {
    const existente = await encontrarLead(payload, ref);
    if (existente != null) return existente;
    const doc = await payload.create({ collection: "leads", overrideAccess: true, depth: 0, data: dados as never });
    payload.logger.info(`[crm/eventos] lead ${doc.id} criado pela resposta de ${dados.instagram ?? dados.whatsapp} (${dados.source})`);
    return doc.id as number;
  })();
  emAndamento.set(chave, tarefa);
  try {
    return await tarefa;
  } finally {
    emAndamento.delete(chave);
  }
}
