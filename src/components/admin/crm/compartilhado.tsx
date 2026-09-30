import type { ReactNode } from "react";
import { CANAIS_ENTREGA, ESTADOS_ENTREGA, ROTULO_ESTADO, type CanalEntrega, type StatusEntrega, type Temperatura } from "@/lib/crm/tipos";

/** Peças visuais do CRM que servem ao servidor e ao navegador (sem estado). Estilo em ea-crm.css. */

export const ROTULO_CANAL: Record<string, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
  dm: "DM do Instagram",
  linkedin: "LinkedIn",
  ligacao: "Ligação",
  nota: "Nota",
  sistema: "Sistema",
};

export const ROTULO_TIPO: Record<string, string> = {
  enviado: "Enviado",
  entregue: "Entregue",
  aberto: "Abriu o e-mail",
  clicado: "Clicou no link",
  lido: "Leu",
  respondido: "Respondeu",
  bounce: "E-mail devolvido",
  falha: "Falhou",
  resultado_ligacao: "Resultado da ligação",
  movimento_manual: "Movimento manual",
  lembrete: "Lembrete",
  agendou: "Agendou a reunião",
  deu_play: "Assistiu ao vídeo",
  abriu_pagina: "Abriu a página",
  descadastro: "Pediu para sair",
};

const ROTULO_TEMPERATURA: Record<Temperatura, string> = { frio: "Frio", morno: "Morno", engajado: "Engajado" };

export function SeloTemperatura({ temperatura, pontos }: { temperatura: Temperatura; pontos: number }) {
  return (
    <span className={`ea-crm-selo ea-crm-selo--${temperatura}`} title={`${ROTULO_TEMPERATURA[temperatura]}: ${pontos} ponto(s) nos últimos 7 dias`}>
      {ROTULO_TEMPERATURA[temperatura]}
      <b>{pontos} {pontos === 1 ? "pt" : "pts"}</b>
    </span>
  );
}

/** Quão adiantado está o canal, para a cor do ícone. */
export function nivelEntrega(estado: string): "nenhum" | "enviado" | "entregue" | "positivo" | "falha" {
  if (estado.startsWith("nao_")) return "nenhum";
  if (["devolvido", "falhou", "sem_whatsapp"].includes(estado)) return "falha";
  if (["aberto", "clicado", "lido", "vista", "aceito"].includes(estado)) return "positivo";
  if (estado === "entregue") return "entregue";
  return "enviado";
}

const ICONES: Record<CanalEntrega, ReactNode> = {
  email: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20l1.3-4.2A8 8 0 1 1 8.3 18.8L4 20z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 9c0 3 3 6 6 6l1.2-1.5-2-1-1 .7c-.9-.4-1.6-1.1-2-2l.7-1-1-2L9 9z" fill="currentColor" />
    </svg>
  ),
  dm: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 4 3 11l6.5 2.5L12 20l2.5-5.5L21 4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m9.5 13.5 4-3.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10.5V16M8 8v.01M11.5 16v-3.2c0-1.5 1-2.3 2.2-2.3s1.8.8 1.8 2.2V16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
};

const NOME_CANAL: Record<CanalEntrega, string> = { email: "E-mail", whatsapp: "WhatsApp", dm: "DM", linkedin: "LinkedIn" };

/** Ícones de status de entrega dos 4 canais. `entrega` pode vir parcial: o que falta está no estado inicial. */
export function IconesEntrega({ entrega, comTexto = false }: { entrega: Partial<StatusEntrega>; comTexto?: boolean }) {
  return (
    <ul className="ea-crm-entrega" aria-label="Status de entrega por canal">
      {CANAIS_ENTREGA.map((canal) => {
        const estado = (entrega[canal] ?? ESTADOS_ENTREGA[canal][0]) as string;
        const rotulo = ROTULO_ESTADO[estado] ?? estado;
        return (
          <li key={canal} className={`ea-crm-entrega-item ea-crm-entrega-item--${nivelEntrega(estado)}`} title={`${NOME_CANAL[canal]}: ${rotulo}`}>
            {ICONES[canal]}
            <span className={comTexto ? "ea-crm-entrega-texto" : "ea-crm-so-leitor"}>
              {NOME_CANAL[canal]}: {rotulo}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Cabeçalho de registro do manifesto e do ícone do atalho da Tela de Início (React 19 leva para o head). */
export function CabecalhoAtalho() {
  return (
    <>
      <link rel="manifest" href="/api/crm/manifest" />
      <link rel="apple-touch-icon" href="/crm/icone-180.png" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="Fila do dia" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="theme-color" content="#1D2B3C" />
    </>
  );
}
