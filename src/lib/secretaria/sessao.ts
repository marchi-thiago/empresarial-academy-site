import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";

/**
 * Porteiro das rotas `/api/secretaria/*` (o painel do EA Assessor). Elas repassam ao EA Flow com a chave de serviço
 * (`EA_FLOW_ADMIN_API_KEY`), então só podem atender quem está logado no EA HUB. Antes ficavam abertas: qualquer visitante
 * (ou robô) da página `/assessor` disparava chamadas ao EA Flow e mantinha o Neon acordado (auditoria de 01/10/2026).
 *
 * Sem cookie de sessão a resposta é 401 na hora, sem abrir o Payload nem tocar no banco.
 */

const TEM_CREDENCIAL = /(^|;\s*)payload-token=/u;

export async function exigirSessao(request: Request): Promise<NextResponse | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const bearer = (request.headers.get("authorization") ?? "").startsWith("JWT ");
  if (!TEM_CREDENCIAL.test(cookie) && !bearer) {
    return NextResponse.json({ ok: false, error: "Não autorizado. Entre no EA HUB." }, { status: 401 });
  }
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ ok: false, error: "Não autorizado. Entre no EA HUB." }, { status: 401 });
  return null;
}
