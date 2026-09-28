/**
 * Configuração central da marca e do site.
 * Fonte da verdade: "Branding Empresarial Academy v3 (2026).md" (posicionamento
 * de 28/09/2026: consultoria empresarial com IA, Gestão 360™ como metodologia
 * proprietária, sistemas sob medida como uma das entregas da consultoria).
 */
export const siteConfig = {
  name: "Empresarial Academy",
  shortName: "Empresarial Academy",
  slogan: "Conhecimento que Impulsiona",
  tagline: "Método para crescer. Gestão para permanecer.",
  description:
    "Consultoria empresarial com IA para PMEs: método Gestão 360™ e sistemas com IA sob medida para ganhar tempo, reduzir custos e aumentar o lucro.",
  // Ajustar quando o domínio oficial for definido (Fase 2, item 1).
  url: "https://empresarialacademy.com",
  locale: "pt-BR",
  founder: "Thiago Marchi",
  contact: {
    email: "contato@empresarialacademy.com",
    phone: "+55 (11) 93340-0264",
    phoneRaw: "5511933400264",
    address: "São Paulo - SP, Brasil",
    whatsappMessage: "Olá! Vim pelo site e gostaria de saber mais sobre a Empresarial Academy.",
  },
  /** Exposto no rodapé (item 15 do checklist da LP, 04/08/2026) — existência
   * formal é diferencial gratuito contra concorrentes sem identificação. */
  cnpj: "52.281.916/0001-60",
  social: {
    instagram: "https://www.instagram.com/empresarial.academy",
    linkedin: "https://www.linkedin.com/company/empresarial-academy",
    facebook: "https://web.facebook.com/profile.php?id=61575032293629",
    youtube: "https://www.youtube.com/@EmpresarialAcademy",
    linktree: "https://linktr.ee/empresarialacademy",
    tiktok: "https://www.tiktok.com/@empresarial.academy",
  },
  youtubeChannelId: "UCMwl07dy4cRIkPM6EB53FOg",
} as const;

export const mainNav = [
  { label: "Início", href: "/" },
  { label: "Institucional", href: "/institucional" },
  { label: "Serviços", href: "/servicos" },
  { label: "Soluções com IA", href: "/solucoes-com-ia" },
  { label: "Materiais Gratuitos", href: "/materiais" },
  { label: "Blog", href: "/blog" },
  { label: "Contato", href: "/contato" },
] as const;

/** Itens do mega menu de Serviços (ordem = hierarquia oficial do Branding v3 §2). */
export const servicosMenu = [
  {
    icon: "chart",
    title: "Consultoria Empresarial com IA",
    desc: "Método Gestão 360™ implantado com sistemas sob medida e foco em indicadores.",
    href: "/servicos/consultoria",
  },
  {
    icon: "users",
    title: "Mentorias Estratégicas",
    desc: "Direcionamento personalizado para crescer com consistência.",
    href: "/servicos/mentorias",
  },
  {
    icon: "mic",
    title: "Palestras Inspiradoras",
    desc: "Conteúdo de alto impacto para equipes e eventos.",
    href: "/servicos/palestras",
  },
  {
    icon: "target",
    title: "Curso Gestão 360",
    desc: "A metodologia completa, em formato de curso, para aplicar com autonomia.",
    href: "/servicos/curso-gestao-360",
  },
  {
    icon: "book",
    title: "Livro Gestão 360",
    desc: "A metodologia em profundidade, para consulta permanente.",
    href: "/livro-gestao-360",
  },
] as const;

/** Links legais (rodapé). */
export const legalNav = [
  { label: "Política de Privacidade", href: "/privacidade" },
  { label: "Termos de Uso", href: "/termos" },
  { label: "Exclusão de Dados", href: "/exclusao-de-dados" },
] as const;
