/**
 * Link para a página /conversa a partir de qualquer página do site. Repassa o token do lead (`t`, vindo do e-mail, da DM
 * ou do WhatsApp) e os parâmetros de campanha da URL atual, para que a atribuição e o prefill do Calendly não se percam.
 */

export const CONVERSA_PATH = "/conversa";

const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gad_source"] as const;

/** Mesmo formato que `tokenValido` (conversa-servidor.ts) aceita: letras, dígitos, hífen e sublinhado. */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function hrefDaConversa(search: string | null | undefined): string {
  let atual: URLSearchParams;
  try {
    atual = new URLSearchParams(search ?? "");
  } catch {
    return CONVERSA_PATH;
  }
  const saida = new URLSearchParams();
  const t = atual.get("t");
  if (t && TOKEN_RE.test(t)) saida.set("t", t);
  for (const k of CAMPAIGN_KEYS) {
    const v = atual.get(k);
    if (v) saida.set(k, v.slice(0, 200));
  }
  const qs = saida.toString();
  return qs ? `${CONVERSA_PATH}?${qs}` : CONVERSA_PATH;
}
