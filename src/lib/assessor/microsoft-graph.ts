/**
 * Cliente Microsoft Graph (Outlook Mail + Calendar + Teams) para o EA Assessor.
 *
 * Autenticação: OAuth 2.0 com refresh token de longa duração (delegated
 * permissions: Mail.Send, Calendars.ReadWrite, OnlineMeetings.ReadWrite),
 * gerado uma vez pelo Thiago via consentimento no navegador. Se as
 * credenciais não estiverem configuradas, cada função retorna um erro claro
 * em vez de quebrar o motor.
 *
 * Variáveis de ambiente necessárias:
 * - MICROSOFT_CLIENT_ID
 * - MICROSOFT_CLIENT_SECRET
 * - MICROSOFT_TENANT_ID (ou "common" para conta pessoal/multi-tenant)
 * - MICROSOFT_REFRESH_TOKEN
 */

const BASE_SCOPES = "offline_access Mail.Send Calendars.ReadWrite OnlineMeetings.ReadWrite";

/** Cache por conjunto de escopos: o token com escopo extra (ex.: Mail.Read.Shared) não substitui o padrão. */
const cachedAccessTokens = new Map<string, { token: string; expiresAt: number }>();

export function isMicrosoftGraphConfigured(): boolean {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID &&
      process.env.MICROSOFT_CLIENT_SECRET &&
      process.env.MICROSOFT_REFRESH_TOKEN
  );
}

/**
 * `extraScopes` só deve ser usado sob flag, depois que o refresh token foi consentido com esses escopos
 * (pedir escopo de fora derruba a renovação, ver docs/outbound/PENDENCIAS-THIAGO.md item 3).
 */
export async function getAccessToken(extraScopes: string[] = []): Promise<string> {
  if (!isMicrosoftGraphConfigured()) {
    throw new Error(
      "Microsoft 365 não conectado. Faltam MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET ou MICROSOFT_REFRESH_TOKEN."
    );
  }

  const scope = [BASE_SCOPES, ...extraScopes].join(" ");
  const cached = cachedAccessTokens.get(scope);
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.token;
  }

  const tenant = process.env.MICROSOFT_TENANT_ID || "common";
  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: process.env.MICROSOFT_REFRESH_TOKEN!,
      grant_type: "refresh_token",
      scope,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao renovar token da Microsoft: ${res.status} ${errText}`);
  }

  const data = await res.json();
  cachedAccessTokens.set(scope, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  });
  return data.access_token;
}

export interface CreateTeamsEventParams {
  title: string;
  description?: string;
  startISO: string;
  endISO: string;
  attendeeEmails?: string[];
  createTeamsMeeting?: boolean;
  timeZone?: string;
}

export interface TeamsEventResult {
  id: string;
  webLink: string;
  teamsJoinUrl?: string;
}

/** Cria um evento no calendário Outlook do Thiago, opcionalmente com reunião Teams. */
export async function createOutlookEvent(params: CreateTeamsEventParams): Promise<TeamsEventResult> {
  const accessToken = await getAccessToken();

  const body = {
    subject: params.title,
    body: { contentType: "Text", content: params.description || "" },
    start: { dateTime: params.startISO, timeZone: params.timeZone || "America/Sao_Paulo" },
    end: { dateTime: params.endISO, timeZone: params.timeZone || "America/Sao_Paulo" },
    attendees: (params.attendeeEmails || []).map((email) => ({
      emailAddress: { address: email },
      type: "required",
    })),
    isOnlineMeeting: Boolean(params.createTeamsMeeting),
    onlineMeetingProvider: params.createTeamsMeeting ? "teamsForBusiness" : undefined,
  };

  const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Microsoft Graph (evento): ${res.status} ${errText}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    webLink: data.webLink,
    teamsJoinUrl: data.onlineMeeting?.joinUrl,
  };
}

export interface ListOutlookEventsParams {
  startISO: string;
  endISO: string;
}

export interface OutlookEventSummary {
  id: string;
  title: string;
  startISO?: string;
  endISO?: string;
  location?: string;
  /** E-mails dos participantes (minúsculos). */
  attendeeEmails?: string[];
}

/** Lista eventos do calendário Outlook num intervalo, para consultas de agenda. */
export async function listOutlookEvents(
  params: ListOutlookEventsParams
): Promise<OutlookEventSummary[]> {
  const accessToken = await getAccessToken();

  const url = new URL("https://graph.microsoft.com/v1.0/me/calendarview");
  url.searchParams.set("startDateTime", params.startISO);
  url.searchParams.set("endDateTime", params.endISO);
  url.searchParams.set("$orderby", "start/dateTime");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="America/Sao_Paulo"',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Microsoft Graph (agenda): ${res.status} ${errText}`);
  }

  const data = await res.json();
  return (data.value || []).map((item: Record<string, unknown>) => {
    const start = item.start as Record<string, string> | undefined;
    const end = item.end as Record<string, string> | undefined;
    return {
      id: item.id as string,
      title: (item.subject as string) || "(sem título)",
      startISO: start?.dateTime,
      endISO: end?.dateTime,
      location: (item.location as Record<string, string> | undefined)?.displayName,
      attendeeEmails: ((item.attendees as { emailAddress?: { address?: string } }[] | undefined) || [])
        .map((a) => a.emailAddress?.address?.toLowerCase())
        .filter((x): x is string => Boolean(x)),
    };
  });
}

export interface SendOutlookMailParams {
  to: string;
  subject: string;
  /** Corpo em texto puro. Compatível com quem já chamava; ignorado se `html` vier. */
  bodyText?: string;
  /** Corpo em HTML (e-mail outbound). O Exchange Online gera a parte texto (domínio remoto padrão). */
  html?: string;
  /** Texto equivalente ao html, usado só se `html` não vier. */
  texto?: string;
  /** Remetente (ex.: comercial@empresarialacademy.com). Exige "Enviar como" no Exchange para o usuário do token. */
  from?: string;
  fromName?: string;
  replyTo?: string;
}

/** Monta o corpo JSON do `sendMail` do Graph. Separado para testar sem rede. */
export function montarMensagemOutlook(params: SendOutlookMailParams) {
  const conteudo = params.html ?? params.texto ?? params.bodyText ?? "";
  const message: Record<string, unknown> = {
    subject: params.subject,
    body: { contentType: params.html ? "HTML" : "Text", content: conteudo },
    toRecipients: [{ emailAddress: { address: params.to } }],
  };
  if (params.from) {
    message.from = { emailAddress: { address: params.from, ...(params.fromName ? { name: params.fromName } : {}) } };
  }
  if (params.replyTo) message.replyTo = [{ emailAddress: { address: params.replyTo } }];
  return { message };
}

/** Envia um e-mail via Outlook (Microsoft Graph) em nome do Thiago (ou de `from`, se permitido). */
export async function sendOutlookMail(params: SendOutlookMailParams): Promise<{ ok: true }> {
  const accessToken = await getAccessToken();

  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(montarMensagemOutlook(params)),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Microsoft Graph (e-mail): ${res.status} ${errText}`);
  }

  return { ok: true };
}
