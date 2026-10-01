import mjml2html from "mjml";
import { depoimentosVideo } from "@/lib/content";
import { siteConfig } from "@/lib/site-config";
import { montarMjml, type ModeloEmail } from "./template";

/**
 * F7: e-mail frio no formato carta do fundador enriquecida.
 * Contrato com a F6 (orquestrador): `renderEmailOutbound(dados)` é ASSÍNCRONA e devolve
 * `{ assunto, html, texto }` (mais `avisos`, lista de ajustes feitos nos textos). Não envia nada.
 * Quem envia usa REMETENTE_OUTBOUND / REMETENTE_OUTBOUND_ENDERECO.
 */

export const REMETENTE_OUTBOUND = "Thiago Marchi | Empresarial Academy";
export const REMETENTE_OUTBOUND_ENDERECO = "comercial@empresarialacademy.com";
export const REMETENTE_OUTBOUND_COMPLETO = `${REMETENTE_OUTBOUND} <${REMETENTE_OUTBOUND_ENDERECO}>`;

export type Prova = "fabio" | "daniella" | "erik" | "demo_segmento";
/** Parte do kit: texto puro ou objeto (o Hunter pode gravar `{ texto }`, `{ corpo }`, lista de frases). */
export type ParteKit = string | string[] | { [chave: string]: unknown } | null | undefined;
export type KitEmail = { [parte: string]: ParteKit };

export type PartesFixasOutbound = {
  /** Linha 1 em negrito (nome), demais em cinza. Aceita {{site}} e {{telefone}}. */
  assinatura?: string;
  /** Um parágrafo por linha. Aceita {{descadastro}} e {{privacidade}}. */
  rodape?: string;
  /** Linha 1: rótulo do bloco. Linha 2: descrição curta. */
  material?: string;
};

export type DadosEmailOutbound = {
  nome?: string | null;
  empresa?: string | null;
  /** Se vazio, usa `kit.assunto`; sem ele ou com termo proibido, é gerado um assunto neutro. */
  assunto?: string | null;
  /** `kit.email1`/`kit.email2` inteiro, ou já a parte escolhida. */
  kit: KitEmail | { email1?: KitEmail; email2?: KitEmail };
  /** Qual toque: 1 = e-mail completo (D1); 2 = curto, sem capa nem material (D6). */
  toque?: 1 | 2;
  prova: Prova;
  diaSugerido: string;
  linkConversa: string;
  linkOptOut: string;
  material?: { titulo: string; link: string } | null;
  linkBlog?: string | null;
  tituloBlog?: string | null;
  pixelUrl?: string | null;
  /** Envolve links do site (clique rastreado). Recebe o rótulo do link para a F6 separar capa, botão etc. */
  rastrear?: (url: string, rotulo?: string) => string;
  /** Vindas de `email-templates` (chave `outbound:`). Ver `partesFixasDoMapa`. */
  partesFixas?: PartesFixasOutbound;
  /** Só para prévia local (ex.: "../../../public"). Em produção vale o domínio da EA. */
  baseUrlImagens?: string;
};

export type EmailOutbound = { assunto: string; html: string; texto: string; avisos: string[] };

// ---------------------------------------------------------------- padrões editáveis

export const PADRAO_ASSINATURA = [
  "Thiago Marchi",
  "Empresarial Academy · Consultoria empresarial com IA",
  "{{site}} · {{telefone}}",
].join("\n");

export const PADRAO_RODAPE = [
  "Você recebeu este e-mail porque encontramos o contato da sua empresa no perfil público do Instagram. Escrevemos com base no legítimo interesse (LGPD, art. 7º, IX), para tratar de um tema ligado à gestão da sua empresa.",
  "Encarregado de dados (DPO): dpo@empresarialacademy.com. Pedidos de acesso, correção ou exclusão: privacidade@empresarialacademy.com. {{privacidade}}.",
  "{{descadastro}}, em um clique, e paramos na hora.",
  `Empresarial Academy, CNPJ ${siteConfig.cnpj}, São Paulo, SP.`,
].join("\n");

