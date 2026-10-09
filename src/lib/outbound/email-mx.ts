import { promises as dns } from "node:dns";

/**
 * O domínio do endereço recebe e-mail? Tem registro MX (ou, sem MX, um A, como manda o RFC 5321).
 * Só reprova com certeza: ENOTFOUND/ENODATA. Timeout e erro passageiro de DNS passam, para uma
 * falha de rede não bloquear o envio do dia.
 */
const CACHE_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { ok: boolean; ate: number }>();

type Resolvedores = {
  mx: (d: string) => Promise<unknown[]>;
  a: (d: string) => Promise<unknown[]>;
};

const REAIS: Resolvedores = { mx: (d) => dns.resolveMx(d), a: (d) => dns.resolve4(d) };
const SEM_REGISTRO = new Set(["ENOTFOUND", "ENODATA"]);

const comTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), ms))]);

export async function dominioRecebeEmail(dominio: string, r: Resolvedores = REAIS, agora = Date.now()): Promise<boolean> {
  const d = dominio.trim().toLowerCase();
  if (!d) return false;
  const guardado = cache.get(d);
  if (guardado && guardado.ate > agora) return guardado.ok;
  let ok = true;
  try {
    const mx = await comTimeout(r.mx(d), 4000);
    ok = mx.length > 0;
    if (!ok) ok = (await comTimeout(r.a(d), 4000)).length > 0;
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (SEM_REGISTRO.has(code)) {
      try {
        ok = (await comTimeout(r.a(d), 4000)).length > 0;
      } catch (e2) {
        ok = !SEM_REGISTRO.has((e2 as { code?: string }).code ?? "");
      }
    }
  }
  cache.set(d, { ok, ate: agora + CACHE_MS });
  return ok;
}

export const limparCacheMx = () => cache.clear();
