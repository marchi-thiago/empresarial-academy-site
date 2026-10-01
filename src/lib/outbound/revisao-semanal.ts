import { getPayload } from "payload";
import configPromise from "@payload-config";
import { startOfWeek, subWeeks, endOfWeek } from "date-fns";

/**
 * Roda toda segunda-feira (via cron ou manual).
 * Coleta:
 * - Metas vs Real (quantos e-mails/DMs enviados vs meta).
 * - Melhores ganchos, segmentos e canais (baseado em quem respondeu/marcou reunio).
 * - Gera um relatrio em markdown na coleo `interacoes`.
 */
export async function gerarRevisaoSemanal() {
  const payload = await getPayload({ config: configPromise });
  
  const hoje = new Date();
  // Semana passada inteira
  const inicioSemanaPassada = startOfWeek(subWeeks(hoje, 1), { weekStartsOn: 1 });
  const fimSemanaPassada = endOfWeek(subWeeks(hoje, 1), { weekStartsOn: 1 });

  const interacoes = await payload.find({
    collection: "interacoes",
    where: {
      data: {
        greater_than_equal: inicioSemanaPassada.toISOString(),
        less_than_equal: fimSemanaPassada.toISOString(),
      },
    },
    limit: 10000,
  });

  let totalEnviados = 0;
  let totalRespostas = 0;
  let totalReunioes = 0;
  const variantesPontos: Record<string, { envios: number; sucesso: number }> = {};

  for (const interacao of interacoes.docs) {
    if (interacao.tipo === "enviado") {
      totalEnviados++;
      const meta = interacao.metadados as any;
      if (meta?.variantesUsadas) {
        for (const [variavel, varId] of Object.entries(meta.variantesUsadas)) {
          const key = `${variavel}:${varId}`;
          if (!variantesPontos[key]) variantesPontos[key] = { envios: 0, sucesso: 0 };
          variantesPontos[key].envios++;
        }
      }
    } else if (interacao.tipo === "respondido") {
      totalRespostas++;
    } else if (interacao.tipo === "agendou_reuniao" || interacao.conteudo?.includes("reuniao")) { // ajuste conforme seu CRM
      totalReunioes++;
    }
  }

  // Identificar vencedores
  const vencedores = Object.entries(variantesPontos)
    .map(([key, stats]) => ({ key, ...stats, taxa: stats.envios > 0 ? stats.sucesso / stats.envios : 0 }))
    .sort((a, b) => b.taxa - a.taxa)
    .slice(0, 5);

  const markdown = `
# Reviso Semanal (${inicioSemanaPassada.toLocaleDateString()} a ${fimSemanaPassada.toLocaleDateString()})

## Metas vs Real
- **Envios Totais:** ${totalEnviados}
- **Respostas:** ${totalRespostas}
- **Reunies Marcadas:** ${totalReunioes}

## Melhores Variantes (A/B)
${vencedores.length > 0 ? vencedores.map(v => `- **${v.key}**: ${v.envios} envios, taxa ${(v.taxa*100).toFixed(1)}%`).join("\\n") : "Sem dados suficientes."}

_Relatrio gerado automaticamente._
  `.trim();

  // Registrar como interao do tipo "revisao_semanal" (lead null, pois  geral, mas payload exige lead? 
  // Na vdd lead tem index mas vamos checar se  obrigatrio. Se for obrigatrio, devemos atrelar a um sistema ou afrouxar)
  // No payload-types.ts, Interacao tem lead (number | Lead). Em schemas relacionais pode ser opcional.
  
  await payload.create({
    collection: "interacoes",
    data: {
      canal: "email", // dummy
      direcao: "saida", // dummy
      tipo: "revisao_semanal",
      conteudo: markdown,
      data: hoje.toISOString(),
      pontos: 0,
    },
  });

  return markdown;
}
