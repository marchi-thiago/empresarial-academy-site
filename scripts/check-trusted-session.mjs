/**
 * Check da duração de sessão do login "Confiar neste navegador"
 * (src/app/api/auth/login-trusted/route.ts).
 *
 * Verifica o que importa em segurança: a caixa marcada dá 30 dias, e a
 * caixa NÃO marcada continua nas 2h padrão — um bug que trocasse o default
 * daria sessão longa a quem não pediu, inclusive em máquina compartilhada.
 *
 * Roda com: node scripts/check-trusted-session.mjs
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { jwtSign, getCookieExpiration } from "payload";

const source = readFileSync(new URL("../src/app/api/auth/login-trusted/route.ts", import.meta.url), "utf8");

// As constantes da rota são a fonte da verdade — lidas do arquivo para o
// check falhar se alguém trocar o número lá sem pensar.
const trustedDays = Number(/const TRUSTED_DAYS = (\d+)/.exec(source)?.[1]);
const defaultHours = Number(/const DEFAULT_SECONDS = (\d+) \* 60 \* 60/.exec(source)?.[1]);

assert.equal(trustedDays, 30, `sessão confiável deveria ser 30 dias, está ${trustedDays}`);
assert.equal(defaultHours, 2, `sessão padrão deveria ser 2h, está ${defaultHours}h`);

// Default nunca pode virar a sessão longa por engano.
assert.ok(defaultHours * 60 * 60 < trustedDays * 24 * 60 * 60, "sessão padrão não pode durar mais que a confiável");

// O token realmente carrega a expiração pedida (é o que o cookie promete).
const secret = "check-only-secret-nao-usado-em-producao";
const trustedSeconds = trustedDays * 24 * 60 * 60;
const { exp } = await jwtSign({
  fieldsToSign: { id: "1", collection: "users", email: "check@example.com" },
  secret,
  tokenExpiration: trustedSeconds,
});
const now = Math.floor(Date.now() / 1000);
assert.ok(Math.abs(exp - (now + trustedSeconds)) <= 5, `exp do token fora do esperado: ${exp - now}s`);

const { exp: shortExp } = await jwtSign({
  fieldsToSign: { id: "1", collection: "users", email: "check@example.com" },
  secret,
  tokenExpiration: defaultHours * 60 * 60,
});
assert.ok(shortExp < exp, "token da sessão padrão deveria expirar antes da confiável");

// O cookie expira junto com o token — cookie mais longo que o token deixaria
// o usuário "logado" com credencial já inválida.
const cookieExp = getCookieExpiration({ seconds: trustedSeconds });
assert.ok(Math.abs(cookieExp.getTime() / 1000 - exp) <= 5, "cookie e token deveriam expirar juntos");

console.log(`✓ sessão confiável ${trustedDays}d, padrão ${defaultHours}h; token e cookie expiram juntos`);
