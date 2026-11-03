import type { CollectionConfig } from "payload";
import { TIPOS_TAREFA } from "@/lib/crm/telas/tarefas";

/**
 * Tarefas do CRM criadas à mão (ficha, painel e Fila do dia) e o histórico das concluídas.
 * O "próximo passo" do lead e os toques da cadência NÃO moram aqui: o painel lê direto do lead
 * (ver src/lib/crm/telas/tarefas.ts). Situação: sem `concluidaEm` é pendente; vencida é atrasada.
 * Produção: tabela criada por docs/outbound/migracoes/F7-crm-tarefas.sql (o push não roda lá).
 */
export const Tarefas: CollectionConfig = {
  slug: "tarefas",
  labels: { singular: "Tarefa", plural: "Tarefas" },
  defaultSort: "venceEm",
  admin: {
    useAsTitle: "titulo",
    defaultColumns: ["venceEm", "titulo", "tipo", "lead", "concluidaEm"],
    group: "EA Leads",
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: () => false,
  },
  fields: [
    { name: "lead", type: "relationship", relationTo: "leads", required: true, index: true, label: "Lead" },
    { name: "tipo", type: "select", required: true, defaultValue: "tarefa", label: "Tipo", options: TIPOS_TAREFA.map((t) => ({ label: t.rotulo, value: t.id })) },
    { name: "titulo", type: "text", required: true, label: "Título" },
    { name: "venceEm", type: "date", index: true, label: "Vence em", admin: { date: { pickerAppearance: "dayAndTime" } } },
    { name: "concluidaEm", type: "date", index: true, label: "Concluída em", admin: { date: { pickerAppearance: "dayAndTime" } } },
    { name: "responsavel", type: "relationship", relationTo: "users", label: "Responsável" },
    { name: "notas", type: "textarea", label: "Notas" },
    {
      name: "origem",
      type: "select",
      defaultValue: "manual",
      label: "Origem",
      options: [
        { label: "Criada à mão", value: "manual" },
        { label: "Próximo passo concluído", value: "proximo_passo" },
      ],
    },
  ],
};
