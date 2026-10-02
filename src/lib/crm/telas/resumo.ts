import type { LeadSlim } from "./cartao";
import { campoDoDossie, decisorDoDossie } from "./dossie";
import { dataHoraBr, inicioDoDia } from "./tempo";

/**
 * Resumo de 3 linhas no topo da ficha (quem é, por que é um bom lead, próximo passo) e
 * agrupamento da linha do tempo por dia. Funções puras.
 */

export type Resumo = { quem: string; porQue: string; proximo: string };

const corta = (t: string, max = 220) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);

/** Passo sugerido pela etapa quando o Thiago ainda não escreveu um próximo passo. */
const PASSO_DA_ETAPA: Record<string, string> = {
  captado: "Avaliar se o lead tem o perfil.",
  qualificado: "Fazer o primeiro contato.",
  em_cadencia: "Aguardar a próxima mensagem da cadência.",
  engajado: "Ligar hoje, enquanto o interesse está quente.",
  respondeu: "Responder a mensagem do lead.",
  reuniao_marcada: "Fazer a reunião e registrar o resultado.",
  reuniao_feita: "Enviar o resumo e a proposta.",
  proposta_enviada: "Acompanhar a proposta.",
  ganho: "Gerar o contrato.",
  nutricao_continua: "Manter contato leve, sem pressionar.",
  saiu_da_lista: "Não contatar mais.",
};

export function resumoDoLead(l: LeadSlim & { dossie?: unknown }, agora: Date): Resumo {
  const decisor = decisorDoDossie(l.dossie);
  const quemPartes = [decisor && decisor !== l.nome ? `${decisor} (${l.nome})` : l.nome, l.empresa && l.empresa !== l.nome ? l.empresa : null].filter(Boolean);
  const quem = [quemPartes.join(", "), l.segmento].filter(Boolean).join(" · ");

  const dor = campoDoDossie(l.dossie, "dorprovavel") ?? campoDoDossie(l.dossie, "dor");
  const gancho = campoDoDossie(l.dossie, "gancho");
  let porQue: string;
  if (l.temperatura === "engajado") porQue = `Mostrou interesse nos últimos 7 dias (${l.pontos} pontos).`;
  else if (dor || gancho) porQue = corta([dor, gancho].filter(Boolean).join(" "));
  else if (l.origem) porQue = `Veio de ${l.origem}. O dossiê com o motivo ainda não foi gerado.`;
  else porQue = "O dossiê com o motivo ainda não foi gerado.";

  let proximo: string;
  if (l.proximoPasso) {
    const quando = l.proximoPassoEm ? new Date(l.proximoPassoEm) : null;
    const rel = quando ? (quando.getTime() < inicioDoDia(agora).getTime() ? `, atrasado desde ${dataHoraBr(quando)}` : `, ${dataHoraBr(quando)}`) : "";
    proximo = `${l.proximoPasso}${rel}`;
  } else {
    proximo = PASSO_DA_ETAPA[l.etapa] ?? "Definir o próximo passo.";
  }
  return { quem, porQue, proximo };
}


/** "Hoje", "Ontem" ou "05/10" para o dia (Brasília) de cada item; mantém a ordem recebida. */
export function agruparPorDia<T extends { data: string }>(itens: T[], agora: Date): { rotulo: string; itens: T[] }[] {
  const hoje0 = inicioDoDia(agora).getTime();
  const grupos: { chave: number; rotulo: string; itens: T[] }[] = [];
  for (const i of itens) {
    const d0 = inicioDoDia(new Date(i.data)).getTime();
    let g = grupos.find((x) => x.chave === d0);
    if (!g) {
      const dias = Math.round((hoje0 - d0) / 86_400_000);
      g = { chave: d0, rotulo: dias === 0 ? "Hoje" : dias === 1 ? "Ontem" : dataHoraBr(new Date(d0 + 12 * 3_600_000)).slice(0, 5), itens: [] };
      grupos.push(g);
    }
    g.itens.push(i);
  }
  return grupos.map(({ rotulo, itens: it }) => ({ rotulo, itens: it }));
}

