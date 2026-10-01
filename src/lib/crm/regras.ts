import {
  CANAIS_ENTREGA,
  ESTADOS_ENTREGA,
  ETAPAS,
  type Canal,
  type CanalEntrega,
  type Direcao,
  type Etapa,
  type StatusEntrega,
  type Temperatura,
  type Tipo,
} from "./tipos";
import type { Pesos } from "./pesos";

/**
 * Regras puras do CRM: recebem o estado do lead e um evento, devolvem o novo
 * estado. Nada aqui toca banco, relógio ou rede (o relógio entra por `agora`).
 */

export type EstadoLead = {
  etapa: Etapa;
  temperatura: Temperatura;
  pontos: number;
  cadencia: {
    pausada: boolean;
    motivoPausa: string | null;
    proximoCanal: string | null;
    /** Canais com falha definitiva: saem da cadência deste lead. */
    canaisEncerrados: string[];
    /** Quando o Thiago arrastou o card pela última vez. */
    movidoManualEm: Date | null;
  };
  statusEntrega: StatusEntrega;
  origem: {
    primeiroToqueCanal: string | null;
    primeiroToqueEm: Date | null;
    ultimoToqueCanal: string | null;
    ultimoToqueRotulo: string | null;
    reuniaoCanal: string | null;
    reuniaoToque: string | null;
    vendaCanal: string | null;
    vendaToque: string | null;
  };
  optOut: boolean;
};

export type EventoCrm = {
  canal: Canal;
  direcao: Direcao;
  tipo: Tipo;
  data: Date;
  /** Sobrescreve os pontos calculados (uso raro). */
  pontos?: number;
  metadados?: Record<string, unknown> | null;
};

export type ContextoRegras = {
  pesos: Pesos;
  /** Aberturas já registradas na janela, antes deste evento. */
  aberturasNaJanela: number;
  /** Pontos já somados na janela, antes deste evento. */
  pontosNaJanela: number;
  agora: Date;
};

export type Movimento = { de: Etapa; para: Etapa; automatico: boolean };

export type ResultadoRegras = {
  lead: EstadoLead;
  /** Pontos que este evento vale (gravado na interação). */
  pontos: number;
  movimento: Movimento | null;
};

const RANK: Record<Etapa, number> = {
  captado: 0,
  qualificado: 1,
  em_cadencia: 2,
  engajado: 3,
  respondeu: 4,
  reuniao_marcada: 5,
  reuniao_feita: 6,
  proposta_enviada: 7,
  ganho: 8,
  nutricao_continua: 1,
  saiu_da_lista: 0,
};

/** Etapas que prendem o lead: nenhuma regra automática tira dele. */
const TERMINAIS: Etapa[] = ["ganho", "saiu_da_lista"];

/** Falha que não adianta repetir (plano, seção 5: sai da cadência daquele lead). */
const MOTIVOS_DEFINITIVOS = new Set(["sem_whatsapp", "sem_botao_mensagem", "perfil_privado", "bounce_permanente"]);

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export function temperaturaDe(pontos: number, pesos: Pesos): Temperatura {
  if (pontos >= pesos.engajadoA) return "engajado";
  return pontos > 0 ? "morno" : "frio";
}

/** Quanto vale o evento, já aplicando o teto de aberturas da janela. */
export function pontosDoEvento(ev: EventoCrm, pesos: Pesos, aberturasNaJanela: number, agora: Date): number {
  const limite = agora.getTime() - pesos.janelaDias * 86_400_000;
  if (ev.data.getTime() < limite) return 0; // fora da janela de 7 dias
  if (typeof ev.pontos === "number") return ev.pontos;
  const destino = str(ev.metadados?.destino);
  switch (ev.tipo) {
    case "aberto":
      return aberturasNaJanela >= pesos.aberturasContadas ? 0 : pesos.abertura;
    case "clicado":
      return pesos.clique;
    case "deu_play":
      return pesos.video;
    case "lido":
      return ev.canal === "whatsapp" ? pesos.leitura : 0;
    case "abriu_pagina":
      if (destino === "diagnostico") return pesos.diagnostico;
      if (destino === "material" || destino === "blog") return pesos.material;
      return 0;
    default:
      return 0;
  }
}

