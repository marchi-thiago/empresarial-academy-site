import { EaBackBar } from "./EaBackBar";

/**
 * Link de retorno para as views custom em tela cheia (que não renderizam a
 * barra lateral do Payload — sem isto o único caminho de volta seria o
 * botão do navegador).
 *
 * Desde 05/09/2026 delega pro EaBackBar, que resolve o beco sem saída
 * relatado pelo Thiago ("em algumas janelas perdemos o acesso a voltar"):
 * como os cards do HUB passaram a abrir em ABA NOVA, um link único "voltar
 * ao HUB" apontando pra home não bastava — na aba nova não há para onde
 * voltar, e telas profundas perdiam o passo intermediário. O EaBackBar
 * mostra "Voltar" só quando existe histórico real, e sempre oferece o nível
 * acima + a home.
 *
 * Mantido como componente próprio (em vez de trocar as 5 chamadas) pra que
 * as views existentes e as futuras continuem importando um nome só.
 */
export function EaHubBackLink({
  href,
  label,
}: {
  /** Destino do nível acima. Vazio = calculado a partir da URL atual. */
  href?: string;
  label?: string;
}) {
  return <EaBackBar parentHref={href} parentLabel={label} />;
}
