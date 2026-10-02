import type { AdminViewServerProps } from "payload";
import { carregarLeadsSlim } from "@/lib/crm/dados";
import { cartaoDe, type Filtros } from "@/lib/crm/telas/cartao";
import { CrmShell, exigirLogin } from "./CrmShell";
import { KanbanClient } from "./KanbanClient";

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Kanban do CRM (/eahub/crm/kanban). Server Component: carrega os ~1,4 mil leads em versão enxuta e
 * entrega ao cliente, que filtra e move cards sem recarregar a página.
 */
export async function CrmKanbanView(props: AdminViewServerProps) {
  exigirLogin(props, "/eahub/crm/kanban");
  const sp = (props as { searchParams?: Record<string, string | string[] | undefined> }).searchParams ?? {};
  const filtros: Filtros = {
    busca: um(sp.busca),
    etapa: um(sp.etapa),
    canal: um(sp.canal),
    entrega: um(sp.entrega),
    segmento: um(sp.segmento),
    campanha: um(sp.campanha),
    temperatura: um(sp.temperatura),
    origem: um(sp.origem),
    proximoPasso: um(sp.proximoPasso),
  };
  const leads = await carregarLeadsSlim(props.payload);
  return (
    <CrmShell subir={false}>
      <KanbanClient iniciais={leads.map(cartaoDe)} filtrosIniciais={filtros} />
    </CrmShell>
  );
}
