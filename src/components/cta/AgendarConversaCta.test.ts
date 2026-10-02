import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AgendarConversaCta } from "./AgendarConversaCta";

describe("AgendarConversaCta", () => {
  it("renderiza o texto do CTA e o link para /conversa, sem prometer duração", () => {
    const html = renderToStaticMarkup(createElement(AgendarConversaCta));
    expect(html).toContain("Reservar um bate-papo gratuito");
    expect(html).toContain('href="/conversa"');
    expect(html).not.toMatch(/\d+\s*minutos/i);
    expect(html).not.toContain("—");
  });
});
