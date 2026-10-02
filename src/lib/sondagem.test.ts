import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarSondagem, INTERVALO_MINIMO_MS } from "./sondagem";

let visivel = true;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
  visivel = true;
});
afterEach(() => vi.useRealTimers());

const nova = (buscar: () => Promise<"parar" | void>, intervaloMs = 20_000, inatividadeMs?: number) =>
  criarSondagem({ buscar, intervaloMs, visivel: () => visivel, ...(inatividadeMs ? { inatividadeMs } : {}) });

describe("sondagem segura", () => {
  it("busca ao abrir e nunca com intervalo menor que 60 s, mesmo pedindo 15 s", async () => {
    const buscar = vi.fn(async () => {});
    const s = nova(buscar, 15_000);
    expect(s.intervaloMs).toBe(INTERVALO_MINIMO_MS);
    s.comecar();
    expect(buscar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(buscar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(buscar).toHaveBeenCalledTimes(2);
    s.parar();
  });

  it("para de vez ao receber 401 (a busca devolve parar)", async () => {
    const buscar = vi.fn(async () => "parar" as const);
    const s = nova(buscar);
    s.comecar();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(s.parado).toBe(true);
    // Voltar a aba também não reabre.
    s.aoMudarVisibilidade();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("pausa com a aba oculta e, ao voltar, busca uma vez só se a última já passou do intervalo", async () => {
    const buscar = vi.fn(async () => {});
    const s = nova(buscar);
    s.comecar();
    visivel = false;
    s.aoMudarVisibilidade();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(buscar).toHaveBeenCalledTimes(1);
    visivel = true;
    s.aoMudarVisibilidade();
    expect(buscar).toHaveBeenCalledTimes(2);
    // Alternar de aba de novo logo em seguida não repete a busca.
    visivel = false;
    s.aoMudarVisibilidade();
    visivel = true;
    s.aoMudarVisibilidade();
    expect(buscar).toHaveBeenCalledTimes(2);
    s.parar();
  });

  it("falha de rede não para a sondagem", async () => {
    const buscar = vi.fn(async () => {
      throw new Error("rede");
    });
    const s = nova(buscar);
    s.comecar();
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    expect(buscar.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(s.parado).toBe(false);
    s.parar();
  });

  it("depois de 15 min sem uso pausa, e o primeiro movimento atualiza uma vez", async () => {
    const buscar = vi.fn(async () => {});
    const s = nova(buscar, 60_000, 15 * 60_000);
    s.comecar();
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    const antes = buscar.mock.calls.length;
    // Em 30 min só as buscas dos primeiros 15 min aconteceram.
    expect(antes).toBeLessThanOrEqual(16);
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(buscar.mock.calls.length).toBe(antes);
    s.aoUsar();
    expect(buscar.mock.calls.length).toBe(antes + 1);
    s.parar();
  });

  it("não empilha buscas: se a anterior não voltou, a seguinte espera", async () => {
    let solta: () => void = () => {};
    const buscar = vi.fn(() => new Promise<void>((r) => (solta = r)));
    const s = nova(buscar);
    s.comecar();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(buscar).toHaveBeenCalledTimes(1);
    solta();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(buscar).toHaveBeenCalledTimes(2);
    s.parar();
  });
});
