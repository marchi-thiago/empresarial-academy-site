import { normalizarChave } from "@/lib/crm/telas/dossie";

/**
 * Lê do kit de mensagens do lead (JSON gravado pelo EA Hunter, F2) as partes do e-mail de cada toque
 * (gancho, dor, ponte, convite, assunto...), que a F7 monta em carta (src/lib/outbound/email/render.ts).
 * Tolerante: aceita `email1: {...}`, `emails: [{...}, {...}]` ou aninhado em até dois níveis.
 */

export type PartesDoEmail = Record<string, unknown>;

const ehObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const NOMES: Record<string, string[]> = {
  email1: ["email1"],
  email2: ["email2"],
  ultimo: ["ultimotoque", "ultimo", "portaaberta", "emailultimotoque", "email3"],
};
const INDICE_EM_LISTA: Record<string, number> = { email1: 0, email2: 1, ultimo: 2 };

function achar(v: unknown, nomes: string[], nivel = 0): unknown {
  if (!ehObj(v) || nivel > 2) return undefined;
  for (const [k, x] of Object.entries(v)) if (nomes.includes(normalizarChave(k))) return x;
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

export function partesDoKit(kit: unknown, toque: string): PartesDoEmail | null {
  let dados = kit;
  if (typeof dados === "string") {
    try {
      dados = JSON.parse(dados);
    } catch {
      return null;
    }
  }
  const direto = achar(dados, NOMES[toque] ?? [normalizarChave(toque)]);
  let partes: unknown = ehObj(direto) ? direto : undefined;
  if (!partes) {
    const lista = achar(dados, ["emails"]);
    if (Array.isArray(lista) && toque in INDICE_EM_LISTA) partes = lista[INDICE_EM_LISTA[toque]];
  }
  return ehObj(partes) && temCorpo(partes) ? partes : null;
}

/** Aplica `f` a todo texto do objeto (profundidade qualquer), sem mexer na estrutura. */
export function mapearTextos<T>(v: T, f: (s: string) => string): T {
  if (typeof v === "string") return f(v) as T;
  if (Array.isArray(v)) return v.map((x) => mapearTextos(x, f)) as T;
  if (ehObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapearTextos(x, f)])) as T;
  return v;
}
