import type { Payload } from "payload";
import { card, sectionTitle, EA_GOLD } from "@/components/admin/ads/adsStyles";
import { DIAS_DO_GRAFICO, faixaDaCota, projetosDoGrafico, serieDaMetrica, ultimosDias, type DiaDeCotas, type MetricaDeCota } from "@/lib/infra/cotas";
import { lerUltimosDias } from "@/lib/infra/cotas-db";

/**
 * Cartão compacto de cotas do Neon e da Vercel no /eahub/apis: barras dos últimos 30 dias por projeto (consumo do dia)
 * e, ao lado, o percentual da cota do mês. Os dados vêm do EA Hunter, que coleta uma vez por dia (marcadores
 * `infra:cotas:AAAA-MM-DD`). Só leitura: abrir a tela não consulta Neon nem Vercel, só o registro guardado.
 *
 * Limites usados (fonte oficial): Neon Free https://neon.com/docs/introduction/plans e Vercel Hobby
 * https://vercel.com/docs/plans/hobby. Percentual marcado "estimativa" não vem direto de uma fonte oficial.
 */

const COR_DA_FAIXA = { ok: "var(--theme-success-500)", atencao: "var(--theme-warning-500)", critico: "var(--theme-error-500)" } as const;
const ROTULO_DA_FAIXA = { ok: "dentro da cota", atencao: "atenção", critico: "perto do limite" } as const;

/** Métricas que viram gráfico, por tipo de projeto. */
const GRAFICOS = {
  neon: [{ chave: "compute", titulo: "Compute por dia (CU-h)" }],
  vercel: [
    { chave: "invocacoes", titulo: "Invocações por dia" },
    { chave: "banda", titulo: "Banda por dia (GB)" },
  ],
} as const;

const formatar = (n: number): string => n.toLocaleString("pt-BR", { maximumFractionDigits: n < 10 ? 2 : 0 });

function Barras({ valores, dias, unidade, titulo }: { valores: number[]; dias: string[]; unidade: string; titulo: string }) {
  const largura = 150;
  const altura = 36;
  const passo = largura / valores.length;
  const maximo = Math.max(...valores, 0);
  const total = valores.reduce((s, v) => s + v, 0);
  return (
    <div style={{ minWidth: 150 }}>
      <svg viewBox={`0 0 ${largura} ${altura}`} width={largura} height={altura} role="img" aria-label={`${titulo}: soma de ${formatar(total)} ${unidade} nos últimos ${valores.length} dias`} style={{ display: "block" }}>
        <line x1={0} y1={altura - 0.5} x2={largura} y2={altura - 0.5} stroke="var(--theme-elevation-200)" strokeWidth={1} />
        {valores.map((v, i) => {
          const h = maximo > 0 ? Math.max(v > 0 ? 1.5 : 0, (v / maximo) * (altura - 4)) : 0;
          return (
            <rect key={dias[i]} x={i * passo + 0.5} y={altura - 1 - h} width={Math.max(passo - 1, 1)} height={h} fill={i === valores.length - 1 ? EA_GOLD : "var(--theme-elevation-400)"} rx={0.5}>
              <title>{`${dias[i]!.split("-").reverse().join("/")}: ${formatar(v)} ${unidade}`}</title>
            </rect>
          );
        })}
      </svg>
      <div style={{ fontSize: "0.7rem", color: "var(--theme-elevation-500)", marginTop: 2 }}>{titulo}</div>
    </div>
  );
}

function Percentuais({ metricas }: { metricas: MetricaDeCota[] }) {
  const comLimite = metricas.filter((m) => m.pct !== null).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  if (comLimite.length === 0) return <span style={{ fontSize: "0.78rem", color: "var(--theme-elevation-500)" }}>sem teto no plano (cobrança por uso)</span>;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: "0.8rem" }}>
      {comLimite.map((m) => {
        const faixa = faixaDaCota(m.pct);
        return (
          <li key={m.chave} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontWeight: 700, minWidth: 44, textAlign: "right", color: COR_DA_FAIXA[faixa] }} title={ROTULO_DA_FAIXA[faixa]}>
              {formatar(m.pct ?? 0)}%
            </span>
            <span>
              {m.rotulo}
              {m.estimativa ? <span style={{ color: "var(--theme-elevation-500)" }}> (estimativa)</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export async function CotasInfraCard({ payload }: { payload: Payload }) {
  let registros: DiaDeCotas[] = [];
  try {
    registros = await lerUltimosDias(payload);
  } catch (erro) {
    console.error(`[eahub/apis] falha ao ler as cotas: ${erro}`);
  }
  const dias = ultimosDias(new Date(Math.max(Date.now(), ...registros.map((r) => Date.parse(`${r.dia}T00:00:00Z`)))), DIAS_DO_GRAFICO);
  const projetos = projetosDoGrafico(registros);

  return (
    <section style={{ marginBottom: "1.75rem" }} aria-labelledby="cotas-infra-titulo">
      <h2 id="cotas-infra-titulo" style={sectionTitle}>
        Cotas de infraestrutura (Neon e Vercel)
      </h2>
      <div style={{ ...card }}>
        {projetos.length === 0 ? (
          <p style={{ margin: 0, color: "var(--theme-elevation-600)" }}>
            Ainda sem retrato. O EA Hunter coleta uma vez por dia, depois das 3h, com as chaves NEON_API_KEY e VERCEL_TOKEN no PC dele.
          </p>
        ) : (
          <>
            <div style={{ display: "grid", gap: "0.9rem" }}>
              {projetos.map(({ atual, dia }) => (
                <div key={atual.id} style={{ display: "grid", gridTemplateColumns: "minmax(150px, 1fr) auto minmax(220px, 1.2fr)", gap: "1rem", alignItems: "center", paddingBottom: "0.9rem", borderBottom: "1px solid var(--theme-elevation-100)" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{atual.nome}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--theme-elevation-500)" }}>
                      plano {atual.plano ?? "não informado"} · atualizado em {dia.split("-").reverse().join("/")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
                    {GRAFICOS[atual.sistema].map((g) => {
                      const metrica = atual.metricas.find((m) => m.chave === g.chave);
                      if (!metrica) return null;
                      return <Barras key={g.chave} valores={serieDaMetrica(registros, atual.id, g.chave, dias)} dias={dias} unidade={metrica.unidade} titulo={g.titulo} />;
                    })}
                  </div>
                  <Percentuais metricas={atual.metricas} />
                </div>
              ))}
            </div>
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.74rem", color: "var(--theme-elevation-500)" }}>
              Barras: consumo de cada dia nos últimos {DIAS_DO_GRAFICO} dias (a mais recente em dourado). Percentual: uso do mês contra o limite do plano (Neon Free e Vercel Hobby);
              em projeto da Vercel é a fatia do limite da conta. Verde abaixo de 70%, amarelo de 70% a 89%, vermelho a partir de 90%.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
