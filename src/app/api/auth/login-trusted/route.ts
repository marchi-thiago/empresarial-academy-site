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

    let finalToken = result.token;
    if (body.trustDevice && result.token) {
      const { jwtVerify } = await import("jose");
      const { jwtSign } = await import("payload");
      const secret = payload.secret;
      if (!secret) throw new Error("PAYLOAD_SECRET não configurada.");

      const secretKey = new TextEncoder().encode(secret);
      const { payload: decoded } = await jwtVerify(result.token, secretKey);
      const { exp: _exp, iat: _iat, ...fieldsToSign } = decoded;

      const { token } = await jwtSign({
        fieldsToSign,
        secret,
        tokenExpiration: TRUSTED_SECONDS,
      });
      finalToken = token;

      // Se a collection usa sessões no banco, estende expiresAt da sessão ativa
      if (fieldsToSign.sid && result.user.id) {
        try {
          const userDoc = await payload.db.findOne<any>({
            collection: "users",
            where: { id: { equals: result.user.id } },
          });
          if (userDoc && Array.isArray(userDoc.sessions)) {
            const activeSession = userDoc.sessions.find((s: any) => s.id === fieldsToSign.sid);
            if (activeSession) {
              activeSession.expiresAt = new Date(Date.now() + TRUSTED_SECONDS * 1000);
              await payload.db.updateOne({
                id: userDoc.id,
                collection: "users",
                data: { ...userDoc, sessions: userDoc.sessions },
                returning: false,
              });
            }
          }
        } catch (sessionErr) {
          console.warn("[login-trusted] aviso ao estender sessão no banco:", sessionErr);
        }
      }
    }

    const res = NextResponse.json({
      success: true,
      user: { id: result.user.id, email: result.user.email },
      trustedFor: body.trustDevice ? `${TRUSTED_DAYS} dias` : "2 horas",
    });

    const cookieName = `${payload.config.cookiePrefix ?? "payload"}-token`;
    const authConfig = payload.collections.users.config.auth;
    const cookiesConfig = typeof authConfig === "object" ? authConfig?.cookies : undefined;
    const host = req.headers.get("host") || "";
    const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");

    res.cookies.set({
      name: cookieName,
      value: finalToken || "",
      httpOnly: true,
      path: "/",
      maxAge: seconds,
      sameSite:
        typeof cookiesConfig?.sameSite === "string"
          ? (cookiesConfig.sameSite.toLowerCase() as "lax" | "strict" | "none")
          : "lax",
      secure: process.env.NODE_ENV === "production" && !isLocalhost,
      domain: cookiesConfig?.domain ?? undefined,
    });

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
