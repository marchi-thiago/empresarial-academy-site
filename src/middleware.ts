import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isBasicAuthProtectedPath } from "@/lib/basic-auth-protected-paths";

/**
 * Protege por senha (HTTP Basic Auth) os materiais estáticos do cliente Souza
 * Ramos — /pos-vendas-souza-ramos e /playbook-souza-ramos — treinamento e
 * conteúdo comercial interno do cliente, não indexável/público. Basic Auth
 * funciona nativamente dentro dos <iframe> do portal: o navegador reusa a
 * credencial já digitada para o mesmo domínio, sem precisar de tela própria.
 */
export function middleware(req: NextRequest) {
  if (!isBasicAuthProtectedPath(req.nextUrl.pathname)) return NextResponse.next();

  const user = process.env.SOUZA_RAMOS_BASIC_USER;
  const pass = process.env.SOUZA_RAMOS_BASIC_PASS;
  // Sem credencial configurada no ambiente, não bloqueia (evita lockout).
  if (!user || !pass) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
    const sep = decoded.indexOf(":");
    if (sep !== -1 && decoded.slice(0, sep) === user && decoded.slice(sep + 1) === pass) {
      return NextResponse.next();
    }
  }

  // Evita que prefetch em segundo plano do Next.js dispare o prompt
  // nativo de login do navegador quando o link entra na viewport.
  const isPrefetch =
    req.headers.get("purpose") === "prefetch" ||
    req.headers.get("sec-purpose") === "prefetch" ||
    req.headers.get("x-middleware-prefetch") === "1" ||
    req.headers.get("next-router-prefetch") === "1";

  if (isPrefetch) {
    return new NextResponse("Autenticação necessária.", { status: 401 });
  }

  return new NextResponse("Autenticação necessária.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Souza Ramos"' },
  });
}

export const config = {
  matcher: ["/pos-vendas-souza-ramos/:path*", "/playbook-souza-ramos/:path*"],
};
