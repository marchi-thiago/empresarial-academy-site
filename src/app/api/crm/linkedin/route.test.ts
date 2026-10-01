import { beforeEach, describe, expect, it, vi } from "vitest";

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

const mockSlim = vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => null);
vi.mock("@/lib/crm/dados", () => ({
  carregarLeadSlim: (...a: unknown[]) => mockSlim(...a),
}));

const { POST } = await import("./route");

beforeEach(() => {
  mockSlim.mockImplementation(async () => ({ entrega: { linkedin: "convite_enviado" } }));
});

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

  it("marca convite como enviado: grava interação com tipo que existe no enum do banco e não mexe no lead por fora", async () => {
    mockRegistrarInteracao.mockClear();
    mockUpdate.mockClear();

    const res = await POST(criarReq({ leadId: 42, acao: "enviado" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; statusLinkedin: string | null };
    expect(json.ok).toBe(true);
    expect(json.statusLinkedin).toBe("convite_enviado");

    expect(mockRegistrarInteracao).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ leadId: 42, canal: "linkedin", direcao: "saida", tipo: "enviado" }),
    );
    // O estado do lead é aplicado por registrarInteracao (regras.ts); gravar de novo por fora sobrescreve estado mais novo.
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("marca convite como aceito com tipo entregue (as regras do canal linkedin levam a aceito)", async () => {
    mockRegistrarInteracao.mockClear();
    const res = await POST(criarReq({ leadId: 42, acao: "aceito" }));
    expect(res.status).toBe(200);
    expect(mockRegistrarInteracao).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ leadId: 42, canal: "linkedin", direcao: "entrada", tipo: "entregue" }),
    );
  });

  it("só usa tipos de interação que existem no enum do banco (sem DDL)", async () => {
    const { TIPOS } = await import("@/lib/crm/tipos");
    for (const acao of ["enviado", "aceito"]) {
      mockRegistrarInteracao.mockClear();
      await POST(criarReq({ leadId: 42, acao }));
      const tipo = (mockRegistrarInteracao.mock.calls[0] as unknown as [unknown, { tipo: string }])[1].tipo;
      expect(TIPOS).toContain(tipo);
    }
  });
});
