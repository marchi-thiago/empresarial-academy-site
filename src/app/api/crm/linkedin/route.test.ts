import { describe, expect, it, vi } from "vitest";

const mockRegistrarInteracao = vi.fn(async () => ({ ok: true }));
const mockUpdate = vi.fn(async () => ({}));
const mockFindByID = vi.fn(async () => ({ id: 42, statusEntrega: { linkedin: "nao_enviado" } }));
const mockAuth = vi.fn(async () => ({ user: { id: "1", email: "thiago@empresarialacademy.com" } }));

vi.mock("@/lib/payload", () => ({
  getPayloadClient: async () => ({
    auth: mockAuth,
    update: mockUpdate,
    findByID: mockFindByID,
    logger: { error: () => {} },
  }),
}));

vi.mock("@/lib/crm/payload-db", () => ({
  crmDb: () => ({
    carregarLead: async (id: number) => ({
      id,
      etapa: "qualificado",
      statusEntrega: { linkedin: "nao_enviado" },
    }),
  }),
}));

vi.mock("@/lib/crm/registrar", () => ({
  registrarInteracao: mockRegistrarInteracao,
}));

vi.mock("@/lib/crm/dados", () => ({
  carregarLeadSlim: async () => null,
}));

const { POST } = await import("./route");

function criarReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://empresarialacademy.com/api/crm/linkedin", {
    method: "POST",
    headers: {
      host: "empresarialacademy.com",
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/crm/linkedin", () => {
  it("bloqueia pedido com origem externa", async () => {
    const req = criarReq({ leadId: 42, acao: "enviado" }, { origin: "https://site-malicioso.com" });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("bloqueia pedido sem content-type application/json", async () => {
    const req = new Request("https://empresarialacademy.com/api/crm/linkedin", {
      method: "POST",
      headers: { host: "empresarialacademy.com", "content-type": "text/plain" },
      body: "ola",
    });
    const res = await POST(req);
    expect(res.status).toBe(415);
  });

  it("bloqueia usuário não autenticado", async () => {
    mockAuth.mockResolvedValueOnce({ user: null } as never);
    const req = criarReq({ leadId: 42, acao: "enviado" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("valida leadId e acao", async () => {
    const r1 = await POST(criarReq({ leadId: "invalido", acao: "enviado" }));
    expect(r1.status).toBe(400);

    const r2 = await POST(criarReq({ leadId: 42, acao: "desconhecido" }));
    expect(r2.status).toBe(400);
  });

  it("marca convite como enviado e atualiza statusEntrega", async () => {
    mockRegistrarInteracao.mockClear();
    mockUpdate.mockClear();

    const req = criarReq({ leadId: 42, acao: "enviado" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { ok: boolean; statusLinkedin: string };
    expect(json.ok).toBe(true);
    expect(json.statusLinkedin).toBe("convite_enviado");

    expect(mockRegistrarInteracao).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        leadId: 42,
        canal: "linkedin",
        direcao: "saida",
        tipo: "linkedin_convite_enviado",
      }),
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "leads",
        id: 42,
        data: expect.objectContaining({
          statusEntrega: expect.objectContaining({ linkedin: "convite_enviado" }),
        }),
      }),
    );
  });

  it("marca convite como aceito e atualiza statusEntrega", async () => {
    mockRegistrarInteracao.mockClear();
    mockUpdate.mockClear();

    const req = criarReq({ leadId: 42, acao: "aceito" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { ok: boolean; statusLinkedin: string };
    expect(json.ok).toBe(true);
    expect(json.statusLinkedin).toBe("aceito");

    expect(mockRegistrarInteracao).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        leadId: 42,
        canal: "linkedin",
        direcao: "entrada",
        tipo: "linkedin_aceito",
      }),
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "leads",
        id: 42,
        data: expect.objectContaining({
          statusEntrega: expect.objectContaining({ linkedin: "aceito" }),
        }),
      }),
    );
  });
});
