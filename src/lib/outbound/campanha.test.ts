import { describe, expect, it } from "vitest";
import { CAMPANHA, LOTE_POR_DIA, planejarCampanha, textoDaCampanha, type LeadCampanha } from "./campanha";
import { palavrasProibidasEm } from "./email/render";
import { problemaDoTexto } from "./texto";

const agora = new Date("2026-10-28T12:00:00-03:00");
const inicio = new Date("2026-10-28T00:00:00-03:00");
const lead = (id: number, over: Partial<LeadCampanha> = {}): LeadCampanha => ({
  id,
  nome: "Ana",
  empresa: "Empresa",
  email: `a${id}@empresa${id}.com.br`,
  etapa: "em_cadencia",
  optOut: false,
  emailSuprimido: false,
  recebidoEm: null,
  ...over,
});

describe("planejarCampanha", () => {
  it("lote diário descontando o que já saiu hoje; quem já recebeu não repete", () => {
    const muitos = Array.from({ length: 40 }, (_, i) => lead(i + 1));
    expect(planejarCampanha(muitos, inicio, agora)).toHaveLength(LOTE_POR_DIA);
    const comHoje = [...muitos, lead(100, { recebidoEm: new Date("2026-10-28T09:00:00-03:00") }), lead(101, { recebidoEm: new Date("2026-10-27T09:00:00-03:00") })];
    const plano = planejarCampanha(comHoje, inicio, agora);
    expect(plano).toHaveLength(LOTE_POR_DIA - 1);
    expect(plano.some((l) => l.id === 100 || l.id === 101)).toBe(false);
  });

  it("fora: opt-out, suprimido, e-mail inválido, reunião marcada e depois", () => {
    const fora = [
      lead(1, { optOut: true }),
      lead(2, { emailSuprimido: true }),
      lead(3, { email: "sem-arroba" }),
      lead(4, { etapa: "reuniao_marcada" }),
      lead(5, { etapa: "ganho" }),
      lead(6, { etapa: "saiu_da_lista" }),
    ];
    expect(planejarCampanha([...fora, lead(7, { etapa: "respondeu" })], inicio, agora).map((l) => l.id)).toEqual([7]);
  });

  it("acaba no fim da campanha", () => {
    expect(planejarCampanha([lead(1)], inicio, new Date(CAMPANHA.fim.getTime() + 1))).toEqual([]);
  });
});

describe("textoDaCampanha", () => {
  it("passa nas travas de texto do outbound, sem travessão e sem duração", () => {
    for (const nome of ["Ana", ""]) {
      const t = textoDaCampanha(nome);
      const corpo = Object.values(t.kit).join("\n");
      expect(problemaDoTexto(t.assunto, corpo)).toBeFalsy();
      expect(palavrasProibidasEm(t.assunto)).toEqual([]);
      expect(corpo).not.toMatch(/[—–]|minutos?/u);
      expect(corpo).toContain("/diagnostico-maturidade-empresarial.html");
    }
    expect(textoDaCampanha("Ana").assunto).toBe("Ana, seu plano de 2027 em uma página");
  });
});
