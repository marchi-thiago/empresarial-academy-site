import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";

/**
 * Semeia os links iniciais da "Central EA" (coleção `system-links`).
 * Idempotente: só cria o que ainda não existe (busca por nome), nunca
 * altera nem apaga — depois da primeira carga, a coleção é do Thiago, que
 * edita pelo admin. Diferente do seed-ads-mock, AQUI PODE rodar contra o
 * Neon de propósito: estes são dados reais de produção, e a carga inicial
 * em produção acontece na mesma sessão local (`next dev` apontando para o
 * Neon) usada para sincronizar o schema novo antes do deploy. Bloqueada
 * apenas em NODE_ENV=production (o runtime da Vercel).
 */

/** Links internos (rota do próprio EA HUB): a URL DEVE ser mantida em dia
 * mesmo em linhas já existentes — quando o admin mudou de /admin para /eahub,
 * estas precisaram ser reescritas no banco. */
const INTERNAL_NAMES = new Set(["EA Marketing Manager", "EA ADS", "Portal de Pós-Vendas", "Playbook de Vendas"]);

const INITIAL_LINKS = [
  { name: "Site Empresarial Academy", url: "https://empresarialacademy.com", description: "Site institucional no ar.", order: 10 },
  { name: "LP Consultoria PME", url: "https://empresarialacademy.com/consultoria-pme", description: "Landing page de aquisição (destino do Google Ads).", order: 20 },
  { name: "EA Marketing Manager", url: "/eahub", description: "Hub das ferramentas de marketing (Ads, e-mail, leads) — é a home do EA HUB.", order: 30 },
  { name: "EA ADS", url: "/eahub/ads-performance", description: "Desempenho de campanhas do Google Ads, CAC e ROI.", order: 40 },
  { name: "EA Post", url: "https://post.empresarialacademy.com/admin", description: "Motor de geração, aprovação e publicação de conteúdo social (Instagram, Facebook, YouTube, LinkedIn).", order: 45 },
  { name: "EA Flow", url: "https://flow.empresarialacademy.com/admin", description: "Automação de mensagens (Instagram DM/comentários, futuramente WhatsApp) com construtor visual de fluxos.", order: 47 },
  { name: "EA Impulsiona", url: "https://ea-impulsiona.web.app", description: "Plataforma EA Impulsiona.", order: 50 },
  { name: "EA Recovery", url: "https://recovery.empresarialacademy.com/", description: "CRM de Cobrança (Souza Ramos).", order: 60 },
  { name: "EA Recovery — Admin", url: "https://recovery.empresarialacademy.com/admin", description: "Painel administrativo do EA Recovery.", order: 70 },
  { name: "Portal de Pós-Vendas", url: "/pos-vendas-souza-ramos", description: "Treinamento pós-vendas (Souza Ramos) — protegido por senha.", order: 80 },
  { name: "Playbook de Vendas", url: "/playbook-souza-ramos", description: "Playbook comercial (Souza Ramos) — protegido por senha.", order: 90 },
];

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Rota de carga — bloqueada no runtime de produção." }, { status: 403 });
  }

  const payload = await getPayloadClient();
  const results: Array<{ name: string; action: string }> = [];

  for (const link of INITIAL_LINKS) {
    const existing = await payload.find({
      collection: "system-links",
      where: { name: { equals: link.name } },
      limit: 1,
      depth: 0,
    });
    if (existing.docs[0]) {
      // Links internos: reescreve a URL se mudou (ex.: /admin → /eahub).
      if (INTERNAL_NAMES.has(link.name) && existing.docs[0].url !== link.url) {
        await payload.update({
          collection: "system-links",
          id: existing.docs[0].id,
          data: { url: link.url },
        });
        results.push({ name: link.name, action: "url-atualizada" });
      } else {
        results.push({ name: link.name, action: "already-exists" });
      }
      continue;
    }
    await payload.create({ collection: "system-links", data: link });
    results.push({ name: link.name, action: "created" });
  }

  return NextResponse.json({ ok: true, results });
}
