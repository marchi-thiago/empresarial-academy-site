/**
 * Preenchimento dos textos do kit (`{{dia_sugerido}}`, `{{link_conversa}}`...) e guardas
 * de publicação: nada sai com marcador sobrando nem com travessão (regra de redação da EA).
 */

export type Variaveis = Record<string, string>;

export function preencher(texto: string, vars: Variaveis): string {
  return texto.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, chave: string) => (chave in vars ? vars[chave] : m));
}

export const marcadoresSobrando = (texto: string): string[] => [...texto.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]);

export const temTravessao = (texto: string): boolean => /[—–]/.test(texto);

export type ProblemaDeTexto = "marcador_sobrando" | "travessao" | "vazio";

/** Por que este texto não pode sair (null = pode). */
export function problemaDoTexto(assunto: string, corpo: string): ProblemaDeTexto | null {
  if (!assunto.trim() || !corpo.trim()) return "vazio";
  if (marcadoresSobrando(assunto).length || marcadoresSobrando(corpo).length) return "marcador_sobrando";
  if (temTravessao(assunto) || temTravessao(corpo)) return "travessao";
  return null;
}
