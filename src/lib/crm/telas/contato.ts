import { normalizarHandle } from "../identificar";

/** Número do WhatsApp do lead em formato internacional, só dígitos (ou null). */
export function telefoneInternacional(whatsapp: string | null | undefined): string | null {
  const d = (whatsapp ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  if (d.length <= 11) return `55${d}`; // DDD + número, sem DDI
  return d;
}

/** Telefone para ler na tela: "(11) 93340-0264". Fora do padrão brasileiro, devolve com + e só dígitos. */
export function telefoneLegivel(whatsapp: string | null | undefined): string | null {
  const t = telefoneInternacional(whatsapp);
  if (!t) return null;
  const br = t.startsWith("55") ? t.slice(2) : null;
  if (br && br.length === 11) return `(${br.slice(0, 2)}) ${br.slice(2, 7)}-${br.slice(7)}`;
  if (br && br.length === 10) return `(${br.slice(0, 2)}) ${br.slice(2, 6)}-${br.slice(6)}`;
  return `+${t}`;
}

export function linkLigar(whatsapp: string | null | undefined): string | null {
  const t = telefoneInternacional(whatsapp);
  return t ? `tel:+${t}` : null;
}

export function linkWhatsapp(whatsapp: string | null | undefined): string | null {
  const t = telefoneInternacional(whatsapp);
  return t ? `https://wa.me/${t}` : null;
}

export function linkInstagram(instagram: string | null | undefined): string | null {
  const h = instagram ? normalizarHandle(instagram) : "";
  return h ? `https://www.instagram.com/${h}/` : null;
}

/** Busca de pessoas no LinkedIn por nome e empresa (plano, seção 5: nenhuma automação, só o link). */
export function linkBuscaLinkedin(nome: string | null | undefined, empresa: string | null | undefined): string {
  const termos = [nome, empresa].filter(Boolean).join(" ").trim();
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(termos).replace(/%20/g, "+")}`;
}
