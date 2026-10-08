/**
 * Limites e chaves do orquestrador de outbound (Plano Outbound, seção 9).
 * As chaves vêm de variáveis de ambiente e começam DESLIGADAS: sem elas o sistema só simula.
 */

export const LIMITES = {
  emailPorDia: 50,
  /** Intervalo aleatório entre e-mails, em minutos (inclusive). */
  intervaloMinMin: 5,
  intervaloMaxMin: 15,
  /** Janela do e-mail, hora de Brasília: de 8h até 22h (exclusivo), segunda a sexta (estendido a pedido do Thiago). */
  janelaEmail: { de: 8, ate: 22 },
  /** Meta do dia: o teto deve sair até esta hora (manhã, para dar tempo de resposta). Depois dela, até `janelaEmail.ate`, só recupera o que faltou. */
  metaEmailAte: 12,
  /** Pausa do dia quando o bounce passa de 3% (com pelo menos `bounceAmostraMin` envios). */
  bounceMax: 0.03,
  bounceAmostraMin: 10,
  /** Com menos envios que a amostra mínima, esta quantidade de bounces já pausa. */
  bounceSemAmostra: 2,
  /** Só lead cujo 1º toque foi há no máximo isto entra na cadência (D14 mais folga). Depois é nutrição mensal (F11). */
  janelaCadenciaDias: 21,
  /** Dois e-mails ao mesmo lead precisam de pelo menos isto de distância. */
  diasMinimosEntreEmails: 2,
} as const;

/** Provedores gratuitos: milhares de empresas diferentes por domínio, então a regra "1 por domínio por dia" não vale para eles. */
export const DOMINIOS_LIVRES = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com", "msn.com", "yahoo.com", "yahoo.com.br",
  "icloud.com", "me.com", "uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br", "globo.com", "globomail.com",
  "protonmail.com", "proton.me", "zipmail.com.br", "r7.com", "oi.com.br",
]);

export const CANAIS_DE_ENVIO = ["email", "dm", "whatsapp", "linkedin", "ligacao"] as const;
export type CanalDeEnvio = (typeof CANAIS_DE_ENVIO)[number];

type Env = Record<string, string | undefined>;

const ligada = (v: string | undefined) => ["1", "true", "sim", "on"].includes((v ?? "").trim().toLowerCase());

/**
 * `OUTBOUND_ENVIO_REAL=email` (lista separada por vírgula) liga o envio real daquele canal.
 * Ausente ou vazia: tudo em simulação. Hoje só o e-mail é enviado por este orquestrador;
 * os outros canais leem a mesma chave quando suas frentes (Hunter, EA Flow) entrarem.
 */
export function canaisComEnvioReal(env: Env = process.env): Set<CanalDeEnvio> {
  const lista = (env.OUTBOUND_ENVIO_REAL ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return new Set(CANAIS_DE_ENVIO.filter((c) => lista.includes(c)));
}

export function envioRealLigado(canal: CanalDeEnvio, env: Env = process.env): boolean {
  return canaisComEnvioReal(env).has(canal);
}

/** Leitura de respostas e bounces da caixa comercial@ (precisa de Mail.Read.Shared, pendência do Thiago). */
export function lerCaixaLigado(env: Env = process.env): boolean {
  return ligada(env.OUTBOUND_LER_CAIXA);
}

export function tetoEmailPorDia(env: Env = process.env): number {
  const n = Number(env.OUTBOUND_EMAIL_TETO_DIA);
  return Number.isInteger(n) && n > 0 ? n : LIMITES.emailPorDia;
}

export const REMETENTE = {
  address: "comercial@empresarialacademy.com",
  name: "Thiago Marchi | Empresarial Academy",
} as const;
