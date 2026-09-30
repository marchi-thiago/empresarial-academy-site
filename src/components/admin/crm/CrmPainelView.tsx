import Link from "next/link";
import type { AdminViewServerProps } from "payload";
import {
  carregarAgregado,
  carregarLeadsSlim,
  carregarMetas,
} from "@/lib/crm/dados";
import {
  montarPainel,
  type LinhaGrupo,
  type LinhaOrigem,
  type Painel,
} from "@/lib/crm/telas/painel";
import { ETAPA_ROTULO } from "@/lib/crm/tipos";
import { CrmShell, exigirLogin } from "./CrmShell";
import { ROTULO_CANAL } from "./compartilhado";

const pct = (n: number | null, casas = 1) =>
  n === null
    ? "sem dado"
    : `${n.toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;
const num = (n: number) => n.toLocaleString("pt-BR");
const dash = (n: number | null) => (n === null ? "n/a" : num(n));
const taxa = (a: number, b: number) =>
  b > 0 ? pct((a / b) * 100) : "sem dado";

function Grupos({
  titulo,
  linhas,
  filtro,
}: {
  titulo: string;
  linhas: LinhaGrupo[];
  filtro: "segmento" | "campanha";
}) {
  const top = linhas.slice(0, 15);
  const resto = linhas.slice(15);
  return (
    <section className="ea-crm-bloco" aria-label={titulo}>
      <h2>{titulo}</h2>
      <div className="ea-table-scroll">
        <table className="ea-crm-tabela">
          <thead>
            <tr>
              <th scope="col">
                {filtro === "segmento" ? "Segmento" : "Campanha"}
              </th>
              <th scope="col">Leads</th>
              <th scope="col">Contatados</th>
              <th scope="col">Respostas</th>
              <th scope="col">Taxa de resposta</th>
              <th scope="col">Reuniões</th>
              <th scope="col">Vendas</th>
            </tr>
          </thead>
          <tbody>
            {top.map((g) => (
              <tr key={g.nome}>
                <th scope="row">
                  {g.nome.startsWith("Sem ") ? (
                    g.nome
                  ) : (
                    <Link
                      href={`/eahub/crm?${filtro}=${encodeURIComponent(g.nome)}`}
                    >
                      {g.nome}
                    </Link>
                  )}
                </th>
                <td>{num(g.leads)}</td>
                <td>{num(g.contatados)}</td>
                <td>{num(g.respostas)}</td>
                <td>{taxa(g.respostas, g.contatados)}</td>
                <td>{num(g.reunioes)}</td>
                <td>{num(g.vendas)}</td>
              </tr>
            ))}
            {resto.length ? (
              <tr>
                <th scope="row">Outros ({resto.length})</th>
                <td>{num(resto.reduce((s, g) => s + g.leads, 0))}</td>
                <td>{num(resto.reduce((s, g) => s + g.contatados, 0))}</td>
                <td>{num(resto.reduce((s, g) => s + g.respostas, 0))}</td>
                <td>
                  {taxa(
                    resto.reduce((s, g) => s + g.respostas, 0),
                    resto.reduce((s, g) => s + g.contatados, 0),
                  )}
                </td>
                <td>{num(resto.reduce((s, g) => s + g.reunioes, 0))}</td>
                <td>{num(resto.reduce((s, g) => s + g.vendas, 0))}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Origens({
  titulo,
  linhas,
  vazio,
}: {
  titulo: string;
  linhas: LinhaOrigem[];
  vazio: string;
}) {
  return (
    <section className="ea-crm-bloco" aria-label={titulo}>
      <h2>{titulo}</h2>
      {linhas.length === 0 ? (
        <p className="ea-crm-vazio">{vazio}</p>
      ) : (
        <ul className="ea-crm-lista">
          {linhas.map((o) => (
            <li key={`${o.canal}|${o.toque}`}>
              <strong>{o.total}</strong> via{" "}
              {o.canal === "sem_origem"
                ? "origem não registrada"
                : (ROTULO_CANAL[o.canal] ?? o.canal)}
              {o.toque ? `, toque ${o.toque}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Painel do CRM (/eahub/crm/painel): só números do banco. A conta está em src/lib/crm/telas/painel.ts (testada). */
export async function CrmPainelView(props: AdminViewServerProps) {
  exigirLogin(props, "/eahub/crm/painel");
  const [leads, agregado, metas] = await Promise.all([
    carregarLeadsSlim(props.payload),
    carregarAgregado(props.payload),
    carregarMetas(props.payload),
  ]);
  return (
    <CrmShell>
      <PainelConteudo p={montarPainel(leads, agregado, metas)} />
    </CrmShell>
  );
}

