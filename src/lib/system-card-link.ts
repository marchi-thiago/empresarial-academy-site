/**
 * Regra única de como um CARD DE SISTEMA do EA HUB abre — pedido do Thiago
 * em 05/09/2026: "todos os sistemas atuais e futuros, sempre que estão no
 * card do hub, devem abrir em nova janela".
 *
 * Antes disso a decisão era tomada em cada tela por um `/^https?:\/\//`
 * solto: sistema com domínio próprio (EA Post, EA Flow) abria em aba nova,
 * mas sistema hospedado sob /eahub abria na MESMA aba — que é como se
 * perdia o caminho de volta, já que várias dessas telas não têm a barra
 * lateral do Payload.
 *
 * Agora todo card de SISTEMA abre em aba nova, interno ou externo: o HUB
 * fica aberto atrás, funcionando como o "menu inicial" que sempre está lá.
 *
 * `rel="noopener noreferrer"` vai junto por segurança: sem `noopener` a
 * página aberta recebe `window.opener` e pode redirecionar a aba do HUB
 * (tabnabbing). Obrigatório em link externo; inofensivo no interno, então
 * é aplicado sempre — uma regra só, sem exceção pra alguém esquecer.
 */
export type SystemCardLinkProps = {
  target: "_blank";
  rel: "noopener noreferrer";
};

export const SYSTEM_CARD_LINK_PROPS: SystemCardLinkProps = {
  target: "_blank",
  rel: "noopener noreferrer",
};

/** URL absoluta (http/https) — precisa de <a>, o <Link> do Next não roteia pra fora. */
export function isExternalUrl(url?: string | null): boolean {
  return /^https?:\/\//i.test(url ?? "");
}
