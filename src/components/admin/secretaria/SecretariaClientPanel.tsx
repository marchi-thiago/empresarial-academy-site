"use client";

import React, { useEffect, useState } from "react";
import { useSondagem } from "./useSondagem";

/* Paleta oficial da marca (Agentes/design-ea.md). Antes desta revisão a tela
 * usava um grafite quase preto (#15191F) e o cinza genérico do Tailwind
 * (#6B7280), que não são da EA: o painel ficava com cara de template escuro
 * em vez de institucional. As linhas da grade também eram desenhadas com um
 * azul escuro (#33445A) sobre fundo claro, o que criava molduras duras. */
const NAVY = "#1D2B3C";
const NAVY_LIGHT = "#2E4059";
const GOLD = "#C99A3E";
const OFFWHITE = "#F7F5F1";
/** Navy um tom acima: cabeçalhos e barras internas do chat. */
const GRAPHITE = "#16222F";
const GRAY = "#5B6472";
/** Linha clara da marca: separa cartões sem virar moldura. */
const LINE = "#E7E2D8";
/** Linha para superfícies escuras (dentro do chat navy). */
const LINE_DARK = "rgba(255,255,255,0.10)";
const GREEN = "#3F7D58";
const AMBER = "#B5842B";
const RADIUS = 12;
const SHADOW = "0 1px 2px rgba(29,43,60,0.06), 0 1px 3px rgba(29,43,60,0.08)";

interface Props {
  postsCount: number;
  leadsCount: number;
}

interface WhatsappInstance {
  instanceName: string;
  ownerNumber: string | null;
  connectionStatus: string;
  connected: boolean;
}

function formatPhone(digits: string): string {
  const m = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  if (!m) return digits;
  return `+55 (${m[1]}) ${m[2]}-${m[3]}`;
}

type SemaforoStatus = "verde" | "amber" | "vermelho";

interface Agent {
  label: string;
  title: string;
  desc: string;
  status: SemaforoStatus;
  statusLabel: string;
  footer: string;
  faltando?: string[];
}

const AGENTS: Agent[] = [
  {
    label: "01",
    // Outlook (Mail.Read) e Teams (OnlineMeetings.ReadWrite) entraram no
    // token de 30/08: o painel seguia mostrando os dois como pendência três
    // dias depois de resolvidos, o que fazia o cartão mentir sobre o estado.
    title: "Calendário & E-mail",
    desc: "Google Calendar, Gmail, Outlook 365 e Teams.",
    status: "verde",
    statusLabel: "Conectado",
    footer: "Google e Microsoft conectados",
  },
  {
    label: "02",
    title: "Social Engine",
    desc: "Fila de posts e aprovação rápida no EA Post.",
    status: "verde",
    statusLabel: "Conectado",
    footer: "",
  },
  {
    label: "03",
    title: "Atendimento & CRM",
    desc: "EA Flow, inbox de leads e automações de DM.",
    status: "verde",
    statusLabel: "Conectado",
    footer: "",
  },
  {
    label: "04",
    title: "Antigravity Dev",
    desc: "Fila de ordens para colar manualmente no Antigravity, sem execução automática.",
    status: "amber",
    statusLabel: "Manual",
    footer: "Registrado via WhatsApp, executado por você",
  },
  {
    label: "05",
    title: "Briefing Executivo",
    desc: "Resumo diário da agenda, todo dia às 7h.",
    status: "verde",
    statusLabel: "Automático",
    footer: "WhatsApp às 7h",
  },
];

const SEMAFORO_COLOR: Record<SemaforoStatus, string> = {
  verde: "#2E7D5B",
  amber: "#C7892B",
  vermelho: "#B23B3B",
};

