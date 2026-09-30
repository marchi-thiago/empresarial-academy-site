import type { CollectionConfig } from "payload";
import { CANAIS, DIRECOES, TIPOS } from "@/lib/crm/tipos";

/**
 * Linha do tempo do CRM: cada fato de qualquer canal com um lead (envio, abertura,
 * resposta, ligação, movimento manual...). Quem grava é `registrarInteracao()`
 * (src/lib/crm/), que também aplica os efeitos no lead. Nunca se edita nem se
 * apaga uma interação: corrigir é registrar outra.
 */
export const Interacoes: CollectionConfig = {
  slug: "interacoes",
  labels: { singular: "Interação", plural: "Interações" },
  defaultSort: "-data",
  admin: {
    useAsTitle: "tipo",
    defaultColumns: ["data", "lead", "canal", "direcao", "tipo", "pontos"],
    group: "EA Leads",
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: "lead", type: "relationship", relationTo: "leads", index: true, label: "Lead" },
    { name: "canal", type: "select", required: true, label: "Canal", options: CANAIS.map((value) => ({ label: value, value })) },
    {
      name: "direcao",
      type: "select",
      required: true,
      label: "Direção",
      options: DIRECOES.map((value) => ({ label: value === "entrada" ? "Entrada" : "Saída", value })),
    },
    { name: "tipo", type: "select", required: true, label: "Tipo", options: TIPOS.map((value) => ({ label: value, value })) },
    { name: "conteudo", type: "textarea", label: "Conteúdo" },
    { name: "pontos", type: "number", defaultValue: 0, label: "Pontos de engajamento" },
    { name: "metadados", type: "json", label: "Metadados" },
    { name: "data", type: "date", required: true, index: true, label: "Data do fato", admin: { date: { pickerAppearance: "dayAndTime" } } },
    {
      name: "chave",
      type: "text",
      unique: true,
      label: "Chave de idempotência",
      admin: { readOnly: true, description: "Reenviar o mesmo evento com a mesma chave não grava duas vezes." },
    },
  ],
};
