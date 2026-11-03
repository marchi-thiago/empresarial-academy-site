import type { AdminViewServerProps } from "payload";
import { carregarIdsQueResponderam, carregarLeadsSlim, carregarUltimosContatos } from "@/lib/crm/dados";
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
    periodo: um(sp.periodo),
    de: um(sp.de),
    ate: um(sp.ate),
    dataBase: um(sp.dataBase),
  };
  const [slim, responderam, contatos] = await Promise.all([
    carregarLeadsSlim(props.payload, { comPesquisa: true }),
    carregarIdsQueResponderam(props.payload),
    carregarUltimosContatos(props.payload),
  ]);
  const leads = slim.map((l) => ({ ...l, ultimoContatoEm: contatos.get(l.id) ?? null }));
  return (
    <CrmShell subir={false}>
      <KanbanClient iniciais={leads.map((l) => (responderam.has(l.id) || l.etapa === "respondeu" ? { ...cartaoDe(l), respondeu: true as const } : cartaoDe(l)))} filtrosIniciais={filtros} />
    </CrmShell>
  );
}
