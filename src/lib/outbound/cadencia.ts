import type { Etapa, StatusEntrega, Temperatura } from "@/lib/crm/tipos";
import { LIMITES } from "./config";
import { inicioDoDia, somarDias } from "./tempo";

/**
 * Cadência adaptativa (Plano Outbound, seção 6). Funções puras: recebem o lead e o histórico
 * de toques reais e dizem qual é o próximo toque de cada canal. Nada aqui toca banco, rede ou relógio.
 */

export type CanalCadencia = "dm" | "email" | "whatsapp" | "linkedin" | "ligacao";

type DefToque = { id: string; dia: number; canal: CanalCadencia | "melhor"; fallback?: { id: string; canal: CanalCadencia } };

export const CADENCIA: readonly DefToque[] = [
  { id: "dm1", dia: 0, canal: "dm" },
  { id: "email1", dia: 1, canal: "email" },
  { id: "linkedin", dia: 2, canal: "linkedin" },
  { id: "dm2", dia: 3, canal: "dm" },
  { id: "whatsapp1", dia: 4, canal: "whatsapp", fallback: { id: "dm_extra", canal: "dm" } },
  { id: "email2", dia: 6, canal: "email" },
  { id: "ligacao", dia: 8, canal: "ligacao" },
  { id: "whatsapp2", dia: 10, canal: "whatsapp" },
  { id: "ultimo", dia: 14, canal: "melhor" },
];

export const ETAPAS_NA_CADENCIA: readonly string[] = ["qualificado", "em_cadencia", "engajado", "em_andamento"];

export type LeadCadencia = {
  id: number;
  etapa: Etapa;
  temperatura: Temperatura;
  pausada: boolean;
  /** Opt-out em qualquer frente (nutrição ou campanhas) ou etapa Saiu da lista. */
  optOut: boolean;
  email: string | null;
  instagram: string | null;
  whatsapp: string | null;
  canaisEncerrados: string[];
  statusEntrega: StatusEntrega;
  primeiroToqueEm: Date | null;
  /** O dossiê traz o perfil do decisor no LinkedIn. */
  linkedinDecisor: boolean;
  /** E-mail em lista de supressão (opt-out ou bounce em outro cadastro com o mesmo endereço). */
  emailSuprimido?: boolean;
};

/** Fato real de saída (nunca simulado) ou falha, em ordem qualquer. */
export type Historico = { canal: string; tipo: string; data: Date; toque?: string | null };

export type Pendente = { toque: string; canal: CanalCadencia; dia: number; devidoEm: Date };

const digitos = (v: string | null) => (v ?? "").replace(/\D/g, "");
const emailSintaxeOk = (v: string | null) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/**
 * Endereço de modelo que o site do lead deixou no formulário ("seu@email.com", "exemplo@dominio.com", "teste@..."):
 * não é caixa de ninguém e volta como bounce, então não conta como canal de e-mail.
 */
const LOCAL_DE_EXEMPLO = /^(seu|sua|seuemail|seu[._-]?(nome|email)|nome[._-]?(sobrenome|completo)|exemplo|example|teste|test|fulano|meu[._-]?email)$/i;
const LOCAL_GENERICO = /^(email|e[._-]?mail|nome|usuario|user|voce|contato|atendimento)$/i;
const DOMINIO_DE_EXEMPLO = /(^|\.)(example|exemplo|exemplos)\./i;
/** Domínio que ninguém registra para uma empresa: qualquer endereço nele é modelo. */
const DOMINIO_DE_MODELO = /^(seudominio|seusite|meusite|meudominio|suaempresa|seuprovedor|yourdomain|yoursite|mysite)\.[a-z.]+$/i;
/** Domínio de webmail ou de teste genérico: só é modelo com local genérico ("email@email.com", "nome@dominio.com"). */
const DOMINIO_GENERICO = /^(email|dominio|domain|test|teste)\.[a-z.]+$/i;

