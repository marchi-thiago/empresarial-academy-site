import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const guardarRegistros = vi.fn(async (_p: unknown, r: unknown[]) => r.length);
const getPayloadClient = vi.fn(async () => ({}));
vi.mock("@/lib/payload", () => ({ getPayloadClient }));
vi.mock("@/lib/infra/cotas-db", () => ({ guardarRegistros }));

const { GET, POST } = await import("./route");
const URL_BASE = "https://empresarialacademy.com/api/infra/cotas";
const corpo = { registros: [{ dia: "2026-10-02", geradoEm: "2026-10-02T09:00:00Z", projetos: [{ id: "neon-a", sistema: "neon", nome: "Neon: a", plano: "free", metricas: [{ chave: "compute", rotulo: "Compute", unidade: "CU-h", dia: 1, mes: 10, limite: 100, pct: 10, estimativa: false }] }] }] };
const post = (token: string | null, body: unknown = corpo): Request =>
  new Request(URL_BASE, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SDR_SEGREDO = "segredo-de-teste";
});
afterEach(() => {
  delete process.env.SDR_SEGREDO;
});

describe("POST /api/infra/cotas", () => {
  it("sem SDR_SEGREDO no servidor responde 503 e não toca no banco", async () => {
    delete process.env.SDR_SEGREDO;
    expect((await POST(post("segredo-de-teste"))).status).toBe(503);
    expect(getPayloadClient).not.toHaveBeenCalled();
  });

  it("sem credencial ou com segredo errado responde 401 e não toca no banco", async () => {
    expect((await POST(post(null))).status).toBe(401);
    expect((await POST(post("errado"))).status).toBe(401);
    expect(getPayloadClient).not.toHaveBeenCalled();
  });

  it("o CRON_SECRET não abre esta rota", async () => {
    process.env.CRON_SECRET = "outro";
    expect((await POST(post("outro"))).status).toBe(401);
    delete process.env.CRON_SECRET;
  });

  it("corpo sem registro válido responde 400 e não grava", async () => {
    expect((await POST(post("segredo-de-teste", { registros: [{ lixo: 1 }] }))).status).toBe(400);
    expect(guardarRegistros).not.toHaveBeenCalled();
  });

  it("autenticado e válido grava os registros", async () => {
    const res = await POST(post("segredo-de-teste"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, recebidos: 1, gravados: 1 });
    expect(guardarRegistros).toHaveBeenCalledTimes(1);
  });

  it("falha do banco vira 500 sem vazar o erro", async () => {
    guardarRegistros.mockRejectedValueOnce(new Error("senha=abc"));
    const res = await POST(post("segredo-de-teste"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("senha");
  });
});

describe("GET /api/infra/cotas", () => {
  it("responde 405 e não grava nem lê", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(getPayloadClient).not.toHaveBeenCalled();
  });
});
