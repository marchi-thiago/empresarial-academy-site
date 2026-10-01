import {
  ETAPAS,
  ETAPA_ROTULO,
  MOTIVOS_RESULTADO,
  type Canal,
  type Direcao,
  type Etapa,
  type Tipo,
} from "../tipos";

/**
 * Ações do Thiago nas telas (arrastar card, botões da Fila, próximo passo).
 * `planejarAcao` é pura: valida e diz o que gravar. Quem grava é a rota
 * POST /api/crm/acao, sempre por `registrarInteracao()`.
 */

export type Resultado = "atendeu" | "sem_resposta" | "reuniao_marcada" | "sem_interesse" | "enviado_linkedin" | "aceito_linkedin" | "respondi" | "reuniao_feita";

/** Resultado de uma reunião de 20 minutos (botão "Reunião feita" da Fila). Tela e servidor usam esta lista. */
export const DESFECHOS_REUNIAO = [
  { value: "proposta_a_enviar", label: "Foi bem: vou enviar resumo e proposta" },
  { value: "proposta_enviada", label: "Proposta já enviada" },
  { value: "ganho", label: "Fechou (Ganho)" },
  { value: "nutricao_continua", label: "Não fechou agora (Nutrição contínua)" },
  { value: "reagendou", label: "Não aconteceu: reagendar" },
] as const;
export type DesfechoReuniao = (typeof DESFECHOS_REUNIAO)[number]["value"];

/** Prazo do plano (seção 8) para enviar resumo e proposta depois da reunião. */
const PRAZO_PROPOSTA_MS = 24 * 3_600_000;

export type Acao =
  | { acao: "mover"; leadId: number; para: string; motivo?: string; detalhe?: string; origemAcao?: string }
  | {
      acao: "resultado";
      leadId: number;
      resultado: Resultado;
      /** Canal da ação (ligação, linkedin ou o canal da resposta). */
      canal?: string;
      motivo?: string;
      detalhe?: string;
      /** ISO da reunião marcada. */
      reuniaoEm?: string;
      /** Só em `reuniao_feita`. */
      desfecho?: string;
    }
  | { acao: "proximo_passo"; leadId: number; texto: string; em?: string | null };

export type InteracaoPlanejada = {
  canal: Canal;
  direcao: Direcao;
  tipo: Tipo;
  conteudo: string;
  metadados?: Record<string, unknown>;
};

export type PlanoAcao =
  | {
      ok: true;
      interacoes: InteracaoPlanejada[];
      /** Campos do lead a gravar além do que as regras já fazem. */
      lead: {
        motivoResultado?: { motivo: string; detalhe: string | null };
        proximoPasso?: string | null;
        proximoPassoEm?: string | null;
      };
    }
  | { ok: false; erro: string };

const ETAPAS_DE_REUNIAO: Etapa[] = ["reuniao_marcada", "reuniao_feita", "proposta_enviada"];

const valores = (ms: readonly { value: string }[]) => new Set(ms.map((m) => m.value));
const GANHO = valores(MOTIVOS_RESULTADO.filter((m) => ["valor_percebido", "indicacao", "preco", "outro"].includes(m.value)));
const NUTRICAO = valores(MOTIVOS_RESULTADO.filter((m) => !["valor_percebido", "indicacao"].includes(m.value)));

/** Motivos oferecidos para cada destino (tela e servidor usam a mesma lista). */
export function motivosPara(destino: string) {
  const ok = destino === "ganho" ? GANHO : NUTRICAO;
  return MOTIVOS_RESULTADO.filter((m) => ok.has(m.value));
}

/** Mover para Ganho ou Nutrição contínua depois de uma reunião pede motivo (plano, seção 5). */
export function pedeMotivo(de: Etapa, para: string): boolean {
  return (para === "ganho" || para === "nutricao_continua") && ETAPAS_DE_REUNIAO.includes(de);
}

const rotuloMotivo = (v: string) => MOTIVOS_RESULTADO.find((m) => m.value === v)?.label ?? v;
const limpar = (s: string | undefined, max: number) => (s ?? "").trim().slice(0, max);

function checarMotivo(destino: string, motivo: string | undefined): string | null {
  if (!motivo) return "Escolha o motivo.";
  if (!motivosPara(destino).some((m) => m.value === motivo)) return "Motivo inválido para este destino.";
  return null;
}

