import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn(async () => ({ user: null as unknown }));
const getPayloadClient = vi.fn(async () => ({ auth }));
vi.mock("@/lib/payload", () => ({ getPayloadClient }));

const { exigirSessao } = await import("./sessao");
const pedido = (headers: Record<string, string> = {}) => new Request("https://empresarialacademy.com/api/secretaria/whatsapp-status", { headers });

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: null });
});

describe("porteiro das rotas do painel do EA Assessor", () => {
  it("sem cookie de sessão responde 401 sem abrir o Payload nem tocar no banco", async () => {
    const r = await exigirSessao(pedido());
    expect(r!.status).toBe(401);
    expect(getPayloadClient).not.toHaveBeenCalled();
  });

  it("cookie de outro nome não vale", async () => {
    expect((await exigirSessao(pedido({ cookie: "outro=1; payload-token-x=2" })))!.status).toBe(401);
    expect(getPayloadClient).not.toHaveBeenCalled();
  });

  it("cookie vencido ou falso (o Payload não reconhece) responde 401", async () => {
    expect((await exigirSessao(pedido({ cookie: "payload-token=velho" })))!.status).toBe(401);
    expect(auth).toHaveBeenCalledTimes(1);
  });

  it("sessão válida passa", async () => {
    auth.mockResolvedValue({ user: { id: 1 } });
    expect(await exigirSessao(pedido({ cookie: "a=1; payload-token=ok" }))).toBeNull();
  });
});
