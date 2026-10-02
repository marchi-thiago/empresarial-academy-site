import { describe, expect, it } from "vitest";
import { hrefDaConversa } from "./conversa-link";

describe("hrefDaConversa", () => {
  it("sem parâmetros: /conversa puro", () => {
    expect(hrefDaConversa("")).toBe("/conversa");
    expect(hrefDaConversa(null)).toBe("/conversa");
  });

  it("repassa o token e as UTMs, e nada mais", () => {
    const h = hrefDaConversa("?t=abcdEFGH12345678_-x&utm_source=email&utm_campaign=c1&foo=bar&gclid=G1");
    const u = new URL(h, "https://x.test");
    expect(u.pathname).toBe("/conversa");
    expect(u.searchParams.get("t")).toBe("abcdEFGH12345678_-x");
    expect(u.searchParams.get("utm_source")).toBe("email");
    expect(u.searchParams.get("utm_campaign")).toBe("c1");
    expect(u.searchParams.get("gclid")).toBe("G1");
    expect(u.searchParams.has("foo")).toBe(false);
  });

  it("descarta token fora do formato", () => {
    expect(hrefDaConversa("?t=curto")).toBe("/conversa");
    expect(hrefDaConversa("?t=" + encodeURIComponent("<script>alert(1)</script>"))).toBe("/conversa");
  });

  it("só UTM, sem token", () => {
    expect(hrefDaConversa("?utm_source=ig")).toBe("/conversa?utm_source=ig");
  });
});