function podeAvancar(de: Etapa, para: Etapa): boolean {
  if (TERMINAIS.includes(de)) return false;
  if (de === "nutricao_continua") return para === "respondeu" || para === "reuniao_marcada";
  return RANK[para] > RANK[de];
}

const FALHAS = new Set(["falhou", "devolvido", "sem_whatsapp"]);
const DEFINITIVOS_NO_CANAL = new Set(["devolvido", "sem_whatsapp"]);

/** Estado a que o evento leva o canal, ou null se o evento não mexe no status. */
function novoEstadoDoCanal(canal: CanalEntrega, ev: EventoCrm): string | null {
  const t = ev.tipo;
  if (canal === "email") {
    if (t === "enviado") return "enviado";
    if (t === "entregue") return "entregue";
    if (t === "aberto") return "aberto";
    if (t === "clicado") return "clicado";
    if (t === "bounce") return "devolvido";
    return null;
  }
  if (canal === "whatsapp") {
    if (t === "enviado") return "enviado";
    if (t === "entregue") return "entregue";
    if (t === "lido") return "lido";
    if (t === "falha") return str(ev.metadados?.motivo) === "sem_whatsapp" ? "sem_whatsapp" : "falhou";
    return null;
  }
  if (canal === "dm") {
    if (t === "enviado") return "enviada";
    if (t === "lido") return "vista";
    if (t === "falha") return "falhou";
    return null;
  }
  // linkedin
  if (t === "enviado") return "convite_enviado";
  if (t === "entregue") return "aceito";
  return null;
}

function aplicarEntrega(lead: EstadoLead, ev: EventoCrm) {
  if (!(CANAIS_ENTREGA as readonly string[]).includes(ev.canal)) return;
  const canal = ev.canal as CanalEntrega;
  const atual = lead.statusEntrega[canal] as string;
  const meta = ev.metadados ?? {};
  const motivo = str(meta.motivo);
  const definitiva =
    ev.tipo === "bounce"
      ? meta.temporario !== true
      : ev.tipo === "falha" && (meta.definitiva === true || (motivo !== null && MOTIVOS_DEFINITIVOS.has(motivo)));

  const novo = novoEstadoDoCanal(canal, ev);
  if (!novo) return;

  const ordem = ESTADOS_ENTREGA[canal] as readonly string[];
  // Progresso nunca anda para trás; sucesso depois de falha transitória é aceito.
  const aplica = DEFINITIVOS_NO_CANAL.has(atual)
    ? false
    : FALHAS.has(novo) || FALHAS.has(atual) || ordem.indexOf(novo) > ordem.indexOf(atual);
  if (aplica) (lead.statusEntrega as Record<string, string>)[canal] = novo;

  if (definitiva) {
    if (!lead.cadencia.canaisEncerrados.includes(canal)) lead.cadencia.canaisEncerrados.push(canal);
    if (lead.cadencia.proximoCanal === canal) lead.cadencia.proximoCanal = null;
  }
}

function pausar(lead: EstadoLead, motivo: string) {
  if (!lead.cadencia.pausada) {
    lead.cadencia.pausada = true;
    lead.cadencia.motivoPausa = motivo;
  }
}

export function copiarEstado(l: EstadoLead): EstadoLead {
  return {
    ...l,
    cadencia: { ...l.cadencia, canaisEncerrados: [...l.cadencia.canaisEncerrados] },
    statusEntrega: { ...l.statusEntrega },
    origem: { ...l.origem },
  };
}

