import type { LeadSlim } from "./cartao";
import { linkBuscaLinkedin, linkInstagram, linkLigar, linkWhatsapp } from "./contato";
import { decisorDoDossie, linkedinDoDossie, notaLinkedinDoKit, roteiroDoKit } from "./dossie";
import { limparNotaLinkedin } from "./linkedin";
import { fimDoDia, haQuanto, inicioDoDia } from "./tempo";

/**
 * Fila do dia (Plano Outbound, seção 5): o que o Thiago faz hoje, em ordem:
 * respostas pendentes, engajados, ligações devidas, reuniões do dia, LinkedIn.
 * Função pura: recebe os leads candidatos e as interações recentes.
 */

export type InteracaoFila = {
  leadId: number;
  canal: string;
  direcao: "entrada" | "saida";
  tipo: string;
  /** ISO. */
  data: string;
  conteudo?: string | null;
  pontos: number;
};

/** Lead candidato, já com os campos pesados (kit e dossiê) que só a Fila e a ficha leem. */
export type LeadFila = LeadSlim & { kit?: unknown; dossie?: unknown };

export type SecaoFila = "resposta" | "engajado" | "ligacao" | "reuniao" | "linkedin";

export type ItemFila = {
  leadId: number;
  secao: SecaoFila;
  nome: string;
  empresa: string | null;
  etapa: string;
  temperatura: string;
  pontos: number;
  /** Por que o lead está na fila. */
  motivo: string;
  /** Mensagem do lead (respostas pendentes). */
  mensagem?: string;
  canalResposta?: string;
  /** ISO de quando o item passou a valer (resposta, reunião, toque devido). */
  desde?: string;
  desdeTexto?: string;
  ligar: string | null;
  whatsapp: string | null;
  instagram: string | null;
  /** Só na seção ligação e nos engajados. */
  roteiro?: string | null;
  /** Só no LinkedIn. */
  linkedinUrl?: string;
  linkedinDireto?: boolean;
  notaLinkedin?: string | null;
  /** Engajado que também tem ligação devida. */
  ligacaoDevida?: boolean;
  proximoPasso?: string | null;
};

export type Fila = Record<"respostas" | "engajados" | "ligacoes" | "reunioes" | "linkedin", ItemFila[]>;

const t = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

const PONTUA = new Set(["aberto", "clicado", "deu_play", "abriu_pagina", "lido"]);

const ROTULO_SINAL: Record<string, string> = {
  aberto: "abriu o e-mail",
  clicado: "clicou no link",
  deu_play: "assistiu ao vídeo de prova",
  lido: "leu o WhatsApp",
};

