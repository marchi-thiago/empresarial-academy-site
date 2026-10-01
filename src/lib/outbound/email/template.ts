/**
 * Template MJML do e-mail outbound (F7): carta do fundador enriquecida.
 * Estrutura espelha `renderEmail()` do EA Recovery (C:\dev\cicj\server\services\email.js):
 * 600 px, seções empilhadas, botão. Aqui não há dado de lead: só layout. Quem
 * escapa e monta cada bloco é o `render.ts`; este arquivo recebe HTML pronto.
 */

export const COR = {
  navy: "#1D2B3C",
  gold: "#C1A160",
  goldInk: "#8A6A1F",
  ink: "#15191F",
  gray: "#5B626E",
  line: "#D9DCE1",
  surface: "#F6F5F1",
  white: "#FFFFFF",
} as const;

export type BlocoMaterial = { rotuloHtml: string; tituloHtml: string; descricaoHtml: string; blogHtml: string };

export type ModeloEmail = {
  preheader: string;
  logoSrc: string;
  logoHref: string;
  logoAlt: string;
  /** Parágrafos antes da capa (HTML já escapado). */
  abertura: string[];
  capa?: { src: string; href: string; alt: string; legendaHtml: string };
  /** Parágrafos depois da capa, antes do botão. */
  convite: string[];
  botao: { href: string; label: string };
  material?: BlocoMaterial;
  fotoSrc: string;
  assinaturaHtml: string[];
  rodapeHtml: string[];
  pixelSrc?: string;
};

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const paragrafo = (html: string, extra = "") =>
  `<mj-text padding="0 0 14px" ${extra}>${html}</mj-text>`;

/** Botão "bulletproof": VML no Outlook (área clicável inteira), link com padding nos demais. */
function botao(href: string, label: string): string {
  const url = attr(href);
  const largura = Math.min(520, Math.max(260, label.length * 9 + 64));
  return `<mj-text padding="6px 0 22px" line-height="1">
<div style="text-align:left;">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:48px;v-text-anchor:middle;width:${largura}px;" arcsize="12%" stroke="f" fillcolor="${COR.gold}"><w:anchorlock/><center style="color:${COR.navy};font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;">${label}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${url}" target="_blank" style="background:${COR.gold};border-radius:6px;color:${COR.navy};display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;line-height:1.25;padding:14px 26px;text-align:center;text-decoration:none;">${label}</a><!--<![endif]-->
</div>
</mj-text>`;
}

export function montarMjml(m: ModeloEmail): string {
  const abertura = m.abertura.map((p) => paragrafo(p)).join("\n");
  const convite = m.convite.map((p) => paragrafo(p)).join("\n");
  const capa = m.capa
    ? `<mj-image src="${attr(m.capa.src)}" href="${attr(m.capa.href)}" alt="${attr(m.capa.alt)}" padding="4px 0 6px" />
       <mj-text padding="0 0 18px" font-size="13px" color="${COR.gray}" line-height="1.45">${m.capa.legendaHtml}</mj-text>`
    : "";
  const material = m.material
    ? `<mj-section background-color="${COR.white}" padding="0 32px 22px">
        <mj-column background-color="${COR.surface}" border-left="3px solid ${COR.gold}" padding="14px 16px">
          <mj-text padding="0 0 4px" font-size="12px" letter-spacing="1px" text-transform="uppercase" color="${COR.goldInk}" font-weight="bold">${m.material.rotuloHtml}</mj-text>
          <mj-text padding="0 0 4px" font-size="16px" font-weight="bold">${m.material.tituloHtml}</mj-text>
          <mj-text padding="0 0 10px" font-size="14px" color="${COR.gray}" line-height="1.5">${m.material.descricaoHtml}</mj-text>
          <mj-text padding="0" font-size="14px" line-height="1.5">${m.material.blogHtml}</mj-text>
        </mj-column>
      </mj-section>`
    : "";
  const assinatura = m.assinaturaHtml
    .map((l, i) =>
      i === 0
        ? `<div style="font-size:16px;font-weight:bold;line-height:1.4;color:${COR.navy};">${l}</div>`
        : `<div style="font-size:13px;line-height:1.45;color:${COR.gray};">${l}</div>`,
    )
    .join("\n");
  const rodape = m.rodapeHtml
    .map((l) => `<mj-text padding="0 0 8px" font-size="12px" line-height="1.55" color="${COR.gray}">${l}</mj-text>`)
    .join("\n");
  const pixel = m.pixelSrc
    ? `<mj-text padding="0" font-size="1px" line-height="1px"><img src="${attr(m.pixelSrc)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" /></mj-text>`
    : "";

  return `<mjml>
  <mj-head>
    <mj-title>Thiago Marchi | Empresarial Academy</mj-title>
    <mj-preview>${m.preheader}</mj-preview>
    <mj-attributes>
      <mj-all font-family="Arial, Helvetica, sans-serif" />
      <mj-text color="${COR.ink}" font-size="16px" line-height="1.6" />
      <mj-image padding="0" />
    </mj-attributes>
    <mj-style>
      a { color: ${COR.goldInk}; }
    </mj-style>
  </mj-head>
  <mj-body background-color="${COR.white}" width="600px">
    <mj-section background-color="${COR.navy}" padding="10px 32px">
      <mj-column>
        <mj-image src="${attr(m.logoSrc)}" href="${attr(m.logoHref)}" alt="${attr(m.logoAlt)}" width="185px" height="40px" align="left" padding="0" />
      </mj-column>
    </mj-section>
    <mj-section background-color="${COR.white}" padding="28px 32px 0">
      <mj-column>
        ${abertura}
        ${capa}
        ${convite}
        ${botao(m.botao.href, m.botao.label)}
      </mj-column>
    </mj-section>
    ${material}
    <mj-section background-color="${COR.white}" padding="6px 32px 26px">
      <mj-column>
        <mj-text padding="0">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td width="72" valign="middle" style="width:72px;padding:0 16px 0 0;"><img src="${attr(m.fotoSrc)}" width="72" height="72" alt="Thiago Marchi" style="display:block;width:72px;height:72px;border:0;" /></td>
              <td valign="middle">${assinatura}</td>
            </tr>
          </table>
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="${COR.surface}" padding="20px 32px 8px">
      <mj-column>
        ${rodape}
        ${pixel}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
}