export const PADRAO_MATERIAL = ["Material gratuito", "Para ler antes da nossa conversa."].join("\n");

/**
 * Material padrão do bloco. O e-book "Por que sua empresa fatura mais e sobra menos" ainda está
 * em rascunho e sem página no site (conferido em 30/09/2026): enquanto isso, a Calculadora de
 * Vazamento de Margem cobre a mesma dor e já está publicada. Trocar quando o e-book subir.
 */
export const MATERIAL_PADRAO = {
  titulo: "Calculadora de Vazamento de Margem",
  link: `${siteConfig.url}/materiais/calculadora-de-vazamento-de-margem`,
};
export const BLOG_PADRAO = {
  titulo: "Sua empresa fatura mais, mas o lucro não acompanha",
  link: `${siteConfig.url}/blog/empresa-fatura-mais-lucro-nao-acompanha`,
};

export const CHAVES_PARTES_FIXAS = {
  assinatura: "outbound:assinatura",
  rodape: "outbound:rodape",
  material: "outbound:material",
} as const;

/** Lê as 3 partes do mapa de `loadNurtureTemplates` (texto no campo `corpoPrimeiro`). Vazio = padrão do código. */
export function partesFixasDoMapa(
  modelos: Map<string, { corpoPrimeiro?: string | null }> | undefined,
): PartesFixasOutbound {
  const ler = (chave: string) => modelos?.get(chave)?.corpoPrimeiro?.trim() || undefined;
  return {
    assinatura: ler(CHAVES_PARTES_FIXAS.assinatura),
    rodape: ler(CHAVES_PARTES_FIXAS.rodape),
    material: ler(CHAVES_PARTES_FIXAS.material),
  };
}

// ---------------------------------------------------------------- vozes e limpeza de texto

/** Anti-glossário do Branding v3 (§5) mais gatilhos de alarme: nenhum pode aparecer no assunto. */
export const PALAVRAS_PROIBIDAS_NO_ASSUNTO = [
  "liberdade financeira",
  "definitivo",
  "definitiva",
  "formula",
  "segredo",
  "hack",
  "revolucione",
  "revolucionar",
  "ia de ponta",
  "o futuro chegou",
  "disruptiv",
  "chatgpt",
  "n8n",
  "urgente",
  "ultima chance",
  "imperdivel",
  "oportunidade unica",
  "atencao",
  "gratis",
  "garantido",
  "promocao",
  "clique aqui",
];

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function palavrasProibidasEm(texto: string): string[] {
  const t = ` ${semAcento(texto)} `;
  return PALAVRAS_PROIBIDAS_NO_ASSUNTO.filter((p) => t.includes(p));
}

/** Sem travessão, sem emoji, espaços normalizados. */
export function limpar(s: string): string {
  return s
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/[\p{Extended_Pictographic}‍️]/gu, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ +([,.;:!?])/g, "$1")
    .trim();
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Texto de uma parte do kit, tolerante: string, lista de frases ou objeto com texto/corpo/conteudo. */
export function textoDaParte(p: ParteKit): string {
  if (p == null) return "";
  if (typeof p === "string") return limpar(p);
  if (Array.isArray(p)) {
    return limpar(
      p
        .map((x) => textoDaParte(x as ParteKit))
        .filter(Boolean)
        .join(" "),
    );
  }
  for (const k of ["texto", "text", "corpo", "conteudo", "mensagem", "valor", "body"]) {
    const v = (p as Record<string, unknown>)[k];
    if (typeof v === "string" && v.trim()) return limpar(v);
    if (Array.isArray(v)) return textoDaParte(v as ParteKit);
  }
  return "";
}

const chaveNorm = (k: string) => semAcento(k).replace(/[^a-z0-9]/g, "");

