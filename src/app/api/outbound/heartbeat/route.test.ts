import { beforeEach, describe, expect, it, vi } from "vitest";

const docs: Array<{ id: number; chave: string; metadados?: unknown; data?: string }> = [];
let nextId = 1;

const mockPayload = {
  find: vi.fn(async ({ where }: { where: { chave?: { equals?: string } } }) => {
    const chave = where?.chave?.equals;
    const encontrados = chave ? docs.filter((d) => d.chave === chave) : docs;
    return { docs: encontrados };
  }),
  create: vi.fn(async ({ data }: { data: { chave: string; metadados?: unknown; data?: string } }) => {
    const novo = { id: nextId++, ...data };
    docs.push(novo);
    return novo;
  }),
  update: vi.fn(async ({ id, data }: { id: number; data: Partial<{ metadados: unknown; data: string }> }) => {
    const idx = docs.findIndex((d) => d.id === id);
    if (idx >= 0) {
      docs[idx] = { ...docs[idx], ...data };
      return docs[idx];
    }
    return null;
  }),
  logger: { error: vi.fn() },
};

vi.mock("@/lib/payload", () => ({
  getPayloadClient: async () => mockPayload,
}));

const { GET, POST } = await import("./route");

beforeEach(() => {
  docs.length = 0;
  nextId = 1;
  vi.clearAllMocks();
});

describe("API /api/outbound/heartbeat", () => {
  it("GET registra heartbeat do Hunter e responde 200", async () => {
    const req = new Request("https://empresarialacademy.com/api/outbound/heartbeat?status=ok");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.recebidoEm).toBeDefined();

    expect(mockPayload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chave: "sistema:heartbeat:hunter",
          tipo: "lembrete",
        }),
      }),
    );
  });

  it("POST com dados de IA registra marcador de teto atingido", async () => {
    const payload = {
      status: "ok",
      ia_teto_atingido: true,
      chamadas_ia: 300,
      teto_ia: 300,
      pid: 12345,
    };

    const req = new Request("https://empresarialacademy.com/api/outbound/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Deve criar heartbeat e marcador de teto
    expect(docs.some((d) => d.chave === "sistema:heartbeat:hunter")).toBe(true);
    expect(docs.some((d) => d.chave.startsWith("sistema:ia_teto:"))).toBe(true);
  });

  it("POST subsequente atualiza o heartbeat existente sem duplicar", async () => {
    const req1 = new Request("https://empresarialacademy.com/api/outbound/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ok" }),
    });
    await POST(req1);

    expect(docs.filter((d) => d.chave === "sistema:heartbeat:hunter")).toHaveLength(1);

    const req2 = new Request("https://empresarialacademy.com/api/outbound/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ok", pid: 999 }),
    });
    await POST(req2);

    expect(docs.filter((d) => d.chave === "sistema:heartbeat:hunter")).toHaveLength(1);
    expect(mockPayload.update).toHaveBeenCalled();
  });
});
