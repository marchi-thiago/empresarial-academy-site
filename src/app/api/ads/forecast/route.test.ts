import { beforeEach, describe, expect, it, vi } from "vitest";

const findByID = vi.fn();
const find = vi.fn();

vi.mock("@/lib/google-ads", () => ({
  getSaoPauloDateISO: () => "2026-10-11",
}));

vi.mock("@/lib/payload", () => ({
  getPayloadClient: async () => ({
    findByID: (...args: unknown[]) => findByID(...args),
    find: (...args: unknown[]) => find(...args),
  }),
}));

import { POST } from "./route";

function req(campaignId = 2) {
  return new Request("https://site.test/api/ads/forecast", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ campaignId }),
  });
}

describe("POST /api/ads/forecast", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    findByID.mockReset().mockResolvedValue({
      id: 2,
      name: "Campanha PME",
      status: "ENABLED",
      dailyBudgetTarget: 50,
      cpcCeiling: 12,
    });
    find.mockReset().mockResolvedValue({
      docs: [{ date: "2026-11-09", clicks: 10, impressions: 500, cost: 40, conversions: 2 }],
    });
    delete process.env.EA_FLOW_URL;
    delete process.env.EA_FLOW_ADMIN_API_KEY;
    delete process.env.EA_FLOW_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  it("retorna 500 sem chamar API paga quando EA Flow não está configurado", async () => {
    process.env.GEMINI_API_KEY = "AIza-nao-deve-ser-usada";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("gera forecast via EA Flow (/api/ia/gerar) pela assinatura", async () => {
    process.env.EA_FLOW_URL = "https://flow.exemplo.test/";
    process.env.EA_FLOW_ADMIN_API_KEY = "chave-admin";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ parts: [{ text: "# Diagnóstico\nCTR de 2.00%" }] }), { status: 200 }));

    const res = await POST(req(2));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      success: true,
      insight: "# Diagnóstico\nCTR de 2.00%",
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://flow.exemplo.test/api/ia/gerar",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer chave-admin" }),
      }),
    );
  });

  it("propaga erro 503 quando o PC está indisponível", async () => {
    process.env.EA_FLOW_URL = "https://flow.exemplo.test";
    process.env.EA_FLOW_ADMIN_API_KEY = "chave-admin";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "O PC não respondeu a tempo.", pcIndisponivel: true }), { status: 503 }),
    );

    const res = await POST(req(2));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "O PC não respondeu a tempo." });
  });
});
