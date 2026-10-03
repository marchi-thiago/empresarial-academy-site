"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { abaInicial, agruparPorEtapa, filtrarCartoes, GRUPOS_ABAS, opcoesDeFiltro, totalDoGrupo, type Cartao, type Filtros } from "@/lib/crm/telas/cartao";
import { VAZIO_ETAPA } from "@/lib/crm/telas/explicacoes";
import { pedeMotivo } from "@/lib/crm/telas/acoes";
import { CANAIS_ENTREGA, ESTADOS_ENTREGA, ETAPAS, ETAPA_ROTULO, ROTULO_ESTADO, type Etapa } from "@/lib/crm/tipos";
import { dataHoraBr } from "@/lib/crm/telas/tempo";
import { DialogoMotivo, enviarAcao, Dialogo } from "./cliente";
import { CoberturaPesquisa, IconesEntrega, Info, SeloTemperatura } from "./compartilhado";

const POR_PAGINA = 20;

const FILTROS_VAZIOS: Filtros = { busca: "", etapa: "", canal: "", entrega: "", segmento: "", campanha: "", temperatura: "", origem: "", proximoPasso: "" };

const NOME_CANAL_ENTREGA: Record<string, string> = { email: "E-mail", whatsapp: "WhatsApp", dm: "DM", linkedin: "LinkedIn" };

type Pendente = { cartao: Cartao; para: Etapa; tipo: "motivo" | "saida" };

