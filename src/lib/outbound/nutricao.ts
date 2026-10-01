import { getPayload } from "payload";
import configPromise from "@payload-config";
import { sortearVariante } from "./experimentos";

/**
 * Roda 1x por ms para leads em "Nutrio contnua".
 * Envia um material relevante ou pedido de indicao.
 */
export async function processarNutricaoMensal() {
  const payload = await getPayload({ config: configPromise });
  const hoje = new Date();

  // Buscar leads em "Nutrio contnua" (ajustar de acordo com o CRM/Payload, ex: dealStatus)
  const leads = await payload.find({
    collection: "leads",
    where: {
      dealStatus: {
        equals: "nutricao_continua",
      },
    },
    limit: 1000,
  });

  for (const lead of leads.docs) {
    // 1. Decidir o que enviar (Material relevante ou pedido de indicao)
    const tipoEnvio = Math.random() > 0.5 ? "material" : "indicacao";
    let assunto = "";
    let conteudo = "";

    if (tipoEnvio === "indicacao") {
      assunto = "Como tem sido a sua experincia?";
      conteudo = `Ol ${lead.name || "gestor"},\\n\\nEspero que esteja tudo bem!\\n\\nQueria saber se voc tem alguma empresa parceira que se beneficiaria do que conversamos h um tempo.\\n\\nAbraos.`;
    } else {
      assunto = "Material interessante para seu setor";
      conteudo = `Ol ${lead.name || "gestor"},\\n\\nEsbarrei neste material sobre otimizao e lembrei de voc.\\n\\nEspero que seja til!`;
    }

    // 2. Registrar interao de envio
    await payload.create({
      collection: "interacoes",
      data: {
        lead: lead.id,
        canal: "email",
        direcao: "saida",
        tipo: "enviado",
        conteudo: conteudo,
        metadados: {
          nutricao: true,
          assunto,
          tipoEnvio
        },
        data: hoje.toISOString(),
      },
    });

    // NOTA: A implementao real do envio (ex: Microsoft Graph ou resend) seria chamada aqui.
    // Como estamos na biblioteca de nutrio, podemos apenas deixar a estrutura.
  }
}
