import { getAccessToken } from "@/lib/assessor/microsoft-graph";

/**
 * Leitura da caixa comercial@ (respostas e bounces dos e-mails outbound). Só roda com
 * OUTBOUND_LER_CAIXA ligada, e exige o consentimento `Mail.Read.Shared` (PENDENCIAS-THIAGO.md, item 3).
 * A classificação é pura e testada; a chamada ao Graph entra por parâmetro (`ler`) para testar com mock.
 */

export type MensagemCaixa = { id: string; assunto: string; de: string; recebidoEm: Date; texto: string };

export type EventoDaCaixa =
  | { tipo: "bounce"; email: string; mensagemId: string; temporario: boolean; recebidoEm: Date }
  | { tipo: "resposta"; email: string; mensagemId: string; texto: string; descadastro: boolean; recebidoEm: Date };

const RE_NDR_ASSUNTO = /undeliverable|delivery status notification|delivery has failed|mail delivery failed|returned mail|non-?delivery|n[aã]o foi entregue|falha na entrega|n[aã]o entregue/i;
const RE_NDR_REMETENTE = /mailer-daemon|postmaster/i;
const RE_AUTOMATICA = /resposta autom[aá]tica|automatic reply|out of office|fora do escrit[oó]rio|auto-?reply|autoresponder/i;
const RE_TEMPORARIO = /temporar|caixa de correio (est[aá] )?cheia|mailbox (is )?full|over quota|try again later|\b4\.\d\.\d\b/i;

const emails = (t: string): string[] => [...t.toLowerCase().matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g)].map((m) => m[0]);

/** Parte nova da resposta: corta a citação da mensagem original. */
export function textoNovo(texto: string): string {
  const corte = texto.search(/\n\s*(em .{5,80} escreveu:|on .{5,80} wrote:|de:\s|from:\s|-{3,}\s*(mensagem original|original message))/i);
  return (corte === -1 ? texto : texto.slice(0, corte)).trim();
}

export function pediuDescadastro(texto: string): boolean {
  const t = textoNovo(texto).slice(0, 400).toLowerCase();
  if (/descadastr|unsubscribe|n[aã]o quero (mais )?receber|pare de (me )?(enviar|mandar)|(tire|remova|exclua|retire)[^.\n]{0,40}(lista|cadastro|e-?mails?)/.test(t)) return true;
  return /^\s*(sair|remover|stop|cancelar|parar)\s*[.!]?\s*$/m.test(t.split("\n").slice(0, 2).join("\n"));
}

/**
 * Bounce (NDR) ou resposta de um destinatário que sabemos ter recebido o outbound.
 * `conhecidos`: endereços (minúsculos) a quem enviamos. Resposta automática e e-mail de estranho: null.
 */
export function classificarMensagem(m: MensagemCaixa, conhecidos: Set<string>): EventoDaCaixa | null {
  const ndr = RE_NDR_REMETENTE.test(m.de) || RE_NDR_ASSUNTO.test(m.assunto);
  if (ndr) {
    const final = /final-recipient:\s*rfc822;\s*([^\s]+)/i.exec(m.texto)?.[1]?.toLowerCase();
    const alvo = (final && conhecidos.has(final) ? final : null) ?? emails(`${m.assunto}\n${m.texto}`).find((e) => conhecidos.has(e));
    if (!alvo) return null;
    return { tipo: "bounce", email: alvo, mensagemId: m.id, temporario: RE_TEMPORARIO.test(m.texto), recebidoEm: m.recebidoEm };
  }
  if (RE_AUTOMATICA.test(m.assunto)) return null;
  const remetente = emails(m.de)[0];
  if (!remetente || !conhecidos.has(remetente)) return null;
  return { tipo: "resposta", email: remetente, mensagemId: m.id, texto: textoNovo(m.texto), descadastro: pediuDescadastro(m.texto), recebidoEm: m.recebidoEm };
}

/** Mensagens da caixa de entrada recebidas desde `desde`. Texto puro, até 100 (mais recentes primeiro). */
export async function lerCaixaDoGraph(caixa: string, desde: Date): Promise<MensagemCaixa[]> {
  const token = await getAccessToken(["Mail.Read.Shared"]);
  const url = new URL(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(caixa)}/mailFolders/inbox/messages`);
  url.searchParams.set("$filter", `receivedDateTime ge ${desde.toISOString()}`);
  url.searchParams.set("$orderby", "receivedDateTime desc");
  url.searchParams.set("$top", "100");
  url.searchParams.set("$select", "id,subject,from,receivedDateTime,body");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.body-content-type="text"' } });
  if (!res.ok) throw new Error(`Microsoft Graph (caixa): ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { value?: Record<string, unknown>[] };
  return (data.value ?? []).map((x) => ({
    id: String(x.id),
    assunto: String(x.subject ?? ""),
    de: String((x.from as { emailAddress?: { address?: string } } | undefined)?.emailAddress?.address ?? ""),
    recebidoEm: new Date(String(x.receivedDateTime)),
    texto: String((x.body as { content?: string } | undefined)?.content ?? ""),
  }));
}
