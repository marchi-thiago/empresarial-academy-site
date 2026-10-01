import { createHmac, timingSafeEqual } from "crypto";
import { siteConfig } from "@/lib/site-config";

/**
 * Rastreio pelo próprio domínio. Os códigos são assinados (HMAC com PAYLOAD_SECRET) e sem estado:
 *   clique   /r/<leadId>.<toque>.<destino>.<assinatura>
 *   abertura /o/<leadId>.<toque>.<assinatura>.gif
 * `destino` é uma palavra da lista abaixo ou `x` + caminho do site em base64url (também assinado):
 * nunca existe redirecionamento para fora do domínio.
 */

export const DESTINOS = ["conversa", "material", "blog", "diagnostico"] as const;
export type DestinoNomeado = (typeof DESTINOS)[number];

/** Caminho no site de cada destino nomeado (a conversa ganha o token do lead na hora do clique). */
export const CAMINHO_DO_DESTINO: Record<Exclude<DestinoNomeado, "conversa">, string> = {
  material: "/materiais",
  blog: "/blog",
  diagnostico: "/diagnostico-maturidade-empresarial.html",
};

const TOQUE = /^[a-z0-9_]{1,24}$/;
const CAMINHO = /^\/(?!\/)[A-Za-z0-9/_\-.%]{0,200}$/;

function segredo(): string {
  const s = process.env.PAYLOAD_SECRET;
  if (!s) throw new Error("PAYLOAD_SECRET ausente: o rastreio não pode assinar links.");
  return s;
}

const assinar = (texto: string) => createHmac("sha256", segredo()).update(texto).digest("base64url").slice(0, 22);

function igual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type Destino = DestinoNomeado | { caminho: string };

const destinoParaCodigo = (d: Destino) => (typeof d === "string" ? d : `x${Buffer.from(d.caminho).toString("base64url")}`);

export function codigoDeClique(leadId: number, toque: string, destino: Destino): string {
  if (!TOQUE.test(toque)) throw new Error(`toque inválido: ${toque}`);
  if (typeof destino !== "string" && !CAMINHO.test(destino.caminho)) throw new Error("caminho de destino inválido");
  const base = `${leadId}.${toque}.${destinoParaCodigo(destino)}`;
  return `${base}.${assinar(`r:${base}`)}`;
}

export function urlDeClique(leadId: number, toque: string, destino: Destino): string {
  return `${siteConfig.url}/r/${codigoDeClique(leadId, toque, destino)}`;
}

export type CliqueLido = { leadId: number; toque: string; destino: Destino };

export function lerCodigoDeClique(codigo: string): CliqueLido | null {
  const partes = codigo.split(".");
  if (partes.length !== 4) return null;
  const [id, toque, dest, sig] = partes;
  const leadId = Number(id);
  if (!Number.isInteger(leadId) || leadId <= 0 || !TOQUE.test(toque)) return null;
  try {
    if (!igual(assinar(`r:${id}.${toque}.${dest}`), sig)) return null;
  } catch {
    return null;
  }
  if ((DESTINOS as readonly string[]).includes(dest)) return { leadId, toque, destino: dest as DestinoNomeado };
  if (dest.startsWith("x")) {
    const caminho = Buffer.from(dest.slice(1), "base64url").toString("utf8");
    if (CAMINHO.test(caminho)) return { leadId, toque, destino: { caminho } };
  }
  return null;
}

export function urlDoPixel(leadId: number, toque: string): string {
  if (!TOQUE.test(toque)) throw new Error(`toque inválido: ${toque}`);
  const base = `${leadId}.${toque}`;
  return `${siteConfig.url}/o/${base}.${assinar(`o:${base}`)}.gif`;
}

export function lerCodigoDoPixel(arquivo: string): { leadId: number; toque: string } | null {
  const semGif = arquivo.replace(/\.gif$/i, "");
  const partes = semGif.split(".");
  if (partes.length !== 3) return null;
  const [id, toque, sig] = partes;
  const leadId = Number(id);
  if (!Number.isInteger(leadId) || leadId <= 0 || !TOQUE.test(toque)) return null;
  try {
    if (!igual(assinar(`o:${id}.${toque}`), sig)) return null;
  } catch {
    return null;
  }
  return { leadId, toque };
}

/** Pré-visualizadores, antivírus de link e robôs: o clique deles não é de uma pessoa. */
export const ehRobo = (userAgent: string | null): boolean =>
  !userAgent || /bot|crawl|spider|preview|scanner|prefetch|headless|curl|wget|python|go-http|java\/|okhttp|facebookexternalhit|slack|whatsapp\/|skypeuripreview/i.test(userAgent);

/** Classifica o caminho do destino para a pontuação (`abriu_pagina`): material e blog 3 pontos, diagnóstico 5. */
export function destinoDeInteracao(destino: Destino): "conversa" | "material" | "blog" | "diagnostico" | "outro" {
  if (typeof destino === "string") return destino;
  const c = destino.caminho.toLowerCase();
  if (c.startsWith("/materiais") || c.startsWith("/baixar")) return "material";
  if (c.startsWith("/blog")) return "blog";
  if (c.includes("diagnostico")) return "diagnostico";
  if (c.startsWith("/conversa")) return "conversa";
  return "outro";
}

/**
 * Função `rastrear(url, rotulo)` do e-mail (F7): link do próprio site vira /r/<codigo>; link de fora
 * (ou com parâmetros, que o código assinado não carrega) segue como veio.
 */
export function rastreadorDoLead(leadId: number, toque: string): (url: string, rotulo?: string) => string {
  return (url) => {
    try {
      const u = new URL(url);
      if (u.origin !== new URL(siteConfig.url).origin) return url;
      if (u.pathname.startsWith("/conversa")) return urlDeClique(leadId, toque, "conversa");
      if (u.search || u.hash || !CAMINHO.test(u.pathname)) return url;
      return urlDeClique(leadId, toque, { caminho: u.pathname });
    } catch {
      return url;
    }
  };
}