export function planejarAcao(a: Acao, etapaAtual: Etapa, agora: Date = new Date()): PlanoAcao {
  if (a.acao === "mover") {
    if (!(ETAPAS as readonly string[]).includes(a.para)) return { ok: false, erro: "Etapa inválida." };
    const para = a.para as Etapa;
    if (para === etapaAtual) return { ok: false, erro: "O lead já está nesta etapa." };
    const motivoObrigatorio = pedeMotivo(etapaAtual, para);
    const detalhe = limpar(a.detalhe, 300) || null;
    const destinoComMotivo = para === "ganho" || para === "nutricao_continua";
    if (motivoObrigatorio || (a.motivo && destinoComMotivo)) {
      const erro = checarMotivo(para, a.motivo);
      if (erro) return { ok: false, erro };
    }
    const comMotivo = Boolean(a.motivo) && destinoComMotivo;
    return {
      ok: true,
      interacoes: [
        {
          canal: "sistema",
          direcao: "saida",
          tipo: "movimento_manual",
          conteudo:
            `Movido de ${ETAPA_ROTULO[etapaAtual]} para ${ETAPA_ROTULO[para]}` +
            (comMotivo ? `. Motivo: ${rotuloMotivo(a.motivo!)}${detalhe ? ` (${detalhe})` : ""}` : ""),
          metadados: {
            para,
            de: etapaAtual,
            origemAcao: a.origemAcao ?? "kanban",
            ...(comMotivo ? { motivo: a.motivo, detalhe } : {}),
          },
        },
      ],
      lead: comMotivo ? { motivoResultado: { motivo: a.motivo!, detalhe } } : {},
    };
  }

  if (a.acao === "proximo_passo") {
    const texto = limpar(a.texto, 200);
    let em: string | null = null;
    if (a.em) {
      const d = new Date(a.em);
      if (Number.isNaN(d.getTime())) return { ok: false, erro: "Data inválida." };
      em = d.toISOString();
    }
    return { ok: true, interacoes: [], lead: { proximoPasso: texto || null, proximoPassoEm: texto || em ? em : null } };
  }

  // Resultados dos botões da Fila do dia.
  const detalhe = limpar(a.detalhe, 300) || null;
  switch (a.resultado) {
    case "atendeu":
    case "sem_resposta":
      return {
        ok: true,
        interacoes: [
          {
            canal: "ligacao",
            direcao: "saida",
            tipo: "resultado_ligacao",
            conteudo: a.resultado === "atendeu" ? "Ligação atendida" : "Ligação sem resposta",
            metadados: { resultado: a.resultado },
          },
        ],
        lead: {},
      };

    case "reuniao_marcada": {
      const quando = a.reuniaoEm ? new Date(a.reuniaoEm) : null;
      if (!quando || Number.isNaN(quando.getTime())) return { ok: false, erro: "Informe o dia e o horário da reunião." };
      const canal = (["ligacao", "dm", "whatsapp", "email", "linkedin"].includes(a.canal ?? "") ? a.canal : "ligacao") as Canal;
      const itens: InteracaoPlanejada[] = [];
      if (canal === "ligacao") {
        itens.push({ canal, direcao: "saida", tipo: "resultado_ligacao", conteudo: "Reunião marcada pela ligação", metadados: { resultado: "reuniao_marcada" } });
      }
      itens.push({
        canal,
        direcao: "saida",
        tipo: "agendou",
        conteudo: "Reunião de 20 minutos marcada pelo Thiago",
        metadados: { canalOrigem: canal, toque: canal === "ligacao" ? "ligacao" : "resposta_manual", reuniaoEm: quando.toISOString() },
      });
      return { ok: true, interacoes: itens, lead: { proximoPasso: "Reunião de 20 min", proximoPassoEm: quando.toISOString() } };
    }

    case "sem_interesse": {
      const erro = checarMotivo("nutricao_continua", a.motivo);
      if (erro) return { ok: false, erro };
      const itens: InteracaoPlanejada[] = [];
      if (a.canal === "ligacao") {
        itens.push({ canal: "ligacao", direcao: "saida", tipo: "resultado_ligacao", conteudo: "Sem interesse", metadados: { resultado: "sem_interesse" } });
      }
      itens.push({
        canal: "sistema",
        direcao: "saida",
        tipo: "movimento_manual",
        conteudo: `Sem interesse agora. Motivo: ${rotuloMotivo(a.motivo!)}${detalhe ? ` (${detalhe})` : ""}. Segue em Nutrição contínua.`,
        metadados: { para: "nutricao_continua", origemAcao: "fila", motivo: a.motivo, detalhe },
      });
      return { ok: true, interacoes: itens, lead: { motivoResultado: { motivo: a.motivo!, detalhe } } };
    }

    case "enviado_linkedin":
      return {
        ok: true,
        interacoes: [
          { canal: "linkedin", direcao: "saida", tipo: "enviado", conteudo: "Convite enviado pelo Thiago", metadados: { toque: "linkedin" } },
        ],
        lead: {},
      };

    case "aceito_linkedin":
      return {
        ok: true,
        interacoes: [
          { canal: "linkedin", direcao: "entrada", tipo: "entregue", conteudo: "Convite do LinkedIn aceito pelo lead", metadados: { toque: "linkedin", evento: "convite_aceito" } },
        ],
        lead: {},
      };

    case "reuniao_feita": {
      if (!ETAPAS_DE_REUNIAO.includes(etapaAtual)) return { ok: false, erro: "Este lead não está em reunião." };
      const desfecho = DESFECHOS_REUNIAO.find((d) => d.value === a.desfecho)?.value;
      if (!desfecho) return { ok: false, erro: "Informe o resultado da reunião." };

      if (desfecho === "reagendou") {
        const quando = a.reuniaoEm ? new Date(a.reuniaoEm) : null;
        if (!quando || Number.isNaN(quando.getTime())) return { ok: false, erro: "Informe o novo dia e horário da reunião." };
        return {
          ok: true,
          interacoes: [
            {
              canal: "sistema",
              direcao: "saida",
              tipo: "agendou",
              conteudo: `Reunião não aconteceu; reagendada${detalhe ? ` (${detalhe})` : ""}.`,
              metadados: { origemAcao: "fila", reagendada: true, desfecho, reuniaoEm: quando.toISOString() },
            },
          ],
          lead: { proximoPasso: "Reunião de 20 min", proximoPassoEm: quando.toISOString() },
        };
      }

      const para: Etapa = desfecho === "proposta_a_enviar" ? "reuniao_feita" : desfecho;
      const comMotivo = para === "ganho" || para === "nutricao_continua";
      if (comMotivo) {
        const erro = checarMotivo(para, a.motivo);
        if (erro) return { ok: false, erro };
      }
      const textoMotivo = comMotivo ? ` Motivo: ${rotuloMotivo(a.motivo!)}${detalhe ? ` (${detalhe})` : ""}.` : detalhe ? ` ${detalhe}` : "";
      const lead: Extract<PlanoAcao, { ok: true }>["lead"] = {};
      if (comMotivo) lead.motivoResultado = { motivo: a.motivo!, detalhe };
      if (para === "reuniao_feita") {
        lead.proximoPasso = "Enviar resumo e proposta";
        lead.proximoPassoEm = new Date(agora.getTime() + PRAZO_PROPOSTA_MS).toISOString();
      } else if (para === "proposta_enviada") {
        lead.proximoPasso = "Follow-up da proposta (D2, D5 e D10)";
        lead.proximoPassoEm = new Date(agora.getTime() + 2 * 86_400_000).toISOString();
      } else {
        lead.proximoPasso = null;
        lead.proximoPassoEm = null;
      }
      return {
        ok: true,
        interacoes: [
          {
            canal: "sistema",
            direcao: "saida",
            tipo: "movimento_manual",
            conteudo: `Reunião feita. Movido para ${ETAPA_ROTULO[para]}.${textoMotivo}`,
            metadados: { para, de: etapaAtual, origemAcao: "reuniao_feita", desfecho, ...(comMotivo ? { motivo: a.motivo, detalhe } : {}) },
          },
        ],
        lead,
      };
    }

    case "respondi": {
      const canal = (["dm", "whatsapp", "email", "ligacao", "linkedin"].includes(a.canal ?? "") ? a.canal : "dm") as Canal;
      return {
        ok: true,
        interacoes: [
          { canal, direcao: "saida", tipo: "enviado", conteudo: "Resposta enviada pelo Thiago", metadados: { toque: "resposta" } },
        ],
        lead: {},
      };
    }
  }
  return { ok: false, erro: "Ação desconhecida." };
}
