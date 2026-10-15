import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { esperaAntesDoReenvio, sendOutlookMail } from "./microsoft-graph";

const resposta = (status: number, texto = "", headers: Record<string, string> = {}) => new Response(texto, { status, headers });

describe("sendOutlookMail: reenvio só quando a Microsoft não aceitou", () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env.MICROSOFT_CLIENT_ID = "id";
    process.env.MICROSOFT_CLIENT_SECRET = "segredo";
    process.env.MICROSOFT_REFRESH_TOKEN = "refresh";
  });
  afterEach(() => {
    process.env = { ...original };
    vi.restoreAllMocks();
  });

  const params = { to: "a@b.com", subject: "x", texto: "y", from: "comercial@empresarialacademy.com" };
  /** O token fica em cache entre os testes; por isso a resposta vem por URL, não por ordem de chamada. */
  const simular = (envios: Response[]) => {
    const fila = [...envios];
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
      String(url).includes("login.microsoftonline.com")
        ? resposta(200, JSON.stringify({ access_token: "t", expires_in: 3600 }))
        : (fila.shift() ?? fila.at(-1) ?? resposta(202)),
    );
  };
  const enviosFeitos = (m: ReturnType<typeof simular>) => m.mock.calls.filter(([u]) => String(u).includes("sendMail")).length;

  it("503 vira sucesso quando a segunda tentativa passa", async () => {
    const m = simular([resposta(503, "Application Request Queue Full"), resposta(202)]);
    const dorme = vi.fn(async () => undefined);
    await expect(sendOutlookMail(params, dorme)).resolves.toEqual({ ok: true });
    expect(dorme).toHaveBeenCalledTimes(1);
    expect(enviosFeitos(m)).toBe(2);
  });

  it("504 NÃO reenvia (pode ter entregue): falha na primeira", async () => {
    const m = simular([resposta(504, "{}")]);
    const dorme = vi.fn(async () => undefined);
    await expect(sendOutlookMail(params, dorme)).rejects.toThrow("504");
    expect(dorme).not.toHaveBeenCalled();
    expect(enviosFeitos(m)).toBe(1);
  });

  it("503 persistente desiste depois de 3 reenvios", async () => {
    const m = simular([resposta(503, "x"), resposta(503, "x"), resposta(503, "x"), resposta(503, "x")]);
    await expect(sendOutlookMail(params, async () => undefined)).rejects.toThrow("503");
    expect(enviosFeitos(m)).toBe(4);
  });

  it("Retry-After maior que a espera padrão vale, com teto de 25 s", () => {
    expect(esperaAntesDoReenvio(0, null)).toBe(3_000);
    expect(esperaAntesDoReenvio(0, "10")).toBe(10_000);
    expect(esperaAntesDoReenvio(0, "120")).toBe(25_000);
  });
});
