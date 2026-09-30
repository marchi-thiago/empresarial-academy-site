import type { GlobalConfig } from "payload";
import { PESOS_PADRAO } from "@/lib/crm/pesos";

/** Pesos do engajamento do CRM (Plano Outbound, seção 5). Campo vazio = valor do plano. */
export const CrmConfig: GlobalConfig = {
  slug: "crm-config",
  label: "Pesos do engajamento (CRM)",
  admin: { group: "EA Leads" },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      type: "row",
      fields: [
        { name: "abertura", type: "number", min: 0, label: "Abriu o e-mail", defaultValue: PESOS_PADRAO.abertura },
        { name: "aberturasContadas", type: "number", min: 0, label: "Aberturas contadas (máximo)", defaultValue: PESOS_PADRAO.aberturasContadas },
        { name: "clique", type: "number", min: 0, label: "Clicou em link", defaultValue: PESOS_PADRAO.clique },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "video", type: "number", min: 0, label: "Assistiu ao vídeo de prova", defaultValue: PESOS_PADRAO.video },
        { name: "material", type: "number", min: 0, label: "Baixou material ou visitou o blog", defaultValue: PESOS_PADRAO.material },
        { name: "diagnostico", type: "number", min: 0, label: "Começou o diagnóstico", defaultValue: PESOS_PADRAO.diagnostico },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "leitura", type: "number", min: 0, label: "Leu o WhatsApp", defaultValue: PESOS_PADRAO.leitura },
        { name: "engajadoA", type: "number", min: 1, label: "Pontos para ficar Engajado", defaultValue: PESOS_PADRAO.engajadoA },
        { name: "janelaDias", type: "number", min: 1, label: "Janela (dias)", defaultValue: PESOS_PADRAO.janelaDias },
      ],
    },
  ],
};
