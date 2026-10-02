"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pedeMotivo } from "@/lib/crm/telas/acoes";
import { apresentarSdr, SITUACAO_PADRAO, type AcaoSdr, type SituacaoSdr } from "@/lib/crm/sdr";
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

type RespostaSdr = { situacao: SituacaoSdr; erro?: string };

async function chamarSdr(leadId: number, acao?: AcaoSdr): Promise<RespostaSdr> {
  try {
    const r = acao
      ? await fetch("/api/crm/sdr", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId, acao }) })
      : await fetch(`/api/crm/sdr?leadId=${leadId}`, { cache: "no-store" });
    const j = (await r.json().catch(() => ({}))) as { situacao?: SituacaoSdr; erro?: string };
    if (!r.ok && !j.situacao) return { situacao: "indisponivel", erro: j.erro ?? "Não foi possível falar com o servidor." };
    return { situacao: j.situacao ?? "indisponivel", erro: j.erro };
  } catch {
    return { situacao: "indisponivel", erro: "Sem conexão. Tente de novo." };
  }
}

/** Selo do SDR na ficha e botão "Voltar ao SDR" / "Tirar do SDR". A chamada ao EA Flow sai do servidor do site. */
export function SeloSdr({ leadId }: { leadId: number }) {
  const router = useRouter();
  const [situacao, setSituacao] = useState<SituacaoSdr>(SITUACAO_PADRAO);
  const [carregado, setCarregado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void chamarSdr(leadId).then((r) => {
      if (!vivo) return;
      setSituacao(r.situacao);
      setCarregado(true);
    });
    return () => {
      vivo = false;
    };
  }, [leadId]);

  async function clicar(acao: AcaoSdr) {
    setOcupado(true);
    setErro(null);
    const r = await chamarSdr(leadId, acao);
    setOcupado(false);
    setSituacao(r.situacao);
    if (r.erro) setErro(r.erro);
    else router.refresh(); // traz a nota nova para a linha do tempo
  }

  const a = apresentarSdr(situacao);
  return (
    <div className="ea-crm-sdr" aria-live="polite">
      <span className={`ea-crm-sdr-selo ea-crm-sdr-selo--${a.tom}`}>{a.rotulo}</span>
      {a.botao && carregado ? (
        <button type="button" className="ea-crm-botao ea-crm-botao--suave" disabled={ocupado} onClick={() => void clicar(a.botao!.acao)}>
          {ocupado ? "Salvando..." : a.botao.texto}
        </button>
      ) : null}
      {a.dica ? <span className="ea-crm-sdr-dica">{a.dica}</span> : null}
      {erro ? <span className="ea-crm-erro" role="alert">{erro}</span> : null}
    </div>
  );
}
