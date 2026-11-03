/**
 * Quem respondeu: pessoa, robô de atendimento ou ainda não dá para saber.
 *
 * Decisão do Thiago (03/11/2026, Projeto Funil de 7 dias): resposta de robô não é resposta. Ela fecha só o canal em
 * que veio e o lead segue nos outros; "Respondeu" fica para pessoa. No teste da campanha 12, 22 das 25 "respostas"
 * eram robô e pausaram a cadência inteira (e-mail e WhatsApp nunca saíram).
 *
 * Os padrões vêm do EA Flow (src/lib/sdr/automatica.ts) e das respostas reais da campanha 12.
 */
export type QuemRespondeu = "pessoa" | "robo" | "indefinido";

/** Prévia sem o texto (a caixa do Instagram mostra só a contagem): espera o texto real que o EA Flow manda depois. */
const SEM_TEXTO = [/^\d+ new messages?$/i, /^\(resposta recebida pelo ea flow\)$/i];

const ROBO = [
  /n[ãa]o estamos dispon[íi]veis/i,
  /estamos ausentes/i,
  /todos os nossos atendentes/i,
  /fora do (nosso )?hor[áa]rio/i,
  /em hor[áa]rio comercial/i,
  /hor[áa]rio de (atendimento|funcionamento)/i,
  /no momento n[ãa]o (podemos|conseguimos) (te |lhe )?atender/i,
  /(retornaremos|entraremos em contato|responderemos)( com voc[êe])?( assim que| em breve| o mais breve)/i,
  /em breve,? (vamos |iremos |um de nossos atendentes )?(responder|retornar|atender|entrar)/i,
  /(nosso atendente|nossa equipe|algu[ée]m) (ir[áa]|vai) (te |lhe )?(ajud|atend|respond)/i,
  /(resposta|mensagem|confirma[çc][ãa]o) autom[áa]tica/i,
  /confirma[çc][ãa]o de que recebemos/i,
  /agradecemos (a |o |pelo |pela )?(seu |sua )?(mensagem|contato|interesse)/i,
  /obrigad[oa] (por entrar em |pelo (seu )?)contato/i,
  /assistente virtual|intelig[êe]ncia artificial assistente/i,
  /this business uses ai from meta/i,
  /seja (muito )?bem[- ]?vind[oa]/i,
  /(digite|escolha|selecione|responda com) (apenas |somente )?(o n[úu]mero|uma op[çc][ãa]o|a op[çc][ãa]o)/i,
  /(envie|digite|mande) \*?#\w+/i,
  /(envie|mande) (seu |o seu )?curr[íi]culo/i,
  /para (agilizar|adiantar|facilitar|melhor) (o |seu |o seu |lhe )?atend/i,
  /(clique|acesse) (no link|aqui|nosso (site|whatsapp))/i,
  /^\S*(liked a message|reacted .{1,8} to your message)$/i,
];

export function quemRespondeu(texto: string | null | undefined): QuemRespondeu {
  const t = (texto ?? "").trim();
  // Evento sem conteúdo (caminho que não manda o texto) segue como antes: conta como pessoa.
  if (!t) return "pessoa";
  if (SEM_TEXTO.some((re) => re.test(t))) return "indefinido";
  // Texto longo de pessoa pode citar "horário de atendimento" no meio: robô é mensagem curta de abertura.
  if (t.length <= 600 && ROBO.some((re) => re.test(t))) return "robo";
  return "pessoa";
}
