import { beforeEach, describe, expect, it, vi } from "vitest";
import { comCache, esquecer, limparTudo, TTL_NEGADO_MS, TTL_OK_MS } from "./cache";

beforeEach(limparTudo);

describe("memória curta das rotas do painel", () => {
  it("chamadas dentro do prazo viram uma só ida ao EA Flow", async () => {
    let agora = 1_000;
    const buscar = vi.fn(async () => ({ status: 200, corpo: { ok: true } }));
    await comCache("k", buscar, () => agora);
    await comCache("k", buscar, () => agora + TTL_OK_MS - 1);
    expect(buscar).toHaveBeenCalledTimes(1);
    agora += TTL_OK_MS + 1;
    await comCache("k", buscar, () => agora);
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("chamadas simultâneas dividem a mesma ida", async () => {
    let solta: (v: { status: number; corpo: unknown }) => void = () => {};
    const buscar = vi.fn(() => new Promise<{ status: number; corpo: unknown }>((r) => (solta = r)));
    const a = comCache("k", buscar);
    const b = comCache("k", buscar);
    solta({ status: 200, corpo: 1 });
    expect(await a).toEqual(await b);
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("401 do EA Flow fica guardado por 5 min: ninguém insiste a cada poucos segundos", async () => {
    let agora = 0;
    const buscar = vi.fn(async () => ({ status: 401, corpo: { error: "unauthorized" } }));
    await comCache("k", buscar, () => agora);
    agora += 60_000;
    await comCache("k", buscar, () => agora);
    agora += TTL_NEGADO_MS - 60_001;
    await comCache("k", buscar, () => agora);
    expect(buscar).toHaveBeenCalledTimes(1);
    agora += 2;
    await comCache("k", buscar, () => agora);
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("esquecer força a próxima leitura a ir ao EA Flow (depois de uma escrita)", async () => {
    const buscar = vi.fn(async () => ({ status: 200, corpo: {} }));
    await comCache("k", buscar);
    esquecer("k");
    await comCache("k", buscar);
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("falha da busca não fica guardada como resposta", async () => {
    const buscar = vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ status: 200, corpo: {} });
    await expect(comCache("k", buscar)).rejects.toThrow("rede");
    expect((await comCache("k", buscar)).status).toBe(200);
  });
});