export function KanbanClient({ iniciais, filtrosIniciais }: { iniciais: Cartao[]; filtrosIniciais: Filtros }) {
  const [cartoes, setCartoes] = useState(iniciais);
  const [filtros, setFiltros] = useState<Filtros>({ ...FILTROS_VAZIOS, ...filtrosIniciais });
  const [ativa, setAtiva] = useState<string>(() => {
    const e = filtrosIniciais.etapa;
    const doFiltro = GRUPOS_ABAS.find((g) => (g.etapas as readonly string[]).includes(e ?? ""));
    return doFiltro?.id ?? abaInicial(agruparPorEtapa(filtrarCartoes(iniciais, { ...FILTROS_VAZIOS, ...filtrosIniciais }, new Date())));
  });
  const [mostrando, setMostrando] = useState<Partial<Record<Etapa, number>>>({});
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<Etapa | null>(null);

  const opcoes = useMemo(() => opcoesDeFiltro(cartoes), [cartoes]);
  const filtrados = useMemo(() => filtrarCartoes(cartoes, filtros, new Date()), [cartoes, filtros]);
  const colunas = useMemo(() => agruparPorEtapa(filtrados), [filtrados]);
  const filtrosAtivos = Object.values(filtros).filter(Boolean).length;

  const mudar = useCallback((campo: keyof Filtros, valor: string) => {
    setFiltros((f) => {
      const novo = { ...f, [campo]: valor };
      // Status de outro canal não combina com o canal escolhido.
      if (campo === "canal" && novo.entrega && valor && !novo.entrega.startsWith(`${valor}:`)) novo.entrega = "";
      try {
        const q = new URLSearchParams(Object.entries(novo).filter(([, v]) => v) as [string, string][]).toString();
        window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
      } catch {
        // sem histórico (preview): o filtro continua valendo na tela
      }
      return novo;
    });
    if (campo === "etapa" && valor) setAtiva(GRUPOS_ABAS.find((g) => (g.etapas as readonly string[]).includes(valor))?.id ?? valor);
  }, []);

  async function gravar(c: Cartao, para: Etapa, motivo?: string, detalhe?: string) {
    const anterior = c;
    setOcupado(true);
    setAviso(null);
    setCartoes((cs) => cs.map((x) => (x.id === c.id ? { ...x, etapa: para } : x))); // otimista
    const r = await enviarAcao({ acao: "mover", leadId: c.id, para, motivo, detalhe, origemAcao: "kanban" });
    setOcupado(false);
    if (r.ok) {
      const novo = r.cartao;
      if (novo) setCartoes((cs) => cs.map((x) => (x.id === c.id ? novo : x)));
      setPendente(null);
      return;
    }
    setCartoes((cs) => cs.map((x) => (x.id === c.id ? anterior : x))); // desfaz
    setAviso(r.erro);
  }

  function mover(c: Cartao, para: Etapa) {
    if (para === c.etapa) return;
    if (pedeMotivo(c.etapa, para)) return setPendente({ cartao: c, para, tipo: "motivo" });
    if (para === "saiu_da_lista") return setPendente({ cartao: c, para, tipo: "saida" });
    void gravar(c, para);
  }

  return (
    <div className="ea-crm-kanban">
      <div className="ea-crm-resumo-linha">
        <p className="ea-crm-resumo" aria-live="polite">
          {filtrados.length === cartoes.length ? `${cartoes.length} leads` : `${filtrados.length} de ${cartoes.length} leads`}
        </p>
        <Info texto="Cada lead está em uma etapa só. O número ao lado de cada aba é a soma das etapas dela, já com os filtros aplicados. A temperatura mostra quanto o lead interagiu nos últimos 7 dias; Sem sinais quer dizer que ele ainda não abriu, clicou nem assistiu a nada." />
      </div>

      <details className="ea-crm-filtros" open={filtrosAtivos > 0 ? true : undefined}>
        <summary>{filtrosAtivos ? `Filtros (${filtrosAtivos} ativos)` : "Filtrar leads"}</summary>
        <div className="ea-crm-filtros-grade">
          <label className="ea-crm-campo ea-crm-campo--busca">
            <span>Buscar</span>
            <input type="search" value={filtros.busca} placeholder="Nome, empresa, segmento" onChange={(e) => mudar("busca", e.target.value)} />
          </label>
          <Seletor rotulo="Etapa" valor={filtros.etapa} onChange={(v) => mudar("etapa", v)} opcoes={ETAPAS.map((e) => [e, ETAPA_ROTULO[e]])} />
          <Seletor rotulo="Canal com toque" valor={filtros.canal} onChange={(v) => mudar("canal", v)} opcoes={CANAIS_ENTREGA.map((c) => [c, NOME_CANAL_ENTREGA[c]])} />
          <label className="ea-crm-campo">
            <span>Status de entrega</span>
            <select value={filtros.entrega} onChange={(e) => mudar("entrega", e.target.value)}>
              <option value="">Todos</option>
              {CANAIS_ENTREGA.filter((c) => !filtros.canal || c === filtros.canal).map((c) => (
                <optgroup key={c} label={NOME_CANAL_ENTREGA[c]}>
                  {ESTADOS_ENTREGA[c].slice(1).map((s) => (
                    <option key={`${c}:${s}`} value={`${c}:${s}`}>
                      {ROTULO_ESTADO[s] ?? s}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <Seletor rotulo="Segmento" valor={filtros.segmento} onChange={(v) => mudar("segmento", v)} opcoes={opcoes.segmentos.map((s) => [s, s])} />
          <Seletor rotulo="Campanha" valor={filtros.campanha} onChange={(v) => mudar("campanha", v)} opcoes={opcoes.campanhas.map((s) => [s, s])} />
          <Seletor rotulo="Temperatura" valor={filtros.temperatura} onChange={(v) => mudar("temperatura", v)} opcoes={[["frio", "Frio"], ["morno", "Morno"], ["engajado", "Engajado"]]} />
          <Seletor rotulo="Origem" valor={filtros.origem} onChange={(v) => mudar("origem", v)} opcoes={opcoes.origens.map((s) => [s, s])} />
          <Seletor
            rotulo="Próximo passo"
            valor={filtros.proximoPasso}
            onChange={(v) => mudar("proximoPasso", v)}
            opcoes={[["vencido", "Vencido"], ["hoje", "Hoje"], ["7dias", "Próximos 7 dias"], ["sem_data", "Sem data"]]}
          />
          {filtrosAtivos ? (
            <button
              type="button"
              className="ea-crm-botao ea-crm-botao--suave"
              onClick={() => {
                setFiltros({ ...FILTROS_VAZIOS });
                try {
                  window.history.replaceState(null, "", window.location.pathname);
                } catch {
                  // ver acima
                }
              }}
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      </details>

      {aviso ? (
        <p className="ea-crm-erro" role="alert">
          {aviso}
        </p>
      ) : null}

      {/* Celular: um grupo de etapas por vez (as do fim do funil ficam agrupadas). */}
      <div className="ea-crm-abas" role="tablist" aria-label="Etapas da jornada">
        {GRUPOS_ABAS.map((g) => (
          <button key={g.id} type="button" role="tab" aria-selected={ativa === g.id} className="ea-crm-aba" onClick={() => setAtiva(g.id)}>
            {g.rotulo} <b>{totalDoGrupo(g, colunas)}</b>
          </button>
        ))}
      </div>

      <div className="ea-crm-quadro">
        {ETAPAS.map((etapa) => {
          const lista = colunas[etapa];
          const n = mostrando[etapa] ?? POR_PAGINA;
          return (
            <section
              key={etapa}
              className={`ea-crm-coluna${sobre === etapa ? " ea-crm-coluna--alvo" : ""}`}
              data-ativa={GRUPOS_ABAS.find((g) => g.id === ativa)?.etapas.includes(etapa) ?? false}
              aria-label={`${ETAPA_ROTULO[etapa]}: ${lista.length} leads`}
              onDragOver={(e) => {
                if (arrastando !== null) {
                  e.preventDefault();
                  setSobre(etapa);
                }
              }}
              onDragLeave={() => setSobre((s) => (s === etapa ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setSobre(null);
                const c = cartoes.find((x) => x.id === arrastando);
                setArrastando(null);
                if (c) mover(c, etapa);
              }}
            >
              <header className="ea-crm-coluna-cabeca">
                <h3>{ETAPA_ROTULO[etapa]}</h3>
                <span>{lista.length}</span>
              </header>
              <ul className="ea-crm-cards">
                {lista.slice(0, n).map((c) => (
                  <li
                    key={c.id}
                    className={`ea-crm-card${arrastando === c.id ? " ea-crm-card--arrastando" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      setArrastando(c.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(c.id));
                    }}
                    onDragEnd={() => {
                      setArrastando(null);
                      setSobre(null);
                    }}
                  >
                    <Link href={`/eahub/crm/lead/${c.id}`} className="ea-crm-card-nome">
                      {c.nome}
                    </Link>
                    {c.empresa ? <div className="ea-crm-card-empresa">{c.empresa}</div> : null}
                    <div className="ea-crm-card-linha">
                      <SeloTemperatura temperatura={c.temperatura} pontos={c.pontos} />
                      <IconesEntrega entrega={c.entrega} />
                    </div>
                    <CoberturaPesquisa fontes={c.pesquisa} />
                    {c.segmento || c.campanha ? (
                      <div className="ea-crm-card-tags">
                        {c.segmento ? <span>{c.segmento}</span> : null}
                        {c.campanha ? <span>{c.campanha}</span> : null}
                      </div>
                    ) : null}
                    {c.proximoPasso || c.proximoPassoEm ? (
                      <div className="ea-crm-card-passo">
                        <span>Próximo passo:</span> {c.proximoPasso ?? "sem descrição"}
                        {c.proximoPassoEm ? <em> ({dataHoraBr(new Date(c.proximoPassoEm))})</em> : null}
                      </div>
                    ) : null}
                    <label className="ea-crm-mover">
                      <span className="ea-crm-so-leitor">Mover {c.nome} para</span>
                      <select
                        value=""
                        disabled={ocupado}
                        onChange={(e) => {
                          const v = e.target.value as Etapa;
                          e.target.value = "";
                          if (v) mover(c, v);
                        }}
                      >
                        <option value="">Mover para...</option>
                        {ETAPAS.filter((e) => e !== c.etapa).map((e) => (
                          <option key={e} value={e}>
                            {ETAPA_ROTULO[e]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
              {lista.length === 0 ? (
                <p className="ea-crm-vazio">
                  {filtrosAtivos && cartoes.some((c) => c.etapa === etapa)
                    ? "Nenhum lead desta etapa passa pelos filtros escolhidos. Abra Filtros e toque em Limpar filtros."
                    : VAZIO_ETAPA[etapa]}
                </p>
              ) : null}
              {lista.length > n ? (
                <button type="button" className="ea-crm-botao ea-crm-botao--suave ea-crm-mais" onClick={() => setMostrando((m) => ({ ...m, [etapa]: n + POR_PAGINA }))}>
                  Mostrar mais {Math.min(POR_PAGINA, lista.length - n)} (faltam {lista.length - n})
                </button>
              ) : null}
            </section>
          );
        })}
      </div>

      {pendente?.tipo === "motivo" ? (
        <DialogoMotivo
          titulo={`${pendente.cartao.nome}: mover para ${ETAPA_ROTULO[pendente.para]}`}
          destino={pendente.para === "ganho" ? "ganho" : "nutricao_continua"}
          ocupado={ocupado}
          erro={aviso}
          onCancelar={() => setPendente(null)}
          onConfirmar={(motivo, detalhe) => void gravar(pendente.cartao, pendente.para, motivo, detalhe)}
        />
      ) : null}
      {pendente?.tipo === "saida" ? (
        <Dialogo
          titulo="Tirar da lista?"
          confirmar="Sim, tirar da lista"
          ocupado={ocupado}
          onCancelar={() => setPendente(null)}
          onConfirmar={() => void gravar(pendente.cartao, pendente.para)}
        >
          <p>
            {pendente.cartao.nome} deixa de receber qualquer contato (DM, e-mail, WhatsApp e nutrição). Use só quando a pessoa pedir para sair.
          </p>
        </Dialogo>
      ) : null}
    </div>
  );
}

function Seletor({ rotulo, valor, onChange, opcoes }: { rotulo: string; valor?: string; onChange: (v: string) => void; opcoes: [string, string][] }) {
  return (
    <label className="ea-crm-campo">
      <span>{rotulo}</span>
      <select value={valor ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Todos</option>
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
    </label>
  );
}
