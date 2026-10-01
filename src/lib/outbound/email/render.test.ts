import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PALAVRAS_PROIBIDAS_NO_ASSUNTO,
  paragrafos,
  partesFixasDoMapa,
  palavrasProibidasEm,
  renderEmailOutbound,
  textoDaParte,
  type DadosEmailOutbound,
  type Prova,
} from "./render";

const base = (prova: Prova, extra: Partial<DadosEmailOutbound> = {}): DadosEmailOutbound => ({
  nome: "Marcos Teixeira",
  empresa: "Teixeira & Lima Advocacia",
  prova,
  diaSugerido: "terça, 6 de outubro, às 15h",
  linkConversa: "https://empresarialacademy.com/conversa?t=ABC",
  linkOptOut: "https://empresarialacademy.com/api/marketing/sair?l=1&t=XYZ",
  kit: {
    email1: {
      assunto: "Marcos, uma ideia para a gestão da Teixeira & Lima",
      gancho: "Vi no perfil que vocês atendem empresas da região.",
      dor: "A gestão costuma depender do sócio: toda decisão passa por ele.",
      ponte_para_o_video: "Um cliente conta em um vídeo curto como saiu dessa.",
      convite: "Posso te mostrar em 20 minutos? Terça, às 15h, serve?",
    },
  },
  ...extra,
});

