import type { AdminViewServerProps } from "payload";
import { carregarFila, carregarLeadsSlim, carregarTarefas, carregarTemEnvioReal, carregarUltimosContatos } from "@/lib/crm/dados";
import { tarefasDoDia, tarefasDoLead } from "@/lib/crm/telas/tarefas";
import { montarFila } from "@/lib/crm/telas/fila";
import { camposDoPeriodo } from "@/lib/crm/telas/periodo";
import { ordemValida } from "@/lib/crm/telas/cartao";
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
  const [{ leads, interacoes }, temEnvioReal, contatos, todos, tarefas] = await Promise.all([
    carregarFila(props.payload, agora),
    carregarTemEnvioReal(props.payload),
    carregarUltimosContatos(props.payload),
    carregarLeadsSlim(props.payload),
    carregarTarefas(props.payload),
  ]);
  // Tarefas do dia com as datas do lead, para o filtro de período valer também nesta seção.
  const porId = new Map(todos.map((l) => [l.id, l]));
  const comLead = (leadId: number) => {
    const l = porId.get(leadId);
    return l ? { lead: l.nome, empresa: l.empresa, entradaEm: l.entradaEm, ultimoContatoEm: contatos.get(l.id) ?? null } : null;
  };
  const doDia = tarefasDoDia(
    [
      ...tarefas.flatMap((t) => {
        const extra = comLead(t.leadId);
        return extra ? [{ ...t, ...extra }] : [];
      }),
      ...todos.flatMap((l) => tarefasDoLead(l).map((t) => ({ ...t, entradaEm: l.entradaEm, ultimoContatoEm: contatos.get(l.id) ?? null }))),
    ],
    agora,
  );
  const fila = montarFila(
    leads.map((l) => ({ ...l, ultimoContatoEm: contatos.get(l.id) ?? null })),
    interacoes,
    agora,
  );
  return (
    <CrmShell>
      <FilaClient fila={fila} agoraIso={agora.toISOString()} temEnvioReal={temEnvioReal} periodoInicial={periodo} ordemInicial={ordemValida(um(sp.ordem))} tarefas={doDia} />
    </CrmShell>
  );
}
