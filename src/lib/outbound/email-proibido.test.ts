import { describe, expect, it } from "vitest";

import { emailProibido } from "./email-proibido";

describe("emailProibido", () => {
  it("LGPD, RH, vagas e nota fiscal nunca recebem; contato e pessoa recebem", () => {
    for (const e of ["dpo@infojobs.com.br", "curriculum@grupomhms.com.br", "vagasdf@gpssa.com.br", "rh@x.com.br", "lgpd@x.com.br", "nfe@x.com.br"]) expect(emailProibido(e)).toBe(true);
    for (const e of ["contato@x.com.br", "rhaissa@x.com.br", "nfernandes@x.com.br", "favorit@favorit.com.br"]) expect(emailProibido(e)).toBe(false);
  });
});
