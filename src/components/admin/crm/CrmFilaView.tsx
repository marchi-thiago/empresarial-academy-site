import type { AdminViewServerProps } from "payload";
import { carregarFila, carregarTemEnvioReal, carregarUltimosContatos } from "@/lib/crm/dados";
import { montarFila } from "@/lib/crm/telas/fila";
import { camposDoPeriodo } from "@/lib/crm/telas/periodo";
import { CrmShell, exigirLogin } from "./CrmShell";
import { FilaClient } from "./FilaClient";

/**
 * Fila do dia (/eahub/crm, também /eahub/crm/fila): é a tela inicial do CRM e a página que o atalho "Adicionar à Tela de Início" abre.
 * A ordem e as regras estão em src/lib/crm/telas/fila.ts (testadas).
 */
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function CrmFilaView(props: AdminViewServerProps) {
  exigirLogin(props, "/eahub/crm");
  const sp = (props as { searchParams?: Record<string, string | string[] | undefined> }).searchParams ?? {};
  const periodo = camposDoPeriodo({ periodo: um(sp.periodo), de: um(sp.de), ate: um(sp.ate), dataBase: um(sp.dataBase) });
  const agora = new Date();
  const [{ leads, interacoes }, temEnvioReal, contatos] = await Promise.all([
    carregarFila(props.payload, agora),
    carregarTemEnvioReal(props.payload),
    carregarUltimosContatos(props.payload),
  ]);
  const fila = montarFila(
    leads.map((l) => ({ ...l, ultimoContatoEm: contatos.get(l.id) ?? null })),
    interacoes,
    agora,
  );
  return (
    <CrmShell>
      <FilaClient fila={fila} agoraIso={agora.toISOString()} temEnvioReal={temEnvioReal} periodoInicial={periodo} />
    </CrmShell>
  );
}