export function SecretariaClientPanel({ postsCount, leadsCount }: Props) {
  const [testInput, setTestInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [whatsappInstances, setWhatsappInstances] = useState<WhatsappInstance[] | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [connectingInstance, setConnectingInstance] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<{ instanceName: string; base64: string } | null>(null);
  const [forwardThirdParty, setForwardThirdParty] = useState<boolean | null>(null);
  const [togglingForward, setTogglingForward] = useState(false);
  const [antigravityTasks, setAntigravityTasks] = useState<
    Array<{ id: number; instruction: string; status: string; createdAt: string }> | null
  >(null);
  type GroupSettings = { enabled: boolean; groups: Array<{ groupId: string; label?: string }> };
  const [groupSettingsByInstance, setGroupSettingsByInstance] = useState<Record<string, GroupSettings>>({});
  const [togglingGroupRead, setTogglingGroupRead] = useState<string | null>(null);
  const [newGroupInput, setNewGroupInput] = useState<Record<string, { id: string; label: string }>>({});
  const [availableGroups, setAvailableGroups] = useState<Record<string, Array<{ groupId: string; subject: string }>>>({});
  const [loadingGroupList, setLoadingGroupList] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/secretaria/whatsapp-forward-toggle")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setForwardThirdParty(data.forwardThirdParty);
      })
      .catch(() => {});
  }, []);

  const fetchGroupSettings = React.useCallback(async (instanceName: string) => {
    try {
      const res = await fetch(`/api/secretaria/whatsapp-group-settings?instanceName=${instanceName}`);
      const data = await res.json();
      if (data.ok) {
        setGroupSettingsByInstance((prev) => ({ ...prev, [instanceName]: { enabled: data.enabled, groups: data.groups || [] } }));
      }
    } catch {
      // silencioso — o bloco de grupos fica vazio nesse caso, não é crítico
    }
  }, []);

  const saveGroupSettings = async (instanceName: string, enabled: boolean, groups: Array<{ groupId: string; label?: string }>) => {
    setTogglingGroupRead(instanceName);
    try {
      const res = await fetch("/api/secretaria/whatsapp-group-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName, enabled, groups }),
      });
      const data = await res.json();
      if (data.ok) {
        setGroupSettingsByInstance((prev) => ({ ...prev, [instanceName]: { enabled: data.enabled, groups: data.groups || [] } }));
      } else {
        setWhatsappError(data.error || "Falha ao salvar configuração de grupos.");
      }
    } catch {
      setWhatsappError("Não foi possível salvar a configuração de grupos agora.");
    } finally {
      setTogglingGroupRead(null);
    }
  };

  const handleToggleGroupRead = (instanceName: string) => {
    const current = groupSettingsByInstance[instanceName];
    if (togglingGroupRead) return;
    saveGroupSettings(instanceName, !(current?.enabled ?? false), current?.groups ?? []);
  };

  const fetchAvailableGroups = async (instanceName: string) => {
    setLoadingGroupList(instanceName);
    try {
      const res = await fetch(`/api/secretaria/whatsapp-list-groups?instanceName=${instanceName}`);
      const data = await res.json();
      if (data.ok) {
        setAvailableGroups((prev) => ({ ...prev, [instanceName]: data.groups || [] }));
      } else {
        setWhatsappError(data.error || "Falha ao listar grupos.");
      }
    } catch {
      setWhatsappError("Não foi possível listar os grupos agora (pode demorar se houver muitos grupos).");
    } finally {
      setLoadingGroupList(null);
    }
  };

  const handleAddGroupFromList = (instanceName: string, groupId: string, subject: string) => {
    const current = groupSettingsByInstance[instanceName];
    const groups = current?.groups ?? [];
    if (groups.some((g) => g.groupId === groupId)) return;
    saveGroupSettings(instanceName, true, [...groups, { groupId, label: subject }]);
  };

  const handleAddGroupManual = (instanceName: string) => {
    const input = newGroupInput[instanceName];
    const groupId = input?.id.trim();
    if (!groupId) return;
    const current = groupSettingsByInstance[instanceName];
    const groups = current?.groups ?? [];
    saveGroupSettings(instanceName, true, [...groups, { groupId, label: input.label.trim() || undefined }]);
    setNewGroupInput((prev) => ({ ...prev, [instanceName]: { id: "", label: "" } }));
  };

  const handleRemoveGroup = (instanceName: string, groupId: string) => {
    const current = groupSettingsByInstance[instanceName];
    const groups = (current?.groups ?? []).filter((g) => g.groupId !== groupId);
    saveGroupSettings(instanceName, current?.enabled ?? true, groups);
  };

  // Sondagem segura (src/lib/sondagem.ts): no mínimo 60 s, só com a aba visível e em uso, e para de vez no 401/403.
  // Antes eram 20 s e 15 s sem pausa nem freio: a auditoria de 01/10 viu ~1,5 chamada por segundo mantendo o Neon acordado.
  const fetchAntigravityTasks = React.useCallback(async (): Promise<"parar" | void> => {
    try {
      const res = await fetch("/api/secretaria/antigravity-tasks");
      if (res.status === 401 || res.status === 403) return "parar";
      const data = await res.json();
      if (data.ok) setAntigravityTasks(data.tasks);
    } catch {
      // silencioso — o card mostra "sem pendências" nesse caso, não crítico
    }
  }, []);

  useSondagem(fetchAntigravityTasks, 60_000);

  const markAntigravityTaskDone = async (id: number) => {
    setAntigravityTasks((prev) => (prev ? prev.filter((t) => t.id !== id) : prev));
    try {
      await fetch("/api/secretaria/antigravity-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "concluida" }),
      });
    } catch {
      fetchAntigravityTasks();
    }
  };

  const handleToggleForward = async () => {
    if (forwardThirdParty === null || togglingForward) return;
    const next = !forwardThirdParty;
    setTogglingForward(true);
    try {
      const res = await fetch("/api/secretaria/whatsapp-forward-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forwardThirdParty: next }),
      });
      const data = await res.json();
      if (data.ok) setForwardThirdParty(data.forwardThirdParty);
      else setWhatsappError(data.error || "Falha ao alterar o encaminhamento.");
    } catch {
      setWhatsappError("Não foi possível alterar o encaminhamento agora.");
    } finally {
      setTogglingForward(false);
    }
  };

  const fetchWhatsappStatus = React.useCallback(async (): Promise<"parar" | void> => {
    try {
      const res = await fetch("/api/secretaria/whatsapp-status");
      if (res.status === 401 || res.status === 403) {
        setWhatsappError("Sessão expirada. Entre de novo no EA HUB para ver o status do WhatsApp.");
        return "parar";
      }
      const data = await res.json();
      if (data.ok) {
        setWhatsappInstances(data.instances);
        setWhatsappError(null);
      } else {
        setWhatsappError(data.error || "Falha ao consultar status.");
      }
    } catch {
      setWhatsappError("Não foi possível consultar o status do WhatsApp agora.");
    }
  }, []);

  useSondagem(fetchWhatsappStatus, 60_000);

  // Carrega a config de grupos assim que cada instância aparece pela primeira vez.
  useEffect(() => {
    whatsappInstances?.forEach((inst) => {
      if (!(inst.instanceName in groupSettingsByInstance)) {
        fetchGroupSettings(inst.instanceName);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatsappInstances]);

  // Some com o QR assim que a instância que estava sendo pareada conecta.
  useEffect(() => {
    if (!qrCode) return;
    const found = whatsappInstances?.find((i) => i.instanceName === qrCode.instanceName);
    if (found?.connected) setQrCode(null);
  }, [whatsappInstances, qrCode]);

  const handleConnect = async (instanceName: string, forceRecreate = false) => {
    setConnectingInstance(instanceName);
    setQrCode(null);
    setWhatsappError(null);
    try {
      const res = await fetch("/api/secretaria/whatsapp-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName, forceRecreate }),
      });
      const data = await res.json();
      if (data.ok && data.base64) {
        setQrCode({ instanceName, base64: data.base64 });
      } else {
        setWhatsappError(data.error || "Falha ao gerar QR code.");
      }
    } catch {
      setWhatsappError("Não foi possível gerar o QR code agora.");
    } finally {
      setConnectingInstance(null);
    }
  };
  const [chatLog, setChatLog] = useState<Array<{ sender: "user" | "secretaria"; text: string; time: string }>>([
    {
      sender: "secretaria",
      text: "Thiago, estou pronta para agenda, e-mail e o ecossistema EA. Como posso apoiar agora?",
      time: "Agora",
    },
  ]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim() || loading) return;

    const userMsg = testInput.trim();
    setTestInput("");
    const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    setChatLog((prev) => [...prev, { sender: "user", text: userMsg, time: now }]);
    setLoading(true);

    try {
      const history = chatLog.map((m) => ({
        role: m.sender === "user" ? ("user" as const) : ("model" as const),
        text: m.text,
      }));
      const res = await fetch("/api/secretaria/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history }),
      });
      const data = await res.json();
      setChatLog((prev) => [
        ...prev,
        {
          sender: "secretaria",
          text: data.reply || "Não consegui processar essa mensagem agora.",
          time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch {
      setChatLog((prev) => [
        ...prev,
        {
          sender: "secretaria",
          text: "Tive um problema técnico ao processar isso. Pode repetir?",
          time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {/* Divisão de Agentes */}
      <div>
        <div style={sectionHeader}>
          <span style={sectionKicker}>Governança operacional</span>
          <h2 style={sectionTitle}>Divisão de Agentes Especializados</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {AGENTS.map((agent) => (
            <div key={agent.label} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <span style={cardLabel}>{agent.label}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: SEMAFORO_COLOR[agent.status] }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: SEMAFORO_COLOR[agent.status], display: "inline-block" }} />
                  {agent.statusLabel}
                </span>
              </div>
              <h3 style={cardTitle}>{agent.title}</h3>
              <p style={cardDesc}>{agent.desc}</p>
              {agent.footer && <div style={cardFooter}>{agent.footer}</div>}
              {agent.title === "Social Engine" && <div style={cardFooter}>{postsCount} posts no ecossistema</div>}
              {agent.title === "Atendimento & CRM" && <div style={cardFooter}>{leadsCount} leads cadastrados</div>}
              {agent.title === "Antigravity Dev" && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #D9DCE1" }}>
                  {!antigravityTasks || antigravityTasks.length === 0 ? (
                    <div style={{ fontSize: 11, color: GRAY }}>Sem ordens pendentes.</div>
                  ) : (
                    antigravityTasks.map((task) => (
                      <div key={task.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: AMBER, display: "inline-block", flexShrink: 0, marginTop: 5 }} />
                        <div style={{ flex: 1, fontSize: 11.5, color: GRAPHITE, lineHeight: 1.4 }}>{task.instruction}</div>
                        <button
                          onClick={() => markAntigravityTaskDone(task.id)}
                          title="Marcar como feita"
                          style={{ background: "none", border: "none", color: GRAY, fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0, textDecoration: "underline" }}
                        >
                          feita
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
              {agent.faltando && agent.faltando.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #D9DCE1" }}>
                  <div style={{ fontSize: 10, color: GRAY, marginBottom: 4, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>
                    Faltando conectar
                  </div>
                  {agent.faltando.map((item) => (
                    <div key={item} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: AMBER, fontWeight: 600, marginTop: 3 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: AMBER, display: "inline-block", flexShrink: 0 }} />
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Console + Ações */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, alignItems: "stretch" }}>
        {/* Console */}
        <div
          style={{
            background: NAVY,
            display: "flex",
            flexDirection: "column",
            height: 500,
            borderRadius: RADIUS,
            overflow: "hidden",
            border: `1px solid ${LINE}`,
            boxShadow: SHADOW,
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              background: GRAPHITE,
              borderBottom: `2px solid ${GOLD}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontFamily: "'Sora', 'Segoe UI', sans-serif", fontWeight: 700, fontSize: 13, color: "#fff", letterSpacing: 0.3 }}>
                TERMINAL EXECUTIVO
              </div>
              {/* Sobre navy, o cinza da marca não tem contraste suficiente. */}
              <div style={{ fontSize: 11, color: "#AEB8C4", marginTop: 2 }}>EA Assessor · Gemini</div>
            </div>
            <span style={{ fontSize: 10, color: GOLD, fontWeight: 600, letterSpacing: 0.5 }}>PT-BR · GMT-3</span>
          </div>

          <div style={{ flex: 1, padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
            {chatLog.map((msg, idx) => (
              <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: msg.sender === "user" ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "88%",
                    padding: "10px 14px",
                    fontSize: 13,
                    lineHeight: 1.55,
                    borderRadius: 10,
                    background: msg.sender === "user" ? GOLD : NAVY_LIGHT,
                    color: msg.sender === "user" ? NAVY : "#F1F0EC",
                    border: msg.sender === "user" ? "none" : `1px solid ${LINE_DARK}`,
                  }}
                >
                  {msg.text}
                </div>
                <span style={{ fontSize: 10, color: "#9AA5B1", marginTop: 4, padding: "0 4px" }}>{msg.time}</span>
              </div>
            ))}
            {loading && <div style={{ color: GOLD, fontSize: 12, fontStyle: "italic" }}>processando…</div>}
          </div>

          <form onSubmit={handleSend} style={{ padding: 14, background: GRAPHITE, borderTop: `1px solid ${LINE_DARK}`, display: "flex", gap: 8 }}>
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Escreva uma instrução para o EA Assessor…"
              style={{
                flex: 1,
                background: NAVY,
                border: `1px solid ${LINE_DARK}`,
                borderRadius: 8,
                padding: "9px 12px",
                color: "#fff",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                background: GOLD,
                color: NAVY,
                border: "none",
                borderRadius: 8,
                padding: "9px 18px",
                fontFamily: "'Sora', 'Segoe UI', sans-serif",
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: 0.3,
                cursor: "pointer",
              }}
            >
              ENVIAR
            </button>
          </form>
        </div>

        {/* Coluna direita */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              background: "#FFFFFF",
              padding: 20,
              maxHeight: 420,
              overflowY: "auto",
              border: `1px solid ${LINE}`,
              borderRadius: RADIUS,
              boxShadow: SHADOW,
            }}
          >
            <h3 style={panelTitle}>Instruções sugeridas</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={suggestionGroupLabel}>Agenda</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button onClick={() => setTestInput("Qual a minha agenda de hoje?")} style={actionBtnStyle}>
                    Consultar agenda de hoje
                  </button>
                  <button onClick={() => setTestInput("Qual a minha agenda de amanhã?")} style={actionBtnStyle}>
                    Consultar agenda de amanhã
                  </button>
                  <button onClick={() => setTestInput("Marque uma reunião de 30 minutos amanhã às 15h com o título Alinhamento comercial.")} style={actionBtnStyle}>
                    Marcar reunião de 30min amanhã 15h
                  </button>
                  <button onClick={() => setTestInput("Crie um lembrete hoje às 18h para revisar o contrato do cliente X.")} style={actionBtnStyle}>
                    Criar lembrete pessoal
                  </button>
                </div>
              </div>
              <div>
                <div style={suggestionGroupLabel}>E-mail</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button onClick={() => setTestInput("Redija um e-mail de acompanhamento para um cliente que não respondeu há 3 dias.")} style={actionBtnStyle}>
                    Redigir e-mail de follow-up
                  </button>
                  <button onClick={() => setTestInput("Envie um e-mail de confirmação de reunião para contato@exemplo.com, assunto Confirmação de reunião, dizendo que confirmo nosso encontro amanhã às 15h.")} style={actionBtnStyle}>
                    Enviar e-mail de confirmação
                  </button>
                </div>
              </div>
              <div>
                <div style={suggestionGroupLabel}>Ecossistema EA</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button onClick={() => setTestInput("Verifique se há posts pendentes de aprovação no EA Post.")} style={actionBtnStyle}>
                    Checar fila do EA Post
                  </button>
                  <button onClick={() => setTestInput("Mostre as conversas recentes de clientes no EA Flow.")} style={actionBtnStyle}>
                    Puxar leads do EA Flow
                  </button>
                  <button onClick={() => setTestInput("Antigravity, crie uma tarefa para auditar as conexões de API.")} style={actionBtnStyle}>
                    Disparar ordem ao Antigravity
                  </button>
                </div>
              </div>
              <div>
                <div style={suggestionGroupLabel}>Briefing</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button onClick={() => setTestInput("Me dê um resumo executivo do meu dia: agenda, pendências e o que precisa da minha atenção agora.")} style={actionBtnStyle}>
                    Gerar briefing sob demanda
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#FFFFFF",
              padding: 20,
              flex: 1,
              border: `1px solid ${LINE}`,
              borderRadius: RADIUS,
              boxShadow: SHADOW,
            }}
          >
            <h3 style={panelTitle}>Canal WhatsApp</h3>
            <p style={{ fontSize: 12, color: GRAY, margin: "0 0 14px", lineHeight: 1.5 }}>
              Instâncias <strong style={{ color: GRAPHITE }}>EA Assessor</strong> na infraestrutura em nuvem
              (Contabo VPS).
            </p>

            {whatsappError && (
              <div style={{ fontSize: 11, color: "#B23B3B", marginBottom: 12 }}>{whatsappError}</div>
            )}

            {whatsappInstances === null && !whatsappError && (
              <div style={{ fontSize: 12, color: GRAY }}>Consultando status…</div>
            )}

            {whatsappInstances?.map((inst) => (
              <div key={inst.instanceName} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #D9DCE1" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: inst.connected ? GREEN : "#B23B3B" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: inst.connected ? GREEN : "#B23B3B", display: "inline-block" }} />
                    {inst.ownerNumber ? formatPhone(inst.ownerNumber) : inst.instanceName} · {inst.connected ? "online" : inst.connectionStatus}
                  </div>
                  {!inst.connected && (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => handleConnect(inst.instanceName)}
                        disabled={connectingInstance === inst.instanceName}
                        style={{
                          background: GOLD,
                          color: NAVY,
                          border: "none",
                          padding: "6px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {connectingInstance === inst.instanceName ? "Gerando…" : "Conectar"}
                      </button>
                      {inst.connectionStatus === "connecting" && (
                        <button
                          onClick={() => handleConnect(inst.instanceName, true)}
                          disabled={connectingInstance === inst.instanceName}
                          title="A instância ficou travada em 'connecting': apaga e recria do zero antes de gerar o QR."
                          style={{
                            background: "transparent",
                            color: GRAY,
                            border: `1px solid ${GRAY}`,
                            padding: "6px 12px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Recriar do zero
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 10, color: GRAY, marginTop: 3 }}>{inst.instanceName}</div>

                {qrCode?.instanceName === inst.instanceName && (
                  <div style={{ marginTop: 10, textAlign: "center" }}>
                    <img
                      src={`data:image/png;base64,${qrCode.base64}`}
                      alt={`QR code para conectar ${inst.instanceName}`}
                      style={{ width: 200, height: 200, border: `1px solid ${LINE}` }}
                    />
                    <div style={{ fontSize: 10, color: GRAY, marginTop: 6 }}>
                      Escaneie rápido no WhatsApp (Aparelhos conectados). Expira em segundos.
                    </div>
                  </div>
                )}

                {inst.connected && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #EAEDF1" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 11, color: GRAPHITE, fontWeight: 600 }}>Ler grupos deste número</div>
                      <button
                        onClick={() => handleToggleGroupRead(inst.instanceName)}
                        disabled={togglingGroupRead === inst.instanceName}
                        title="Liga/desliga a leitura de grupos específicos, mesmo sem @menção"
                        style={{
                          width: 36,
                          height: 20,
                          borderRadius: 999,
                          border: "none",
                          background: groupSettingsByInstance[inst.instanceName]?.enabled ? GREEN : "#C7CCD4",
                          position: "relative",
                          cursor: "pointer",
                          flexShrink: 0,
                          opacity: togglingGroupRead === inst.instanceName ? 0.6 : 1,
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: 2,
                            left: groupSettingsByInstance[inst.instanceName]?.enabled ? 18 : 2,
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            background: "#fff",
                            transition: "left 0.15s ease",
                          }}
                        />
                      </button>
                    </div>

                    {groupSettingsByInstance[inst.instanceName]?.enabled && (
                      <div style={{ marginTop: 8 }}>
                        {(groupSettingsByInstance[inst.instanceName]?.groups ?? []).map((g) => (
                          <div key={g.groupId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                            <div style={{ flex: 1, fontSize: 10.5, color: GRAPHITE }}>
                              {g.label || g.groupId}
                            </div>
                            <button
                              onClick={() => handleRemoveGroup(inst.instanceName, g.groupId)}
                              style={{ background: "none", border: "none", color: "#B23B3B", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                            >
                              remover
                            </button>
                          </div>
                        ))}

                        <button
                          onClick={() => fetchAvailableGroups(inst.instanceName)}
                          disabled={loadingGroupList === inst.instanceName}
                          style={{ fontSize: 10, color: GOLD, background: "none", border: "none", fontWeight: 700, cursor: "pointer", padding: 0, marginTop: 4 }}
                        >
                          {loadingGroupList === inst.instanceName ? "Buscando grupos…" : "Escolher da lista de grupos"}
                        </button>

                        {availableGroups[inst.instanceName] && (
                          <div style={{ marginTop: 6, maxHeight: 140, overflowY: "auto", border: "1px solid #EAEDF1" }}>
                            {availableGroups[inst.instanceName].length === 0 ? (
                              <div style={{ fontSize: 10, color: GRAY, padding: 8 }}>Nenhum grupo encontrado.</div>
                            ) : (
                              availableGroups[inst.instanceName].map((g) => {
                                const already = (groupSettingsByInstance[inst.instanceName]?.groups ?? []).some(
                                  (x) => x.groupId === g.groupId
                                );
                                return (
                                  <button
                                    key={g.groupId}
                                    onClick={() => handleAddGroupFromList(inst.instanceName, g.groupId, g.subject)}
                                    disabled={already}
                                    style={{
                                      display: "block",
                                      width: "100%",
                                      textAlign: "left",
                                      fontSize: 10.5,
                                      padding: "6px 8px",
                                      background: already ? "#F6F5F1" : "#fff",
                                      color: already ? GRAY : GRAPHITE,
                                      border: "none",
                                      borderBottom: "1px solid #F0F0EE",
                                      cursor: already ? "default" : "pointer",
                                    }}
                                  >
                                    {g.subject} {already ? "· já adicionado" : ""}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}

                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <input
                            type="text"
                            value={newGroupInput[inst.instanceName]?.id || ""}
                            onChange={(e) =>
                              setNewGroupInput((prev) => ({
                                ...prev,
                                [inst.instanceName]: { id: e.target.value, label: prev[inst.instanceName]?.label || "" },
                              }))
                            }
                            placeholder="ou cole o ID (ex: 12036...@g.us)"
                            style={{ flex: 2, fontSize: 10.5, padding: "5px 7px", border: "1px solid #D9DCE1" }}
                          />
                          <button
                            onClick={() => handleAddGroupManual(inst.instanceName)}
                            disabled={!newGroupInput[inst.instanceName]?.id?.trim()}
                            style={{ background: GOLD, color: NAVY, border: "none", padding: "5px 10px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            <div style={{ marginTop: 4, paddingTop: 14, borderTop: "1px solid #D9DCE1", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: GRAPHITE }}>Ler mensagens de terceiros</div>
                <div style={{ fontSize: 10, color: GRAY, marginTop: 2 }}>
                  {forwardThirdParty === false
                    ? "Desativado: mensagens de quem não é você são ignoradas."
                    : "Ativado: lê mensagens de terceiros e atua como atendente para validação de lead da Empresarial Academy."}
                </div>
              </div>
              <button
                onClick={handleToggleForward}
                disabled={forwardThirdParty === null || togglingForward}
                title="Liga/desliga o encaminhamento de mensagens de terceiros no WhatsApp do assessor"
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 999,
                  border: "none",
                  background: forwardThirdParty ? GREEN : "#C7CCD4",
                  position: "relative",
                  cursor: forwardThirdParty === null ? "default" : "pointer",
                  flexShrink: 0,
                  opacity: togglingForward ? 0.6 : 1,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: forwardThirdParty ? 23 : 3,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left 0.15s ease",
                  }}
                />
              </button>
            </div>

            <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid #D9DCE1` }}>
              <div style={{ fontSize: 11, color: GRAY, marginBottom: 6 }}>Conexões pendentes de autorização</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: AMBER }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: AMBER, display: "inline-block" }} />
                Google Calendar / Gmail
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: AMBER, marginTop: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: AMBER, display: "inline-block" }} />
                Outlook 365 / Teams
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const sectionHeader: React.CSSProperties = { marginBottom: 14 };
const sectionKicker: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: GOLD,
  letterSpacing: 1,
  textTransform: "uppercase",
};
const sectionTitle: React.CSSProperties = {
  fontFamily: "'Sora', 'Segoe UI', sans-serif",
  fontSize: 18,
  fontWeight: 700,
  color: GRAPHITE,
  margin: "4px 0 0",
};

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  padding: 18,
  display: "flex",
  flexDirection: "column",
  border: `1px solid ${LINE}`,
  borderRadius: RADIUS,
  boxShadow: SHADOW,
};

const cardLabel: React.CSSProperties = {
  fontFamily: "'Sora', 'Segoe UI', sans-serif",
  fontSize: 11,
  fontWeight: 700,
  color: GOLD,
  letterSpacing: 1,
};

const cardTitle: React.CSSProperties = {
  fontFamily: "'Sora', 'Segoe UI', sans-serif",
  fontSize: 14,
  fontWeight: 700,
  color: GRAPHITE,
  margin: "0 0 6px",
};

const cardDesc: React.CSSProperties = {
  fontSize: 12,
  color: GRAY,
  margin: "0 0 12px",
  lineHeight: 1.5,
  flex: 1,
};

const cardFooter: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: NAVY,
  borderTop: "1px solid #D9DCE1",
  paddingTop: 8,
};

const panelTitle: React.CSSProperties = {
  fontFamily: "'Sora', 'Segoe UI', sans-serif",
  fontSize: 13,
  fontWeight: 700,
  color: GRAPHITE,
  margin: "0 0 14px",
};

const suggestionGroupLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: GOLD,
  marginBottom: 6,
};

const actionBtnStyle: React.CSSProperties = {
  background: "#fff",
  color: GRAPHITE,
  border: "1px solid #D9DCE1",
  padding: "9px 12px",
  fontSize: 12,
  textAlign: "left",
  cursor: "pointer",
};
