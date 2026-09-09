"use client";

import { useState } from "react";
import Link from "next/link";
import { SYSTEM_CARD_LINK_PROPS, isExternalUrl } from "@/lib/system-card-link";
import { isBasicAuthProtectedPath } from "@/lib/basic-auth-protected-paths";
import { motion, AnimatePresence } from "motion/react";
import {
  IconContracts,
  IconPresentation,
  IconAds,
  IconWhatsApp,
  IconDiagnostic,
  IconContent,
  IconSystems,
  IconExternal,
} from "./EaHubIcons";

type SystemLinkItem = {
  id: string | number;
  name: string;
  url?: string | null;
  description?: string | null;
};

export function EaHubCommercialCockpit({
  leadsCount = 0,
  dmeLeadsCount = 0,
  emailsCount = 0,
  adsCount = 0,
  contractsCount = 0,
  signedContractsCount = 0,
  systemLinks = [],
}: {
  leadsCount: number;
  dmeLeadsCount: number;
  emailsCount: number;
  adsCount: number;
  contractsCount: number;
  signedContractsCount: number;
  systemLinks: SystemLinkItem[];
}) {
  const [activeStage, setActiveStage] = useState<string>("all");

  const filteredSystemLinks = systemLinks.filter(
    (l) => !l.name.toLowerCase().includes("assessor") && !l.name.toLowerCase().includes("secretaria")
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.09, delayChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: "easeOut" as const },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
    >
      {/* 1. BARRA DE AÇÕES RÁPIDAS DE VENDAS COM MOTION */}
      <motion.div
        variants={itemVariants}
        className="ea-glass-panel"
        style={{
          padding: "1.1rem 1.4rem",
          display: "flex",
          alignItems: "center",
          gap: "0.85rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginRight: "0.4rem" }}>
          <span className="ea-pulse-dot" />
          <span
            style={{
              fontSize: "0.74rem",
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#C99A3E",
              fontFamily: "'Sora', sans-serif",
            }}
          >
            Comando Comercial:
          </span>
        </div>

        <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
          <Link href="/eahub/contratos/novo" className="ea-btn-gold">
            <IconContracts size={17} color="#0F1722" />
            <span>+ Novo Contrato</span>
          </Link>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
          <Link href="/eahub/apresentacao" className="ea-btn-glass">
            <IconPresentation size={16} color="#C99A3E" />
            <span>Apresentador Comercial 16:9</span>
          </Link>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
          <Link href="/eahub/ads-performance" className="ea-btn-glass">
            <IconAds size={16} color="#C99A3E" />
            <span>EA ADS Performance</span>
          </Link>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
          <Link href="/eahub/secretaria" className="ea-btn-glass">
            <IconWhatsApp size={16} color="#2E7D5B" />
            <span>WhatsApp Comercial (24/7)</span>
          </Link>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }} style={{ marginLeft: "auto" }}>
          <a
            href="https://ea-social-engine.vercel.app/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="ea-btn-glass"
          >
            <IconContent size={16} color="#C99A3E" />
            <span>EA Post (Central de Conteúdo) ↗</span>
          </a>
        </motion.div>
      </motion.div>

      {/* 2. MESA EXECUTIVA DE INDICADORES (PIPELINE VISUAL COM FILTRO REATIVO) */}
      <motion.div
        variants={itemVariants}
        className="ea-glass-panel"
        style={{
          padding: "1.6rem 1.85rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.35rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#C99A3E", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Esteira Contínua de Receita
            </span>
            <h2
              style={{
                margin: "0.2rem 0 0",
                fontSize: "1.28rem",
                fontWeight: 800,
                color: "var(--ea-text-primary, #1D2B3C)",
                fontFamily: "'Sora', sans-serif",
                letterSpacing: "-0.01em",
              }}
            >
              Mesa de Indicadores & Pipeline de Vendas
            </h2>
          </div>

          {/* Seletor de Foco Rápido por Estágio */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
            {[
              { id: "all", label: "Visão Completa" },
              { id: "01", label: "01 · Tráfego" },
              { id: "02", label: "02 · DME" },
              { id: "03", label: "03 · Fechamento" },
              { id: "04", label: "04 · Contratos" },
              { id: "05", label: "05 · Sistemas" },
            ].map((btn) => {
              const isSelected = activeStage === btn.id;
              return (
                <motion.button
                  key={btn.id}
                  type="button"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setActiveStage(btn.id)}
                  style={{
                    border: `1px solid ${isSelected ? "#C99A3E" : "var(--ea-card-border, #E7E2D8)"}`,
                    background: isSelected ? "linear-gradient(180deg, #E5CA8C 0%, #C99A3E 100%)" : "var(--ea-surface-subtle, #F3EFE8)",
                    color: isSelected ? "#0F1722" : "var(--ea-text-secondary, #5B6472)",
                    fontWeight: isSelected ? 800 : 600,
                    fontSize: "0.74rem",
                    padding: "0.35rem 0.75rem",
                    borderRadius: 16,
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                  }}
                >
                  {btn.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Linha de Indicadores Interligados com Motion */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            alignItems: "stretch",
          }}
        >
          <MetricTile
            stage="01"
            label="Tráfego & Atração"
            value={`${adsCount}`}
            unit="Campanhas Google Ads"
            detail="Páginas de conversão ativas"
            icon={<IconAds size={20} color="#C99A3E" />}
            isActive={activeStage === "all" || activeStage === "01"}
            onClick={() => setActiveStage(activeStage === "01" ? "all" : "01")}
          />

          <MetricTile
            stage="02"
            label="Qualificação DME"
            value={`${dmeLeadsCount}`}
            unit={`de ${leadsCount} leads totais`}
            detail={`${emailsCount} réguas de nutrição`}
            icon={<IconDiagnostic size={20} color="#C99A3E" />}
            isActive={activeStage === "all" || activeStage === "02"}
            onClick={() => setActiveStage(activeStage === "02" ? "all" : "02")}
          />

          <MetricTile
            stage="03"
            label="Reuniões & Fechamento"
            value="16:9"
            unit="Deck Comercial Ativo"
            detail="Radar do cliente + WhatsApp 24/7"
            icon={<IconPresentation size={20} color="#C99A3E" />}
            isActive={activeStage === "all" || activeStage === "03"}
            onClick={() => setActiveStage(activeStage === "03" ? "all" : "03")}
          />

          <MetricTile
            stage="04"
            label="Contratos & Receita"
            value={`${signedContractsCount}`}
            unit={`de ${contractsCount} gerados`}
            detail="Com certificação digital PDF"
            icon={<IconContracts size={20} color="#C99A3E" />}
            highlight
            isActive={activeStage === "all" || activeStage === "04"}
            onClick={() => setActiveStage(activeStage === "04" ? "all" : "04")}
          />
        </div>
      </motion.div>

      {/* 3. OS 5 GRUPOS ESTRATÉGICOS INTERLIGADOS */}
      <AnimatePresence mode="popLayout">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {/* GRUPO 01: ATRAÇÃO E TRÁFEGO PAGO */}
          {(activeStage === "all" || activeStage === "01") && (
            <StrategicGroup
              key="group-01"
              groupId="01"
              badge="Aquisição & Tráfego"
              title="Atração e Tráfego Pago de Alta Intenção"
              icon={<IconAds size={22} color="#C99A3E" />}
              description="Captação ativa de empresários e donos de empresas que buscam consultoria empresarial no Google, através de palavras-chave qualificadas e campanhas segmentadas."
              interconnection="Direciona o tráfego de empresários qualificados para as Landing Pages temáticas e para a ferramenta pública de Diagnóstico de Maturidade Empresarial (DME)."
              modules={[
                {
                  title: "EA ADS Performance & Forecast",
                  description: "Painel de controle do Google Ads com projeção de CAC, ROI, concorrência e metas.",
                  href: "/eahub/ads-performance",
                  actionLabel: "Abrir ADS Manager ↗",
                  primary: true,
                },
                {
                  title: "LP · Consultoria PME",
                  description: "Página canônica de consultoria para pequenas e médias empresas.",
                  href: "/consultoria-pme",
                  actionLabel: "Ver Landing Page ↗",
                },
                {
                  title: "LP · Consultoria de Gestão",
                  description: "Página focada em busca por consultoria de gestão empresarial e estruturação.",
                  href: "/consultoria-de-gestao-empresarial",
                  actionLabel: "Ver Landing Page ↗",
                },
                {
                  title: "Motor de Conteúdo EA Post",
                  description: "Planejamento e publicação unificada para Blog, Materiais Gratuitos e Redes Sociais.",
                  href: "https://ea-social-engine.vercel.app/admin",
                  actionLabel: "Acessar EA Post ↗",
                },
                {
                  title: "EA Flow (Automação de Mensagens)",
                  description: "Fluxos de DM e comentário no Instagram, Messenger e WhatsApp: responde, qualifica e captura o lead na conversa.",
                  href: "https://ea-flow.vercel.app/admin",
                  actionLabel: "Acessar EA Flow ↗",
                },
              ]}
            />
          )}

          {/* GRUPO 02: QUALIFICAÇÃO & INTELIGÊNCIA DME */}
          {(activeStage === "all" || activeStage === "02") && (
            <StrategicGroup
              key="group-02"
              groupId="02"
              badge="Qualificação & Dados"
              title="Qualificação de Oportunidades & Inteligência de Leads"
              icon={<IconDiagnostic size={22} color="#C99A3E" />}
              description="Mapeamento das vulnerabilidades e oportunidades da empresa em 6 pilares estratégicos (Vendas, Marketing, Liderança, Processos, Finanças e Cultura) via metodologia Gestão 360."
              interconnection="O empresário realiza o diagnóstico, recebe seu plano na hora, e as informações alimentam automaticamente a Base de Leads, as réguas de nutrição e o deck de fechamento."
              modules={[
                {
                  title: "Diagnóstico DME Online",
                  description: "Ferramenta pública com 36 perguntas, gráfico radar e plano de ação imediato.",
                  href: "/diagnostico-maturidade-empresarial.html",
                  actionLabel: "Abrir Ferramenta Pública ↗",
                  primary: true,
                },
                {
                  title: "Base Unificada de Leads",
                  description: "Listagem de todos os empresários captados com score, pilar mais fraco e canal.",
                  href: "/eahub/collections/leads",
                  actionLabel: "Ver Base de Leads ↗",
                },
                {
                  title: "Campanhas de E-mail & Nutrição",
                  description: "Disparos automáticos e réguas de relacionamento baseadas no pilar deficitário.",
                  href: "/eahub/collections/email-campaigns",
                  actionLabel: "Gerenciar Campanhas ↗",
                },
                {
                  title: "Segmentos de Leads",
                  description: "Critérios de segmentação por maturidade, origem e volume de faturamento.",
                  href: "/eahub/collections/email-segments",
                  actionLabel: "Ver Segmentos ↗",
                },
              ]}
            />
          )}

          {/* GRUPO 03: NEGOCIAÇÃO & APRESENTAÇÃO */}
          {(activeStage === "all" || activeStage === "03") && (
            <StrategicGroup
              key="group-03"
              groupId="03"
              badge="Fechamento Comercial"
              title="Negociação, Apresentação Comercial & Atendimento Executivo"
              icon={<IconPresentation size={22} color="#C99A3E" />}
              description="Ambiente de reunião consultiva de alto impacto para apresentação da proposta comercial, projeção do radar do cliente e suporte executivo multicanal."
              interconnection="O consultor digita o ID do diagnóstico na Apresentação 16:9 para personalizar a reunião na hora e utiliza o WhatsApp integrado para follow-up imediato de fechamento."
              modules={[
                {
                  title: "Apresentação Comercial Gestão 360",
                  description: "Deck 16:9 com carregamento automático dos dados do cliente a partir do ID do DME.",
                  href: "/eahub/apresentacao",
                  actionLabel: "Iniciar Apresentação 16:9 ↗",
                  primary: true,
                },
                {
                  title: "EA Assessor (Torre WhatsApp)",
                  description: "Assessoria executiva 24/7 conectada ao WhatsApp, Google Agenda, Outlook e e-mails.",
                  href: "/eahub/secretaria",
                  actionLabel: "Abrir WhatsApp Executivo ↗",
                },
                {
                  title: "Depoimentos & Prova Social",
                  description: "Casos de sucesso de empresários mentorados para ancoragem de autoridade.",
                  href: "/eahub/collections/testimonials",
                  actionLabel: "Gerenciar Prova Social ↗",
                },
              ]}
            />
          )}

          {/* GRUPO 04: FORMALIZAÇÃO JURÍDICA & RECEITA */}
          {(activeStage === "all" || activeStage === "04") && (
            <StrategicGroup
              key="group-04"
              groupId="04"
              badge="Formalização & Receita"
              title="Formalização Jurídica, Certificação & Receita"
              icon={<IconContracts size={22} color="#C99A3E" />}
              description="Geração instantânea de minutas contratuais personalizadas para Mentoria, Consultoria, Conselho ou Projetos, com colheita de assinatura eletrônica válida."
              interconnection="Transforma a negociação aprovada em contrato com link seguro (/assinar/[token]), emitindo o Certificado Digital de Assinatura em PDF anexado ao registro."
              modules={[
                {
                  title: "Gerador de Minutas Contratuais",
                  description: "Preenchimento guiado com cláusulas jurídicas padrão EA e envio direto para assinatura.",
                  href: "/eahub/contratos/novo",
                  actionLabel: "+ Criar Novo Contrato",
                  primary: true,
                },
                {
                  title: "Gestão de Contratos & Assinaturas",
                  description: "Acompanhamento em tempo real de minutas enviadas, assinadas e arquivadas.",
                  href: "/eahub/collections/contracts",
                  actionLabel: "Ver Todos os Contratos ↗",
                },
              ]}
            />
          )}

          {/* GRUPO 05: ECOSSISTEMA & GOVERNANÇA */}
          {(activeStage === "all" || activeStage === "05") && (
            <StrategicGroup
              key="group-05"
              groupId="05"
              badge="Infraestrutura & Governança"
              title="Ecossistema Integrado, Governança & Sistemas"
              icon={<IconSystems size={22} color="#C99A3E" />}
              description="Torre de monitoramento técnico, inventário de APIs externas, credenciais com faturamento e portfólio de aplicações do ecossistema Empresarial Academy."
              interconnection="Garante que todas as integrações (Google Cloud, Gemini AI, Resend, Vercel e bancos de dados) operem com alta disponibilidade e segurança criptografada."
              modules={[
                {
                  title: "Painel de APIs & Credenciais",
                  description: "Inventário de credenciais externas, sistemas consumidores, expiração e status de billing.",
                  href: "/eahub/apis",
                  actionLabel: "Ver Painel de APIs ↗",
                },
                {
                  title: "Dashboard de Operações TV",
                  description: "Visão consolidada para telão: pendências de aprovação, tokens e alertas de automação.",
                  href: "/eahub/tv",
                  actionLabel: "Abrir Modo TV ↗",
                },
                {
                  title: "Gerenciador de Links do Ecossistema",
                  description: "Cadastro e ordenação dos sistemas no portfólio executivo da marca.",
                  href: "/eahub/collections/system-links",
                  actionLabel: "Gerenciar Links ⚙",
                },
              ]}
              extraLinks={filteredSystemLinks}
            />
          )}
        </div>
      </AnimatePresence>
    </motion.div>
  );
}

function MetricTile({
  stage,
  label,
  value,
  unit,
  detail,
  icon,
  highlight = false,
  isActive = true,
  onClick,
}: {
  stage: string;
  label: string;
  value: string;
  unit: string;
  detail: string;
  icon: React.ReactNode;
  highlight?: boolean;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        background: highlight
          ? "var(--ea-card-primary-bg, #FFFFFF)"
          : "var(--ea-surface-bg, #FFFFFF)",
        border: `1px solid ${highlight ? "#C99A3E" : isActive ? "var(--ea-card-border, #E7E2D8)" : "transparent"}`,
        borderRadius: 14,
        padding: "1.15rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        position: "relative",
        boxShadow: highlight ? "0 8px 24px -4px rgba(29, 43, 60, 0.08), 0 0 12px rgba(201, 154, 62, 0.12)" : "0 2px 8px rgba(29,43,60,0.03)",
        cursor: "pointer",
        opacity: isActive ? 1 : 0.45,
        transition: "opacity 0.2s ease, border-color 0.2s ease, background 0.2s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#C99A3E", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Etapa {stage}
        </span>
        <div style={{ opacity: 0.85 }}>{icon}</div>
      </div>

      <div>
        <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 600, color: "var(--ea-text-secondary, #5B6472)" }}>
          {label}
        </p>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", margin: "0.15rem 0" }}>
          <strong style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--ea-text-primary, #1D2B3C)", fontFamily: "'Sora', sans-serif" }}>
            {value}
          </strong>
          <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--ea-text-secondary, #5B6472)" }}>
            {unit}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--ea-text-secondary, #8A93A0)" }}>
          {detail}
        </p>
      </div>
    </motion.div>
  );
}

function StrategicGroup({
  groupId,
  badge,
  title,
  icon,
  description,
  interconnection,
  modules,
  extraLinks = [],
}: {
  groupId: string;
  badge: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  interconnection: string;
  modules: {
    title: string;
    description: string;
    href: string;
    actionLabel: string;
    primary?: boolean;
  }[];
  extraLinks?: SystemLinkItem[];
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="ea-glass-panel"
      style={{
        padding: "1.6rem 1.85rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      {/* Header do Grupo */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "#1D2B3C",
            border: "1px solid #C99A3E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(29, 43, 60, 0.25)",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div style={{ display: "grid", gap: "0.15rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 800,
                color: "#C99A3E",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontFamily: "'Sora', sans-serif",
              }}
            >
              Fase {groupId} · {badge}
            </span>
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: "1.18rem",
              fontWeight: 800,
              color: "var(--ea-text-primary, #1D2B3C)",
              fontFamily: "'Sora', sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h3>
        </div>
      </div>

      {/* Caixa Explicativa: Função & Interligação */}
      <div
        style={{
          background: "var(--ea-box-bg, #F8F6F2)",
          border: "1px solid var(--ea-card-border, #E7E2D8)",
          borderRadius: 12,
          padding: "1rem 1.25rem",
          display: "grid",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#C99A3E", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
            Função:
          </span>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ea-text-secondary, #5B6472)", lineHeight: 1.45 }}>
            {description}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#3F7D58", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
            Interligação:
          </span>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ea-text-primary, #1D2B3C)", fontWeight: 500, lineHeight: 1.45 }}>
            {interconnection}
          </p>
        </div>
      </div>

      {/* Módulos do Grupo (Cards com Motion) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "1rem",
        }}
      >
        {modules.map((mod) => {
          // Todo card de sistema abre em aba nova (ver system-card-link.ts) —
          // o HUB fica atrás como menu inicial. <a> quando a URL é absoluta ou
          // protegida por Basic Auth (evita prefetch automático disparar 401).
          const isExt = isExternalUrl(mod.href);
          const isProtected = isBasicAuthProtectedPath(mod.href);
          const Component = isExt || isProtected ? "a" : Link;
          return (
            <motion.div key={mod.title} whileHover={{ y: -3, scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Component
                href={mod.href}
                {...SYSTEM_CARD_LINK_PROPS}
                className="ea-glass-card"
                style={{
                  height: "100%",
                  border: mod.primary ? "1px solid #C99A3E" : "1px solid var(--ea-card-border, #E7E2D8)",
                  background: mod.primary ? "var(--ea-card-primary-bg, #FFFFFF)" : "var(--ea-surface-bg, #FFFFFF)",
                  boxShadow: mod.primary ? "0 8px 24px -4px rgba(29, 43, 60, 0.08), 0 0 12px rgba(201, 154, 62, 0.12)" : undefined,
                }}
              >
                <strong style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ea-text-primary, #1D2B3C)", fontFamily: "'Sora', sans-serif" }}>
                  {mod.title}
                </strong>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--ea-text-secondary, #5B6472)", lineHeight: 1.45, flexGrow: 1 }}>
                  {mod.description}
                </p>
                <div style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", fontWeight: 700, color: "#C99A3E" }}>
                  <span>{mod.actionLabel}</span>
                  <IconExternal size={12} color="#C99A3E" />
                </div>
              </Component>
            </motion.div>
          );
        })}
      </div>

      {/* Links Extras de Sistemas (quando houver) */}
      {extraLinks.length > 0 ? (
        <div style={{ paddingTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
          {extraLinks.map((item) => {
            return (
              <motion.div key={String(item.id)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <a
                  href={item.url || "#"}
                  {...SYSTEM_CARD_LINK_PROPS}
                  className="ea-btn-glass"
                  style={{ fontSize: "0.78rem", padding: "0.45rem 0.8rem" }}
                >
                  <span>{item.name}</span>
                  <IconExternal size={12} color="#C99A3E" />
                </a>
              </motion.div>
            );
          })}
        </div>
      ) : null}
    </motion.div>
  );
}
