"use client";

import { useState } from "react";
import Link from "next/link";

function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const input =
  "w-full rounded-lg border border-line bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-gold";

export function DownloadButton({
  slug,
  title,
  primary = false,
  label = "Baixar",
}: {
  slug: string;
  title: string;
  primary?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function startDownload() {
    // Abre o arquivo (rota /baixar conta o download e redireciona).
    window.location.href = `/baixar/${slug}`;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const payload = {
      nome: String(fd.get("nome") ?? ""),
      email: String(fd.get("email") ?? ""),
      whatsapp: String(fd.get("whatsapp") ?? ""),
      consentimento: fd.get("consentimento") === "on",
      origem: `Download: ${title}`,
      // A rota resolve a categoria do material por este slug (fonte
      // confiável, não confia em categoria vinda do cliente) — é o que liga
      // o lead a um tema pra jornada de nutrição.
      materialSlug: slug,
      website: String(fd.get("website") ?? ""),
    };
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setOpen(false);
        startDownload();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setErrors(data.errors ?? { geral: "Tente novamente." });
    } catch {
      setErrors({ geral: "Não foi possível agora. Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  const btnClass = primary
    ? "inline-flex min-h-11 items-center gap-2 rounded-lg bg-gold px-6 py-3 font-[var(--font-heading)] font-semibold text-navy transition-colors hover:bg-gold-light"
    : "inline-flex min-h-11 items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-light";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnClass}>
        <svg width={primary ? 18 : 16} height={primary ? 18 : 16} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {primary ? "Baixar material gratuito" : label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dl-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-navy p-7 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center text-white/60 hover:text-gold"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <p className="font-[var(--font-heading)] text-sm uppercase tracking-[0.2em] text-gold">
              Material gratuito
            </p>
            <h2 id="dl-title" className="mt-2 text-xl font-bold">
              {title}
            </h2>
            <p className="mt-2 text-sm text-white/80">
              Preencha para liberar o download — e receba mais conteúdos práticos.
            </p>

            <form onSubmit={onSubmit} noValidate className="mt-5 space-y-3">
              <div aria-hidden className="absolute left-[-9999px]" tabIndex={-1}>
                <input name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
              <div>
                <input name="nome" placeholder="Seu nome" aria-label="Nome" className={input} required />
                {errors.nome && <p className="mt-1 text-xs text-gold-light">{errors.nome}</p>}
              </div>
              <div>
                <input name="email" type="email" placeholder="Seu melhor e-mail" aria-label="E-mail" className={input} required />
                {errors.email && <p className="mt-1 text-xs text-gold-light">{errors.email}</p>}
              </div>
              <input
                name="whatsapp"
                type="tel"
                inputMode="tel"
                placeholder="WhatsApp (opcional)"
                aria-label="WhatsApp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
                className={input}
              />
              <label className="flex items-start gap-2 text-xs text-white/80">
                <input name="consentimento" type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]" required />
                <span>
                  Aceito receber conteúdos e promoções por e-mail, conforme a{" "}
                  <Link href="/privacidade" className="underline">
                    Política de Privacidade
                  </Link>
                  .
                </span>
              </label>
              {errors.geral && <p className="text-xs text-gold-light">{errors.geral}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gold px-6 py-3 font-[var(--font-heading)] font-semibold text-navy transition-colors hover:bg-gold-light disabled:opacity-60"
              >
                {loading ? "Liberando..." : "Baixar agora"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
