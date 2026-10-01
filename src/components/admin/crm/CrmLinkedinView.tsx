import type { AdminViewServerProps } from "payload";
import { carregarDadosLinkedin } from "@/lib/crm/dados";
import { CrmShell, exigirLogin } from "./CrmShell";
import { LinkedinClient } from "./LinkedinClient";

/**
 * Fila do LinkedIn semiautomático (/eahub/crm/linkedin - Plano Outbound F10).
 * Convites para decisores identificados no dossiê e seguidores da página da EA.
 */
export async function CrmLinkedinView(props: AdminViewServerProps) {
  exigirLogin(props, "/eahub/crm/linkedin");
  const agora = new Date();
  const fila = await carregarDadosLinkedin(props.payload, agora);
  return (
    <CrmShell>
      <LinkedinClient fila={fila} agoraIso={agora.toISOString()} />
    </CrmShell>
  );
}
