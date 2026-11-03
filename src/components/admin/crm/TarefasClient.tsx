"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PERIODOS } from "@/lib/crm/telas/periodo";
import {
  agruparTarefas,
  filtrarTarefas,
  ordenarTarefas,
  ROTULO_TIPO_TAREFA,
  SITUACOES_FILTRO,
  situacaoDe,
  TIPOS_TAREFA,
  type FiltroTarefas,
  type ItemTarefa,
} from "@/lib/crm/telas/tarefas";
import { dataHoraBr, deInputLocal, inicioDoDia, paraInputLocal } from "@/lib/crm/telas/tempo";
import { Dialogo, enviarAcao } from "./cliente";

type LeadOpcao = { id: number; nome: string; empresa: string | null };

/** Quantas tarefas a lista mostra por vez (os toques da cadência passam de mil). */
const POR_VEZ = 100;

const ROTULO_ORIGEM: Record<ItemTarefa["origem"], string> = { manual: "Tarefa", proximo_passo: "Próximo passo", cadencia: "Automático" };

/** Sugestão de horário para tarefa nova ou reagendada: amanhã às 10h de Brasília. */
const amanha10h = (agora: Date) => paraInputLocal(new Date(inicioDoDia(agora).getTime() + 34 * 3_600_000));

/**
 * Concluir e reagendar, com o diálogo de data. Painel, ficha e Fila usam o mesmo.
 * `ajustes` guarda o efeito na tela até a lista do servidor voltar (null = some da lista).
 */
function useAcoesTarefa(agora: Date) {
  const router = useRouter();
  const [ajustes, setAjustes] = useState<Record<string, Partial<ItemTarefa> | null>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [reagendando, setReagendando] = useState<{ item: ItemTarefa; quando: string } | null>(null);

  async function acao(item: ItemTarefa, corpo: Record<string, unknown>, ajuste: Partial<ItemTarefa> | null) {
    setOcupado(item.chave);
    setErro(null);
    const r = await enviarAcao({ leadId: item.leadId, ...(item.tarefaId ? { tarefaId: item.tarefaId } : {}), ...corpo });
    setOcupado(null);
    if (!r.ok) {
      setErro(r.erro);
      return false;
    }
    setAjustes((a) => ({ ...a, [item.chave]: ajuste }));
    router.refresh();
    return true;
  }

  const aplicar = (itens: ItemTarefa[]) => itens.flatMap((t) => (ajustes[t.chave] === null ? [] : [{ ...t, ...ajustes[t.chave] }]));

  const linha = (t: ItemTarefa, comLead = true) => {
    const s = situacaoDe(t, agora);
    return (
      <li key={t.chave} className="ea-crm-item ea-crm-tarefa" data-situacao={s}>
        <div className="ea-crm-item-cabeca">
          <div>
            <span className="ea-crm-tarefa-tipo">{ROTULO_TIPO_TAREFA[t.tipo]}</span> <strong>{t.titulo}</strong>
            {comLead ? (
              <div className="ea-crm-card-empresa">
                <Link className="ea-crm-card-nome" href={`/eahub/crm/lead/${t.leadId}`}>
                  {t.lead}
                </Link>
                {t.empresa ? ` · ${t.empresa}` : ""}
              </div>
            ) : null}
          </div>
          <span className="ea-crm-tarefa-selo">
            {s === "concluida" ? `Concluída ${dataHoraBr(new Date(t.concluidaEm!))}` : t.venceEm ? dataHoraBr(new Date(t.venceEm)) : "Sem data"}
            {s === "atrasada" ? " · Atrasada" : ""} · {ROTULO_ORIGEM[t.origem]}
          </span>
        </div>
        {t.origem !== "cadencia" ? (
          <div className="ea-crm-resultados">
            {s !== "concluida" ? (
              <button
                type="button"
                className="ea-crm-botao"
                disabled={ocupado === t.chave}
                onClick={() => void acao(t, { acao: "tarefa_concluir" }, t.origem === "proximo_passo" ? null : { concluidaEm: new Date().toISOString() })}
              >
                Concluir
              </button>
            ) : null}
            <button
              type="button"
              className="ea-crm-botao ea-crm-botao--suave"
              disabled={ocupado === t.chave}
              onClick={() => setReagendando({ item: t, quando: t.venceEm && s !== "concluida" ? paraInputLocal(new Date(t.venceEm)) : amanha10h(agora) })}
            >
              {s === "concluida" ? "Reabrir" : "Reagendar"}
            </button>
          </div>
        ) : null}
      </li>
    );
  };

  const extras: ReactNode = (
    <>
      {erro ? (
        <p className="ea-crm-erro" role="alert">
          {erro}
        </p>
      ) : null}
      {reagendando ? (
        <Dialogo
          titulo={`${reagendando.item.concluidaEm ? "Reabrir" : "Reagendar"}: ${reagendando.item.titulo}`}
          confirmar="Salvar"
          ocupado={ocupado === reagendando.item.chave}
          desabilitarConfirmar={!deInputLocal(reagendando.quando)}
          onCancelar={() => setReagendando(null)}
          onConfirmar={async () => {
            const d = deInputLocal(reagendando.quando);
            if (!d) return;
            const ok = await acao(reagendando.item, { acao: "tarefa_reagendar", venceEm: d.toISOString() }, { venceEm: d.toISOString(), concluidaEm: null });
            if (ok) setReagendando(null);
          }}
        >
          <label className="ea-crm-campo">
            <span>Novo dia e horário (Brasília)</span>
            <input type="datetime-local" value={reagendando.quando} onChange={(e) => setReagendando({ ...reagendando, quando: e.target.value })} autoFocus />
          </label>
        </Dialogo>
      ) : null}
    </>
  );

  return { aplicar, linha, extras, ocupado, setOcupado, setErro, router };
}

