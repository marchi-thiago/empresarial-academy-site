"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motivosPara } from "@/lib/crm/telas/acoes";
import type { Cartao } from "@/lib/crm/telas/cartao";

/** Peças com estado do CRM (chamada à rota de ações, diálogo, copiar). */

export type RespostaAcao = { ok: true; cartao: Cartao | null } | { ok: false; erro: string };

export async function enviarAcao(corpo: Record<string, unknown>): Promise<RespostaAcao> {
  try {
    const r = await fetch("/api/crm/acao", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const j = (await r.json().catch(() => ({}))) as { cartao?: Cartao | null; erro?: string };
    if (!r.ok) return { ok: false, erro: j.erro ?? "Não foi possível salvar." };
    return { ok: true, cartao: j.cartao ?? null };
  } catch {
    return { ok: false, erro: "Sem conexão. Tente de novo." };
  }
}

export type RespostaAcaoLinkedin = { ok: true; leadId: number; statusLinkedin: string } | { ok: false; erro: string };

export async function enviarAcaoLinkedin(leadId: number, acao: "enviado" | "aceito"): Promise<RespostaAcaoLinkedin> {
  try {
    const r = await fetch("/api/crm/linkedin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadId, acao }),
    });
    const j = (await r.json().catch(() => ({}))) as { erro?: string; leadId?: number; statusLinkedin?: string };
    if (!r.ok) return { ok: false, erro: j.erro ?? "Não foi possível salvar." };
    return { ok: true, leadId: j.leadId ?? leadId, statusLinkedin: j.statusLinkedin ?? (acao === "enviado" ? "convite_enviado" : "aceito") };
  } catch {
    return { ok: false, erro: "Sem conexão. Tente de novo." };
  }
}

/** Janela de confirmação (sem <dialog>: funciona igual no Safari do iPhone). */
export function Dialogo({
  titulo,
  children,
  confirmar,
  onConfirmar,
  onCancelar,
  ocupado = false,
  desabilitarConfirmar = false,
}: {
  titulo: string;
  children: ReactNode;
  confirmar: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  ocupado?: boolean;
  desabilitarConfirmar?: boolean;
}) {
  useEffect(() => {
    const aoTecla = (e: KeyboardEvent) => e.key === "Escape" && onCancelar();
    window.addEventListener("keydown", aoTecla);
    return () => window.removeEventListener("keydown", aoTecla);
  }, [onCancelar]);

  return (
    <div className="ea-crm-fundo" role="presentation" onClick={onCancelar}>
      <div className="ea-crm-dialogo" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <h3>{titulo}</h3>
        <div className="ea-crm-dialogo-corpo">{children}</div>
        <div className="ea-crm-dialogo-acoes">
          <button type="button" className="ea-crm-botao ea-crm-botao--suave" onClick={onCancelar} disabled={ocupado}>
            Cancelar
          </button>
          <button type="button" className="ea-crm-botao ea-crm-botao--principal" onClick={onConfirmar} disabled={ocupado || desabilitarConfirmar}>
            {ocupado ? "Salvando..." : confirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Motivo (lista curta + texto livre) para Ganho, Nutrição contínua e "Sem interesse". */
export function DialogoMotivo({
  titulo,
  destino,
  confirmar = "Confirmar",
  ocupado,
  erro,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  destino: "ganho" | "nutricao_continua";
  confirmar?: string;
  ocupado?: boolean;
  erro?: string | null;
  onConfirmar: (motivo: string, detalhe: string) => void;
  onCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  return (
    <Dialogo titulo={titulo} confirmar={confirmar} ocupado={ocupado} desabilitarConfirmar={!motivo} onCancelar={onCancelar} onConfirmar={() => onConfirmar(motivo, detalhe)}>
      <label className="ea-crm-campo">
        <span>Motivo</span>
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus>
          <option value="">Escolha um motivo</option>
          {motivosPara(destino).map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="ea-crm-campo">
        <span>Detalhe (opcional)</span>
        <textarea rows={3} maxLength={300} value={detalhe} onChange={(e) => setDetalhe(e.target.value)} />
      </label>
      {erro ? <p className="ea-crm-erro" role="alert">{erro}</p> : null}
    </Dialogo>
  );
}

/** Copia o texto e mostra "Copiado" por 2 s. */
export function BotaoCopiar({ texto, rotulo = "Copiar" }: { texto: string; rotulo?: string }) {
  const [ok, setOk] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Safari antigo ou sem permissão: cai no campo temporário.
      const t = document.createElement("textarea");
      t.value = texto;
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      document.body.removeChild(t);
    }
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  }
  return (
    <button type="button" className="ea-crm-botao ea-crm-botao--suave" onClick={copiar}>
      {ok ? "Copiado" : rotulo}
    </button>
  );
}
