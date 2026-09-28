"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useDocumentInfo } from "@payloadcms/ui";

type Envio = { id: number; type: string; subject: string; status: string; createdAt: string };

const TIPO: Record<string, string> = {
  "diagnostic-result": "Resultado do diagnóstico",
  "nurture-1": "Nutrição E1",
  "nurture-2": "Nutrição E2",
  "nurture-3": "Nutrição E3",
  campaign: "Campanha",
  "content-alert": "Alerta de conteúdo",
};

/** E-mails que este lead recebeu (coleção email-logs), com link pra cada envio. */
export function LeadEmailHistoryField() {
  const { id } = useDocumentInfo();
  const [envios, setEnvios] = useState<Envio[] | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/email-logs?where[lead][equals]=${encodeURIComponent(String(id))}&sort=-createdAt&limit=50&depth=0`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j) => setEnvios(j.docs ?? []))
      .catch(() => setEnvios([]));
  }, [id]);

  if (!id) return null;
  return (
    <div style={{ margin: "1rem 0 1.5rem" }}>
      <div style={{ fontWeight: 700, marginBottom: "0.4rem" }}>E-mails recebidos</div>
      {envios === null ? (
        <p style={{ fontSize: "0.85rem" }}>Carregando…</p>
      ) : envios.length === 0 ? (
        <p style={{ fontSize: "0.85rem", color: "var(--theme-elevation-500)" }}>Nenhum e-mail enviado a este lead.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
          {envios.map((e) => (
            <li key={e.id} style={{ marginBottom: "0.3rem" }}>
              {new Date(e.createdAt).toLocaleDateString("pt-BR")} · {TIPO[e.type] ?? e.type} ·{" "}
              <Link href={`/eahub/collections/email-logs/${e.id}`}>{e.subject}</Link>
              {e.status === "failed" ? <strong style={{ color: "#B23B3B" }}> (falhou)</strong> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
