/**
 * Vocabulário do CRM do EA Leads (Plano Outbound, seção 5). Fonte única: as
 * coleções `leads` e `interacoes` importam estas listas para montar as opções.
 */

export const ETAPAS = [
  "captado",
  "qualificado",
  "em_cadencia",
  "engajado",
  "respondeu",
  "reuniao_marcada",
  "reuniao_feita",
  "proposta_enviada",
  "ganho",
  "nutricao_continua",
  "saiu_da_lista",
] as const;
export type Etapa = (typeof ETAPAS)[number];

export const ETAPA_ROTULO: Record<Etapa, string> = {
  captado: "Captado",
  qualificado: "Qualificado",
  em_cadencia: "Em cadência",
  engajado: "Engajado",
  respondeu: "Respondeu",
  reuniao_marcada: "Reunião marcada",
  reuniao_feita: "Reunião feita",
  proposta_enviada: "Proposta enviada",
  ganho: "Ganho",
  nutricao_continua: "Nutrição contínua",
  saiu_da_lista: "Saiu da lista",
};

/** Valores que já existem em dados reais de `dealStatus` antes do CRM. */
export const ETAPA_LEGADA: Record<string, Etapa> = {
  em_andamento: "qualificado",
  perdido: "nutricao_continua", // nunca "perdido" sem pedido do cliente (plano, seção 5)
};

export function etapaDe(valor: string | null | undefined): Etapa {
  if (valor && (ETAPAS as readonly string[]).includes(valor)) return valor as Etapa;
  if (valor && valor in ETAPA_LEGADA) return ETAPA_LEGADA[valor];
  return "qualificado";
}

export const CANAIS = ["email", "whatsapp", "dm", "ligacao", "linkedin", "nota", "sistema"] as const;
export type Canal = (typeof CANAIS)[number];

/** Canais com status de entrega marcado no contato. */
export const CANAIS_ENTREGA = ["email", "whatsapp", "dm", "linkedin"] as const;
export type CanalEntrega = (typeof CANAIS_ENTREGA)[number];

export const DIRECOES = ["entrada", "saida"] as const;
export type Direcao = (typeof DIRECOES)[number];

export const TIPOS = [
  "enviado",
  "entregue",
  "aberto",
  "clicado",
  "lido",
  "respondido",
  "bounce",
  "falha",
  "resultado_ligacao",
  "movimento_manual",
  "lembrete",
  "agendou",
  "deu_play",
  "abriu_pagina",
  "descadastro",
  "linkedin_convite_enviado",
  "linkedin_aceito",
  "revisao_semanal",
] as const;
export type Tipo = (typeof TIPOS)[number];

export const TEMPERATURAS = ["frio", "morno", "engajado"] as const;
export type Temperatura = (typeof TEMPERATURAS)[number];

/** Estados por canal (plano, seção 5). O primeiro de cada lista é o inicial. */
export const ESTADOS_ENTREGA = {
  email: ["nao_enviado", "enviado", "entregue", "devolvido", "aberto", "clicado"],
  whatsapp: ["nao_enviado", "enviado", "entregue", "lido", "falhou", "sem_whatsapp"],
  dm: ["nao_enviada", "enviada", "vista", "falhou"],
  linkedin: ["nao_enviado", "convite_enviado", "aceito"],
} as const;

export type StatusEntrega = { [C in CanalEntrega]: (typeof ESTADOS_ENTREGA)[C][number] };

export const ROTULO_ESTADO: Record<string, string> = {
  nao_enviado: "Não enviado",
  nao_enviada: "Não enviada",
  enviado: "Enviado",
  enviada: "Enviada",
  entregue: "Entregue",
  devolvido: "Devolvido (bounce)",
  aberto: "Aberto",
  clicado: "Clicado",
  lido: "Lido",
  vista: "Vista",
  falhou: "Falhou",
  sem_whatsapp: "Número sem WhatsApp",
  convite_enviado: "Convite enviado",
  aceito: "Aceito",
};

export const MOTIVOS_RESULTADO = [
  { value: "preco", label: "Preço" },
  { value: "momento", label: "Não é o momento" },
  { value: "concorrente", label: "Escolheu outra solução" },
  { value: "sem_fit", label: "Fora do perfil" },
  { value: "sem_resposta", label: "Parou de responder" },
  { value: "interno", label: "Vai resolver internamente" },
  { value: "valor_percebido", label: "Viu valor e fechou" },
  { value: "indicacao", label: "Veio por indicação" },
  { value: "outro", label: "Outro" },
] as const;

export const BASES_LEGAIS = [
  { value: "legitimo_interesse", label: "Legítimo interesse (B2B)" },
  { value: "consentimento", label: "Consentimento" },
  { value: "contrato", label: "Execução de contrato" },
] as const;

/** Como o lead é achado por um evento externo (Hunter, EA Flow). */
export type RefLead = {
  leadId?: number | string;
  hunterId?: number | string;
  instagram?: string;
  email?: string;
  whatsapp?: string;
};