export function TarefasClient({ itens, leads, agoraIso }: { itens: ItemTarefa[]; leads: LeadOpcao[]; agoraIso: string }) {
  const agora = useMemo(() => new Date(agoraIso), [agoraIso]);
  const { aplicar, linha, extras, ocupado, setOcupado, setErro, router } = useAcoesTarefa(agora);
  const [filtro, setFiltro] = useState<FiltroTarefas>({ situacao: "pendentes", automaticos: true, tipos: [] });
  const [limite, setLimite] = useState(POR_VEZ);
  const [criando, setCriando] = useState<{ lead: string; tipo: string; titulo: string; quando: string } | null>(null);

  const atuais = aplicar(itens);
  const filtradas = filtrarTarefas(atuais, filtro, agora);
  const grupos = agruparTarefas(filtradas.slice(0, limite), agora);
  const atrasadas = atuais.filter((t) => situacaoDe(t, agora) === "atrasada").length;

  const mudar = (campo: keyof FiltroTarefas, valor: FiltroTarefas[keyof FiltroTarefas]) => {
    setFiltro((f) => ({ ...f, [campo]: valor }));
    setLimite(POR_VEZ);
  };
  const alternarTipo = (tipo: string) => mudar("tipos", filtro.tipos?.includes(tipo) ? filtro.tipos.filter((t) => t !== tipo) : [...(filtro.tipos ?? []), tipo]);

  async function criar() {
    if (!criando) return;
    const lead = leads.find((l) => rotuloLead(l) === criando.lead);
    if (!lead) return setErro("Escolha o lead na lista.");
    const quando = criando.quando ? deInputLocal(criando.quando) : null;
    setOcupado("nova");
    setErro(null);
    const r = await enviarAcao({ acao: "tarefa_criar", leadId: lead.id, tipo: criando.tipo, titulo: criando.titulo, venceEm: quando?.toISOString() ?? null });
    setOcupado(null);
    if (!r.ok) return setErro(r.erro);
    setCriando(null);
    router.refresh();
  }

  return (
    <div className="ea-crm-tarefas">
      <div className="ea-crm-fila-topo">
        <p className="ea-crm-resumo" aria-live="polite">
          {filtradas.length} {filtradas.length === 1 ? "tarefa" : "tarefas"}
          {atrasadas ? ` · ${atrasadas} atrasadas no total` : ""}
        </p>
        <button type="button" className="ea-crm-botao" onClick={() => setCriando({ lead: "", tipo: "ligacao", titulo: "", quando: amanha10h(agora) })}>
          Criar tarefa
        </button>
      </div>

      <div className="ea-crm-fila-periodo">
        <label className="ea-crm-campo">
          <span>Buscar</span>
          <input type="search" value={filtro.busca ?? ""} placeholder="Lead, empresa ou tarefa" onChange={(e) => mudar("busca", e.target.value)} />
        </label>
        <label className="ea-crm-campo">
          <span>Situação</span>
          <select value={filtro.situacao} onChange={(e) => mudar("situacao", e.target.value)}>
            {SITUACOES_FILTRO.map((s) => (
              <option key={s.id} value={s.id}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="ea-crm-campo">
          <span>Período (vencimento)</span>
          <select value={filtro.periodo ?? ""} onChange={(e) => mudar("periodo", e.target.value)}>
            <option value="">Qualquer data</option>
            {PERIODOS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </label>
        {filtro.periodo === "personalizado" ? (
          <>
            <label className="ea-crm-campo">
              <span>De</span>
              <input type="date" value={filtro.de ?? ""} max={filtro.ate || undefined} onChange={(e) => mudar("de", e.target.value)} />
            </label>
            <label className="ea-crm-campo">
              <span>Até</span>
              <input type="date" value={filtro.ate ?? ""} min={filtro.de || undefined} onChange={(e) => mudar("ate", e.target.value)} />
            </label>
          </>
        ) : null}
        <details className="ea-crm-campo ea-crm-tipos">
          <summary>
            <span>Tipo</span>
            <b>{filtro.tipos?.length ? filtro.tipos.map((t) => ROTULO_TIPO_TAREFA[t as keyof typeof ROTULO_TIPO_TAREFA]).join(", ") : "Todos os tipos"}</b>
          </summary>
          <div className="ea-crm-tipos-lista">
            {TIPOS_TAREFA.map((t) => (
              <label key={t.id}>
                <input type="checkbox" checked={Boolean(filtro.tipos?.includes(t.id))} onChange={() => alternarTipo(t.id)} /> {t.rotulo}
              </label>
            ))}
          </div>
        </details>
        <label className="ea-crm-campo ea-crm-campo--marcar">
          <input type="checkbox" checked={filtro.automaticos !== false} onChange={(e) => mudar("automaticos", e.target.checked)} />
          <span>Mostrar toques automáticos da cadência</span>
        </label>
      </div>

      {extras}

      {filtradas.length === 0 ? <p className="ea-crm-vazio">Nenhuma tarefa com esses filtros.</p> : null}

      {grupos.map((g) => (
        <section key={g.rotulo} className="ea-crm-secao" aria-label={g.rotulo}>
          <h2>
            {g.rotulo} <span>{g.itens.length}</span>
          </h2>
          <ul className="ea-crm-itens">{g.itens.map((t) => linha(t))}</ul>
        </section>
      ))}

      {filtradas.length > limite ? (
        <button type="button" className="ea-crm-botao ea-crm-botao--suave" onClick={() => setLimite((l) => l + POR_VEZ)}>
          Mostrar mais ({filtradas.length - limite} restantes)
        </button>
      ) : null}

      {criando ? (
        <Dialogo
          titulo="Criar tarefa"
          confirmar="Criar"
          ocupado={ocupado === "nova"}
          desabilitarConfirmar={!criando.titulo.trim() || !criando.lead}
          onCancelar={() => setCriando(null)}
          onConfirmar={() => void criar()}
        >
          <label className="ea-crm-campo">
            <span>Lead</span>
            <input list="ea-crm-leads" value={criando.lead} placeholder="Digite o nome ou a empresa" onChange={(e) => setCriando({ ...criando, lead: e.target.value })} autoFocus />
            <datalist id="ea-crm-leads">
              {leads.map((l) => (
                <option key={l.id} value={rotuloLead(l)} />
              ))}
            </datalist>
          </label>
          <FormTarefa valor={criando} onChange={(v) => setCriando({ ...criando, ...v })} />
        </Dialogo>
      ) : null}
    </div>
  );
}

/**
 * Tarefas de um lead (ficha) ou do dia (Fila): lista com Concluir e Reagendar e, com `leadId`, o
 * formulário de tarefa nova. Mostra as pendentes e as últimas concluídas.
 */
export function BlocoTarefas({ itens, agoraIso, leadId, titulo }: { itens: ItemTarefa[]; agoraIso: string; leadId?: number; titulo: string }) {
  const agora = useMemo(() => new Date(agoraIso), [agoraIso]);
  const { aplicar, linha, extras, ocupado, setOcupado, setErro, router } = useAcoesTarefa(agora);
  const [nova, setNova] = useState({ tipo: "ligacao", titulo: "", quando: amanha10h(agora) });
  const atuais = ordenarTarefas(aplicar(itens));
  const pendentes = atuais.filter((t) => !t.concluidaEm);
  const concluidas = atuais.filter((t) => t.concluidaEm).slice(0, 5);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!leadId) return;
    const quando = nova.quando ? deInputLocal(nova.quando) : null;
    setOcupado("nova");
    setErro(null);
    const r = await enviarAcao({ acao: "tarefa_criar", leadId, tipo: nova.tipo, titulo: nova.titulo, venceEm: quando?.toISOString() ?? null });
    setOcupado(null);
    if (!r.ok) return setErro(r.erro);
    setNova({ tipo: "ligacao", titulo: "", quando: amanha10h(agora) });
    router.refresh();
  }

  return (
    <section className="ea-crm-secao" aria-label={titulo}>
      <h2>
        {titulo} <span>{pendentes.length}</span>
      </h2>
      {pendentes.length === 0 ? <p className="ea-crm-vazio">Nenhuma tarefa pendente.</p> : null}
      <ul className="ea-crm-itens">{pendentes.map((t) => linha(t, !leadId))}</ul>
      {concluidas.length ? (
        <details>
          <summary>Concluídas recentes ({concluidas.length})</summary>
          <ul className="ea-crm-itens">{concluidas.map((t) => linha(t, !leadId))}</ul>
        </details>
      ) : null}
      {extras}
      {leadId ? (
        <form className="ea-crm-fila-periodo" onSubmit={criar}>
          <FormTarefa valor={nova} onChange={(v) => setNova({ ...nova, ...v })} />
          <button type="submit" className="ea-crm-botao" disabled={ocupado === "nova" || !nova.titulo.trim()}>
            {ocupado === "nova" ? "Salvando..." : "Criar tarefa"}
          </button>
        </form>
      ) : null}
    </section>
  );
}

const rotuloLead = (l: LeadOpcao) => `${l.nome}${l.empresa ? ` (${l.empresa})` : ""} #${l.id}`;

/** Tipo, o que fazer e quando: usado no painel, na ficha e na Fila do dia. */
export function FormTarefa({
  valor,
  onChange,
}: {
  valor: { tipo: string; titulo: string; quando: string };
  onChange: (v: Partial<{ tipo: string; titulo: string; quando: string }>) => void;
}) {
  return (
    <>
      <label className="ea-crm-campo">
        <span>Tipo</span>
        <select value={valor.tipo} onChange={(e) => onChange({ tipo: e.target.value })}>
          {TIPOS_TAREFA.map((t) => (
            <option key={t.id} value={t.id}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="ea-crm-campo">
        <span>O que fazer</span>
        <input type="text" maxLength={200} value={valor.titulo} placeholder="Ex.: ligar e falar do diagnóstico" onChange={(e) => onChange({ titulo: e.target.value })} />
      </label>
      <label className="ea-crm-campo">
        <span>Quando (Brasília)</span>
        <input type="datetime-local" value={valor.quando} onChange={(e) => onChange({ quando: e.target.value })} />
      </label>
    </>
  );
}
