"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pedeMotivo } from "@/lib/crm/telas/acoes";
import { ETAPAS, ETAPA_ROTULO, type Etapa } from "@/lib/crm/tipos";
import { deInputLocal, paraInputLocal } from "@/lib/crm/telas/tempo";
import { Dialogo, DialogoMotivo, enviarAcao } from "./cliente";

/** Mover a etapa pela ficha: mesmas regras do Kanban (motivo depois de reunião, confirmação de saída). */
export function MoverEtapa({ leadId, nome, etapa }: { leadId: number; nome: string; etapa: Etapa }) {
  const router = useRouter();
  const [pendente, setPendente] = useState<{ para: Etapa; tipo: "motivo" | "saida" } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gravar(para: Etapa, motivo?: string, detalhe?: string) {
    setOcupado(true);
    setErro(null);
    const r = await enviarAcao({ acao: "mover", leadId, para, motivo, detalhe, origemAcao: "ficha" });
    setOcupado(false);
    if (!r.ok) return setErro(r.erro);
    setPendente(null);
    router.refresh();
  }

  function escolher(para: Etapa) {
    if (para === etapa) return;
    if (pedeMotivo(etapa, para)) return setPendente({ para, tipo: "motivo" });
    if (para === "saiu_da_lista") return setPendente({ para, tipo: "saida" });
    void gravar(para);
  }

  return (
    <div className="ea-crm-mover-ficha">
      <label className="ea-crm-campo">
        <span>Etapa da jornada</span>
        <select value={etapa} disabled={ocupado} onChange={(e) => escolher(e.target.value as Etapa)}>
          {ETAPAS.map((e) => (
            <option key={e} value={e}>
              {ETAPA_ROTULO[e]}
            </option>
          ))}
        </select>
      </label>
      {erro && !pendente ? <p className="ea-crm-erro" role="alert">{erro}</p> : null}
      {pendente?.tipo === "motivo" ? (
        <DialogoMotivo
          titulo={`${nome}: mover para ${ETAPA_ROTULO[pendente.para]}`}
          destino={pendente.para === "ganho" ? "ganho" : "nutricao_continua"}
          ocupado={ocupado}
          erro={erro}
          onCancelar={() => setPendente(null)}
          onConfirmar={(m, d) => void gravar(pendente.para, m, d)}
        />
      ) : null}
      {pendente?.tipo === "saida" ? (
        <Dialogo titulo="Tirar da lista?" confirmar="Sim, tirar da lista" ocupado={ocupado} onCancelar={() => setPendente(null)} onConfirmar={() => void gravar(pendente.para)}>
          <p>{nome} deixa de receber qualquer contato (DM, e-mail, WhatsApp e nutrição). Use só quando a pessoa pedir para sair.</p>
        </Dialogo>
      ) : null}
    </div>
  );
}

/** Próximo passo editável: texto e, se quiser, dia e horário. Texto vazio limpa os dois. */
export function ProximoPasso({
  leadId,
  textoInicial,
  emInicial,
  aoSalvar,
  compacto = false,
}: {
  leadId: number;
  textoInicial: string | null;
  emInicial: string | null;
  aoSalvar?: () => void;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(textoInicial ?? "");
  const [em, setEm] = useState(emInicial ? paraInputLocal(new Date(emInicial)) : "");
  const [estado, setEstado] = useState<"parado" | "salvando" | "salvo">("parado");
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("salvando");
    setErro(null);
    const data = em ? deInputLocal(em) : null;
    const r = await enviarAcao({ acao: "proximo_passo", leadId, texto, em: data ? data.toISOString() : null });
    if (!r.ok) {
      setEstado("parado");
      return setErro(r.erro);
    }
    setEstado("salvo");
    aoSalvar?.();
    router.refresh();
    setTimeout(() => setEstado("parado"), 2000);
  }

  return (
    <form className={`ea-crm-passo-form${compacto ? " ea-crm-passo-form--compacto" : ""}`} onSubmit={salvar}>
      <label className="ea-crm-campo">
        <span>Próximo passo</span>
        <input type="text" value={texto} maxLength={200} placeholder="Ex.: ligar na sexta e falar do diagnóstico" onChange={(e) => setTexto(e.target.value)} />
      </label>
      <label className="ea-crm-campo">
        <span>Quando</span>
        <input type="datetime-local" value={em} onChange={(e) => setEm(e.target.value)} />
      </label>
      <button type="submit" className="ea-crm-botao ea-crm-botao--principal" disabled={estado === "salvando"}>
        {estado === "salvando" ? "Salvando..." : estado === "salvo" ? "Salvo" : "Salvar"}
      </button>
      {erro ? <p className="ea-crm-erro" role="alert">{erro}</p> : null}
    </form>
  );
}
