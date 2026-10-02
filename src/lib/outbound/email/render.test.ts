import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTORIDADE,
  PADRAO_PERGUNTA,
  PALAVRAS_PROIBIDAS_NO_ASSUNTO,
  PONTE_CLIENTE,
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
      convite: "Posso te mostrar? Terça, às 15h, serve?",
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
    expect(r.html).toContain("Reservar meu bate-papo gratuito (terça, 6 de outubro, às 15h)");
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
    expect(padrao.html).toContain("contato@empresarialacademy.com");
    expect(padrao.html).toContain("(11) 93340-0264");
    expect(padrao.html).toContain("Consultoria empresarial com IA");
    const editado = await renderEmailOutbound(
      base("fabio", { partesFixas: partesFixasDoMapa(new Map([["outbound:rodape", { corpoPrimeiro: "Rodapé novo.\n{{descadastro}}." }], ["outbound:assinatura", { corpoPrimeiro: "  " }]])) }),
    );
    expect(editado.html).toContain("Rodapé novo.");
    expect(editado.html).not.toContain("contato@empresarialacademy.com");
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

describe("ajustes do e-mail 1 (autoridade, prova, convite e pergunta)", () => {
  const kitJuridico = {
    email1: {
      gancho: "Vi no perfil que vocês atendem empresas da região.",
      dor: "A gestão costuma depender do sócio.",
      ponte_video: "Um cliente, também do ramo jurídico, conta como organizou o escritório.",
      convite: "Gostaria de propor uma conversa de 20 minutos. Consegue na terça pelo link X?",
    },
  };

  it("autoridade traz cursos e empresas, em duas frases, sem WCES nem número fora da lista", async () => {
    const r = await renderEmailOutbound(base("fabio", { kit: kitJuridico }));
    expect(r.texto).toContain(AUTORIDADE);
    expect(AUTORIDADE.split(/(?<=\.)\s/)).toHaveLength(2);
    for (const f of ["PME por 7 anos", "19 anos em gestão e vendas", "Vivo", "Atento", "Sitallcom", "MBA pela FGV", "Lean Six Sigma Green Belt"]) expect(AUTORIDADE).toContain(f);
    expect(r.texto + r.html).not.toMatch(/WCES|Utah/i);
  });

  it("a prova de cliente é neutra: sem ramo, sem escritório e sem o texto do kit", async () => {
    for (const prova of ["fabio", "daniella", "erik"] as const) {
      const r = await renderEmailOutbound(base(prova, { kit: kitJuridico }));
      expect(r.texto).toContain(PONTE_CLIENTE);
      expect(r.texto + r.html).not.toMatch(/bramob|jurídic|escritório|advog|Souza Ramos/i);
    }
  });

  it("o convite é fixo, assertivo e não cita duração em lugar nenhum; o link rastreado continua", async () => {
    const rastrear = (url: string, rotulo?: string) => `https://empresarialacademy.com/r/9.email1.${rotulo}.X`;
    const r = await renderEmailOutbound(base("erik", { kit: kitJuridico, rastrear, diaSugerido: "na terça, às 15h" }));
    expect(r.texto).toContain("Reserve agora um bate-papo rápido e gratuito para entender onde priorizar e como obter mais resultado usando IA na sua empresa. Tenho terça, às 15h livre.");
    expect(r.texto).toContain("Reservar meu bate-papo gratuito (terça, às 15h)\nhttps://empresarialacademy.com/r/9.email1.convite.X");
    expect(r.html).toContain("Reservar meu bate-papo gratuito (terça, às 15h)");
    expect(r.html).toContain("Bate-papo rápido e gratuito: terça, às 15h");
    expect(r.texto + r.html).not.toMatch(/\b\d+\s*(min\b|minutos|segundos)/i);
  });

  it("avisa quando o kit traz duração (e-mail 2 do Hunter)", async () => {
    const r = await renderEmailOutbound(base("erik", { toque: 2, kit: { email2: { dica: "Tenho 20 minutos na terça. Escolha: https://empresarialacademy.com/conversa?t=A" } } }));
    expect(r.avisos.join(" ")).toMatch(/cita duração/);
  });

  it("o cabeçalho traz a pergunta padrão logo abaixo do logo, editável por partes fixas", async () => {
    const r = await renderEmailOutbound(base("fabio"));
    expect(PADRAO_PERGUNTA).toBe("Sua empresa cresce, mas a sobra no fim do mês não acompanha?");
    expect(r.texto.startsWith(PADRAO_PERGUNTA)).toBe(true);
    expect(r.html.indexOf("logo-faixa.png")).toBeLessThan(r.html.indexOf(PADRAO_PERGUNTA));
    expect(r.html.indexOf(PADRAO_PERGUNTA)).toBeLessThan(r.html.indexOf("Olá, Marcos"));
    const editada = await renderEmailOutbound(
      base("fabio", { partesFixas: partesFixasDoMapa(new Map([["outbound:pergunta", { corpoPrimeiro: "A gestão ainda depende de você?" }]])) }),
    );
    expect(editada.texto.startsWith("A gestão ainda depende de você?")).toBe(true);
    expect(editada.html).not.toContain(PADRAO_PERGUNTA);
  });

  it("usa a pergunta do dossiê ou do kit se for uma pergunta curta; senão, a padrão; e-mail 2 não tem cabeçalho", async () => {
    expect((await renderEmailOutbound(base("fabio", { pergunta: "A cobrança consome o tempo do seu time?" }))).texto).toMatch(/^A cobrança consome o tempo do seu time\?/);
    expect((await renderEmailOutbound(base("fabio", { pergunta: "Isto não é uma pergunta." }))).texto).toMatch(/^Sua empresa cresce/);
    expect((await renderEmailOutbound(base("fabio", { pergunta: "Você quer dobrar o faturamento sem esforço, garantido, em 30 dias, hoje mesmo?".padEnd(120, "x") + "?" }))).texto).toMatch(/^Sua empresa cresce/);
    const comKit = await renderEmailOutbound(base("fabio", { kit: { email1: { ...kitJuridico.email1, pergunta: "O dono ainda decide tudo sozinho?" } } }));
    expect(comKit.texto).toMatch(/^O dono ainda decide tudo sozinho\?/);
    const e2 = await renderEmailOutbound(base("fabio", { toque: 2, kit: { email2: { dica: "Um ponto novo." } } }));
    expect(e2.texto).not.toContain(PADRAO_PERGUNTA);
    for (const t of [PADRAO_PERGUNTA, AUTORIDADE]) expect(t).not.toMatch(/[—–]/);
  });
});
