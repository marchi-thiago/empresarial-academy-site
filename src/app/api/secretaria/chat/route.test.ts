import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const exigirSessao = vi.fn();

vi.mock("@/lib/secretaria/sessao", () => ({
  exigirSessao: (...args: unknown[]) => exigirSessao(...args),
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("https://site.test/api/secretaria/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/secretaria/chat", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    exigirSessao.mockReset().mockResolvedValue(null);
    delete process.env.EA_FLOW_URL;
    delete process.env.EA_FLOW_ADMIN_API_KEY;
    delete process.env.EA_FLOW_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  it("bloqueia quem não tem sessão no EA HUB (401)", async () => {
    exigirSessao.mockResolvedValue(NextResponse.json({ ok: false }, { status: 401 }));
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(req({ message: "oi" }));
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("não usa GEMINI_API_KEY paga e avisa quando EA Flow não está configurado", async () => {
    process.env.GEMINI_API_KEY = "AIza-nao-deve-ser-usada";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(req({ message: "o que tenho hoje?" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      reply: expect.stringContaining("EA_FLOW_URL"),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("encaminha turno para o EA Flow pela assinatura e devolve resposta", async () => {
    process.env.EA_FLOW_URL = "https://flow.exemplo.test/";
    process.env.EA_FLOW_ADMIN_API_KEY = "chave-admin";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ reply: "Reunião às 15h." }), { status: 200 }));

    const res = await POST(
      req({
        message: "agenda de hoje",
        history: [
          { role: "user", text: "oi" },
          { role: "model", text: "olá" },
          { role: "invalid", text: "ignorar" },
        ],
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "Reunião às 15h." });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://flow.exemplo.test/api/secretaria/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer chave-admin" }),
        body: JSON.stringify({
          message: "agenda de hoje",
          history: [
            { role: "user", text: "oi" },
            { role: "model", text: "olá" },
          ],
        }),
      }),
    );
  });

  it("informa quando o PC / EA Hunter não responde a tempo pela assinatura", async () => {
    process.env.EA_FLOW_URL = "https://flow.exemplo.test";
    process.env.EA_FLOW_ADMIN_API_KEY = "chave-admin";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ reply: "", quotaExhausted: true, viaAssinatura: true }), { status: 200 }),
    );

    const res = await POST(req({ message: "oi" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.quotaExhausted).toBe(true);
    expect(data.reply).toContain("EA Hunter");
  });
});
