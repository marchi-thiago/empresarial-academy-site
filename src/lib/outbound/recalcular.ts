import type { Pesos } from "@/lib/crm/pesos";
import { temperaturaDe } from "@/lib/crm/regras";
import type { Temperatura } from "@/lib/crm/tipos";

/**
 * Rotina diária (pendência da F4): a temperatura só mudava quando chegava evento novo, então o fim da
 * janela de 7 dias nunca esfriava ninguém. Aqui os pontos são somados de novo só com o que ainda está na janela.
 */
export function recalcularTemperatura(
  interacoes: { pontos: number; data: Date }[],
  agora: Date,
  pesos: Pesos,
): { pontos: number; temperatura: Temperatura } {
  const limite = agora.getTime() - pesos.janelaDias * 86_400_000;
  const pontos = interacoes.filter((i) => i.data.getTime() >= limite).reduce((s, i) => s + (i.pontos || 0), 0);
  return { pontos, temperatura: temperaturaDe(pontos, pesos) };
}

export type Reuniao = { leadId: number; eventoId: string; inicio: Date };

/**
 * Garantia pela agenda do Outlook: reunião futura em que o e-mail do lead é participante
 * (o Calendly grava o convidado como participante do evento).
 */
export function acharReunioes(
  eventos: { id: string; inicio: Date; emails: string[] }[],
  leads: { id: number; email: string }[],
  agora: Date,
): Reuniao[] {
  const porEmail = new Map(leads.map((l) => [l.email.trim().toLowerCase(), l.id]));
  const saida: Reuniao[] = [];
  for (const e of eventos) {
    if (e.inicio.getTime() < agora.getTime()) continue;
    const alvo = e.emails.map((x) => porEmail.get(x.toLowerCase())).find((x) => x !== undefined);
    if (alvo !== undefined) saida.push({ leadId: alvo, eventoId: e.id, inicio: e.inicio });
  }
  return saida;
}
