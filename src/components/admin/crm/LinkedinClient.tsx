"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FilaLinkedin, ItemFilaLinkedin, StatusLinkedin } from "@/lib/crm/telas/linkedin";
import { BotaoCopiar, enviarAcaoLinkedin } from "./cliente";
import { SeloTemperatura } from "./compartilhado";

type AbaFiltro = "pendentes" | "enviados" | "aceitos" | "todos";

export function LinkedinClient({
  fila,
  agoraIso: _agoraIso,
}: {
  fila: FilaLinkedin;
  agoraIso: string;
}) {
  const [itens, setItens] = useState<ItemFilaLinkedin[]>(fila.todos);
  const [contadores, setContadores] = useState(fila.contadores);
  const [aba, setAba] = useState<AbaFiltro>("pendentes");
  const [busca, setBusca] = useState("");
  const [ocupadoId, setOcupadoId] = useState<number | null>(null);
  const [erro, setErro] = useState<{ leadId: number; texto: string } | null>(null);

  async function handleAcao(leadId: number, acao: "enviado" | "aceito") {
    setOcupadoId(leadId);
    setErro(null);
    const r = await enviarAcaoLinkedin(leadId, acao);
    setOcupadoId(null);

    if (!r.ok) {
      setErro({ leadId, texto: r.erro });
      return;
    }

    const novoStatus: StatusLinkedin = acao === "enviado" ? "convite_enviado" : "aceito";
    const agoraStr = new Date().toISOString();

    setItens((prev) =>
      prev.map((item) => {
        if (item.leadId !== leadId) return item;
        return {
          ...item,
          statusLinkedin: novoStatus,
          enviadoEm: acao === "enviado" ? agoraStr : item.enviadoEm,
          aceitoEm: acao === "aceito" ? agoraStr : item.aceitoEm,
        };
      }),
    );

    if (acao === "enviado") {
      setContadores((prev) => {
        const novosHoje = prev.enviadosHoje + 1;
        const novosSemana = prev.enviadosSemana + 1;
        return {
          ...prev,
          enviadosHoje: novosHoje,
          restantesHoje: Math.max(0, prev.limiteDiario - novosHoje),
          enviadosSemana: novosSemana,
          restantesSemana: Math.max(0, prev.limiteSemanal - novosSemana),
          atingiuLimiteDiario: novosHoje >= prev.limiteDiario,
          atingiuLimiteSemanal: novosSemana >= prev.limiteSemanal,
        };
      });
    }
  }

  const itensFiltrados = useMemo(() => {
    let base = itens;
    if (aba === "pendentes") {
      base = base.filter((i) => i.statusLinkedin === "nao_enviado");
    } else if (aba === "enviados") {
      base = base.filter((i) => i.statusLinkedin === "convite_enviado");
    } else if (aba === "aceitos") {
      base = base.filter((i) => i.statusLinkedin === "aceito");
    }

    if (!busca.trim()) return base;
    const termo = busca.toLowerCase().trim();
    return base.filter(
      (i) =>
        i.nome.toLowerCase().includes(termo) ||
        i.decisor.toLowerCase().includes(termo) ||
        (i.empresa && i.empresa.toLowerCase().includes(termo)) ||
        (i.segmento && i.segmento.toLowerCase().includes(termo)),
    );
  }, [itens, aba, busca]);

  const contagemPendentes = itens.filter((i) => i.statusLinkedin === "nao_enviado").length;
  const contagemEnviados = itens.filter((i) => i.statusLinkedin === "convite_enviado").length;
  const contagemAceitos = itens.filter((i) => i.statusLinkedin === "aceito").length;

  return (
    <div className="ea-crm-linkedin">
      <div className="ea-crm-linkedin-header">
        <div>
          <h2>LinkedIn semiautomático</h2>
          <p className="ea-crm-suave-texto">
            Convites preparados para decisores de dossiês e seguidores da EA. Clique no perfil, copie a nota e marque o resultado.
          </p>
        </div>
        <button
          type="button"
          className="ea-crm-botao ea-crm-botao--suave"
          onClick={() => window.location.reload()}
        >
          Atualizar
        </button>
      </div>

      {/* Painel de limites anti-ban */}
      <div className="ea-crm-linkedin-limites" role="region" aria-label="Contadores de limite do LinkedIn">
        <div className={`ea-crm-limite-card ${contadores.atingiuLimiteDiario ? "ea-crm-limite-card--alerta" : ""}`}>
          <div className="ea-crm-limite-rotulo">
            <span>Convites enviados hoje</span>
            <b>{contadores.enviadosHoje} / {contadores.limiteDiario}</b>
          </div>
          <div className="ea-crm-limite-barra">
            <div
              className="ea-crm-limite-progresso"
              style={{ width: `${Math.min(100, (contadores.enviadosHoje / contadores.limiteDiario) * 100)}%` }}
            />
          </div>
          <span className="ea-crm-limite-sub">
            {contadores.atingiuLimiteDiario
              ? "Limite diário atingido. Evite novos convites hoje para proteção anti-ban."
              : `Restam ${contadores.restantesHoje} convites hoje (teto seguro: 15/dia)`}
          </span>
        </div>

        <div className={`ea-crm-limite-card ${contadores.atingiuLimiteSemanal ? "ea-crm-limite-card--alerta" : ""}`}>
          <div className="ea-crm-limite-rotulo">
            <span>Convites na semana</span>
            <b>{contadores.enviadosSemana} / {contadores.limiteSemanal}</b>
          </div>
          <div className="ea-crm-limite-barra">
            <div
              className="ea-crm-limite-progresso"
              style={{ width: `${Math.min(100, (contadores.enviadosSemana / contadores.limiteSemanal) * 100)}%` }}
            />
          </div>
          <span className="ea-crm-limite-sub">
            {contadores.atingiuLimiteSemanal
              ? "Limite semanal atingido (~100/semana na conta gratuita)."
              : `Restam ${contadores.restantesSemana} convites na semana (teto seguro: ~100/semana)`}
          </span>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="ea-crm-linkedin-filtros">
        <nav className="ea-crm-linkedin-abas" aria-label="Filtros do LinkedIn">
          <button
            type="button"
            className={`ea-crm-aba ${aba === "pendentes" ? "ea-crm-aba--ativa" : ""}`}
            onClick={() => setAba("pendentes")}
          >
            Pendentes <b>{contagemPendentes}</b>
          </button>
          <button
            type="button"
            className={`ea-crm-aba ${aba === "enviados" ? "ea-crm-aba--ativa" : ""}`}
            onClick={() => setAba("enviados")}
          >
            Enviados <b>{contagemEnviados}</b>
          </button>
          <button
            type="button"
            className={`ea-crm-aba ${aba === "aceitos" ? "ea-crm-aba--ativa" : ""}`}
            onClick={() => setAba("aceitos")}
          >
            Aceitos <b>{contagemAceitos}</b>
          </button>
          <button
            type="button"
            className={`ea-crm-aba ${aba === "todos" ? "ea-crm-aba--ativa" : ""}`}
            onClick={() => setAba("todos")}
          >
            Todos <b>{itens.length}</b>
          </button>
        </nav>

        <div className="ea-crm-linkedin-busca">
          <input
            type="search"
            placeholder="Buscar por decisor, lead ou empresa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="ea-crm-input"
            aria-label="Buscar leads do LinkedIn"
          />
        </div>
      </div>

      {/* Lista de Leads */}
      {itensFiltrados.length === 0 ? (
        <div className="ea-crm-vazio" style={{ marginTop: "1.5rem" }}>
          {busca
            ? "Nenhum contato encontrado com o termo buscado."
            : aba === "pendentes"
              ? "Nenhum convite pendente. Todos os leads qualificados do LinkedIn já foram contatados!"
              : aba === "enviados"
                ? "Nenhum convite enviado ainda."
                : aba === "aceitos"
                  ? "Nenhum convite aceito ainda."
                  : "Nenhum lead com LinkedIn identificado."}
        </div>
      ) : (
        <ul className="ea-crm-itens" style={{ marginTop: "1rem" }}>
          {itensFiltrados.map((item) => (
            <li key={item.leadId} className="ea-crm-item">
              <div className="ea-crm-item-cabeca">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Link className="ea-crm-card-nome" href={`/eahub/crm/lead/${item.leadId}`}>
                      {item.decisor}
                    </Link>
                    {item.decisor !== item.nome ? (
                      <span className="ea-crm-badge ea-crm-badge--cinza" title="Nome do lead / contato">
                        Lead: {item.nome}
                      </span>
                    ) : null}
                    {item.origem === "seguidor_ea" ? (
                      <span className="ea-crm-badge ea-crm-badge--ouro" title="Seguidor da página oficial da EA">
                        Seguidor da EA
                      </span>
                    ) : item.origem === "ambos" ? (
                      <span className="ea-crm-badge ea-crm-badge--ouro" title="Decisor no dossiê e seguidor da EA">
                        Dossiê + Seguidor EA
                      </span>
                    ) : (
                      <span className="ea-crm-badge ea-crm-badge--cinza">Decisor do dossiê</span>
                    )}
                    {item.emCadenciaD2 ? (
                      <span className="ea-crm-badge ea-crm-badge--azul" title="No dia 2 da cadência outbound">
                        D2 Cadência
                      </span>
                    ) : null}
                  </div>
                  {item.empresa ? (
                    <div className="ea-crm-card-empresa">
                      {item.empresa} {item.segmento ? `· ${item.segmento}` : ""}
                    </div>
                  ) : null}
                </div>
                <SeloTemperatura
                  temperatura={item.temperatura as "frio" | "morno" | "engajado"}
                  pontos={item.pontos}
                />
              </div>

              {/* Status do LinkedIn */}
              <div style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  className={`ea-crm-status-tag ${
                    item.statusLinkedin === "aceito"
                      ? "ea-crm-status-tag--ok"
                      : item.statusLinkedin === "convite_enviado"
                        ? "ea-crm-status-tag--enviado"
                        : "ea-crm-status-tag--pendente"
                  }`}
                >
                  {item.statusLinkedin === "aceito"
                    ? "✓ Convite aceito"
                    : item.statusLinkedin === "convite_enviado"
                      ? "Convite enviado"
                      : "Pendente"}
                </span>
                {item.statusLinkedin === "convite_enviado" && item.enviadoEm ? (
                  <span className="ea-crm-suave-texto" style={{ fontSize: "0.8rem" }}>
                    enviado em {new Date(item.enviadoEm).toLocaleDateString("pt-BR")}
                  </span>
                ) : null}
                {item.statusLinkedin === "aceito" && item.aceitoEm ? (
                  <span className="ea-crm-suave-texto" style={{ fontSize: "0.8rem" }}>
                    aceito em {new Date(item.aceitoEm).toLocaleDateString("pt-BR")}
                  </span>
                ) : null}
              </div>

              {/* Bloco da Nota do LinkedIn */}
              {item.nota ? (
                <div className="ea-crm-linkedin-nota-box">
                  <div className="ea-crm-linkedin-nota-topo">
                    <span className="ea-crm-suave-texto" style={{ fontSize: "0.8rem" }}>
                      Nota de convite ({item.nota.length}/200 caracteres):
                    </span>
                    <BotaoCopiar texto={item.nota} rotulo="Copiar nota" />
                  </div>
                  <blockquote className="ea-crm-citacao" style={{ marginTop: "0.3rem", fontStyle: "normal" }}>
                    {item.nota}
                  </blockquote>
                </div>
              ) : (
                <p className="ea-crm-suave-texto" style={{ fontSize: "0.85rem", marginTop: "0.4rem" }}>
                  Sem nota personalizada gerada no kit (convite pode ser enviado sem nota ou com saudação direta).
                </p>
              )}

              {/* Botões de Ação */}
              <div className="ea-crm-item-contato" style={{ marginTop: "0.75rem" }}>
                <a
                  className="ea-crm-botao ea-crm-botao--principal"
                  href={item.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.linkedinDireto ? "Abrir perfil no LinkedIn ↗" : "Buscar decisor no LinkedIn ↗"}
                </a>

                {item.statusLinkedin === "nao_enviado" ? (
                  <button
                    type="button"
                    className="ea-crm-botao ea-crm-botao--resultado"
                    onClick={() => handleAcao(item.leadId, "enviado")}
                    disabled={ocupadoId === item.leadId}
                  >
                    {ocupadoId === item.leadId ? "Salvando..." : "Marcar como Enviado"}
                  </button>
                ) : null}

                {item.statusLinkedin === "convite_enviado" ? (
                  <button
                    type="button"
                    className="ea-crm-botao ea-crm-botao--resultado"
                    onClick={() => handleAcao(item.leadId, "aceito")}
                    disabled={ocupadoId === item.leadId}
                  >
                    {ocupadoId === item.leadId ? "Salvando..." : "Marcar como Aceito"}
                  </button>
                ) : null}

                {item.statusLinkedin === "aceito" ? (
                  <button
                    type="button"
                    className="ea-crm-botao ea-crm-botao--suave"
                    disabled
                    style={{ opacity: 0.7 }}
                  >
                    ✓ Aceito
                  </button>
                ) : null}

                {item.whatsapp ? (
                  <a
                    className="ea-crm-botao ea-crm-botao--suave"
                    href={item.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>
                ) : null}

                {item.instagram ? (
                  <a
                    className="ea-crm-botao ea-crm-botao--suave"
                    href={item.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Instagram
                  </a>
                ) : null}

                <Link className="ea-crm-botao ea-crm-botao--suave" href={`/eahub/crm/lead/${item.leadId}`}>
                  Ficha
                </Link>
              </div>

              {erro && erro.leadId === item.leadId ? (
                <p className="ea-crm-erro" role="alert" style={{ marginTop: "0.5rem" }}>
                  {erro.texto}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
