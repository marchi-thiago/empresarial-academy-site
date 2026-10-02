import { CANAIS_ENTREGA, ESTADOS_ENTREGA, ETAPAS, type CanalEntrega, type Etapa, type StatusEntrega, type Temperatura } from "../tipos";
import { fimDoDia, inicioDoDia } from "./tempo";

/**
 * Lead enxuto para as telas do CRM: só o que o Kanban, a Fila e o painel usam.
 * Datas em ISO. O carregamento (Payload) fica em src/lib/crm/dados.ts.
 */
export type LeadSlim = {
  id: number;
  nome: string;
  empresa: string | null;
  segmento: string | null;
  /** Campanha = fonteCaptacao (hashtag, seguidores ou comentários de um perfil). */
  campanha: string | null;
  /** Origem = campo `source` do lead (formulário, diagnóstico, EA Hunter...). */
  origem: string | null;
  etapa: Etapa;
  temperatura: Temperatura;
  pontos: number;
  entrega: StatusEntrega;
  proximoPasso: string | null;
  proximoPassoEm: string | null;
  proximoCanal: string | null;
  proximoToqueEm: string | null;
  pausada: boolean;
  canaisEncerrados: string[];
  whatsapp: string | null;
  instagram: string | null;
  email: string | null;
  primeiroToqueEm: string | null;
  ultimoToqueCanal: string | null;
  reuniaoCanal: string | null;
  reuniaoToque: string | null;
  vendaCanal: string | null;
  vendaToque: string | null;
  atualizadoEm: string | null;
};

/** O que vai para o navegador no Kanban. Campos vazios saem do JSON. */
export type Cartao = {
  id: number;
  nome: string;
  empresa?: string;
  segmento?: string;
  campanha?: string;
  origem?: string;
  etapa: Etapa;
  temperatura: Temperatura;
  pontos: number;
  /** Só os canais com status diferente do inicial. */
  entrega: Partial<StatusEntrega>;
  proximoPasso?: string;
  proximoPassoEm?: string;
  temTelefone: boolean;
};

export function estadoInicial(canal: CanalEntrega): string {
  return ESTADOS_ENTREGA[canal][0];
}

/** Estados em que o canal falhou antes de a mensagem sair: não contam como envio nem como toque. */
const SEM_ENVIO = new Set(["falhou", "sem_whatsapp"]);

/** Houve mensagem realmente enviada neste canal (status diferente do inicial e que não seja falha de envio). */
export function canalFoiTocado(canal: CanalEntrega, estado: string): boolean {
  return estado !== estadoInicial(canal) && !SEM_ENVIO.has(estado);
}

/** Situação da cadência em texto. Lead sem toque agendado nem feito nunca aparece como "ativo". */
export function situacaoDaCadencia(
  l: Pick<LeadSlim, "proximoCanal" | "primeiroToqueEm" | "pausada">,
  cad: { etapaAtual?: unknown; motivoPausa?: unknown } = {},
): string {
  if (l.pausada) return `pausada (${typeof cad.motivoPausa === "string" && cad.motivoPausa ? cad.motivoPausa : "sem motivo"})`;
  if (l.proximoCanal || l.primeiroToqueEm || cad.etapaAtual) return "ativa";
  return "ainda não começou (nenhum toque agendado nem enviado)";
}

export function cartaoDe(l: LeadSlim): Cartao {
  const entrega: Partial<StatusEntrega> = {};
  for (const c of CANAIS_ENTREGA) if (l.entrega[c] !== estadoInicial(c)) (entrega as Record<string, string>)[c] = l.entrega[c];
  const c: Cartao = {
    id: l.id,
    nome: l.nome,
    etapa: l.etapa,
    temperatura: l.temperatura,
    pontos: l.pontos,
    entrega,
    temTelefone: Boolean(l.whatsapp && l.whatsapp.replace(/\D/g, "").length >= 10),
  };
  if (l.empresa) c.empresa = l.empresa;
  if (l.segmento) c.segmento = l.segmento;
  if (l.campanha) c.campanha = l.campanha;
  if (l.origem) c.origem = l.origem;
  if (l.proximoPasso) c.proximoPasso = l.proximoPasso;
  if (l.proximoPassoEm) c.proximoPassoEm = l.proximoPassoEm;
  return c;
}

export type FiltroProximoPasso = "" | "vencido" | "hoje" | "7dias" | "sem_data";

