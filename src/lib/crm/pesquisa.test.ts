import { describe, expect, it } from "vitest";
import { coberturaDePesquisa, coberturaDoDossie, lerPesquisa } from "./pesquisa";

const item = (o: Record<string, unknown> = {}) => ({
  fonte: "site",
  rotulo: "Serviços",
  valor: "Atende indústrias",
  consultadoEm: "2026-10-01T12:00:00Z",
  confianca: "confirmado",
  ...o,
});

describe("lerPesquisa", () => {
  it("devolve vazio para dossiê nulo, texto, número, lista e sem pesquisa", () => {
    for (const d of [null, undefined, "texto solto", 42, [], {}, { pesquisa: "x" }, { pesquisa: {} }, "{quebrado"]) {
      expect(lerPesquisa(d)).toEqual([]);
    }
  });

  it("lê dossiê que veio como texto JSON", () => {
    expect(lerPesquisa(JSON.stringify({ pesquisa: [item()] }))).toHaveLength(1);
  });

  it("ignora itens inválidos sem derrubar os válidos", () => {
    const r = lerPesquisa({
      pesquisa: [
        item(),
        null,
        "x",
        42,
        item({ fonte: "tiktok" }),
        item({ rotulo: "  " }),
        item({ valor: 3 }),
        item({ confianca: "certeza" }),
        item({ consultadoEm: "ontem" }),
        item({ consultadoEm: undefined }),
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ fonte: "site", rotulo: "Serviços", confianca: "confirmado", consultadoEm: "2026-10-01T12:00:00.000Z" });
  });

  it("aceita fonte e confiança com maiúscula e acento", () => {
    const r = lerPesquisa({ pesquisa: [item({ fonte: "CNPJ", confianca: "Indício" })] });
    expect(r[0]).toMatchObject({ fonte: "cnpj", confianca: "indicio" });
  });

  it("só mantém link http(s)", () => {
    const r = lerPesquisa({
      pesquisa: [
        item({ link: "https://exemplo.com.br/a" }),
        item({ link: "javascript:alert(1)", rotulo: "B" }),
        item({ link: "nao e link", rotulo: "C" }),
      ],
    });
    expect(r.find((i) => i.rotulo === "Serviços")?.link).toBe("https://exemplo.com.br/a");
    expect(r.find((i) => i.rotulo === "B")?.link).toBeUndefined();
    expect(r.find((i) => i.rotulo === "C")?.link).toBeUndefined();
  });

  it("ordena por fonte e, dentro dela, pela data mais recente", () => {
    const r = lerPesquisa({
      pesquisa: [
        item({ fonte: "manual", rotulo: "m" }),
        item({ fonte: "linkedin", rotulo: "l" }),
        item({ fonte: "site", rotulo: "s-velho", consultadoEm: "2026-09-01T00:00:00Z" }),
        item({ fonte: "site", rotulo: "s-novo", consultadoEm: "2026-10-02T00:00:00Z" }),
        item({ fonte: "instagram", rotulo: "i" }),
        item({ fonte: "cnpj", rotulo: "c" }),
      ],
    });
    expect(r.map((i) => i.rotulo)).toEqual(["i", "s-novo", "s-velho", "c", "l", "m"]);
  });

  it("limita a 20 itens e respeita limite informado", () => {
    const muitos = Array.from({ length: 30 }, (_, n) => item({ rotulo: `r${n}` }));
    expect(lerPesquisa({ pesquisa: muitos })).toHaveLength(20);
    expect(lerPesquisa({ pesquisa: muitos }, Infinity)).toHaveLength(30);
  });
});

describe("coberturaDePesquisa", () => {
  it("devolve as fontes consultadas em ordem fixa, sem repetir e sem manual", () => {
    expect(coberturaDePesquisa([{ fonte: "linkedin" }, { fonte: "site" }, { fonte: "site" }, { fonte: "manual" }])).toEqual(["site", "linkedin"]);
    expect(coberturaDePesquisa([])).toEqual([]);
  });

  it("coberturaDoDossie não perde fonte por causa do corte de 20", () => {
    const itens = [...Array.from({ length: 25 }, () => item({ fonte: "instagram" })), item({ fonte: "linkedin" })];
    expect(coberturaDoDossie({ pesquisa: itens })).toEqual(["instagram", "linkedin"]);
    expect(coberturaDoDossie(null)).toEqual([]);
  });
});
