import type { AdminViewServerProps } from "payload";
import { carregarLeadsSlim, carregarTarefas } from "@/lib/crm/dados";
import { tarefasDoLead, type ItemTarefa } from "@/lib/crm/telas/tarefas";
import { CrmShell, exigirLogin } from "./CrmShell";
import { TarefasClient } from "./TarefasClient";

/**
 * Painel de Tarefas (/eahub/crm/tarefas): tarefas criadas à mão, o próximo passo de cada lead e o
 * próximo toque da cadência, numa lista só. Filtros no navegador (src/lib/crm/telas/tarefas.ts).
 */
export async function CrmTarefasView(props: AdminViewServerProps) {
  exigirLogin(props, "/eahub/crm/tarefas");
  const [leads, tarefas] = await Promise.all([carregarLeadsSlim(props.payload), carregarTarefas(props.payload)]);
  const porId = new Map(leads.map((l) => [l.id, l]));
  const itens: ItemTarefa[] = [
    ...tarefas.flatMap((t) => {
      const l = porId.get(t.leadId);
      return l ? [{ ...t, lead: l.nome, empresa: l.empresa }] : [];
    }),
    ...leads.flatMap(tarefasDoLead),
  ];
  return (
    <CrmShell>
      <TarefasClient itens={itens} leads={leads.map((l) => ({ id: l.id, nome: l.nome, empresa: l.empresa }))} agoraIso={new Date().toISOString()} />
    </CrmShell>
  );
}
