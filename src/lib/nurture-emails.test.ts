import { describe, expect, it } from "vitest";
import {
  renderBoasVindasEmail,
  renderCategoryNurtureEmail,
  renderContatoConfirmacaoEmail,
  renderDmeRetomadaEmail,
  renderDownloadThanksEmail,
  temaDoMaterial,
} from "./nurture-emails";

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

  it("E1 a E3 da nutrição por tema têm os dois CTAs: DME (caminho que existe) e conversa", () => {
    const input = { leadId: 1, name: "Ana", email: "a@b.com", category: "vendas", categoryLabel: "Vendas" };
    for (const step of [1, 2, 3] as const) {
      const mail = renderCategoryNurtureEmail(step, input);
      expect(mail.html).toContain("/diagnostico-maturidade-empresarial.html?");
      expect(mail.html).not.toContain("/diagnostico-maturidade-empresarial\"");
      expect(mail.html).toContain("/conversa?");
      expect(mail.text).toContain("/diagnostico-maturidade-empresarial.html?");
      expect(mail.text).toContain("/conversa?");
    }
  });

  it("boas-vindas, retomada e contato têm os dois CTAs e nenhum travessão", () => {
    const lead = { leadId: 7, name: "Carla Souza", email: "c@d.com" };
    for (const mail of [renderBoasVindasEmail(lead), renderDmeRetomadaEmail(lead), renderContatoConfirmacaoEmail(lead)]) {
      expect(mail.html).toContain("/diagnostico-maturidade-empresarial.html?");
      expect(mail.html).toContain("/conversa?");
      expect(mail.html).toContain("Olá, Carla");
      expect(mail.html).toContain("/api/nutricao/sair");
      expect(mail.subject + mail.text).not.toContain("—");
    }
    expect(renderDmeRetomadaEmail(lead).html).toContain("Terminar o Diagnóstico");
  });

  it("quem já fez o DME recebe o convite para refazer, não para fazer", () => {
    const base = { leadId: 1, name: "Ana", email: "a@b.com", materialTitle: "Matriz de SLA Interno", materialSlug: "matriz-de-sla-interno", tema: "gestao" };
    expect(renderDownloadThanksEmail({ ...base, jaFezDme: true }).html).toContain("Refazer o Diagnóstico");
    expect(renderDownloadThanksEmail(base).html).not.toContain("Refazer o Diagnóstico");
  });

  it("inscrito não lê que baixou material", () => {
    const input = { leadId: 1, name: "Ana", email: "a@b.com", category: "gestao", categoryLabel: "Gestão", origem: "inscricao" as const };
    for (const step of [1, 2, 3] as const) {
      const mail = renderCategoryNurtureEmail(step, input);
      expect(mail.html + mail.text).not.toMatch(/baixou|material/i);
    }
  });
});
