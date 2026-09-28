import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";
import {
  renderAreaNurtureEmail,
  renderCategoryNurtureEmail,
  renderNurtureEmail,
  type NurtureTemplate,
} from "@/lib/nurture-emails";

/**
 * Prévia real (mesma função de envio) dos 3 e-mails de um modelo do EA Leads,
 * com os campos ainda não salvos do formulário. Só usuário do admin.
 */
export async function POST(req: Request) {
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: req.headers });
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  let modelo: NurtureTemplate;
  try {
    modelo = (await req.json()) as NurtureTemplate;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const chave = String(modelo?.chave ?? "");
  const modelos = new Map([[chave, modelo]]);
  const exemplo = { leadId: 0, name: "Maria Souza", email: "maria@exemplo.com.br" };

  const [tipo, alvo] = [chave.slice(0, chave.indexOf(":")), chave.slice(chave.indexOf(":") + 1)];
  if (!alvo || !["tema", "pilar", "area"].includes(tipo)) {
    return NextResponse.json({ error: "Chave precisa ser tema:<slug>, pilar:<nome> ou area:<segmento>." }, { status: 422 });
  }

  const vazio = { subject: "(etapa sem assunto ou texto: não será enviada)", html: "" };
  const emails = ([1, 2, 3] as const).map((step) =>
    tipo === "tema"
      ? renderCategoryNurtureEmail(step, { ...exemplo, category: alvo, categoryLabel: alvo }, modelos)
      : tipo === "area"
        ? (renderAreaNurtureEmail(step, { ...exemplo, area: alvo }, modelos) ?? vazio)
        : // Diagnóstico fictício em que este pilar é o mais fraco.
          renderNurtureEmail(step, { ...exemplo, details: { [alvo]: "20%", "Maturidade Geral": "55%" } }, modelos),
  );
  return NextResponse.json({ emails: emails.map(({ subject, html }) => ({ subject, html })) });
}
