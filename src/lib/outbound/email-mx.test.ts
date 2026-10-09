import { beforeEach, describe, expect, it } from "vitest";
import { dominioRecebeEmail, limparCacheMx } from "./email-mx";

const erro = (code: string) => Object.assign(new Error(code), { code });

describe("dominioRecebeEmail", () => {
  beforeEach(() => limparCacheMx());

  it("aceita domínio com MX", async () => {
    expect(await dominioRecebeEmail("empresa.com.br", { mx: async () => [{ exchange: "mx.empresa.com.br", priority: 10 }], a: async () => [] })).toBe(true);
  });

  it("sem MX mas com A, aceita (RFC 5321)", async () => {
    expect(await dominioRecebeEmail("so-a.com", { mx: async () => [], a: async () => ["1.2.3.4"] })).toBe(true);
  });

  it("reprova domínio que não existe", async () => {
    const r = { mx: async () => { throw erro("ENOTFOUND"); }, a: async () => { throw erro("ENOTFOUND"); } };
    expect(await dominioRecebeEmail("nao-existe-xyz.com", r)).toBe(false);
  });

  it("falha passageira de DNS não reprova", async () => {
    const r = { mx: async () => { throw erro("ESERVFAIL"); }, a: async () => [] };
    expect(await dominioRecebeEmail("instavel.com", r)).toBe(true);
  });

  it("guarda o resultado no cache", async () => {
    let chamadas = 0;
    const r = { mx: async () => { chamadas++; return [{}]; }, a: async () => [] };
    await dominioRecebeEmail("cache.com", r);
    await dominioRecebeEmail("cache.com", r);
    expect(chamadas).toBe(1);
  });
});
