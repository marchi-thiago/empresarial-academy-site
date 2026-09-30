import { aplicarEvento, type EstadoLead, type EventoCrm } from "./regras";
import { resolverPesos, type Pesos } from "./pesos";
import type { Canal, Direcao, Tipo } from "./tipos";

/**
 * `registrarInteracao` é o único caminho para gravar um fato do CRM: grava a
 * linha em `interacoes` e aplica os efeitos no lead (pontos, temperatura,
 * entrega por canal, etapa, pausa). Persistência entra por `CrmDb`, então a
 * regra testa sem banco (ver payload-db.ts para a versão real).
 */

export type InteracaoJanela = { tipo: string; pontos: number };

export type CrmDb = {
  carregarLead(id: number | string): Promise<EstadoLead | null>;
  pesos(): Promise<Pesos>;
  /** Interações do lead com data >= desde. */
  interacoesDesde(leadId: number | string, desde: Date): Promise<InteracaoJanela[]>;
  /** `chave` já gravada? Dá idempotência a quem reenvia o mesmo evento. */
  existeChave(chave: string): Promise<boolean>;
  criarInteracao(dados: {
    lead: number | string;
    canal: Canal;
    direcao: Direcao;
    tipo: Tipo;
    conteudo?: string;
    pontos: number;
    metadados?: Record<string, unknown> | null;
    data: Date;
    chave?: string;
  }): Promise<number | string>;
  salvarLead(id: number | string, estado: EstadoLead): Promise<void>;
};

export type EntradaInteracao = {
  leadId: number | string;
  canal: Canal;
  direcao: Direcao;
  tipo: Tipo;
  conteudo?: string;
  pontos?: number;
  metadados?: Record<string, unknown> | null;
  data?: Date;
  /** Chave de idempotência opcional (ex.: id da mensagem no canal). */
  chave?: string;
};

export type ResultadoRegistro =
  | { ok: true; interacaoId: number | string; pontos: number; etapa: string; movimento: { de: string; para: string; automatico: boolean } | null }
  | { ok: false; motivo: "lead_nao_encontrado" | "duplicado" };

export async function registrarInteracao(
  db: CrmDb,
  entrada: EntradaInteracao,
  agora: Date = new Date(),
): Promise<ResultadoRegistro> {
  if (entrada.chave && (await db.existeChave(entrada.chave))) return { ok: false, motivo: "duplicado" };

  const lead = await db.carregarLead(entrada.leadId);
  if (!lead) return { ok: false, motivo: "lead_nao_encontrado" };

  const pesos = resolverPesos(await db.pesos());
  const data = entrada.data ?? agora;
  const desde = new Date(agora.getTime() - pesos.janelaDias * 86_400_000);
  const janela = await db.interacoesDesde(entrada.leadId, desde);

  const evento: EventoCrm = {
    canal: entrada.canal,
    direcao: entrada.direcao,
    tipo: entrada.tipo,
    data,
    pontos: entrada.pontos,
    metadados: entrada.metadados,
  };
  const r = aplicarEvento(lead, evento, {
    pesos,
    aberturasNaJanela: janela.filter((i) => i.tipo === "aberto").length,
    pontosNaJanela: janela.reduce((s, i) => s + (i.pontos || 0), 0),
    agora,
  });

  const interacaoId = await db.criarInteracao({
    lead: entrada.leadId,
    canal: entrada.canal,
    direcao: entrada.direcao,
    tipo: entrada.tipo,
    conteudo: entrada.conteudo,
    pontos: r.pontos,
    metadados: entrada.metadados,
    data,
    chave: entrada.chave,
  });
  await db.salvarLead(entrada.leadId, r.lead);

  return { ok: true, interacaoId, pontos: r.pontos, etapa: r.lead.etapa, movimento: r.movimento };
}
