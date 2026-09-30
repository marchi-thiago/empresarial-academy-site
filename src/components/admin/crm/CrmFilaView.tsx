import type { AdminViewServerProps } from "payload";
import { carregarFila } from "@/lib/crm/dados";
import { montarFila } from "@/lib/crm/telas/fila";
import { CrmShell, exigirLogin } from "./CrmShell";
import { FilaClient } from "./FilaClient";

/**
 * Fila do dia (/eahub/crm/fila): é a página que o atalho "Adicionar à Tela de Início" abre.
 * A ordem e as regras estão em src/lib/crm/telas/fila.ts (testadas).
 */
export async function CrmFilaView(props: AdminViewServerProps) {
  exigirLogin(props, "/eahub/crm/fila");
  const agora = new Date();
  const { leads, interacoes } = await carregarFila(props.payload, agora);
  const fila = montarFila(leads, interacoes, agora);
  return (
    <CrmShell>
      <FilaClient fila={fila} agoraIso={agora.toISOString()} />
    </CrmShell>
  );
}
