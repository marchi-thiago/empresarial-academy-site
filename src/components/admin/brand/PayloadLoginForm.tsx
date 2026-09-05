"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Form de login próprio, reaproveitado nos 3 sistemas Payload (site/EA HUB,
 * EA Post, EA Flow) dentro do layout de PayloadLoginView — substitui o
 * LoginForm nativo do Payload (não exportado publicamente por
 * @payloadcms/next, importar de caminho interno seria frágil entre
 * versões). Mesmo endpoint REST que o form nativo usa por baixo dos panos
 * (POST /api/{userSlug}/login) — mesmo padrão já validado em produção pelo
 * login próprio do EA Flow (LoginForm.tsx).
 *
 * Estilo com efeito (cantos suavizados, glow dourado no foco, botão com
 * gradiente e sombra) — pedido explícito do Thiago em 30/08/2026, desenhado
 * primeiro em Figma antes de traduzir pra CSS. `<style>` local com classe
 * `.ea-login-input` porque `:focus` não dá pra expressar em inline style.
 */
import { motion, AnimatePresence } from "motion/react";

export function PayloadLoginForm({
  userSlug,
  adminRoute,
  forgotRoute,
}: {
  userSlug: string;
  /**
   * Mantida na assinatura porque as views que montam este form já a passam,
   * mas o login agora vai pela rota própria /api/auth/login-trusted.
   */
  apiRoute?: string;
  adminRoute: string;
  forgotRoute?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // "Confiar neste navegador" (pedido do Thiago, 05/09/2026): sessão de 30
  // dias em vez das 2h padrão. Nasce DESMARCADA de propósito — marcar é
  // escolha consciente de quem está no teclado, feita só na máquina dele.
  const [trustDevice, setTrustDevice] = useState(false);
  // Mostrar/ocultar senha (pedido do Thiago, 05/09/2026) — senha longa
  // digitada às cegas é a causa mais comum de "senha incorreta" que na
  // verdade era erro de digitação.
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Rota própria (não a de fábrica): a duração do cookie do Payload é
      // fixa por collection, e aqui ela depende da caixa marcada.
      const res = await fetch("/api/auth/login-trusted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, trustDevice, collection: userSlug }),
      });
      if (!res.ok) {
        setError("E-mail ou senha incorretos.");
        return;
      }
      const redirectTo = searchParams.get("redirect");
      router.push(redirectTo && redirectTo.startsWith("/") ? redirectTo : adminRoute);
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      <style>{`
        .ea-login-input {
          width: 100%;
          padding: 0.8rem 1rem;
          background: #F9FAFB;
          border: 1px solid #D1D5DB;
          color: #1D2B3C;
          font-size: 0.92rem;
          font-family: inherit;
          font-weight: 500;
          border-radius: 12px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ea-login-input::placeholder { color: #9CA3AF; font-size: 0.85rem; }
        .ea-login-input:focus {
          outline: none;
          border-color: #C99A3E;
          background: #FFFFFF;
          box-shadow: 0 0 0 3px rgba(201,154,62,0.22);
        }
        .ea-login-submit {
          width: 100%;
          padding: 0.85rem;
          background: linear-gradient(180deg, #E5CA8C 0%, #C99A3E 100%);
          color: #0F1722;
          font-weight: 700;
          font-family: 'Sora', 'Montserrat', Arial, sans-serif;
          font-size: 0.92rem;
          letter-spacing: 0.02em;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(201,154,62,0.35);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          margin-top: 0.3rem;
        }
        .ea-login-submit:disabled { opacity: 0.65; cursor: not-allowed; }
        .ea-login-forgot {
          transition: all 0.2s ease;
          text-decoration: none;
          color: #5B6472;
          font-size: 0.8rem;
          text-align: center;
          font-weight: 500;
        }
        .ea-login-forgot:hover {
          color: #C99A3E !important;
          text-decoration: underline;
        }
      `}</style>

      <div>
        <label htmlFor="email" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#1D2B3C", marginBottom: "0.45rem" }}>
          E-mail Corporativo
        </label>
        <input
          id="email"
          type="email"
          required
          autoFocus
          placeholder="exemplo@empresarialacademy.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="ea-login-input"
        />
      </div>

      <div>
        <label htmlFor="password" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#1D2B3C", marginBottom: "0.45rem" }}>
          Senha de Acesso
        </label>
        <div style={{ position: "relative" }}>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="ea-login-input"
            style={{ paddingRight: "3rem" }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            // O botão não recebe foco por Tab: quem navega por teclado
            // esperaria ir do campo de senha para o de entrar, não para um
            // controle visual no meio do caminho.
            tabIndex={-1}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={showPassword}
            title={showPassword ? "Ocultar senha" : "Mostrar senha"}
            style={{
              position: "absolute",
              right: "0.55rem",
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              padding: "0.3rem",
              cursor: "pointer",
              fontSize: "1rem",
              lineHeight: 1,
              color: "#5B6472",
            }}
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              background: "rgba(181,72,43,0.1)",
              border: "1px solid #B5482B",
              borderRadius: 8,
              padding: "0.6rem 0.85rem",
              color: "#B5482B",
              fontSize: "0.82rem",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {error}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.55rem",
          fontSize: "0.82rem",
          color: "#5B6472",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={trustDevice}
          onChange={(e) => setTrustDevice(e.target.checked)}
          style={{ width: 16, height: 16, marginTop: 2, accentColor: "#C99A3E", cursor: "pointer", flexShrink: 0 }}
        />
        <span>
          <strong style={{ color: "#1D2B3C", fontWeight: 700 }}>Confiar neste navegador</strong>
          <br />
          Continuar conectado por 30 dias. Use apenas em um dispositivo seu — em computador compartilhado,
          quem o usar entra sem senha.
        </span>
      </label>

      <motion.button
        whileHover={!loading ? { scale: 1.02, y: -1.5, filter: "brightness(1.05)" } : {}}
        whileTap={!loading ? { scale: 0.98 } : {}}
        type="submit"
        disabled={loading}
        className="ea-login-submit"
      >
        {loading ? "Autenticando..." : "Acessar EA HUB →"}
      </motion.button>

      {forgotRoute ? (
        <a href={forgotRoute} className="ea-login-forgot">
          Esqueci minha senha
        </a>
      ) : null}
    </form>
  );
}
