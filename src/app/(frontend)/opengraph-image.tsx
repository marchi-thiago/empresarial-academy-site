import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site-config";

export const alt = `${siteConfig.name} — ${siteConfig.slogan}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #1D2B3C 0%, #2E4358 100%)",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: 999,
            border: "3px solid #C1A160",
            color: "#C1A160",
            fontSize: 44,
            fontWeight: 700,
            marginBottom: 36,
          }}
        >
          EA
        </div>
        <div
          style={{
            fontSize: 30,
            letterSpacing: 8,
            color: "#C1A160",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          Empresarial Academy
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 900 }}>
          Consultoria empresarial com IA
        </div>
        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.8)", marginTop: 24, maxWidth: 880 }}>
          Método Gestão 360™ e sistemas sob medida para ganhar tempo e aumentar o lucro.
        </div>
      </div>
    ),
    { ...size },
  );
}
