/**
 * Cópia de ea-flow/src/lib/sdr/agradecimento.ts.
 *
 * A mensagem é só agradecimento ou despedida ("Por nada! Foi um prazer", "Disponha, até a próxima")? Não há o que
 * responder. Em 30/10/2026 o SDR agradecia de volta, o robô ou a atendente agradecia de novo e a conversa virava um
 * laço de agradecimentos (VERUS, Cury). Mensagem com pergunta ou com conteúdo além das cortesias não conta.
 */
const CORTESIAS = [
  /muit[oa]s? obrigad[oa]s?/giu,
  /obrigad[oa]s?/giu,
  /\bagrade[çc]o\b|\bagradecemos\b|\bagradecid[oa]\b/giu,
  /eu que agrade[çc]o/giu,
  /por nada|de nada|disponha|imagina|valeu|tmj/giu,
  /foi um prazer( (te |lhe )?(atender|falar com voc[êe]))?/giu,
  /(um |uma )?(grande |forte )?abra[çc]o( pra voc[êe]| para voc[êe])?( tamb[ée]m)?/giu,
  /(tenha |desejo )?(um |uma )?([óo]timo|[óo]tima|excelente|bom|boa) (dia|tarde|noite|semana|fim de semana|trabalho)( de trabalho)?( pra voc[êe]| para voc[êe])?( tamb[ée]m)?/giu,
  /bom trabalho( a[íi])?|sucesso/giu,
  /at[ée] (a )?(pr[óo]xima|mais|logo|breve)/giu,
  /(fico|ficamos|estou|estamos) [àa] disposi[çc][ãa]o/giu,
  /conte (conosco|comigo)( sempre que precisar)?/giu,
  /(sempre que|se|caso) (voc[êe] )?precis(ar|e)( de algo| de alguma coisa)?( no futuro)?(,)? (é s[óo] |estaremos |estou |estamos )?(chamar|falar|me chamar|por aqui)?( por aqui)?/giu,
  /combinado|perfeito|certo|ok|beleza|show/giu,
  /voc[êe] tamb[ée]m|pra voc[êe]|para voc[êe]|tamb[ée]m/giu,
];

export function ehSoAgradecimento(texto: string | null | undefined): boolean {
  const t = (texto ?? "").trim();
  if (!t || t.length > 240 || t.includes("?")) return false;
  let resto = t.toLowerCase();
  if (!CORTESIAS.slice(0, 13).some((re) => new RegExp(re.source, "iu").test(resto))) return false;
  for (const re of CORTESIAS) resto = resto.replace(re, " ");
  const palavras = resto.replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/u).filter((p) => p.length > 2);
  return palavras.length <= 2;
}