/** Acha a parte do kit pelo nome tolerante ("ponte", "ponte_video", "Ponte para o vídeo"...). */
function acharParte(kit: KitEmail, raiz: string): string {
  for (const [k, v] of Object.entries(kit)) {
    if (chaveNorm(k).startsWith(raiz)) {
      const t = textoDaParte(v);
      if (t) return t;
    }
  }
  return "";
}

function escolherKit(kit: DadosEmailOutbound["kit"], toque: 1 | 2): KitEmail {
  const k = kit as { email1?: KitEmail; email2?: KitEmail };
  if (k.email1 || k.email2) return (toque === 2 ? (k.email2 ?? k.email1) : (k.email1 ?? k.email2)) ?? {};
  return kit as KitEmail;
}

/** Quebra em parágrafos de até ~3 linhas (200 caracteres) sem cortar frase no meio. */
export function paragrafos(texto: string, max = 200): string[] {
  const saida: string[] = [];
  for (const bloco of texto
    .split(/\n\s*\n|\n/)
    .map((b) => b.trim())
    .filter(Boolean)) {
    const frases = bloco.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g)?.map((f) => f.trim()) ?? [bloco];
    let atual = "";
    for (const f of frases) {
      if (atual && (atual + " " + f).length > max) {
        saida.push(atual);
        atual = f;
      } else atual = atual ? `${atual} ${f}` : f;
    }
    if (atual) saida.push(atual);
  }
  return saida;
}

const SO_NOME = /^[\p{L}][\p{L}' -]*$/u;
export function primeiroNome(nome?: string | null): string {
  const n = (nome ?? "").trim();
  if (!n || !SO_NOME.test(n)) return "";
  const p = n.split(/\s+/)[0];
  return p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1).toLocaleLowerCase("pt-BR");
}

/** Reserva quando o kit não traz assunto: nome ou empresa mais um gancho neutro, curto e sem alarme. */
export function gerarAssunto(d: Pick<DadosEmailOutbound, "nome" | "empresa">): string {
  const nome = primeiroNome(d.nome);
  const empresa = (d.empresa ?? "").trim();
  if (nome && empresa && nome.length + empresa.length <= 34) return limpar(`${nome}, uma ideia para a gestão da ${empresa}`);
  if (nome) return limpar(`${nome}, uma ideia para a gestão da sua empresa`);
  if (empresa) return limpar(`Uma ideia para a gestão da ${empresa}`);
  return "Uma ideia para a gestão da sua empresa";
}

// ---------------------------------------------------------------- provas

const PROVAS: Record<Prova, { arquivo: string; alt: string; legenda: string; ponte: string }> = {
  fabio: {
    arquivo: "capa-fabio.jpg",
    alt: `Assistir ao depoimento de ${depoimentosVideo.fabio.name}, ${depoimentosVideo.fabio.role} da Souza Ramos Advogados`,
    legenda: `${depoimentosVideo.fabio.name}, ${depoimentosVideo.fabio.role} da Souza Ramos Advogados, sobre organizar a gestão e destravar o que dependia só dele.`,
    ponte: "Um cliente conta, em um vídeo curto, como foi organizar a gestão sem depender só do dono.",
  },
  daniella: {
    arquivo: "capa-daniella.jpg",
    alt: `Assistir ao depoimento de ${depoimentosVideo.daniella.name}, ${depoimentosVideo.daniella.role}`,
    legenda: `${depoimentosVideo.daniella.name}, ${depoimentosVideo.daniella.role}, sobre a rotina do time de vendas depois do método.`,
    ponte: "A coordenadora comercial de um cliente conta, em um vídeo curto, o que mudou na rotina do time de vendas.",
  },
  erik: {
    arquivo: "capa-erik.jpg",
    alt: `Assistir ao depoimento de ${depoimentosVideo.erik.name}, do time financeiro`,
    legenda: `${depoimentosVideo.erik.name}, do time financeiro, sobre menos tarefa manual e relatórios mais claros.`,
    ponte: "O time financeiro de um cliente conta, em um vídeo curto, como a rotina de cobrança e relatórios mudou.",
  },
  demo_segmento: {
    arquivo: "capa-demo.jpg",
    alt: "Assistir à demonstração de 60 segundos",
    legenda: "Demonstração de 60 segundos de como o método roda em sistema, pensada para o seu segmento.",
    ponte: "Preparei uma demonstração de 60 segundos, pensada para o seu segmento.",
  },
};

