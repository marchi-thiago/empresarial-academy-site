"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EaLogoSpinner } from "@/components/brand/EaLogoSpinner";

export function SiteLogoutView() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function handleLogout() {
      try {
        await fetch("/api/users/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Erro na requisição de logout:", err);
      } finally {
        if (isMounted) {
          const timer = setTimeout(() => {
            router.push("/eahub/login");
            router.refresh();
          }, 1100);
          return () => clearTimeout(timer);
        }
      }
    }

    handleLogout();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#FFFFFF",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <style>{`
        body, html {
          background: #FFFFFF !important;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
      `}</style>

      {/* LOGO CIRCULAR OFICIAL EA COM ANEL DOURADO ÚNICO GIRANDO (ZERO TEXTO) */}
      <EaLogoSpinner size={145} glow={true} shimmer={true} />

      <noscript>
        <div style={{ marginTop: "2rem", textAlign: "center" }}>
          <Link
            href="/eahub/login"
            style={{
              color: "#C99A3E",
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              fontSize: "0.9rem",
              textDecoration: "underline",
            }}
          >
            Clique aqui para fazer login
          </Link>
        </div>
      </noscript>
    </div>
  );
}