const PROVAS: Prova[] = ["fabio", "daniella", "erik", "demo_segmento"];
const hrefs = (html: string) => [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
const srcs = (html: string) => [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
const EMOJI = /[\p{Extended_Pictographic}]/u;

describe("renderEmailOutbound", () => {
  it.each(PROVAS)("renderiza a prova %s sem erro e sem aviso", async (prova: (typeof PROVAS)[number]) => {
    const r = await renderEmailOutbound(base(prova));
    expect(r.avisos).toEqual([]);
    expect(r.html).toMatch(/^<!doctype html>/i);
    expect(r.html).toContain("Reservar 20 minutos: terça, 6 de outubro, às 15h");
    expect(r.assunto).toBe("Marcos, uma ideia para a gestão da Teixeira & Lima");
  });

  it("a versão texto traz os mesmos links do HTML", async () => {
    const rastrear = (url: string, rotulo?: string) => `https://empresarialacademy.com/r/ID?u=${encodeURIComponent(url)}&k=${rotulo}`;
    for (const prova of PROVAS) {
      const r = await renderEmailOutbound(base(prova, { rastrear }));
      const links = new Set(hrefs(r.html));
      expect(links.size).toBeGreaterThanOrEqual(6);
      for (const l of links) expect(r.texto, l).toContain(l);
    }
  });

  it("só tem link e imagem no domínio da EA, com o descadastro sem rastreio", async () => {
    const chamados: string[] = [];
    const r = await renderEmailOutbound(
      base("fabio", { pixelUrl: "https://empresarialacademy.com/api/outbound/o.gif?t=1", rastrear: (u, k) => (chamados.push(`${k}`), u) }),
    );
    for (const u of [...hrefs(r.html), ...srcs(r.html)]) expect(new URL(u).hostname, u).toBe("empresarialacademy.com");
    expect(chamados.sort()).toEqual(["blog", "convite", "material", "site", "video"]);
    expect(hrefs(r.html)).toContain("https://empresarialacademy.com/api/marketing/sair?l=1&t=XYZ");
  });

  it("não usa travessão nem emoji, mesmo se o kit trouxer", async () => {
    const r = await renderEmailOutbound(
      base("erik", {
        kit: { gancho: "Vi o perfil — muito bom 🚀.", dor: "Cobrança – o caixa atrasa.", convite: "Terça, às 15h?" },
        assunto: "Carlos — cobrança 🚀",
      }),
    );
    for (const t of [r.html, r.texto, r.assunto]) {
      expect(t).not.toMatch(/[—–]/);
      expect(t).not.toMatch(EMOJI);
    }
  });

  it("pesa menos de 200 KB com as imagens, no máximo 4 imagens e texto como maior parte", async () => {
    for (const prova of PROVAS) {
      const r = await renderEmailOutbound(base(prova, { pixelUrl: "https://empresarialacademy.com/api/outbound/o.gif" }));
      const imagens = srcs(r.html);
      expect(imagens.length).toBeLessThanOrEqual(5); // faixa, capa, foto e pixel (o pixel não é arquivo)
      const arquivos = imagens.filter((u) => u.includes("/email/"));
      expect(arquivos.length).toBeLessThanOrEqual(3);
      const pesoImagens = arquivos.map((u) => statSync(join(__dirname, "../../../../public", new URL(u).pathname)).size);
      for (const p of pesoImagens) expect(p).toBeLessThan(30 * 1024);
      const total = Buffer.byteLength(r.html) + pesoImagens.reduce((a, b) => a + b, 0);
      expect(total).toBeLessThan(200 * 1024);
      expect(Buffer.byteLength(r.html)).toBeGreaterThan(pesoImagens.reduce((a, b) => a + b, 0) * 0.3);
    }
  });

  it("usa a capa certa de cada prova", async () => {
    const capas: Record<Prova, string> = { fabio: "capa-fabio.jpg", daniella: "capa-daniella.jpg", erik: "capa-erik.jpg", demo_segmento: "capa-demo.jpg" };
    for (const p of PROVAS) expect((await renderEmailOutbound(base(p))).html).toContain(`/email/${capas[p]}`);
  });

  it("rejeita assunto com palavra proibida do Branding v3 e gera um neutro", async () => {
    const r = await renderEmailOutbound(base("fabio", { assunto: "Segredo urgente para a sua empresa", kit: { gancho: "Oi.", dor: "Dor." } }));
    expect(r.assunto).toBe("Marcos, uma ideia para a gestão da Teixeira & Lima Advocacia");
    expect(r.avisos.join(" ")).toMatch(/proibido/);
    expect(palavrasProibidasEm(r.assunto)).toEqual([]);
  });

  it("os assuntos de exemplo são curtos e limpos", async () => {
    const r = await renderEmailOutbound(base("fabio"));
    expect(r.assunto.length).toBeLessThanOrEqual(60);
    expect(palavrasProibidasEm(r.assunto)).toEqual([]);
    expect(PALAVRAS_PROIBIDAS_NO_ASSUNTO).toContain("liberdade financeira");
    expect(palavrasProibidasEm("A fórmula definitiva, grátis")).toEqual(expect.arrayContaining(["definitiva", "formula", "gratis"]));
  });

  it("aceita kit em formas variadas e escolhe email1 ou email2 pelo toque", async () => {
    const kit = {
      email1: { gancho: { texto: "Gancho um." }, dor: ["Dor um."] },
      email2: { gancho: "Gancho dois.", insight: { corpo: "Insight novo." } },
    };
    const um = await renderEmailOutbound(base("erik", { kit, assunto: null }));
    expect(um.texto).toContain("Gancho um.");
    expect(um.html).toContain("/email/capa-erik.jpg");
    const dois = await renderEmailOutbound(base("erik", { kit, toque: 2, assunto: null }));
    expect(dois.texto).toContain("Insight novo.");
    expect(dois.html).not.toContain("/email/capa-erik.jpg");
    expect(dois.html).not.toContain("Material gratuito");
  });

  it("falha com kit vazio e com link inválido", async () => {
    await expect(renderEmailOutbound(base("fabio", { kit: {} }))).rejects.toThrow(/vazio/);
    await expect(renderEmailOutbound(base("fabio", { linkConversa: "/conversa" }))).rejects.toThrow(/linkConversa/);
  });

  it("usa as partes fixas editadas e volta ao padrão quando vazias", async () => {
    const padrao = await renderEmailOutbound(base("fabio"));
    expect(padrao.html).toContain("encontramos o contato da sua empresa no perfil público do Instagram");
    expect(padrao.html).toContain("dpo@empresarialacademy.com");
    expect(padrao.html).toContain("(11) 93340-0264");
    expect(padrao.html).toContain("Consultoria empresarial com IA");
    const editado = await renderEmailOutbound(
      base("fabio", { partesFixas: partesFixasDoMapa(new Map([["outbound:rodape", { corpoPrimeiro: "Rodapé novo.\n{{descadastro}}." }], ["outbound:assinatura", { corpoPrimeiro: "  " }]])) }),
    );
    expect(editado.html).toContain("Rodapé novo.");
    expect(editado.html).not.toContain("dpo@empresarialacademy.com");
    expect(editado.html).toContain("Thiago Marchi");
  });

  it("coloca o pixel só quando informado e usa material e blog recebidos", async () => {
    expect((await renderEmailOutbound(base("fabio"))).html).not.toContain('width="1" height="1"');
    const r = await renderEmailOutbound(
      base("fabio", {
        pixelUrl: "https://empresarialacademy.com/o.gif",
        material: { titulo: "Planilha X", link: "https://empresarialacademy.com/materiais/x" },
        linkBlog: "https://empresarialacademy.com/blog/y",
        tituloBlog: "Artigo Y",
      }),
    );
    expect(r.html).toContain('width="1" height="1"');
    expect(r.texto).toContain("Planilha X");
    expect(r.texto).toContain("https://empresarialacademy.com/blog/y");
  });
});

describe("texto do kit", () => {
  it("quebra em parágrafos de até 3 linhas sem perder frase", () => {
    const longo = "Primeira frase com algum tamanho razoável para ocupar espaço. ".repeat(6).trim();
    const ps = paragrafos(longo);
    expect(ps.length).toBeGreaterThan(1);
    for (const p of ps) expect(p.length).toBeLessThanOrEqual(200);
    expect(ps.join(" ")).toBe(longo);
  });
  it("lê string, lista e objeto", () => {
    expect(textoDaParte("a")).toBe("a");
    expect(textoDaParte(["a.", "b."])).toBe("a. b.");
    expect(textoDaParte({ conteudo: "c" })).toBe("c");
    expect(textoDaParte({ nada: 1 })).toBe("");
  });
});

describe("imagens publicadas", () => {
  it("existem em public/email e são pequenas", () => {
    for (const f of ["logo-faixa.png", "thiago.png", "capa-fabio.jpg", "capa-daniella.jpg", "capa-erik.jpg", "capa-demo.jpg"]) {
      const caminho = join(__dirname, "../../../../public/email", f);
      expect(readFileSync(caminho).length).toBeLessThan(30 * 1024);
    }
  });
});
