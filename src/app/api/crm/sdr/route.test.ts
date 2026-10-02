import { beforeEach, describe, expect, it, vi } from "vitest";

const registrar = vi.fn();
const auth = vi.fn();
const slim = vi.fn();

vi.mock("@/lib/payload", () => ({ getPayloadClient: async () => ({ auth, logger: { error: vi.fn() } }) }));
vi.mock("@/lib/crm/payload-db", () => ({ crmDb: () => ({}) }));
vi.mock("@/lib/crm/registrar", () => ({ registrarInteracao: (...a: unknown[]) => registrar(...a) }));
vi.mock("@/lib/crm/dados", () => ({ carregarLeadSlim: (...a: unknown[]) => slim(...a) }));

import { GET, POST } from "./route";

const post = (corpo: unknown) =>
  new Request("https://site.test/api/crm/sdr", { method: "POST", headers: { "content-type": "application/json", host: "site.test" }, body: JSON.stringify(corpo) });

beforeEach(() => {
  vi.restoreAllMocks();
  registrar.mockReset().mockResolvedValue({ ok: true });
  auth.mockReset().mockResolvedValue({ user: { id: 1 } });
  slim.mockReset().mockResolvedValue({ id: 7, whatsapp: "11933400264", instagram: "@lead" });
  delete process.env.EAFLOW_URL;
  delete process.env.SDR_SEGREDO;
});

function configurar(estado: string) {
  process.env.EAFLOW_URL = "https://flow.exemplo.test";
  process.env.SDR_SEGREDO = "segredo-de-teste";
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ estado }), { status: 200 }));
}

describe("/api/crm/sdr", () => {
  it("sem login: 401 e nenhuma chamada ao EA Flow", async () => {
    const f = configurar("sdr");
    auth.mockResolvedValue({ user: null });
    expect((await GET(new Request("https://site.test/api/crm/sdr?leadId=7"))).status).toBe(401);
    expect((await POST(post({ leadId: 7, acao: "pausar" }))).status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it("sem EAFLOW_URL e SDR_SEGREDO: SDR não configurado, sem botão e sem chamada", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    const j = await (await GET(new Request("https://site.test/api/crm/sdr?leadId=7"))).json();
    expect(j).toMatchObject({ situacao: "nao_configurado", rotulo: "SDR não configurado", botao: null });
    const p = await POST(post({ leadId: 7, acao: "retomar" }));
    expect((await p.json()).situacao).toBe("nao_configurado");
    expect(f).not.toHaveBeenCalled();
    expect(registrar).not.toHaveBeenCalled();
  });

  it("GET: devolve o estado vindo do EA Flow, com o segredo só no servidor", async () => {
    const f = configurar("thiago");
    const j = await (await GET(new Request("https://site.test/api/crm/sdr?leadId=7"))).json();
    expect(j).toMatchObject({ situacao: "thiago", botao: { acao: "retomar", texto: "Voltar ao SDR" } });
    expect(JSON.stringify(j)).not.toContain("segredo-de-teste");
    expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({ authorization: "Bearer segredo-de-teste" });
  });

  it("retomar: chama o EA Flow e registra SDR retomado pelo Thiago como nota", async () => {
    const f = configurar("sdr");
    const j = await (await POST(post({ leadId: 7, acao: "retomar" }))).json();
    expect(j.situacao).toBe("sdr");
    expect(JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)).toEqual({ contato: { telefone: "5511933400264", instagram: "@lead" }, acao: "retomar" });
    expect(registrar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ leadId: 7, canal: "nota", direcao: "saida", conteudo: "SDR retomado pelo Thiago" }));
  });

  it("pausar: registra SDR pausado pelo Thiago", async () => {
    configurar("thiago");
    await POST(post({ leadId: 7, acao: "pausar" }));
    expect(registrar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ conteudo: "SDR pausado pelo Thiago" }));
  });

  it("SDR geral desligado: não registra nota e avisa", async () => {
    configurar("desligado");
    const j = await (await POST(post({ leadId: 7, acao: "retomar" }))).json();
    expect(j.situacao).toBe("desligado");
    expect(j.erro).toBeTruthy();
    expect(registrar).not.toHaveBeenCalled();
  });

  it("ação inválida e origem de outro site são barradas", async () => {
    configurar("sdr");
    expect((await POST(post({ leadId: 7, acao: "apagar" }))).status).toBe(400);
    const fora = new Request("https://site.test/api/crm/sdr", { method: "POST", headers: { "content-type": "application/json", origin: "https://outro.test", host: "site.test" }, body: "{}" });
    expect((await POST(fora)).status).toBe(403);
  });

  it("lead sem telefone nem Instagram: não chama o EA Flow", async () => {
    const f = configurar("sdr");
    slim.mockResolvedValue({ id: 7, whatsapp: null, instagram: null });
    const j = await (await POST(post({ leadId: 7, acao: "retomar" }))).json();
    expect(j.situacao).toBe("sem_contato");
    expect(f).not.toHaveBeenCalled();
  });
});
