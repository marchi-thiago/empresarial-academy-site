import { siteConfig } from "@/lib/site-config";
import type { Etapa } from "@/lib/crm/tipos";
import type { TextoNutricao } from "./nutricao";

/**
 * Campanha de e-mail para quem já recebeu algum contato da EA (pedido do Thiago em 27/10/2026): material "Plano 2027 em
 * 1 página" e convite para o bate-papo. Um e-mail por lead, nunca dois (o toque é a chave de idempotência). Sai pelo
 * orquestrador como os outros e-mails (comercial@ no M365, janela, 1 por domínio, pausa por bounce), em lote diário
 * dentro do teto: `LOTE_POR_DIA` vagas por dia, o resto do teto fica para a cadência.
 */
export const CAMPANHA = {
  toque: "camp_plano_2027",
  fim: new Date("2027-01-10T23:59:59-03:00"),
  material: { titulo: "Plano 2027 em 1 página", link: `${siteConfig.url}/materiais/plano-2027-em-1-pagina` },
} as const;

const DME = `${siteConfig.url}/diagnostico-maturidade-empresarial.html`;

// ponytail: lote fixo; vira variável de ambiente se o Thiago quiser mudar o ritmo sem deploy.
export const LOTE_POR_DIA = 25;

export type LeadCampanha = {
  id: number;
  nome: string;
  empresa: string | null;
  email: string | null;
  etapa: Etapa;
  optOut: boolean;
  emailSuprimido: boolean;
  /** Quando recebeu o e-mail da campanha (null = ainda não recebeu). */
  recebidoEm: Date | null;
};

/** Etapas em que o lead já está conversando com o Thiago: e-mail de campanha ali atrapalha. */
const ETAPAS_FORA: readonly Etapa[] = ["saiu_da_lista", "reuniao_marcada", "reuniao_feita", "proposta_enviada", "ganho"];

const emailValido = (v: string | null) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** Quem recebe hoje: ainda não recebeu, pode receber e cabe no lote do dia (descontado o que já saiu hoje). */
export function planejarCampanha(leads: readonly LeadCampanha[], inicioDoDia: Date, agora: Date): LeadCampanha[] {
  if (agora > CAMPANHA.fim) return [];
  const saiuHoje = leads.filter((l) => l.recebidoEm && l.recebidoEm >= inicioDoDia).length;
  const vagas = Math.max(0, LOTE_POR_DIA - saiuHoje);
  return leads
    .filter((l) => !l.recebidoEm && !l.optOut && !l.emailSuprimido && emailValido(l.email) && !ETAPAS_FORA.includes(l.etapa))
    .sort((a, b) => a.id - b.id)
    .slice(0, vagas);
}

/** Texto fixo, voz do Branding v3 (direto, sem promessa, sem travessão, convite sem duração). */
export function textoDaCampanha(nome: string): TextoNutricao {
  return {
    assunto: nome ? `${nome}, seu plano de 2027 em uma página` : "Seu plano de 2027 em uma página",
    kit: {
      gancho:
        "Fim de outubro é quando muito dono de empresa começa a pensar em 2027. E quase sempre o plano vira uma lista de desejos que não cabe no caixa.",
      insight:
        "Por isso montei um modelo de uma página: o balanço de 2026, as metas de 2027 com margem e caixa, as 3 prioridades, o plano dos primeiros 90 dias e os 5 indicadores para acompanhar toda semana. É gratuito, em PDF e em planilha.",
      convite: `Antes de planejar, vale saber de onde a empresa parte: o Diagnóstico de Maturidade Empresarial é gratuito e mostra o resultado na hora, em ${DME}. E se quiser montar o seu plano com alguém olhando junto, reserve um bate-papo rápido e gratuito comigo.`,
    },
    leitura: { rotulo: "Material gratuito", titulo: CAMPANHA.material.titulo, link: CAMPANHA.material.link },
  };
}