export function emailDeExemplo(v: string | null | undefined): boolean {
  const e = (v ?? "").trim().toLowerCase();
  const i = e.lastIndexOf("@");
  if (i < 1) return false;
  const local = e.slice(0, i);
  const dominio = e.slice(i + 1);
  if (LOCAL_DE_EXEMPLO.test(local) || DOMINIO_DE_EXEMPLO.test(dominio) || DOMINIO_DE_MODELO.test(dominio)) return true;
  return DOMINIO_GENERICO.test(dominio) && LOCAL_GENERICO.test(local);
}

const emailValido = (v: string | null) => emailSintaxeOk(v) && !emailDeExemplo(v);

export function canaisDisponiveis(l: LeadCadencia): Set<CanalCadencia> {
  const ok = (c: CanalCadencia) => !l.canaisEncerrados.includes(c);
  const s = new Set<CanalCadencia>();
  if (l.instagram && ok("dm") && l.statusEntrega.dm !== "falhou") s.add("dm");
  if (emailValido(l.email) && ok("email") && l.statusEntrega.email !== "devolvido" && !l.emailSuprimido && !l.optOut) s.add("email");
  if (digitos(l.whatsapp).length >= 10 && ok("whatsapp") && l.statusEntrega.whatsapp !== "sem_whatsapp") s.add("whatsapp");
  if (l.linkedinDecisor && ok("linkedin")) s.add("linkedin");
  if (digitos(l.whatsapp).length >= 10 && ok("ligacao")) s.add("ligacao"); // o telefone é o número do WhatsApp
  return s;
}

const FORCA_ENTREGA = ["clicado", "aberto", "lido", "vista", "aceito", "entregue", "enviado", "enviada", "convite_enviado"];

/** Canal com mais sinal de vida (clicou, abriu, leu); empate: e-mail, WhatsApp, DM. */
export function melhorCanal(l: LeadCadencia, disp: Set<CanalCadencia>): CanalCadencia | null {
  const ordem: CanalCadencia[] = ["email", "whatsapp", "dm"];
  let melhor: CanalCadencia | null = null;
  let pontos = -1;
  for (const c of ordem) {
    if (!disp.has(c)) continue;
    const idx = FORCA_ENTREGA.indexOf(l.statusEntrega[c as keyof StatusEntrega] as string);
    const p = idx === -1 ? 0 : FORCA_ENTREGA.length - idx;
    if (p > pontos) {
      melhor = c;
      pontos = p;
    }
  }
  return melhor;
}

/** D0: primeiro toque; sem ele, o dia em que descobrimos que a DM é impossível. */
export function d0Do(l: LeadCadencia, hist: Historico[]): Date | null {
  if (l.primeiroToqueEm) return l.primeiroToqueEm;
  const falhas = hist.filter((h) => h.tipo === "falha" && h.canal === "dm").sort((a, b) => a.data.getTime() - b.data.getTime());
  return falhas[0]?.data ?? null;
}

/** Quantos toques reais já saíram em cada canal (o toque "ultimo" fica de fora). Ligação conta resultado. */
function contagens(hist: Historico[]): { porCanal: Record<string, number>; ultimoFeito: boolean } {
  const porCanal: Record<string, number> = {};
  let ultimoFeito = false;
  for (const h of hist) {
    if (h.tipo === "enviado" && h.toque === "ultimo") {
      ultimoFeito = true;
      continue;
    }
    if (h.tipo === "enviado" || (h.tipo === "resultado_ligacao" && h.canal === "ligacao")) {
      porCanal[h.canal] = (porCanal[h.canal] ?? 0) + 1;
    }
  }
  return { porCanal, ultimoFeito };
}

/**
 * Toques que faltam, na ordem da cadência, com o dia em que vencem. Canal que o lead não tem é pulado
 * (WhatsApp 1 vira "DM extra"). O 1º toque pendente de cada canal é o único que importa: o 2º só vence depois.
 */
