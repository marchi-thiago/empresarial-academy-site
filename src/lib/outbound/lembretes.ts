import { registrarInteracao } from "@/lib/crm/registrar";
import type { Deps } from "./orquestrador";
import { envioRealLigado } from "./config";
import { gerarFichaPreReuniao } from "./ficha-pre-reuniao";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import { crmDb } from "@/lib/crm/payload-db";

export async function processarLembretes(d: Deps): Promise<{ processados: number }> {
  if (!d.db.leadsParaAgendaComData) return { processados: 0 };
  const leads = await d.db.leadsParaAgendaComData();
  const agora = new Date();
  let processados = 0;

  const payload = await getPayload({ config: configPromise });

  for (const lead of leads) {
    const dataReuniao = new Date(lead.data);
    const msDiff = dataReuniao.getTime() - agora.getTime();
    const hsDiff = msDiff / 3600000;

    const leadDoc = await payload.findByID({ collection: "leads", id: lead.id, depth: 0 });

    // Ficha pré-reunião: enviada 1 dia antes (entre 24h e 25h)
    if (hsDiff > 24 && hsDiff <= 25) {
      const ficha = await gerarFichaPreReuniao(leadDoc.dossie, [], leadDoc.pontosEngajamento || 0);
      
      // Send to Thiago (simulated as internal system interaction for now, the webhook/SDR would forward if real)
      await registrarInteracao(crmDb(payload), {
        leadId: lead.id,
        canal: "sistema",
        direcao: "saida",
        tipo: "movimento_manual",
        conteudo: `Ficha pré-reunião gerada e enviada ao Thiago:\n${ficha}`,
        metadados: { fichaGerada: true }
      });
      processados++;
    }

    // Lembrete 24h pro lead
    if (hsDiff > 23 && hsDiff <= 24) {
      if (await envioRealLigado("whatsapp")) {
        // Envio real seria via d.mensageiro (Evolution)
      }
      await registrarInteracao(crmDb(payload), {
        leadId: lead.id,
        canal: "whatsapp",
        direcao: "saida",
        tipo: "lembrete",
        conteudo: "Lembrete: Nossa reunião é amanhã! Aguardo você.",
        metadados: { horas: 24 }
      });
      processados++;
    }

    // Lembrete 1h pro lead
    if (hsDiff > 0 && hsDiff <= 1) {
      if (await envioRealLigado("whatsapp")) {
        // Envio real
      }
      await registrarInteracao(crmDb(payload), {
        leadId: lead.id,
        canal: "whatsapp",
        direcao: "saida",
        tipo: "lembrete",
        conteudo: "Lembrete: Nossa reunião começa em menos de 1 hora. Até já!",
        metadados: { horas: 1 }
      });
      processados++;
    }
  }

  return { processados };
}
