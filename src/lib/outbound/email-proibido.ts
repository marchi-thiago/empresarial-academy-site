/**
 * Endereço que nunca é contato comercial (04/11/2026): encarregado de LGPD, privacidade, RH, vagas, nota fiscal e
 * denúncia. Em 04/11 saíram e-mails para dpo@infojobs, dpo@bentomar e curriculum@grupomhms, todos achados pelo Hunter
 * no site do lead. O Hunter já não capta esses (EA-Hunter#86); aqui é a trava no envio para os que já estão no CRM.
 * Mesma lista de `emailProibido` do Hunter (src/features/leads/porte-da-empresa.ts).
 */
const PREFIXO_PROIBIDO_RE =
  /^(dpo|lgpd|privacidade|privacy|encarregado|protecao|dataprotection|dados\.?pessoais|curricul|cv$|vaga|trabalhe|recrut|selecao|rh($|[._-])|jobs?$|carreira|career|talent|denuncia|ouvidoria|compliance|juridico|nfe?($|[._-])|fiscal|xml|etica)/u;

export function emailProibido(email: string): boolean {
  return PREFIXO_PROIBIDO_RE.test((email.split("@")[0] ?? "").toLowerCase());
}
