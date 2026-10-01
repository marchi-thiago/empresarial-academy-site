import { registrarInteracao, type CrmDb } from "@/lib/crm/registrar";
import type { Canal } from "@/lib/crm/tipos";
import { siteConfig } from "@/lib/site-config";
import { destinoDeInteracao, ehRobo, lerCodigoDeClique, lerCodigoDoPixel } from "./rastreio";
import { dataIso, inicioDoDia } from "./tempo";

/**
 * O que acontece quando alguém clica num link `/r/<codigo>` ou carrega o pixel `/o/<arquivo>`.
 * O redirecionamento e a imagem NUNCA dependem do banco: falha ao gravar não quebra a experiência.
 */

export type DepsRastreio = {
  crm: CrmDb;
  /** Token da /conversa do lead (para o destino "conversa"). */
  tokenDoLead: (leadId: number) => Promise<string | null>;
  agora?: Date;
};

const canalDoToque = (toque: string): Canal => (toque.startsWith("whatsapp") ? "whatsapp" : toque.startsWith("dm") ? "dm" : toque === "linkedin" ? "linkedin" : "email");

/** Para onde o clique leva (URL absoluta no domínio da EA). Código inválido: página inicial. */
export async function tratarClique(deps: DepsRastreio, codigo: string, userAgent: string | null): Promise<{ location: string; registrado: boolean }> {
  const lido = lerCodigoDeClique(codigo);
  if (!lido) return { location: siteConfig.url, registrado: false };

  const nome = destinoDeInteracao(lido.destino);
  let caminho: string;
  if (typeof lido.destino !== "string") caminho = lido.destino.caminho;
  else if (lido.destino === "conversa") {
    const token = await deps.tokenDoLead(lido.leadId).catch(() => null);
    caminho = token ? `/conversa?t=${encodeURIComponent(token)}` : "/conversa";
  } else {
    caminho = { material: "/materiais", blog: "/blog", diagnostico: "/diagnostico-maturidade-empresarial.html" }[lido.destino];
  }
  const location = `${siteConfig.url}${caminho}`;

  if (ehRobo(userAgent)) return { location, registrado: false };
  const agora = deps.agora ?? new Date();
  try {
    const r = await registrarInteracao(
      deps.crm,
      {
        leadId: lido.leadId,
        canal: canalDoToque(lido.toque),
        direcao: "entrada",
        tipo: "clicado",
        metadados: { toque: lido.toque, destino: nome },
        chave: `clique:${lido.leadId}:${lido.toque}:${nome}:${dataIso(inicioDoDia(agora))}`,
        data: agora,
      },
      agora,
    );
    return { location, registrado: r.ok };
  } catch {
    return { location, registrado: false };
  }
}

/** GIF transparente de 1x1 (43 bytes). */
export const GIF_1X1 = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** Registra a abertura (aproximada: cliente de e-mail que bloqueia imagem não conta). Devolve se gravou. */
export async function tratarAbertura(deps: DepsRastreio, arquivo: string, userAgent: string | null): Promise<boolean> {
  const lido = lerCodigoDoPixel(arquivo);
  if (!lido || ehRobo(userAgent)) return false;
  const agora = deps.agora ?? new Date();
  try {
    const r = await registrarInteracao(
      deps.crm,
      {
        leadId: lido.leadId,
        canal: "email",
        direcao: "entrada",
        tipo: "aberto",
        metadados: { toque: lido.toque },
        chave: `aberto:${lido.leadId}:${lido.toque}:${dataIso(inicioDoDia(agora))}`,
        data: agora,
      },
      agora,
    );
    return r.ok;
  } catch {
    return false;
  }
}
