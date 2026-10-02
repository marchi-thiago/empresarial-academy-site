/**
 * Painel de Automações: formato padrão e regra das cores.
 *
 * Este arquivo é o CONTRATO entre os três sistemas (Hunter, site e EA Flow). O formato `Automacao` e a função
 * `decidirEstado` existem idênticos em `EA Hunter/src/features/automacoes/estado.ts`,
 * `empresarial-academy-site/src/lib/automacoes/estado.ts` e `ea-flow/src/lib/automacoes/estado.ts`.
 * Se mudar aqui, mude nos outros dois.
 *
 * Cores (o que o Thiago vê): verde = ligado e a última execução sem erro; amarelo = ligado, mas com erro
 * recente (últimas 24 h) ou fila travada; vermelho = desligado, sem chave, em simulação ou sem rodar no prazo.
 * No código os estados são "ligado" (verde), "erro" (amarelo) e "parado" (vermelho).
 */

export type EstadoDaAutomacao = "ligado" | "erro" | "parado";
export type SistemaDaAutomacao = "hunter" | "site" | "flow";
export type GrupoDaAutomacao = "Prospecção" | "Cadência e CRM" | "Atendimento";

export interface NumeroDaAutomacao {
  rotulo: string;
  /** `null` = não existe ou não se aplica (a tela mostra um traço). */
  hoje: number | null;
  semana: number | null;
}

export interface Automacao {
  id: string;
  nome: string;
  sistema: SistemaDaAutomacao;
  grupo: GrupoDaAutomacao;
  estado: EstadoDaAutomacao;
  /** Em português simples. Presente quando o estado não é verde. */
  motivo?: string;
  numeros: NumeroDaAutomacao[];
  /** ISO 8601. */
  ultimaExecucao?: string;
}

export const HORA_MS = 3_600_000;
export const DIA_MS = 24 * HORA_MS;
/** Janela do "erro recente" que deixa a automação amarela. */
export const JANELA_DE_ERRO_MS = DIA_MS;

export interface EntradaDeEstado {
  agora: Date;
  /** Qualquer um dos quatro motivos abaixo deixa a automação vermelha (parado). */
  desligada?: string | null;
  semChave?: string | null;
  simulacao?: string | null;
  semSinal?: string | null;
  ultimaExecucao?: Date | null;
  /** Tempo máximo esperado entre duas execuções. Passou disso (ou nunca rodou), vermelho. */
  prazoMs?: number;
  /** Amarelo: erro nas últimas 24 h. */
  erroRecente?: string | null;
  /** Amarelo: fila que não anda. */
  filaTravada?: string | null;
}

export function formatarDuracao(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} dias`;
}

export function decidirEstado(e: EntradaDeEstado): { estado: EstadoDaAutomacao; motivo?: string } {
  const parado = e.desligada || e.semChave || e.simulacao || e.semSinal;
  if (parado) return { estado: "parado", motivo: parado };

  if (e.prazoMs !== undefined) {
    if (!e.ultimaExecucao) return { estado: "parado", motivo: "ainda não rodou" };
    const idade = e.agora.getTime() - e.ultimaExecucao.getTime();
    if (idade > e.prazoMs) {
      return { estado: "parado", motivo: `sem rodar há ${formatarDuracao(idade)} (o normal é a cada ${formatarDuracao(e.prazoMs)} ou menos)` };
    }
  }

  const aviso = e.erroRecente || e.filaTravada;
  if (aviso) return { estado: "erro", motivo: aviso };
  return { estado: "ligado" };
}

type Descricao = Pick<Automacao, "id" | "nome" | "sistema" | "grupo" | "numeros">;

/** Monta a automação já com estado, motivo e última execução. */
export function montarAutomacao(d: Descricao, e: EntradaDeEstado): Automacao {
  const { estado, motivo } = decidirEstado(e);
  return {
    ...d,
    estado,
    ...(motivo ? { motivo } : {}),
    ...(e.ultimaExecucao ? { ultimaExecucao: e.ultimaExecucao.toISOString() } : {}),
  };
}

export function contarCores(lista: readonly Pick<Automacao, "estado">[]): { verdes: number; amarelas: number; vermelhas: number } {
  return {
    verdes: lista.filter((a) => a.estado === "ligado").length,
    amarelas: lista.filter((a) => a.estado === "erro").length,
    vermelhas: lista.filter((a) => a.estado === "parado").length,
  };
}