// ---------------------------------------------------------------- montagem

type Modo = "html" | "texto";

export async function renderEmailOutbound(d: DadosEmailOutbound): Promise<EmailOutbound> {
  const avisos: string[] = [];
  const toque = d.toque ?? 1;
  const kit = escolherKit(d.kit, toque);
  const gancho = acharParte(kit, "gancho");
  const dor = acharParte(kit, "dor");
  const ponteKit = acharParte(kit, "ponte");
  const conviteKit = acharParte(kit, "convite");
  const insight = toque === 2 ? acharParte(kit, "insight") || acharParte(kit, "dica") : "";
  if (!gancho && !dor && !insight) throw new Error("Kit de e-mail vazio: sem gancho nem dor, nada a enviar.");
  if (!/^https?:\/\//.test(d.linkConversa)) throw new Error("linkConversa inválido");
  if (!/^https?:\/\//.test(d.linkOptOut)) throw new Error("linkOptOut inválido");

  const prova = PROVAS[d.prova] ?? PROVAS.demo_segmento;
  const fixas = d.partesFixas ?? {};
  const rastreado = new Map<string, string>();
  const rastrear = (url: string, rotulo: string) => {
    const chave = `${rotulo}|${url}`;
    if (!rastreado.has(chave)) rastreado.set(chave, d.rastrear ? d.rastrear(url, rotulo) : url);
    return rastreado.get(chave)!;
  };

  // Assunto
  let assunto = limpar(d.assunto || acharParte(kit, "assunto"));
  const proibidas = assunto ? palavrasProibidasEm(assunto) : [];
  if (proibidas.length) avisos.push(`Assunto recebido tinha termo proibido (${proibidas.join(", ")}); gerado outro.`);
  if (!assunto || proibidas.length) assunto = gerarAssunto(d);

  // Texto da carta
  const credibilidade =
    "Fui dono de uma PME por 7 anos. Hoje organizo a gestão de outros donos, com método e sistemas com IA.";
  const abertura = [
    ...paragrafos(gancho),
    ...paragrafos(dor),
    ...paragrafos(insight),
    ...(/7 anos/i.test(`${gancho} ${dor} ${insight} ${ponteKit}`) ? [] : [credibilidade]),
    ...(toque === 1 ? paragrafos(ponteKit || prova.ponte) : []),
  ];
  const convite = paragrafos(
    conviteKit || `Podemos conversar 20 minutos ${d.diaSugerido}? Se não servir, o link mostra outros horários.`,
  );
  const labelBotao = limpar(`Reservar 20 minutos: ${d.diaSugerido}`);

  const base = (d.baseUrlImagens ?? siteConfig.url).replace(/\/$/, "");
  const img = (arquivo: string) => `${base}/email/${arquivo}`;

  const linkSite = rastrear(siteConfig.url, "site");
  const linkConversa = (rotulo: string) => rastrear(d.linkConversa, rotulo);
  const privacidade = `${siteConfig.url}/privacidade`;

  const material = d.material ?? MATERIAL_PADRAO;
  const blogLink = d.linkBlog ?? BLOG_PADRAO.link;
  const blogTitulo = limpar(d.tituloBlog ?? (d.linkBlog ? "Ler no blog" : BLOG_PADRAO.titulo));
  const [rotuloMaterial = "Material gratuito", descMaterial = ""] = (fixas.material ?? PADRAO_MATERIAL)
    .split(/\r?\n/)
    .map((l) => limpar(l));

  const expandir = (linha: string, modo: Modo): string => {
    const tokens: Record<string, [string, string]> = {
      "{{site}}": [`<a href="${esc(linkSite)}" style="color:inherit;">empresarialacademy.com</a>`, linkSite],
      "{{telefone}}": [
        `<a href="tel:+${siteConfig.contact.phoneRaw}" style="color:inherit;white-space:nowrap;">(11) 93340-0264</a>`,
        "(11) 93340-0264",
      ],
      "{{descadastro}}": [
        `<a href="${esc(d.linkOptOut)}">Não quero receber mais e-mails</a>`,
        `Não quero receber mais e-mails: ${d.linkOptOut}`,
      ],
      "{{privacidade}}": [
        `<a href="${esc(privacidade)}">Política de privacidade</a>`,
        `Política de privacidade: ${privacidade}`,
      ],
    };
    let out = modo === "html" ? esc(limpar(linha)) : limpar(linha);
    for (const [t, [h, x]] of Object.entries(tokens)) out = out.split(t).join(modo === "html" ? h : x);
    return out;
  };

  const linhas = (s: string) =>
    s
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  const assinaturaLinhas = linhas(fixas.assinatura ?? PADRAO_ASSINATURA);
  const rodapeLinhas = linhas(fixas.rodape ?? PADRAO_RODAPE);

  const saudacao = primeiroNome(d.nome) ? `Olá, ${primeiroNome(d.nome)},` : "Olá,";
  const preheader = limpar(`Conversa de 20 minutos, ${d.diaSugerido}. Sem compromisso.`);
  const completo = toque === 1;

  const modelo: ModeloEmail = {
    preheader: esc(preheader),
    logoSrc: img("logo-faixa.png"),
    logoHref: linkSite,
    logoAlt: "Empresarial Academy · Consultoria empresarial com IA",
    abertura: [esc(saudacao), ...abertura.map(esc)],
    capa: completo
      ? { src: img(prova.arquivo), href: linkConversa("video"), alt: prova.alt, legendaHtml: esc(prova.legenda) }
      : undefined,
    convite: convite.map(esc),
    botao: { href: linkConversa("convite"), label: esc(labelBotao) },
    material: completo
      ? {
          rotuloHtml: esc(rotuloMaterial),
          tituloHtml: `<a href="${esc(rastrear(material.link, "material"))}" style="color:#15191F;text-decoration:underline;">${esc(limpar(material.titulo))}</a>`,
          descricaoHtml: esc(descMaterial),
          blogHtml: `No blog: <a href="${esc(rastrear(blogLink, "blog"))}">${esc(blogTitulo)}</a>`,
        }
      : undefined,
    fotoSrc: img("thiago.png"),
    assinaturaHtml: assinaturaLinhas.map((l) => expandir(l, "html")),
    rodapeHtml: rodapeLinhas.map((l) => expandir(l, "html")),
    pixelSrc: d.pixelUrl ?? undefined,
  };

  const resultado = await mjml2html(montarMjml(modelo), { validationLevel: "soft", minify: false });
  for (const e of resultado.errors ?? []) avisos.push(`MJML: ${e.formattedMessage ?? e.message}`);

  // Versão texto: mesmos links, na mesma ordem.
  const texto = [
    saudacao,
    ...abertura,
    ...(completo ? [`${prova.legenda}\nAssistir: ${linkConversa("video")}`] : []),
    ...convite,
    `${labelBotao}\n${linkConversa("convite")}`,
    ...(completo
      ? [
          `${rotuloMaterial}: ${limpar(material.titulo)}\n${descMaterial}\n${rastrear(material.link, "material")}`,
          `No blog: ${blogTitulo}\n${rastrear(blogLink, "blog")}`,
        ]
      : []),
    assinaturaLinhas.map((l) => expandir(l, "texto")).join("\n"),
    "--",
    rodapeLinhas.map((l) => expandir(l, "texto")).join("\n\n"),
  ].join("\n\n");

  return { assunto, html: resultado.html, texto, avisos };
}
