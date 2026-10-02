import type { Payload } from "payload";
import { carregarDadosDoPainel } from "./dados";
import { contarCores, type Automacao } from "./estado";
import { automacoesDoHunter } from "./hunter";
import { montarAutomacoesDoSite } from "./site";

/**
 * Resposta do `GET /api/automacoes/status`: as automações do site mais as do Hunter (o último status que o PC mandou),
 * e a hora do último sinal do Hunter. Quem agrega com as do EA Flow e desenha o painel é o próprio EA Flow.
 */

export interface RespostaDoStatus {
  geradoEm: string;
  hunter: { ultimoSinal: string | null; semSinal: string | null };
  automacoes: Automacao[];
  cores: { verdes: number; amarelas: number; vermelhas: number };
}

export async function montarRespostaDoStatus(payload: Payload, agora: Date = new Date(), env: Record<string, string | undefined> = process.env): Promise<RespostaDoStatus> {
  const dados = await carregarDadosDoPainel(payload, agora);
  const site = montarAutomacoesDoSite(dados, agora, env);
  const hunter = automacoesDoHunter({ agora, ultimoSinal: dados.ultimoSinalDoHunter, status: dados.statusDoHunter });
  const automacoes = [...site, ...hunter.automacoes];
  return {
    geradoEm: agora.toISOString(),
    hunter: { ultimoSinal: dados.ultimoSinalDoHunter?.toISOString() ?? null, semSinal: hunter.semSinal },
    automacoes,
    cores: contarCores(automacoes),
  };
}
