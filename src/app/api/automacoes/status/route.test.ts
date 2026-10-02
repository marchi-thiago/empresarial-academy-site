import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const montar = vi.fn(async () => ({
  geradoEm: "2026-10-02T14:00:00.000Z",
  hunter: { ultimoSinal: null, semSinal: "x" },
  automacoes: [],
  cores: { verdes: 0, amarelas: 0, vermelhas: 0 },
}));
const getPayloadClient = vi.fn(async () => ({}));
vi.mock("@/lib/payload", () => ({ getPayloadClient }));
vi.mock("@/lib/automacoes/status", () => ({ montarRespostaDoStatus: montar }));

const { GET } = await import("./route");
const URL_BASE = "https://empresarialacademy.com/api/automacoes/status";
const bearer = (t: string): RequestInit => ({ headers: { authorization: `Bearer ${t}` } });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SDR_SEGREDO = "segredo-de-teste";
});
afterEach(() => {
  delete process.env.SDR_SEGREDO;
});

describe("GET /api/automacoes/status", () => {
  it("sem SDR_SEGREDO no servidor responde 503 e não toca no banco", async () => {
    delete process.env.SDR_SEGREDO;
    expect((await GET(new Request(URL_BASE, bearer("segredo-de-teste")))).status).toBe(503);
    expect(getPayloadClient).not.toHaveBeenCalled();
  });

  it("sem credencial, com segredo errado ou com o segredo na URL responde 401 e não toca no banco", async () => {
    expect((await GET(new Request(URL_BASE))).status).toBe(401);
    expect((await GET(new Request(URL_BASE, bearer("errado")))).status).toBe(401);
    expect((await GET(new Request(`${URL_BASE}?key=segredo-de-teste`))).status).toBe(401);
    expect(getPayloadClient).not.toHaveBeenCalled();
  });

  it("o CRON_SECRET não abre esta rota (o segredo é o SDR_SEGREDO)", async () => {
    process.env.CRON_SECRET = "outro";
    expect((await GET(new Request(URL_BASE, bearer("outro")))).status).toBe(401);
    delete process.env.CRON_SECRET;
  });

  it("autenticado devolve o status, sem cache", async () => {
    const res = await GET(new Request(URL_BASE, bearer("segredo-de-teste")));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ geradoEm: "2026-10-02T14:00:00.000Z", automacoes: [] });
  });

  it("falha ao montar vira 500 sem vazar o erro", async () => {
    montar.mockRejectedValueOnce(new Error("senha do banco: abc"));
    const res = await GET(new Request(URL_BASE, bearer("segredo-de-teste")));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("senha");
  });
});
