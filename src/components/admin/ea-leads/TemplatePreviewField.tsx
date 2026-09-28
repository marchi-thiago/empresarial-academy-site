"use client";
import React, { useEffect, useState } from "react";
import { useFormFields } from "@payloadcms/ui";

type Email = { subject: string; html: string };
const CAMPOS = [
  "chave",
  "tema",
  "assuntoPrimeiro",
  "assuntoSegundo",
  "assuntoTerceiro",
  "corpoPrimeiro",
  "corpoSegundo",
  "corpoTerceiro",
  "sinais",
  "acoes",
  "metodo",
] as const;
const ROTULOS = ["1º e-mail", "2º e-mail", "3º e-mail"];

/** Prévia dos 3 e-mails com o que está no formulário (antes de salvar). */
export function TemplatePreviewField() {
  const valores = useFormFields(([fields]) =>
    Object.fromEntries(CAMPOS.map((c) => [c, (fields[c]?.value as string | undefined) ?? ""])),
  );
  const chave = JSON.stringify(valores);
  const [emails, setEmails] = useState<Email[]>([]);
  const [aba, setAba] = useState(0);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/ea-leads/previa-modelo", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: chave,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        setEmails(json.emails);
        setErro("");
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
    }, 600);
    return () => clearTimeout(t);
  }, [chave]);

  return (
    <div style={{ margin: "1.5rem 0" }}>
      <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.05rem", marginBottom: "0.2rem" }}>
        Como o e-mail chega
      </div>
      <div style={{ fontSize: "0.82rem", color: "var(--theme-elevation-500)", marginBottom: "0.6rem" }}>
        Exemplo com uma lead fictícia, Maria Souza. Atualiza enquanto você edita, antes de salvar.
      </div>
      {erro ? <p style={{ color: "#B23B3B" }}>{erro}</p> : null}
      <div role="tablist" className="ea-leads-tabs" style={{ marginBottom: "0.6rem" }}>
        {ROTULOS.map((r, i) => (
          <button
            key={r}
            type="button"
            role="tab"
            className="ea-leads-tab"
            aria-selected={aba === i}
            onClick={() => setAba(i)}
            style={{ cursor: "pointer" }}
          >
            {r}
          </button>
        ))}
      </div>
      {emails[aba] ? (
        <>
          <div style={{ fontSize: "0.85rem", marginBottom: "0.4rem" }}>
            <strong>Assunto:</strong> {emails[aba].subject}
          </div>
          <iframe
            title={`Prévia ${ROTULOS[aba]}`}
            srcDoc={emails[aba].html}
            sandbox=""
            style={{ width: "100%", height: 720, border: "1px solid var(--theme-elevation-150)", borderRadius: 8, background: "#fff" }}
          />
        </>
      ) : null}
    </div>
  );
}
