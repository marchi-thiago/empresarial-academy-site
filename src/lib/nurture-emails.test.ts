import { describe, expect, it } from "vitest";
import { renderCategoryNurtureEmail, renderDownloadThanksEmail, temaDoMaterial } from "./nurture-emails";

describe("agradecimento do download e DME como próximo passo", () => {
  it("material de caixa ou margem usa o tema financeiro, os demais a categoria", () => {
    expect(temaDoMaterial("gestao", "Planilha de Fluxo de Caixa Diário e Ponto de Equilíbrio")).toBe("financeiro");
    expect(temaDoMaterial("gestao", "Planilha de Precificação: Margem de Lucro Real")).toBe("financeiro");
    expect(temaDoMaterial("gestao", "Matriz de SLA Interno")).toBe("gestao");
    expect(temaDoMaterial("vendas", "Template de Playbook de Vendas")).toBe("vendas");
  });

  it("agradecimento traz o arquivo, o bate-papo e o DME (com .html)", () => {
    const mail = renderDownloadThanksEmail({
      leadId: 19,
      name: "Fabiana Napoleão",
      email: "lead@exemplo.com",
      materialTitle: "Planilha de Fluxo de Caixa Diário e Ponto de Equilíbrio",
      materialSlug: "planilha-de-fluxo-de-caixa-diario-e-ponto-de-equilibrio",
      tema: "financeiro",
    });
    expect(mail.subject).toContain("Planilha de Fluxo de Caixa");
    expect(mail.html).toContain("/baixar/planilha-de-fluxo-de-caixa-diario-e-ponto-de-equilibrio");
    expect(mail.html).toContain("/conversa?");
    expect(mail.html).toContain("/diagnostico-maturidade-empresarial.html?");
    expect(mail.html).toContain("caixa apertado");
    expect(mail.html).toContain("Olá, Fabiana");
    expect(mail.html).not.toContain("—");
    expect(mail.text).not.toMatch(/\d+ min/);
  });

  it("E1 e E2 da nutrição por tema levam ao DME pelo caminho que existe", () => {
    const input = { leadId: 1, name: "Ana", email: "a@b.com", category: "vendas", categoryLabel: "Vendas" };
    for (const step of [1, 2] as const) {
      const mail = renderCategoryNurtureEmail(step, input);
      expect(mail.html).toContain("/diagnostico-maturidade-empresarial.html?");
      expect(mail.html).not.toContain("/diagnostico-maturidade-empresarial\"");
    }
  });
});