/** "Clicou no link (3 pontos) e abriu o e-mail (1 ponto)": o motivo de o lead estar engajado. */
export function motivoEngajamento(inters: InteracaoFila[], agora: Date, janelaDias = 7): string {
  const desde = agora.getTime() - janelaDias * 86_400_000;
  const sinais = inters.filter((i) => PONTUA.has(i.tipo) && i.pontos > 0 && t(i.data) >= desde);
  if (sinais.length === 0) return "Passou dos pontos de engajamento da semana";
  sinais.sort((a, b) => b.pontos - a.pontos || t(b.data) - t(a.data));
  const textos = sinais.slice(0, 3).map((s) => {
    const base = s.tipo === "abriu_pagina" ? (s.conteudo ? s.conteudo.charAt(0).toLowerCase() + s.conteudo.slice(1) : "visitou a página") : ROTULO_SINAL[s.tipo] ?? s.tipo;
    return `${base} (${s.pontos} ${s.pontos === 1 ? "ponto" : "pontos"})`;
  });
  const frase = textos.join(", ");
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

export function montarFila(leads: LeadFila[], interacoes: InteracaoFila[], agora: Date): Fila {
  const fim = fimDoDia(agora).getTime();
  const ini = inicioDoDia(agora).getTime();
  const porLead = new Map<number, InteracaoFila[]>();
  for (const i of interacoes) {
    const l = porLead.get(i.leadId);
    if (l) l.push(i);
    else porLead.set(i.leadId, [i]);
  }
  for (const l of porLead.values()) l.sort((a, b) => t(b.data) - t(a.data)); // mais recente primeiro

  const vistos = new Set<number>();
  const fila: Fila = { respostas: [], engajados: [], ligacoes: [], reunioes: [], linkedin: [] };

  const base = (l: LeadFila, secao: SecaoFila, motivo: string): ItemFila => ({
    leadId: l.id,
    secao,
    nome: l.nome,
    empresa: l.empresa,
    etapa: l.etapa,
    temperatura: l.temperatura,
    pontos: l.pontos,
    motivo,
    ligar: linkLigar(l.whatsapp),
    whatsapp: linkWhatsapp(l.whatsapp),
    instagram: linkInstagram(l.instagram),
    proximoPasso: l.proximoPasso,
  });

  const ultimo = (l: LeadFila, pred: (i: InteracaoFila) => boolean) => (porLead.get(l.id) ?? []).find(pred);

  // 1. Respostas pendentes: Respondeu e nenhuma saída depois da última entrada.
  for (const l of leads.filter((x) => x.etapa === "respondeu")) {
    const resp = ultimo(l, (i) => i.tipo === "respondido" && i.direcao === "entrada");
    const respondida = ultimo(l, (i) => i.direcao === "saida" && i.tipo === "enviado" && (!resp || t(i.data) > t(resp.data)));
    if (respondida) continue;
    const item = base(l, "resposta", resp ? `Respondeu por ${rotuloCanal(resp.canal)}` : "Está em Respondeu, sem resposta nossa registrada");
    if (resp) {
      item.mensagem = resp.conteudo ?? undefined;
      item.canalResposta = resp.canal;
      item.desde = resp.data;
      item.desdeTexto = haQuanto(new Date(resp.data), agora);
    }
    fila.respostas.push(item);
    vistos.add(l.id);
  }
  // Quem espera há mais tempo primeiro; sem data vai para o fim.
  fila.respostas.sort((a, b) => (t(a.desde) || Infinity) - (t(b.desde) || Infinity));

  const ligacaoDevida = (l: LeadFila): boolean => {
    if (l.proximoCanal !== "ligacao" || l.pausada || l.canaisEncerrados.includes("ligacao")) return false;
    const quando = t(l.proximoToqueEm);
    if (!(quando < fim)) return false;
    if (!linkLigar(l.whatsapp)) return false;
    // Já tratada: resultado de ligação registrado depois da data do toque.
    return !ultimo(l, (i) => i.tipo === "resultado_ligacao" && t(i.data) >= quando);
  };

  // 2. Engajados, com o motivo. Quem já teve resultado de ligação depois do último sinal sai da lista.
  for (const l of leads.filter((x) => x.etapa === "engajado" && !vistos.has(x.id))) {
    const inters = porLead.get(l.id) ?? [];
    const ultimoSinal = inters.find((i) => PONTUA.has(i.tipo) && i.pontos > 0);
    if (ultimoSinal && ultimo(l, (i) => i.tipo === "resultado_ligacao" && t(i.data) >= t(ultimoSinal.data))) continue;
    const item = base(l, "engajado", motivoEngajamento(inters, agora));
    item.roteiro = roteiroDoKit(l.kit);
    item.ligacaoDevida = ligacaoDevida(l);
    item.desde = ultimoSinal?.data;
    item.desdeTexto = ultimoSinal ? haQuanto(new Date(ultimoSinal.data), agora) : undefined;
    fila.engajados.push(item);
    vistos.add(l.id);
  }
  fila.engajados.sort((a, b) => b.pontos - a.pontos || (t(b.desde) || 0) - (t(a.desde) || 0));

  // 3. Ligações devidas (cadência com próximo canal = ligação e data até hoje), mais atrasadas primeiro.
  const devidas = leads.filter((l) => !vistos.has(l.id) && ligacaoDevida(l));
  devidas.sort((a, b) => t(a.proximoToqueEm) - t(b.proximoToqueEm));
  for (const l of devidas) {
    const atraso = t(l.proximoToqueEm) < ini;
    const item = base(l, "ligacao", atraso ? `Ligação atrasada, prevista ${haQuanto(new Date(l.proximoToqueEm!), agora)}` : "Ligação de hoje na cadência");
    item.roteiro = roteiroDoKit(l.kit);
    item.desde = l.proximoToqueEm ?? undefined;
    fila.ligacoes.push(item);
    vistos.add(l.id);
  }

  // 4. Reuniões do dia (etapa Reunião marcada com data de hoje) e as que já passaram sem resultado
  // registrado (o botão "Reunião feita" pede o resultado), por horário.
  const reunioes = leads
    .filter((l) => l.etapa === "reuniao_marcada" && !vistos.has(l.id) && t(l.proximoPassoEm) < fim)
    .sort((a, b) => t(a.proximoPassoEm) - t(b.proximoPassoEm));
  for (const l of reunioes) {
    const atrasada = t(l.proximoPassoEm) < ini;
    const item = base(l, "reuniao", atrasada ? `Reunião ${haQuanto(new Date(l.proximoPassoEm!), agora)}, sem resultado registrado` : "Reunião de 20 minutos hoje");
    item.desde = l.proximoPassoEm ?? undefined;
    fila.reunioes.push(item);
    vistos.add(l.id);
  }

  // 5. LinkedIn: convite devido hoje e ainda não enviado.
  const devidosLinkedin = leads
    .filter((l) => {
      if (vistos.has(l.id) || l.proximoCanal !== "linkedin" || l.pausada || l.canaisEncerrados.includes("linkedin")) return false;
      const quando = t(l.proximoToqueEm);
      if (!(quando < fim)) return false;
      return !ultimo(l, (i) => i.canal === "linkedin" && (i.tipo === "enviado" || i.tipo === "linkedin_convite_enviado") && t(i.data) >= quando);
    })
    .sort((a, b) => t(a.proximoToqueEm) - t(b.proximoToqueEm));
  for (const l of devidosLinkedin) {
    const direto = linkedinDoDossie(l.dossie);
    const decisor = decisorDoDossie(l.dossie);
    const item = base(l, "linkedin", "Convite do LinkedIn de hoje");
    item.linkedinDireto = Boolean(direto);
    item.linkedinUrl = direto ?? linkBuscaLinkedin(decisor ?? l.nome, l.empresa);
    item.notaLinkedin = limparNotaLinkedin(notaLinkedinDoKit(l.kit));
    item.desde = l.proximoToqueEm ?? undefined;
    fila.linkedin.push(item);
    vistos.add(l.id);
  }

  return fila;
}

const ROTULO_CANAL: Record<string, string> = { dm: "DM", email: "e-mail", whatsapp: "WhatsApp", ligacao: "ligação", linkedin: "LinkedIn" };
export const rotuloCanal = (c: string) => ROTULO_CANAL[c] ?? c;

export const totalDaFila = (f: Fila) => f.respostas.length + f.engajados.length + f.ligacoes.length + f.reunioes.length + f.linkedin.length;
