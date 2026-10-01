import type { Etapa } from "@/lib/crm/tipos";
import { LIMITES } from "./config";
import { partesBr } from "./tempo";

/**
 * Nutrição mensal e pedido de indicação (Plano Outbound, seção 6 e F11). Funções puras: quem está devido, qual post,
 * qual texto. O envio é do orquestrador (src/lib/outbound/orquestrador.ts), que trata esses toques como os outros
 * e-mails: simulação por padrão, teto de 50 por dia, janela, 1 por domínio, pausa por bounce. Sem IA: os textos são
 * fixos e só o post (título, resumo, link) vem do blog, que já recebe os artigos do EA Post.
 */

export const DIAS_ENTRE_NUTRICOES = 30;

export type PostNutricao = {
  titulo: string;
  slug: string;
  resumo: string | null;
  /** Categoria e tags do artigo, para casar com o segmento do lead. */
  temas: string[];
  publicadoEm: Date;
};

export type LeadNutricao = {
  id: number;
  nome: string;
  empresa: string | null;
  segmento: string | null;
  email: string | null;
  etapa: Etapa;
  pausada: boolean;
  /** Pediu para sair em qualquer frente (marketing, nutrição ou etapa Saiu da lista). */
  optOut: boolean;
  emailSuprimido: boolean;
  /** Respondeu "não é o momento" (intenção nao_agora). */
  naoAgora: boolean;
  /** Já recebeu o pedido de indicação. */
  indicacaoPedida: boolean;
  /** Último e-mail de nutrição ou indicação enviado. */
  ultimoEnvioEm: Date | null;
  primeiroToqueEm: Date | null;
};

export type TipoNutricao = "indicacao" | "material";

const emailValido = (v: string | null) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/**
 * Quem recebe: Nutrição contínua, ou quem terminou a cadência sem responder (em cadência há mais dias que a janela da
 * cadência). Nunca quem pediu para sair, nem e-mail suprimido ou devolvido (bounce). No máximo 1 por mês por lead.
 */
export function elegivelParaNutricao(l: LeadNutricao, agora: Date): boolean {
  if (l.optOut || l.emailSuprimido || l.etapa === "saiu_da_lista" || !emailValido(l.email)) return false;
  const cadenciaEncerrada =
    l.etapa === "em_cadencia" &&
    !l.pausada &&
    l.primeiroToqueEm !== null &&
    agora.getTime() - l.primeiroToqueEm.getTime() > LIMITES.janelaCadenciaDias * 86_400_000;
  if (l.etapa !== "nutricao_continua" && !cadenciaEncerrada) return false;
  if (l.ultimoEnvioEm && agora.getTime() - l.ultimoEnvioEm.getTime() < DIAS_ENTRE_NUTRICOES * 86_400_000) return false;
  return true;
}

/** "Não é o momento" recebe primeiro o pedido de indicação (uma vez); depois, o material do mês. */
export function tipoDeNutricao(l: LeadNutricao): TipoNutricao {
  return l.naoAgora && !l.indicacaoPedida ? "indicacao" : "material";
}

/**
 * Id do toque, que também é a chave de idempotência (`out:email:<lead>:<toque>`) e o código do rastreio
 * (só letras minúsculas, números e _). Material: 1 por mês de Brasília; indicação: 1 por lead.
 */
export function toqueDaNutricao(tipo: TipoNutricao, agora: Date): string {
  if (tipo === "indicacao") return "indicacao";
  const p = partesBr(agora);
  return `nutr_${p.ano}_${String(p.mes).padStart(2, "0")}`;
}

export const ehToqueDeNutricao = (toque: string): boolean => toque === "indicacao" || /^nutr_\d{4}_\d{2}$/.test(toque);

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const palavras = (s: string): Set<string> => new Set(semAcento(s).split(/[^a-z0-9]+/).filter((p) => p.length >= 4));

/**
 * O post mais recente que combina com o segmento do lead (palavra do segmento na categoria, nas tags ou no título).
 * Sem combinação, o mais recente do blog (`combina: false`). Sem posts, null: nada é inventado.
 */
