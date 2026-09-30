import { describe, expect, it } from "vitest";
import { finalDoWhatsapp, normalizarEmail, normalizarHandle, temReferencia } from "./identificar";

describe("identificação do lead", () => {
  it("normaliza o @ do Instagram", () => {
    expect(normalizarHandle("@JM_Metalurgica")).toBe("jm_metalurgica");
    expect(normalizarHandle("https://www.instagram.com/JM_Metalurgica/?hl=pt")).toBe("jm_metalurgica");
  });
  it("normaliza e-mail e WhatsApp pelo final", () => {
    expect(normalizarEmail("  Fulano@Empresa.com ")).toBe("fulano@empresa.com");
    expect(finalDoWhatsapp("+55 (11) 93340-0264")).toBe("11933400264");
    expect(finalDoWhatsapp("933400264")).toBeNull();
  });
  it("exige ao menos uma referência", () => {
    expect(temReferencia({})).toBe(false);
    expect(temReferencia({ email: "sem-arroba" })).toBe(false);
    expect(temReferencia({ hunterId: 0 })).toBe(true);
    expect(temReferencia({ whatsapp: "11933400264" })).toBe(true);
  });
});
