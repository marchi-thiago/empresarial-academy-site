import type { AdminViewServerProps } from "payload";
import { carregarFila, carregarTemEnvioReal } from "@/lib/crm/dados";
import { montarFila } from "@/lib/crm/telas/fila";
import { CrmShell, exigirLogin } from "./CrmShell";
import { FilaClient } from "./FilaClient";

/**
 * Fila do dia (/eahub/crm, também /eahub/crm/fila): é a tela inicial do CRM e a página que o atalho "Adicionar à Tela de Início" abre.
 * A ordem e as regras estão em src/lib/crm/telas/fila.ts (testadas).
 */
export async function CrmFilaView(props: AdminViewServerProps) {
  exigirLogin(props, "/eahub/crm");
  const agora = new Date();
  const [{ leads, interacoes }, temEnvioReal] = await Promise.all([carregarFila(props.payload, agora), carregarTemEnvioReal(props.payload)]);
  const fila = montarFila(leads, interacoes, agora);
  return (
    <CrmShell>
      <FilaClient fila={fila} agoraIso={agora.toISOString()} temEnvioReal={temEnvioReal} />
    </CrmShell>
  );
}