export function aplicarEvento(entrada: EstadoLead, ev: EventoCrm, ctx: ContextoRegras): ResultadoRegras {
  const lead = copiarEstado(entrada);
  const meta = ev.metadados ?? {};
  const de = lead.etapa;
  let automatico = true;

  // Movimento automático: só avança, e nunca desfaz um movimento manual mais recente.
  // Evento fraco (envio, pontos) nunca mexe em card arrastado à mão; evento forte
  // (resposta, agendamento, descadastro) só vale se aconteceu depois do arraste.
  const mover = (alvo: Etapa, forte: boolean, forcar = false) => {
    const m = lead.cadencia.movidoManualEm;
    if (m && (!forte || m.getTime() >= ev.data.getTime())) return;
    if (forcar ? TERMINAIS.includes(lead.etapa) : !podeAvancar(lead.etapa, alvo)) return;
    lead.etapa = alvo;
  };

  aplicarEntrega(lead, ev);

  // Origem do primeiro e do último toque.
  const envioReal = ev.tipo === "enviado" && ev.direcao === "saida" && ev.canal !== "nota" && ev.canal !== "sistema";
  if (envioReal) {
    if (!lead.origem.primeiroToqueEm) {
      lead.origem.primeiroToqueCanal = ev.canal;
      lead.origem.primeiroToqueEm = ev.data;
    }
    lead.origem.ultimoToqueCanal = ev.canal;
    lead.origem.ultimoToqueRotulo = str(meta.toque) ?? lead.origem.ultimoToqueRotulo;
  }

  // Pontos na janela e temperatura.
  const pontos = pontosDoEvento(ev, ctx.pesos, ctx.aberturasNaJanela, ctx.agora);
  lead.pontos = ctx.pontosNaJanela + pontos;
  lead.temperatura = temperaturaDe(lead.pontos, ctx.pesos);

  const intencao = str(meta.intencao);
  const descadastro = ev.tipo === "descadastro" || (ev.tipo === "respondido" && intencao === "descadastro");

  if (ev.tipo === "movimento_manual") {
    automatico = false;
    const alvo = str(meta.para);
    if (alvo && (ETAPAS as readonly string[]).includes(alvo)) {
      lead.etapa = alvo as Etapa;
      lead.cadencia.movidoManualEm = ev.data;
      if (RANK[lead.etapa] >= RANK.respondeu || lead.etapa === "nutricao_continua" || lead.etapa === "saiu_da_lista") {
        pausar(lead, "movimento_manual");
      }
      if (lead.etapa === "saiu_da_lista") lead.optOut = true;
      if (lead.etapa === "ganho") {
        lead.origem.vendaCanal = str(meta.canalOrigem) ?? lead.origem.reuniaoCanal ?? lead.origem.ultimoToqueCanal;
        lead.origem.vendaToque = str(meta.toque) ?? lead.origem.reuniaoToque ?? lead.origem.ultimoToqueRotulo;
      }
    }
  } else if (descadastro) {
    mover("saiu_da_lista", true, true);
    lead.optOut = true;
    pausar(lead, "descadastro");
  } else if (ev.tipo === "respondido") {
    pausar(lead, "resposta");
    if (intencao === "nao_agora") mover("nutricao_continua", true, true);
    else mover("respondeu", true);
  } else if (ev.tipo === "agendou") {
    mover("reuniao_marcada", true);
    pausar(lead, "reuniao_marcada");
    if (lead.etapa === "reuniao_marcada" && de !== "reuniao_marcada") {
      lead.origem.reuniaoCanal = str(meta.canalOrigem) ?? lead.origem.ultimoToqueCanal;
      lead.origem.reuniaoToque = str(meta.toque) ?? lead.origem.ultimoToqueRotulo;
    }
  } else if (envioReal) {
    mover("em_cadencia", false);
  }

  if (lead.temperatura === "engajado" && ev.tipo !== "movimento_manual") mover("engajado", false);

  return {
    lead,
    pontos,
    movimento: lead.etapa !== de ? { de, para: lead.etapa, automatico } : null,
  };
}
