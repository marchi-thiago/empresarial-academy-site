import { normalizarChave } from "@/lib/crm/telas/dossie";

/**
 * Lê do kit de mensagens do lead (JSON gravado pelo EA Hunter, F2) as partes do e-mail de cada toque
 * (gancho, dor, ponte, convite, assunto...), que a F7 monta em carta (src/lib/outbound/email/render.ts).
 * Tolerante: aceita `email1: {...}`, `emails: [{...}, {...}]` ou aninhado em até dois níveis.
 */

export type PartesDoEmail = Record<string, unknown>;

const ehObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Nomes aceitos para cada toque, em ordem de preferência. O último toque é `dm3` no kit do Hunter (porta aberta com o
 * link do diagnóstico, escrita para DM): serve de texto do e-mail quando não há um e-mail do último toque.
 */
const NOMES: Record<string, string[]> = {
  email1: ["email1"],
  email2: ["email2"],
  ultimo: ["emailultimotoque", "ultimotoque", "ultimo", "portaaberta", "email3", "dm3"],
};
const INDICE_EM_LISTA: Record<string, number> = { email1: 0, email2: 1, ultimo: 2 };

function achar(v: unknown, nomes: string[], nivel = 0): unknown {
  if (!ehObj(v) || nivel > 2) return undefined;
  for (const nome of nomes) {
    for (const [k, x] of Object.entries(v)) if (normalizarChave(k) === nome) return x;
  }
  for (const x of Object.values(v)) {
    const r = achar(x, nomes, nivel + 1);
    if (r !== undefined) return r;
  }
  return undefined;
}

/** Tem o mínimo para virar carta: gancho, dor ou dica (a F7 recusa kit sem isso). */
export function temCorpo(partes: PartesDoEmail): boolean {
  return Object.keys(partes).some((k) => {
    const n = normalizarChave(k);
    return (n.startsWith("gancho") || n.startsWith("dor") || n.startsWith("insight") || n.startsWith("dica")) && JSON.stringify(partes[k] ?? "").length > 2;
  });
}

/** Saudação de abertura de DM ("Oi, Marcos!", "Olá, Marcos,", "Oi!") que não cabe numa carta que já abre com "Olá, Nome,". */
const SAUDACAO_DE_DM = /^\s*(?:[Oo]i|[Oo]l[aá])(?!\p{L})(?:[,!]\s*[\p{Lu}][\p{L}'-]*(?:\s+[\p{Lu}][\p{L}'-]*){0,2}\s*[,!]|[,!](?=\s+\p{Lu}))\s+/u;

/**
 * Parte do kit que chega como texto simples (o Hunter grava `email2` e `dm3` assim) ou como lista de frases:
 * vira o corpo do e-mail curto (`dica`); no e-mail 1 vira o `gancho`.
 */
function partesDeTexto(v: unknown, toque: string): PartesDoEmail | null {
  const texto = typeof v === "string" ? v : Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string") ? v.join("\n\n") : null;
  const limpo = texto?.replace(SAUDACAO_DE_DM, "").trim();
  if (!limpo) return null;
  return toque === "email1" ? { gancho: limpo } : { dica: limpo };
}

function comoPartes(v: unknown, toque: string): PartesDoEmail | null {
  if (ehObj(v)) return temCorpo(v) ? v : null;
  return partesDeTexto(v, toque);
}

export function partesDoKit(kit: unknown, toque: string): PartesDoEmail | null {
  let dados = kit;
  if (typeof dados === "string") {
    try {
      dados = JSON.parse(dados);
    } catch {
      return null;
    }
  }
  const nomes = NOMES[toque] ?? [normalizarChave(toque)];
  const direto = comoPartes(achar(dados, nomes), toque);
  if (direto) return direto;
  const lista = achar(dados, ["emails"]);
  if (Array.isArray(lista) && toque in INDICE_EM_LISTA) return comoPartes(lista[INDICE_EM_LISTA[toque]], toque);
  return null;
}

/** Aplica `f` a todo texto do objeto (profundidade qualquer), sem mexer na estrutura. */
export function mapearTextos<T>(v: T, f: (s: string) => string): T {
  if (typeof v === "string") return f(v) as T;
  if (Array.isArray(v)) return v.map((x) => mapearTextos(x, f)) as T;
  if (ehObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapearTextos(x, f)])) as T;
  return v;
}