export function escolherPost(posts: readonly PostNutricao[], segmento: string | null): { post: PostNutricao; combina: boolean } | null {
  if (posts.length === 0) return null;
  const recentes = [...posts].sort((a, b) => b.publicadoEm.getTime() - a.publicadoEm.getTime() || a.slug.localeCompare(b.slug));
  const alvo = palavras(segmento ?? "");
  if (alvo.size > 0) {
    const achado = recentes.find((p) => {
      const nos = palavras(`${p.temas.join(" ")} ${p.titulo}`);
      return [...alvo].some((w) => nos.has(w));
    });
    if (achado) return { post: achado, combina: true };
  }
  return { post: recentes[0], combina: false };
}

const limparResumo = (s: string | null) =>
  (s ?? "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

/** Primeira ou duas primeiras frases do resumo, até ~220 caracteres, sem cortar frase no meio. */
export function recorteDoResumo(resumo: string | null, max = 220): string {
  const r = limparResumo(resumo);
  if (!r) return "";
  const frases = r.match(/[^.!?]+[.!?]+/g)?.map((f) => f.trim()) ?? [r];
  let saida = "";
  for (const f of frases) {
    if (saida && (saida + " " + f).length > max) break;
    saida = saida ? `${saida} ${f}` : f;
  }
  return saida.length > max ? `${saida.slice(0, max - 1).trim()}…` : saida;
}

export type TextoNutricao = {
  assunto: string;
  /** Partes no formato do kit do e-mail (F7, toque curto). */
  kit: { gancho: string; insight?: string; convite: string };
  /** Link do post, para o render mostrar "Leitura do mês" (material). */
  leitura?: { titulo: string; link: string };
};

/** Textos fixos (voz do Branding v3: direto, sem promessa, sem travessão). `{{...}}` já vem preenchido aqui. */
export function textoDaNutricao(
  tipo: TipoNutricao,
  d: { nome: string; empresa: string | null; post: PostNutricao | null; combina: boolean; linkDoPost: string | null },
): TextoNutricao | null {
  if (tipo === "indicacao") {
    return {
      assunto: d.nome ? `${d.nome}, uma pergunta rápida` : "Uma pergunta rápida",
      kit: {
        gancho: "Entendi que agora não é o momento, e está tudo certo. Não vou insistir.",
        insight:
          "Fica só uma pergunta: você conhece algum dono de empresa que esteja organizando a gestão e toparia uma conversa? Se lembrar de alguém, responda este e-mail com o nome, e eu só faço contato se a pessoa autorizar.",
        convite: "Quando o momento mudar para você, são 20 minutos. O link mostra os horários.",
      },
    };
  }
  if (!d.post || !d.linkDoPost) return null;
  const resumo = recorteDoResumo(d.post.resumo);
  return {
    assunto: d.post.titulo,
    kit: {
      gancho: d.combina
        ? "Faz um tempo que conversamos e não quero ser insistente. Publiquei um texto que combina com o que vejo na rotina de empresas do seu segmento."
        : "Faz um tempo que conversamos e não quero ser insistente. Publiquei um texto que pode servir para a rotina de quem toca uma empresa.",
      insight: resumo || undefined,
      convite: "Se fizer sentido conversar 20 minutos sobre isso, o link mostra os horários. Se não, tudo bem.",
    },
    leitura: { titulo: d.post.titulo, link: d.linkDoPost },
  };
}

export type ItemNutricao = { lead: LeadNutricao; tipo: TipoNutricao; toque: string; post: PostNutricao | null; combina: boolean };

/** Quem recebe hoje: elegíveis, com o tipo, o toque e o post de cada um. Material sem post no blog fica de fora. */
export function planejarNutricao(leads: readonly LeadNutricao[], posts: readonly PostNutricao[], agora: Date): ItemNutricao[] {
  const itens: ItemNutricao[] = [];
  for (const lead of leads) {
    if (!elegivelParaNutricao(lead, agora)) continue;
    const tipo = tipoDeNutricao(lead);
    const escolha = tipo === "material" ? escolherPost(posts, lead.segmento) : null;
    if (tipo === "material" && !escolha) continue;
    itens.push({ lead, tipo, toque: toqueDaNutricao(tipo, agora), post: escolha?.post ?? null, combina: escolha?.combina ?? false });
  }
  // Indicação primeiro (é resposta a um "não agora" recente), depois quem espera há mais tempo.
  return itens.sort(
    (a, b) =>
      Number(b.tipo === "indicacao") - Number(a.tipo === "indicacao") ||
      (a.lead.ultimoEnvioEm?.getTime() ?? 0) - (b.lead.ultimoEnvioEm?.getTime() ?? 0) ||
      a.lead.id - b.lead.id,
  );
}
