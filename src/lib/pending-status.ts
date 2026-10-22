import { getPayload } from "payload";
import config from "@payload-config";

const EA_POST_URL = "https://post.empresarialacademy.com";

export type TokenAlert = {
  channel: string;
  expired: boolean;
  daysRemaining: number | null;
};

export type CronAlert = {
  cron: string;
  status: string;
  createdAt: string;
  summary: string | null;
};

export type EaPostPendingStatus = {
  pendingApprovalCount: number;
  tokenAlerts: TokenAlert[];
  cronAlerts: CronAlert[];
  generatedAt: string;
};

export type ContractPending = {
  id: string | number;
  title: string;
  status: string;
  createdAt: string;
};

export type ExpiringCredential = {
  name: string;
  provider: string;
  expiresAt: string;
  daysRemaining: number;
};

export type PendingStatus = {
  eaPost: EaPostPendingStatus | null;
  eaPostError: string | null;
  contractsAwaitingSignature: ContractPending[];
  expiringCredentials: ExpiringCredential[];
};

/**
 * Agrega as pendências que já são rastreadas hoje em cada sistema — nenhuma
 * métrica nova. EA Post via API (repo separado, banco próprio); contratos e
 * credenciais direto do banco do site. Nunca lança: um sistema fora do ar
 * não pode derrubar o dashboard inteiro, só aparece como alerta próprio.
 */
export async function getPendingStatus(): Promise<PendingStatus> {
  const [eaPostResult, contractsAwaitingSignature, expiringCredentials] = await Promise.all([
    fetchEaPostPendingStatus(),
    fetchContractsAwaitingSignature(),
    fetchExpiringCredentials(),
  ]);

  return {
    eaPost: eaPostResult.data,
    eaPostError: eaPostResult.error,
    contractsAwaitingSignature,
    expiringCredentials,
  };
}

async function fetchEaPostPendingStatus(): Promise<{ data: EaPostPendingStatus | null; error: string | null }> {
  const key = process.env.CONTENT_ENGINE_API_KEY;
  if (!key) {
    return { data: null, error: "CONTENT_ENGINE_API_KEY não configurada neste ambiente." };
  }
  try {
    const res = await fetch(`${EA_POST_URL}/api/content-engine/pending-status`, {
      headers: { authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return { data: null, error: `EA Post respondeu ${res.status}.` };
    }
    return { data: (await res.json()) as EaPostPendingStatus, error: null };
  } catch {
    return { data: null, error: "EA Post fora do ar ou inacessível." };
  }
}

async function fetchContractsAwaitingSignature(): Promise<ContractPending[]> {
  const payload = await getPayload({ config });
  const res = await payload.find({
    collection: "contracts",
    where: { status: { in: ["rascunho", "enviado"] } },
    sort: "createdAt",
    limit: 10,
    depth: 0,
  });
  return res.docs.map((doc) => {
    const d = doc as unknown as { id: string | number; title?: string | null; status: string; createdAt: string };
    return { id: d.id, title: d.title ?? "Sem título", status: d.status, createdAt: d.createdAt };
  });
}

async function fetchExpiringCredentials(): Promise<ExpiringCredential[]> {
  const payload = await getPayload({ config });
  const now = new Date();
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const res = await payload.find({
    collection: "api-inventory",
    where: { expiresAt: { less_than: in30days.toISOString() } },
    sort: "expiresAt",
    limit: 10,
    depth: 0,
  });
  return res.docs
    .map((doc) => {
      const d = doc as unknown as { name: string; provider: string; expiresAt?: string | null };
      if (!d.expiresAt) return null;
      const daysRemaining = Math.ceil((new Date(d.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      return { name: d.name, provider: d.provider, expiresAt: d.expiresAt, daysRemaining };
    })
    .filter((c): c is ExpiringCredential => c !== null);
}
