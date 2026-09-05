import type { AdminViewServerProps } from "payload";
import { redirect } from "next/navigation";
import { SystemLogo } from "./SystemLogo";
import { PayloadLoginForm } from "./PayloadLoginForm";

/**
 * Tela de login própria, no lugar da tela nativa (quadrada, genérica) do
 * Payload — mesmo padrão nos 3 sistemas Payload da EA (site/EA HUB, EA
 * Post, EA Flow). Registrada em admin.components.views.login (path
 * "/login") de cada payload.config.ts; cada sistema só passa seu próprio
 * `systemName`/`tagline` — o resto (fundo, glow, card de vidro, form) é
 * idêntico. Tratamento visual com efeito (glow atmosférico + glassmorphism
 * + sombra), pedido explícito do Thiago em 30/08/2026 — desenhado primeiro
 * em Figma (arquivo "EA Login Screens") antes de traduzir pra CSS.
 *
 * `position: fixed; inset: 0` de propósito: o template "minimal" do
 * Payload envolve a view custom num container com padding/max-width
 * próprios — sem isso o fundo não cobre a tela inteira (bug visto em
 * produção em 30/08/2026, corrigido nesta mesma sessão). O `<style>` que
 * força `body { background: #fff }` é o mesmo tipo de fallback: garante um
 * fundo neutro atrás do overlay em vez do branco/cinza padrão do navegador
 * enquanto o CSS do gradiente carrega.
 */
export function PayloadLoginView({ systemName, tagline }: { systemName: string; tagline: string }) {
  return function LoginViewForSystem({ initPageResult, searchParams }: AdminViewServerProps) {
    const { req } = initPageResult;
    if (req.user) {
      redirect(req.payload.config.routes.admin);
    }

    const { routes, admin } = req.payload.config;
    const userSlug = admin.user;
    const forgotRoute = `${routes.admin}${routes.admin.endsWith("/") ? "" : "/"}forgot`.replace(/\/{2,}/g, "/");
    const redirectParam = typeof searchParams?.redirect === "string" ? `?redirect=${encodeURIComponent(searchParams.redirect)}` : "";

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          overflowY: "auto",
          background: `
            radial-gradient(1000px 600px at 50% 0%, rgba(201,154,62,0.08) 0%, rgba(201,154,62,0) 70%),
            linear-gradient(180deg, #FAFAF7 0%, #FFFFFF 100%)
          `,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          // `justifyContent: center` com overflow corta o TOPO quando o
          // conteúdo passa da altura da tela: o excesso vai para fora da
          // área rolável e fica inalcançável (achado do Thiago em
          // 05/09/2026, depois que a caixa "Confiar neste navegador"
          // deixou o card mais alto). `margin: auto` no filho centraliza
          // quando sobra espaço e vira alinhamento normal quando falta.
          justifyContent: "flex-start",
          gap: "1.5rem",
          padding: "2.5rem 1.5rem",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700&display=swap');
          body { background: #FFFFFF; }
        `}</style>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            // Centraliza verticalmente sem cortar o topo (ver acima).
            margin: "auto",
            gap: "1.5rem",
            padding: "2.25rem 2.5rem 2rem",
            borderRadius: 20,
            background: "#FFFFFF",
            border: "1px solid #E2DCD0",
            boxShadow: "0 20px 48px -10px rgba(29,43,60,0.12), 0 0 0 1px rgba(201,154,62,0.12)",
            width: "100%",
            maxWidth: 400,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <SystemLogo systemName={systemName} size={130} glow={false} />
            <p
              style={{
                margin: "0.2rem 0 0",
                fontSize: "1.08rem",
                color: "#1D2B3C",
                textAlign: "center",
                fontWeight: 700,
                fontFamily: "'Sora', 'Inter', sans-serif",
                letterSpacing: "-0.01em",
                lineHeight: 1.35,
              }}
            >
              {tagline}
            </p>
          </div>
          <PayloadLoginForm
            userSlug={userSlug}
            apiRoute={routes.api}
            adminRoute={routes.admin}
            forgotRoute={`${forgotRoute}${redirectParam}`}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "#5B6472", fontSize: "0.76rem", fontWeight: 600 }}>
            <span>Ambiente Seguro & Criptografado</span>
            <span style={{ opacity: 0.4 }}>•</span>
            <span style={{ color: "#1D2B3C", fontWeight: 700 }}>Empresarial Academy</span>
          </div>
          <p style={{ margin: 0, fontSize: "0.72rem", color: "#8A93A0" }}>
            Conhecimento que Impulsiona
          </p>
        </div>
      </div>
    );
  };
}
