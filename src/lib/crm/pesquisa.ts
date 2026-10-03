/**
 * Pesquisa registrada pelo EA Hunter dentro do JSON `dossie` (chave `pesquisa`). Sem coluna nova:
 * a leitura é defensiva, o dossiê pode ser nulo, texto, ter outra forma ou itens malformados.
 * Item inválido é ignorado; nada aqui lança erro.
 */

export const FONTES_PESQUISA = ["instagram", "site", "cnpj", "linkedin", "manual"] as const;
export type FontePesquisa = (typeof FONTES_PESQUISA)[number];

export const CONFIANCAS_PESQUISA = ["confirmado", "indicio", "hipotese"] as const;
export type ConfiancaPesquisa = (typeof CONFIANCAS_PESQUISA)[number];

/** Fontes que contam na linha de cobertura (manual é anotação, não uma fonte a consultar). */
export const FONTES_COBERTURA = ["instagram", "site", "cnpj", "linkedin"] as const;
export type FonteCobertura = (typeof FONTES_COBERTURA)[number];

export const ROTULO_FONTE: Record<FontePesquisa, string> = {
  instagram: "Instagram",
  site: "Site",
  cnpj: "CNPJ",
  linkedin: "LinkedIn",
  manual: "Manual",
};

/** Sigla curta para o card. */
export const SIGLA_FONTE: Record<FonteCobertura, string> = { instagram: "IG", site: "Site", cnpj: "CNPJ", linkedin: "LI" };

export const ROTULO_CONFIANCA: Record<ConfiancaPesquisa, string> = {
  confirmado: "Confirmado",
  indicio: "Indício",
  hipotese: "Hipótese",
};

export type ItemPesquisa = {
  fonte: FontePesquisa;
  rotulo: string;
  valor: string;
  link?: string;
  /** ISO 8601. */
  consultadoEm: string;
  confianca: ConfiancaPesquisa;
};

export const LIMITE_PESQUISA = 20;
const MAX_TEXTO = 1000;

const ehObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const texto = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, MAX_TEXTO) : null;
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

const noConjunto = <T extends string>(lista: readonly T[], v: unknown): T | null => {
  if (typeof v !== "string") return null;
  const n = semAcento(v.trim().toLowerCase());
  return lista.find((x) => x === n) ?? null;
};

/** Só endereços http(s); qualquer outra coisa (javascript:, texto solto) é descartada. */
const linkSeguro = (v: unknown): string | undefined => {
  const t = texto(v);
  if (!t) return undefined;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
};

function lerItem(bruto: unknown): ItemPesquisa | null {
  if (!ehObj(bruto)) return null;
  const fonte = noConjunto(FONTES_PESQUISA, bruto.fonte);
  const rotulo = texto(bruto.rotulo);
  const valor = texto(bruto.valor);
  const confianca = noConjunto(CONFIANCAS_PESQUISA, bruto.confianca);
  const dataTxt = texto(bruto.consultadoEm);
  if (!fonte || !rotulo || !valor || !confianca || !dataTxt) return null;
  const data = new Date(dataTxt);
  if (Number.isNaN(data.getTime())) return null;
  const item: ItemPesquisa = { fonte, rotulo, valor, consultadoEm: data.toISOString(), confianca };
  const link = linkSeguro(bruto.link);
  if (link) item.link = link;
  return item;
}

/** O campo json pode chegar como texto (importação antiga). */
function comoObjeto(d: unknown): unknown {
  if (typeof d !== "string") return d;
  try {
    return JSON.parse(d);
  } catch {
    return null;
  }
}

/**
 * Itens de pesquisa válidos do dossiê, ordenados por fonte (instagram, site, cnpj, linkedin, manual) e,
 * dentro da fonte, do mais recente para o mais antigo. `limite` corta a lista (padrão 20).
 */
export function lerPesquisa(dossie: unknown, limite: number = LIMITE_PESQUISA): ItemPesquisa[] {
  const dados = comoObjeto(dossie);
  if (!ehObj(dados)) return [];
  const brutos = comoObjeto(dados.pesquisa);
  if (!Array.isArray(brutos)) return [];
  const itens = brutos.map(lerItem).filter((x): x is ItemPesquisa => x !== null);
  itens.sort(
    (a, b) =>
      FONTES_PESQUISA.indexOf(a.fonte) - FONTES_PESQUISA.indexOf(b.fonte) ||
      Date.parse(b.consultadoEm) - Date.parse(a.consultadoEm),
  );
  return itens.slice(0, Math.max(0, limite));
}

/** Fontes já consultadas (instagram, site, cnpj, linkedin), em ordem fixa e sem repetição. */
export function coberturaDePesquisa(itens: readonly Pick<ItemPesquisa, "fonte">[]): FonteCobertura[] {
  return FONTES_COBERTURA.filter((f) => itens.some((i) => i.fonte === f));
}

/** Atalho para o card: cobertura lida direto do dossiê, sem o corte de 20 itens. */
export function coberturaDoDossie(dossie: unknown): FonteCobertura[] {
  return coberturaDePesquisa(lerPesquisa(dossie, Infinity));
}
