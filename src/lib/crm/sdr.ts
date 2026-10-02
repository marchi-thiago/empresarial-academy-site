import { normalizarHandle } from "./identificar";
import { telefoneInternacional } from "./telas/contato";

/**
 * Lado CRM do SDR do EA Assessor (contrato em Agentes/CONTRATO-SDR-ASSINATURA.md, seção 6).
 * O estado e a troca ficam no EA Flow. O site só pergunta e pede, sempre pelo servidor,
 * porque o segredo (SDR_SEGREDO) nunca pode ir ao navegador.
 */

export type EstadoSdr = "sdr" | "thiago" | "desligado";
export type AcaoSdr = "retomar" | "pausar";
/** O que a tela mostra: os 3 estados do EA Flow mais os dois casos em que o site não conseguiu saber. */
export type SituacaoSdr = EstadoSdr | "nao_configurado" | "sem_contato" | "indisponivel";

/** O SDR nasce ligado em toda conversa e só sai quando o Thiago responde: enquanto o EA Flow não responde, a tela mostra este. */
export const SITUACAO_PADRAO: SituacaoSdr = "sdr";

export type ConfigSdr = { url: string; segredo: string };
export type ContatoSdr = { telefone?: string; instagram?: string };
export type ResultadoSdr = { ok: true; estado: EstadoSdr } | { ok: false; situacao: "indisponivel" | "nao_configurado"; erro: string };

/** As duas variáveis só do servidor. Sem as duas, o recurso fica desligado na tela. */
export function configSdr(env: Record<string, string | undefined> = process.env): ConfigSdr | null {
  const url = (env.EAFLOW_URL ?? "").trim().replace(/\/+$/, "");
  const segredo = (env.SDR_SEGREDO ?? "").trim();
  if (!url || !segredo) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return { url, segredo };
}

/** Telefone (internacional, só dígitos) e @ do lead. Nenhum dos dois: o SDR não tem como achar a conversa. */
export function contatoDoLead(l: { whatsapp?: string | null; instagram?: string | null }): ContatoSdr | null {
  const telefone = telefoneInternacional(l.whatsapp);
  const handle = l.instagram ? normalizarHandle(l.instagram) : "";
  if (!telefone && !handle) return null;
  return { ...(telefone ? { telefone } : {}), ...(handle ? { instagram: `@${handle}` } : {}) };
}

export type Apresentacao = {
  rotulo: string;
  /** Tom do selo: ativo (SDR responde), humano (Thiago), neutro. */
  tom: "ativo" | "humano" | "neutro";
  botao: { acao: AcaoSdr; texto: string } | null;
  dica: string | null;
};

/** Estado → texto do selo, botão e dica. Regra única, usada pela tela e testada. */
export function apresentarSdr(s: SituacaoSdr): Apresentacao {
  switch (s) {
    case "sdr":
      return { rotulo: "SDR atendendo", tom: "ativo", botao: { acao: "pausar", texto: "Tirar do SDR" }, dica: null };
    case "thiago":
      return { rotulo: "Com o Thiago", tom: "humano", botao: { acao: "retomar", texto: "Voltar ao SDR" }, dica: null };
    case "desligado":
      return { rotulo: "SDR desligado", tom: "neutro", botao: null, dica: "Ligue pela Secretaria." };
    case "nao_configurado":
      return { rotulo: "SDR não configurado", tom: "neutro", botao: null, dica: null };
    case "sem_contato":
      return { rotulo: "SDR sem contato", tom: "neutro", botao: null, dica: "Este lead não tem telefone nem Instagram." };
    default:
      return { rotulo: "SDR indisponível", tom: "neutro", botao: null, dica: "Não consegui falar com o EA Flow agora." };
  }
}

/** Texto gravado na linha do tempo do lead quando o Thiago clica. */
export function textoLinhaDoTempo(acao: AcaoSdr): string {
  return acao === "retomar" ? "SDR retomado pelo Thiago" : "SDR pausado pelo Thiago";
}

const ESTADOS: readonly string[] = ["sdr", "thiago", "desligado"];
const TEMPO_MAXIMO_MS = 8000;

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

async function chamar(config: ConfigSdr, url: string, init: RequestInit, f: FetchLike): Promise<ResultadoSdr> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TEMPO_MAXIMO_MS);
  try {
    const r = await f(url, {
      ...init,
      signal: ctl.signal,
      cache: "no-store",
      headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${config.segredo}` },
    });
    if (!r.ok) return { ok: false, situacao: "indisponivel", erro: `EA Flow respondeu ${r.status}.` };
    const j = (await r.json().catch(() => null)) as { estado?: unknown } | null;
    if (!j || typeof j.estado !== "string" || !ESTADOS.includes(j.estado)) {
      return { ok: false, situacao: "indisponivel", erro: "Resposta do EA Flow sem estado válido." };
    }
    return { ok: true, estado: j.estado as EstadoSdr };
  } catch {
    return { ok: false, situacao: "indisponivel", erro: "EA Flow não respondeu." };
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/sdr/conversa?telefone=... (ou ?instagram=...). Telefone tem prioridade; o Instagram vale quando não há telefone. */
export async function consultarEstadoSdr(contato: ContatoSdr, config: ConfigSdr | null, f: FetchLike = fetch): Promise<ResultadoSdr> {
  if (!config) return { ok: false, situacao: "nao_configurado", erro: "SDR não configurado." };
  const qs = contato.telefone
    ? `telefone=${encodeURIComponent(contato.telefone)}`
    : `instagram=${encodeURIComponent(contato.instagram ?? "")}`;
  return chamar(config, `${config.url}/api/sdr/conversa?${qs}`, { method: "GET" }, f);
}

/** POST /api/sdr/conversa { contato, acao }. */
export async function alterarEstadoSdr(contato: ContatoSdr, acao: AcaoSdr, config: ConfigSdr | null, f: FetchLike = fetch): Promise<ResultadoSdr> {
  if (!config) return { ok: false, situacao: "nao_configurado", erro: "SDR não configurado." };
  return chamar(
    config,
    `${config.url}/api/sdr/conversa`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contato, acao }) },
    f,
  );
}
