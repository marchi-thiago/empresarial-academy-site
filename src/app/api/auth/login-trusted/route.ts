import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";

/**
 * Login com a opção "Confiar neste navegador" — pedido do Thiago em
 * 05/09/2026: a sessão padrão do Payload dura 2h, então ele reloga o dia
 * inteiro nas máquinas dele.
 *
 * Por que uma rota própria e não o `/api/users/login` de fábrica: o Payload
 * assina o token com `collection.auth.tokenExpiration`, um valor FIXO da
 * collection — não dá pra escolher a duração por login. Aqui a duração vem
 * da caixa marcada na tela: 30 dias quando o usuário confia no navegador,
 * 2h quando não.
 *
 * A senha continua sendo verificada pelo Payload (payload.login), que trata
 * hash, bloqueio por tentativas e os hooks da collection. Esta rota só
 * decide por quanto tempo o cookie vale — nada de credencial é guardado no
 * navegador, nem aqui nem no cliente.
 */

const TRUSTED_DAYS = 30;
const TRUSTED_SECONDS = TRUSTED_DAYS * 24 * 60 * 60;
/** Sessão padrão quando o usuário NÃO confia no navegador (o default do Payload). */
const DEFAULT_SECONDS = 2 * 60 * 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    trustDevice?: boolean;
    /**
     * Slug da collection de auth. Só "users" é aceito: aceitar qualquer
     * string deixaria o cliente escolher em que collection autenticar.
     */
    collection?: string;
  };
  if (body.collection && body.collection !== "users") {
    return NextResponse.json({ error: "Collection de autenticação inválida." }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 });
  }

  const payload = await getPayloadClient();

  try {
    // payload.login valida a senha e aplica as regras da collection
    // (tentativas, lock). Não reimplementar nada disso aqui.
    const result = await payload.login({
      collection: "users",
      data: { email: body.email, password: body.password },
    });

    if (!result?.user) {
      return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
    }

    const seconds = body.trustDevice ? TRUSTED_SECONDS : DEFAULT_SECONDS;

    // Reassina com a duração escolhida. O token que payload.login devolve
    // já carrega a expiração fixa da collection, por isso não serve aqui.
    const { jwtSign } = await import("payload");
    const secret = payload.secret;
    if (!secret) throw new Error("PAYLOAD_SECRET não configurada.");

    const { token } = await jwtSign({
      fieldsToSign: {
        id: result.user.id,
        collection: "users",
        email: result.user.email,
      },
      secret,
      tokenExpiration: seconds,
    });

    const res = NextResponse.json({
      success: true,
      user: { id: result.user.id, email: result.user.email },
      trustedFor: body.trustDevice ? `${TRUSTED_DAYS} dias` : "2 horas",
    });

    // Cookie montado pela função oficial do Payload (herda sameSite, secure
    // e domain da config da collection) — só a expiração é nossa. Montar o
    // Set-Cookie na mão sairia do padrão do resto do sistema.
    const { generateCookie, getCookieExpiration } = await import("payload");
    const authConfig = payload.collections.users.config.auth;
    const cookie = generateCookie<string>({
      name: `${payload.config.cookiePrefix ?? "payload"}-token`,
      domain: authConfig.cookies.domain ?? undefined,
      expires: getCookieExpiration({ seconds }),
      httpOnly: true,
      path: "/",
      returnCookieAsObject: false,
      sameSite: typeof authConfig.cookies.sameSite === "string" ? authConfig.cookies.sameSite : authConfig.cookies.sameSite ? "Strict" : undefined,
      secure: authConfig.cookies.secure,
      value: token,
    });
    res.headers.set("Set-Cookie", cookie);

    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Credencial errada não vira log de erro nem detalhe pro cliente —
    // responder sempre a mesma coisa evita dizer se o e-mail existe.
    if (/credential|password|email|locked/i.test(message)) {
      return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
    }
    console.error("[login-trusted] falha no login:", err);
    return NextResponse.json({ error: "Não foi possível entrar. Tente de novo." }, { status: 500 });
  }
}
