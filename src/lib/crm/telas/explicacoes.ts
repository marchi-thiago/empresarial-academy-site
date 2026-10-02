import type { Etapa } from "../tipos";
import type { Metas } from "./metas";

/**
 * Textos curtos das telas do CRM em linguagem simples: como cada número é calculado e o que fazer
 * quando uma lista está vazia. Ficam aqui (e não nos componentes) para serem revisados num lugar só.
 */

/** Cada número do painel, com a conta por extenso. */
export const COMO_CALCULA = {
  leads: "Todos os leads cadastrados no sistema, de qualquer origem.",
  contatados: "Leads que já receberam pelo menos uma mensagem nossa de verdade (DM, e-mail, WhatsApp, LinkedIn) ou uma ligação. Mensagem que falhou ou que só foi simulada não conta.",
  respostas: "Leads que responderam por qualquer canal. Cada lead conta uma vez.",
  reunioes: "Leads com reunião marcada ou que já passaram dela (reunião feita, proposta, ganho).",
  vendas: "Leads na etapa Ganho.",
  engajados: "Leads com 5 pontos ou mais nos últimos 7 dias. Abrir e-mail vale 1 ponto, clicar vale 3, assistir ao vídeo vale 4.",
  funil: "Quantos leads chegaram a cada passo. Quem avançou também conta nos passos anteriores, então o número nunca sobe ao avançar.",
  canais: "Só envios reais, contando cada lead uma vez por canal. Respostas são as de quem recebeu mensagem nossa, então a taxa nunca passa de 100%.",
  simulacao: "O que o sistema mandaria se o envio automático estivesse ligado. Nada saiu de verdade e nada disso entra nos outros números.",
} as const;

export const COMO_CALCULA_META: Record<keyof Metas, string> = {
  entregaEmail: "E-mails enviados menos os devolvidos, dividido pelos enviados.",
  respostaDm: "Leads que responderam à DM, dividido pelos leads que receberam DM.",
  respostaEmail: "Leads que responderam ao e-mail, dividido pelos leads que receberam e-mail.",
  respostaWhatsapp: "Leads que responderam no WhatsApp, dividido pelos leads que receberam WhatsApp.",
  respostasPositivas: "Respostas classificadas como interesse ou dúvida, dividido pelas respostas já classificadas.",
  reuniaoMarcada: "Leads contatados que marcaram reunião, dividido por todos os leads contatados.",
  comparecimento: "Reuniões que aconteceram, dividido pelas reuniões com resultado registrado no botão Reunião feita. Reagendar conta como reunião que não aconteceu.",
  reuniaoComProximoPasso: "Reuniões que terminaram em proposta ou venda, dividido pelas que aconteceram.",
};

/** Etapa vazia no Kanban: por que está vazia e o que fazer. */
export const VAZIO_ETAPA: Record<Etapa, string> = {
  captado: "Ninguém aqui. Lead novo que ainda não foi avaliado aparece nesta etapa.",
  qualificado: "Ninguém aqui. Lead avaliado e pronto para o primeiro contato aparece nesta etapa.",
  em_cadencia: "Ninguém aqui ainda: nenhum lead recebeu mensagem de verdade. Quando o envio automático for ligado, o lead vem para cá sozinho no primeiro envio.",
  engajado: "Ninguém aqui. O lead vem para cá quando abre e-mail, clica ou assiste ao vídeo e junta 5 pontos em 7 dias.",
  respondeu: "Ninguém respondeu ainda. Quando um lead responder, ele vem para cá sozinho e a cadência para.",
  reuniao_marcada: "Nenhuma reunião marcada. O lead vem para cá quando agenda pelo link ou quando você marca na Fila do dia.",
  reuniao_feita: "Nenhuma reunião feita registrada. Use o botão Reunião feita na Fila do dia depois de cada reunião.",
  proposta_enviada: "Nenhuma proposta enviada. Aparece aqui depois do resultado da reunião.",
  ganho: "Nenhuma venda ainda. Mover para Ganho pede o motivo.",
  nutricao_continua: "Ninguém aqui. Quem não fechou agora fica aqui, sem ser dado como perdido.",
  saiu_da_lista: "Ninguém pediu para sair.",
};

/** Seção vazia da Fila do dia. */
export const VAZIO_FILA = {
  respostas: "Ninguém esperando resposta sua. Quando um lead responder, ele aparece aqui no topo.",
  engajados: "Nenhum lead mostrou interesse esta semana. Eles aparecem aqui quando abrem e-mail, clicam ou assistem ao vídeo.",
  reunioes: "Nenhuma reunião hoje e nenhuma esperando resultado.",
  ligacoes: "Nenhuma ligação prevista para hoje.",
  linkedin: "Nenhum convite do LinkedIn para hoje.",
} as const;

/** Frase para a Fila vazia, conforme já houve envio real ou não. */
export function explicacaoFilaVazia(temEnvioReal: boolean): string {
  return temEnvioReal
    ? "Nada pendente agora. Volte mais tarde ou veja o Kanban."
    : "Nenhum envio real ainda: o envio automático está desligado, então ninguém respondeu nem demonstrou interesse. Quando as mensagens começarem a sair, as respostas aparecem aqui.";
}