export type Filtros = {
  busca?: string;
  etapa?: string;
  canal?: string;
  segmento?: string;
  campanha?: string;
  temperatura?: string;
  origem?: string;
  /** "<canal>:<estado>", ex.: "email:aberto". */
  entrega?: string;
  proximoPasso?: string;
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Estado do canal no cartão (o que não aparece está no estado inicial). */
export function estadoDoCanal(c: Pick<Cartao, "entrega">, canal: CanalEntrega): string {
  return c.entrega[canal] ?? estadoInicial(canal);
}

export function filtrarCartoes(cartoes: Cartao[], f: Filtros, agora: Date): Cartao[] {
  const busca = f.busca ? semAcento(f.busca.trim()) : "";
  const hoje0 = inicioDoDia(agora).getTime();
  const amanha0 = fimDoDia(agora).getTime();
  const em7 = amanha0 + 6 * 86_400_000;
  const canal = (CANAIS_ENTREGA as readonly string[]).includes(f.canal ?? "") ? (f.canal as CanalEntrega) : null;
  const [eCanal, eEstado] = (f.entrega ?? "").split(":");

  return cartoes.filter((c) => {
    if (f.etapa && c.etapa !== f.etapa) return false;
    if (f.segmento && c.segmento !== f.segmento) return false;
    if (f.campanha && c.campanha !== f.campanha) return false;
    if (f.temperatura && c.temperatura !== f.temperatura) return false;
    if (f.origem && c.origem !== f.origem) return false;
    // Canal: já houve toque nele (status diferente do inicial).
    if (canal && !canalFoiTocado(canal, estadoDoCanal(c, canal))) return false;
    if (eEstado) {
      const alvo = (CANAIS_ENTREGA as readonly string[]).includes(eCanal) ? [eCanal as CanalEntrega] : [];
      if (!alvo.some((k) => estadoDoCanal(c, k) === eEstado)) return false;
    }
    if (f.proximoPasso) {
      const t = c.proximoPassoEm ? new Date(c.proximoPassoEm).getTime() : null;
      if (f.proximoPasso === "sem_data" && t !== null) return false;
      if (f.proximoPasso === "vencido" && !(t !== null && t < hoje0)) return false;
      if (f.proximoPasso === "hoje" && !(t !== null && t >= hoje0 && t < amanha0)) return false;
      if (f.proximoPasso === "7dias" && !(t !== null && t >= hoje0 && t < em7)) return false;
    }
    if (busca) {
      const alvo = semAcento([c.nome, c.empresa, c.segmento, c.campanha, c.proximoPasso].filter(Boolean).join(" "));
      if (!alvo.includes(busca)) return false;
    }
    return true;
  });
}

/** Mais quente primeiro; no empate, quem tem próximo passo mais cedo; depois o nome. */
export function ordenarCartoes(cartoes: Cartao[]): Cartao[] {
  return [...cartoes].sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    const ta = a.proximoPassoEm ? Date.parse(a.proximoPassoEm) : Infinity;
    const tb = b.proximoPassoEm ? Date.parse(b.proximoPassoEm) : Infinity;
    if (ta !== tb) return ta - tb;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export function agruparPorEtapa(cartoes: Cartao[]): Record<Etapa, Cartao[]> {
  const out = Object.fromEntries(ETAPAS.map((e) => [e, [] as Cartao[]])) as Record<Etapa, Cartao[]>;
  for (const c of ordenarCartoes(cartoes)) out[c.etapa].push(c);
  return out;
}

const unicos = (xs: (string | undefined)[]) =>
  [...new Set(xs.filter((x): x is string => Boolean(x)))].sort((a, b) => a.localeCompare(b, "pt-BR"));

export function opcoesDeFiltro(cartoes: Cartao[]) {
  return {
    segmentos: unicos(cartoes.map((c) => c.segmento)),
    campanhas: unicos(cartoes.map((c) => c.campanha)),
    origens: unicos(cartoes.map((c) => c.origem)),
  };
}

/**
 * Abas do Kanban no celular: as etapas do fim do funil e as de fora do funil ficam agrupadas, para
 * caber na tela sem rolar para o lado. No computador as colunas continuam todas visíveis.
 */
export type GrupoAba = { id: string; rotulo: string; etapas: Etapa[] };

export const GRUPOS_ABAS: GrupoAba[] = [
  { id: "captado", rotulo: "Captado", etapas: ["captado"] },
  { id: "qualificado", rotulo: "Qualificado", etapas: ["qualificado"] },
  { id: "em_cadencia", rotulo: "Em cadência", etapas: ["em_cadencia"] },
  { id: "engajado", rotulo: "Engajado", etapas: ["engajado"] },
  { id: "respondeu", rotulo: "Respondeu", etapas: ["respondeu"] },
  { id: "reuniao_marcada", rotulo: "Reunião marcada", etapas: ["reuniao_marcada"] },
  { id: "depois", rotulo: "Depois da reunião", etapas: ["reuniao_feita", "proposta_enviada", "ganho"] },
  { id: "fora", rotulo: "Nutrição e saída", etapas: ["nutricao_continua", "saiu_da_lista"] },
];

export const totalDoGrupo = (g: GrupoAba, colunas: Record<Etapa, Cartao[]>) => g.etapas.reduce((s, e) => s + colunas[e].length, 0);

/** Aba aberta de início: a de maior prioridade com lead (quem respondeu primeiro); sem nenhum lead, Qualificado. */
const PRIORIDADE_ABAS = ["respondeu", "engajado", "reuniao_marcada", "depois", "em_cadencia", "qualificado", "captado", "fora"];
export function abaInicial(colunas: Record<Etapa, Cartao[]>): string {
  for (const id of PRIORIDADE_ABAS) {
    const g = GRUPOS_ABAS.find((x) => x.id === id)!;
    if (totalDoGrupo(g, colunas) > 0) return id;
  }
  return "qualificado";
}
