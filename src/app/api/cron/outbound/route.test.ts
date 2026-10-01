import { afterEach, describe, expect, it, vi } from "vitest";

const rodar = vi.fn(async () => ({ modo: "simulacao", sairiaHoje: [] }));
vi.mock("@/lib/payload", () => ({ getPayloadClient: async () => ({ logger: { error: () => {} } }) }));
vi.mock("@/lib/outbound/payload-outbound", () => ({ depsDeProducao: () => ({}) }));
vi.mock("@/lib/outbound/orquestrador", () => ({ rodar }));

const { GET, POST } = await import("./route");

const req = (headers: Record<string, string> = {}, query = "") => new Request(`https://empresarialacademy.com/api/cron/outbound${query}`, { headers });

afterEach(() => {
  delete process.env.CRON_SECRET;
  rodar.mockClear();
});

describe("cron do outbound", () => {
  it("sem autorização responde 401 e não roda nada", async () => {
    process.env.CRON_SECRET = "segredo";
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req({ authorization: "Bearer errado" }))).status).toBe(401);
    expect((await POST(req({ authorization: "segredo" }))).status).toBe(401);
    expect(rodar).not.toHaveBeenCalled();
  });

  it("sem CRON_SECRET no ambiente a rota fica fechada, nunca aberta", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req({ authorization: "Bearer " }))).status).toBe(401);
    expect(rodar).not.toHaveBeenCalled();
  });

  it("com o segredo certo roda; ?dry=1 vai como dry", async () => {
    process.env.CRON_SECRET = "segredo";
    const ok = await GET(req({ authorization: "Bearer segredo" }));
    expect(ok.status).toBe(200);
    expect(rodar).toHaveBeenLastCalledWith({}, { dry: false });
    await GET(req({ authorization: "Bearer segredo" }, "?dry=1"));
    expect(rodar).toHaveBeenLastCalledWith({}, { dry: true });
  });
});