/** O conteúdo do painel, separado da leitura do banco para poder ser renderizado com dados de exemplo. */
export function PainelConteudo({ p }: { p: Painel }) {
  const maiorFunil = Math.max(1, ...p.funil.map((f) => f.chegaram));

  return (
    <div className="ea-crm-painel">
      <div className="ea-crm-numeros">
        <div>
          <strong>{num(p.totais.leads)}</strong>
          <span>Leads na base</span>
        </div>
        <div>
          <strong>{num(p.totais.contatados)}</strong>
          <span>Contatados</span>
        </div>
        <div>
          <strong>{num(p.totais.respostas)}</strong>
          <span>Responderam</span>
        </div>
        <div>
          <strong>{num(p.totais.reunioes)}</strong>
          <span>Reunião marcada ou além</span>
        </div>
        <div>
          <strong>{num(p.totais.vendas)}</strong>
          <span>Vendas</span>
        </div>
        <div>
          <strong>{num(p.temperaturas.engajado)}</strong>
          <span>Engajados agora</span>
        </div>
      </div>

      <section className="ea-crm-bloco" aria-label="Metas contra o real">
        <h2>Metas do plano contra o real</h2>
        <p className="ea-crm-nota">
          Metas são hipóteses do plano: revise depois de 2 semanas de piloto e mude uma variável por vez. Hoje valem os números iniciais do plano.</p>
        <ul className="ea-crm-metas">
          {p.metas.map((m) => (
            <li key={m.chave} className="ea-crm-meta">
              <div className="ea-crm-meta-topo">
                <strong>{m.rotulo}</strong>
                <span
                  className={`ea-crm-situacao ea-crm-situacao--${m.situacao}`}
                >
                  {m.situacao === "na_meta"
                    ? "Na meta"
                    : m.situacao === "abaixo"
                      ? "Abaixo da meta"
                      : "Sem dados"}
                </span>
              </div>
              <div className="ea-crm-meta-numeros">
                <span>
                  Meta <b>{pct(m.meta, 0)}</b>
                </span>
                <span>
                  Real{" "}
                  <b>{m.situacao === "sem_dados" ? "sem dado" : pct(m.real)}</b>
                </span>
                {m.situacao !== "sem_dados" ? (
                  <span>
                    Base{" "}
                    <b>
                      {num(m.numerador)} de {num(m.denominador)}
                    </b>
                  </span>
                ) : null}
              </div>
              {m.situacao === "sem_dados" ? (
                <p className="ea-crm-nota">{m.faltando}</p>
              ) : null}
              {m.situacao === "abaixo" ? (
                <p className="ea-crm-nota">
                  Se seguir abaixo em 2 semanas: {m.regra}
                </p>
              ) : null}
              {m.situacao !== "sem_dados" && m.amostraPequena ? (
                <p className="ea-crm-nota">
                  Amostra pequena (menos de 30): não decida ainda.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="ea-crm-bloco" aria-label="Funil">
        <h2>Funil da jornada</h2>
        <p className="ea-crm-nota">
          Quantos leads chegaram a cada passo e a conversão do passo anterior.
          Quem avançou conta nos passos de trás.
        </p>
        <ol className="ea-crm-funil">
          {p.funil.map((f) => (
            <li key={f.rotulo}>
              <div className="ea-crm-funil-linha">
                <span>{f.rotulo}</span>
                <strong>{num(f.chegaram)}</strong>
                <em>
                  {f.conversao === null
                    ? ""
                    : `${pct(f.conversao)} do passo anterior`}
                </em>
              </div>
              <div className="ea-crm-barra" aria-hidden="true">
                <div
                  style={{
                    width: `${Math.max(1, (f.chegaram / maiorFunil) * 100)}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
        <h3>Onde estão agora</h3>
        <ul className="ea-crm-etapas">
          {p.porEtapa.map((e) => (
            <li key={e.etapa}>
              <Link href={`/eahub/crm?etapa=${e.etapa}`}>
                {ETAPA_ROTULO[e.etapa]} <b>{num(e.agora)}</b>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="ea-crm-bloco" aria-label="Por canal">
        <h2>Por canal</h2>
        <p className="ea-crm-nota">
          Leads distintos em cada passo. n/a: o canal não tem esse dado.
        </p>
        <div className="ea-table-scroll">
          <table className="ea-crm-tabela">
            <thead>
              <tr>
                <th scope="col">Canal</th>
                <th scope="col">Enviados</th>
                <th scope="col">Entregues</th>
                <th scope="col">Abertos ou vistos</th>
                <th scope="col">Cliques</th>
                <th scope="col">Respostas</th>
                <th scope="col">Taxa de resposta</th>
                <th scope="col">Reuniões</th>
              </tr>
            </thead>
            <tbody>
              {p.canais.map((c) => (
                <tr key={c.canal}>
                  <th scope="row">{c.rotulo}</th>
                  <td>{num(c.enviados)}</td>
                  <td>{dash(c.entregues)}</td>
                  <td>{dash(c.abertos)}</td>
                  <td>{dash(c.cliques)}</td>
                  <td>{c.canal === "ligacao" ? "n/a" : num(c.respostas)}</td>
                  <td>
                    {c.canal === "ligacao"
                      ? "n/a"
                      : taxa(c.respostas, c.enviados)}
                  </td>
                  <td>{num(c.reunioes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Grupos titulo="Por segmento" linhas={p.segmentos} filtro="segmento" />
      <Grupos titulo="Por campanha" linhas={p.campanhas} filtro="campanha" />

      <div className="ea-crm-duas">
        <Origens
          titulo="Origem das reuniões"
          linhas={p.origemReunioes}
          vazio="Nenhuma reunião marcada ainda."
        />
        <Origens
          titulo="Origem das vendas"
          linhas={p.origemVendas}
          vazio="Nenhuma venda registrada ainda."
        />
      </div>

      <p className="ea-crm-nota">
        Os números vêm do que o CRM registrou (linha do tempo, status de entrega
        e etapa de cada lead). O histórico de DMs anterior ao CRM entra quando o
        EA Hunter sincronizar os status. Estes números não são estimativas.
      </p>
    </div>
  );
}