export function pendentes(l: LeadCadencia, hist: Historico[]): Pendente[] {
  const d0 = d0Do(l, hist);
  if (!d0) return [];
  const base = inicioDoDia(d0);
  const disp = canaisDisponiveis(l);
  const { porCanal, ultimoFeito } = contagens(hist);
  const slot: Record<string, number> = {};
  const saida: Pendente[] = [];
  const vistos = new Set<CanalCadencia>();

  for (const def of CADENCIA) {
    if (def.canal === "melhor") {
      const melhor = melhorCanal(l, disp);
      if (melhor && !ultimoFeito) saida.push({ toque: def.id, canal: melhor, dia: def.dia, devidoEm: somarDias(base, def.dia) });
      continue;
    }
    let canal: CanalCadencia = def.canal;
    let id = def.id;
    if (!disp.has(canal) && def.fallback && disp.has(def.fallback.canal)) {
      canal = def.fallback.canal;
      id = def.fallback.id;
    }
    if (!disp.has(canal)) continue;
    slot[canal] = (slot[canal] ?? 0) + 1;
    const feito = (porCanal[canal] ?? 0) >= slot[canal];
    if (feito || vistos.has(canal)) continue;
    vistos.add(canal);
    saida.push({ toque: id, canal, dia: def.dia, devidoEm: somarDias(base, def.dia) });
  }
  return saida;
}

export type Agendamento = { toque: string; canal: CanalCadencia; em: Date; dia: number };

/**
 * Próximo toque do lead, para gravar em `cadencia.proximoToqueEm` e `proximoCanal`.
 * Lead engajado entra na fila de ligação no mesmo dia (se tem telefone e ainda não ligamos).
 */
export function agendamentoDoLead(l: LeadCadencia, hist: Historico[], hoje: Date): Agendamento | null {
  const disp = canaisDisponiveis(l);
  const ligou = hist.some((h) => h.tipo === "resultado_ligacao");
  if (l.etapa === "engajado" && disp.has("ligacao") && !ligou) return { toque: "ligacao", canal: "ligacao", em: inicioDoDia(hoje), dia: 8 };
  const p = pendentes(l, hist);
  if (p.length === 0) return null;
  const primeiro = [...p].sort((a, b) => a.devidoEm.getTime() - b.devidoEm.getTime() || a.dia - b.dia)[0];
  return { toque: primeiro.toque, canal: primeiro.canal, em: primeiro.devidoEm, dia: primeiro.dia };
}

/** O lead entra na cadência? (Etapa ativa, sem pausa, sem opt-out, 1º toque dentro da janela.) */
export function elegivel(l: LeadCadencia, hist: Historico[], hoje: Date): boolean {
  if (l.pausada || l.optOut) return false;
  if (!ETAPAS_NA_CADENCIA.includes(l.etapa)) return false;
  const d0 = d0Do(l, hist);
  if (!d0) return false;
  return hoje.getTime() - d0.getTime() <= LIMITES.janelaCadenciaDias * 86_400_000;
}

export type EmailDevido = { toque: string; devidoEm: Date };

/**
 * O e-mail que está devido hoje para o lead, ou null. Regras: no máximo 1 toque real por dia por lead
 * (qualquer canal) e 2 dias de distância entre e-mails.
 */
export function emailDevido(l: LeadCadencia, hist: Historico[], hoje: Date): EmailDevido | null {
  if (!elegivel(l, hist, hoje)) return null;
  const p = pendentes(l, hist).find((x) => x.canal === "email");
  if (!p) return null;
  const inicioHoje = inicioDoDia(hoje);
  if (p.devidoEm.getTime() >= somarDias(inicioHoje, 1).getTime()) return null; // ainda não venceu
  if (hist.some((h) => h.tipo === "enviado" && h.data.getTime() >= inicioHoje.getTime())) return null; // já recebeu um toque hoje
  const limite = hoje.getTime() - LIMITES.diasMinimosEntreEmails * 86_400_000;
  if (hist.some((h) => h.tipo === "enviado" && h.canal === "email" && h.data.getTime() > limite)) return null;
  return { toque: p.toque, devidoEm: p.devidoEm };
}
