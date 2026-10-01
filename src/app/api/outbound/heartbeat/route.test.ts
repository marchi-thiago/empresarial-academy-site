import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Doc = { id: number; chave: string; metadados?: Record<string, unknown>; data?: string };
const docs: Doc[] = [];
let nextId = 1;

const mockPayload = {
  find: vi.fn(async ({ where }: { where: { chave?: { equals?: string } } }) => {
    const chave = where?.chave?.equals;
    return { docs: chave ? docs.filter((d) => d.chave === chave) : docs };
  }),
  create: vi.fn(async ({ data }: { data: Omit<Doc, "id"> }) => {
    const novo = { id: nextId++, ...data };
    docs.push(novo);
    return novo;
  }),
  update: vi.fn(async ({ id, data }: { id: number; data: Partial<Doc> }) => {
    const i = docs.findIndex((d) => d.id === id);
    docs[i] = { ...docs[i], ...data };
    return docs[i];
  }),
  logger: { error: vi.fn(), warn: vi.fn() },
};

vi.mock("@/lib/payload", () => ({ getPayloadClient: async () => mockPayload }));

const { GET, POST } = await import("./route");

const URL_BASE = "https://empresarialacademy.com/api/outbound/heartbeat";
const comBearer = (init: RequestInit = {}): RequestInit => ({ ...init, headers: { authorization: "Bearer segredo-de-teste" } });

beforeEach(() => {
  docs.length = 0;
  nextId = 1;
  vi.clearAllMocks();
  process.env.CRON_SECRET = "segredo-de-teste";
});
afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("API /api/outbound/heartbeat", () => {
  it("GET nunca grava (405), com ou sem credencial", async () => {
    for (const url of [URL_BASE, `${URL_BASE}?key=segredo-de-teste`]) {
      const res = await (GET as (r?: Request) => Promise<Response>)(new Request(url, comBearer()));
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST");
    }
    expect(docs).toHaveLength(0);
    expect(mockPayload.create).not.toHaveBeenCalled();
  });

  it("sem CRON_SECRET configurado recusa tudo (503) e não grava", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(new Request(URL_BASE, comBearer({ method: "POST", body: "{}" })));
    expect(res.status).toBe(503);
    expect(docs).toHaveLength(0);
  });

  it("sem credencial, com credencial errada ou com o segredo na URL responde 401 e não grava", async () => {
    expect((await POST(new Request(URL_BASE, { method: "POST", body: "{}" }))).status).toBe(401);
    expect((await POST(new Request(URL_BASE, { method: "POST", headers: { authorization: "Bearer errado" }, body: "{}" }))).status).toBe(401);
    expect((await POST(new Request(`${URL_BASE}?key=segredo-de-teste`, { method: "POST", body: "{}" }))).status).toBe(401);
    expect(docs).toHaveLength(0);
    expect(mockPayload.create).not.toHaveBeenCalled();
  });

  it("POST autenticado registra o sinal de vida (corpo vazio ou inválido também)", async () => {
    expect((await POST(new Request(URL_BASE, comBearer({ method: "POST", body: "isto não é json" })))).status).toBe(200);
    const hb = docs.find((d) => d.chave === "sistema:heartbeat:hunter");
    expect(hb?.metadados).toMatchObject({ status: "ok" });
    expect(typeof hb?.metadados?.recebidoEm).toBe("string");
  });

  it("POST com teto de IA grava o marcador do dia uma vez só, com chamadas e teto", async () => {
    const corpo = JSON.stringify({ status: "ok", ia_teto_atingido: true, chamadas_ia: 300, teto_ia: 300, pid: 123 });
    expect((await POST(new Request(URL_BASE, comBearer({ method: "POST", body: corpo })))).status).toBe(200);
    expect((await POST(new Request(URL_BASE, comBearer({ method: "POST", body: corpo })))).status).toBe(200);
    expect(docs.filter((d) => d.chave.startsWith("sistema:ia_teto:"))).toHaveLength(1);
    expect(docs.find((d) => d.chave.startsWith("sistema:ia_teto:"))?.metadados).toMatchObject({ chamadas: 300, teto: 300 });
  });

  it("chamadas seguidas atualizam o mesmo heartbeat, sem duplicar", async () => {
    await POST(new Request(URL_BASE, comBearer({ method: "POST", body: JSON.stringify({ status: "ok" }) })));
    await POST(new Request(URL_BASE, comBearer({ method: "POST", body: JSON.stringify({ status: "ok", pid: 999 }) })));
    const hbs = docs.filter((d) => d.chave === "sistema:heartbeat:hunter");
    expect(hbs).toHaveLength(1);
    expect(hbs[0].metadados?.pid).toBe(999);
  });

  it("ultima_sincronizacao válida grava o marcador de sync; inválida é ignorada", async () => {
    await POST(new Request(URL_BASE, comBearer({ method: "POST", body: JSON.stringify({ ultima_sincronizacao: "2026-10-05T12:00:00.000Z" }) })));
    expect(docs.find((d) => d.chave === "sistema:sync:hunter")?.metadados?.ultimaSincronizacao).toBe("2026-10-05T12:00:00.000Z");

    docs.length = 0;
    await POST(new Request(URL_BASE, comBearer({ method: "POST", body: JSON.stringify({ ultima_sincronizacao: "ontem" }) })));
    expect(docs.some((d) => d.chave === "sistema:sync:hunter")).toBe(false);
  });
});
