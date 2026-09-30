import Link from "next/link";
import type { AdminViewServerProps } from "payload";
import { carregarFicha } from "@/lib/crm/dados";
import {
  linkInstagram,
  linkLigar,
  linkWhatsapp,
} from "@/lib/crm/telas/contato";
import {
  dossieParaLeitura,
  kitParaBlocos,
  textoParaCopiar,
  type BlocoKit,
  type CanalKit,
} from "@/lib/crm/telas/dossie";
import { dataHoraBr } from "@/lib/crm/telas/tempo";
import { ETAPA_ROTULO, MOTIVOS_RESULTADO } from "@/lib/crm/tipos";
import { BotaoCopiar } from "./cliente";
import { CrmShell, exigirLogin } from "./CrmShell";
import {
  IconesEntrega,
  ROTULO_CANAL,
  ROTULO_TIPO,
  SeloTemperatura,
} from "./compartilhado";
import { MoverEtapa, ProximoPasso } from "./FichaClient";

const ROTULO_CANAL_KIT: Record<CanalKit, string> = {
  dm: "DM do Instagram",
  email: "E-mail",
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  linkedin: "LinkedIn",
  geral: "Outras mensagens",
};
const ORDEM_KIT: CanalKit[] = [
  "dm",
  "email",
  "whatsapp",
  "ligacao",
  "linkedin",
  "geral",
];

function idDaRota(params: AdminViewServerProps["params"]): number | null {
  const seg = params?.segments;
  const ultimo = Array.isArray(seg) ? seg[seg.length - 1] : undefined;
  const n = Number(ultimo);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const comHttp = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

function BotaoLink({
  href,
  children,
  externo = true,
}: {
  href: string | null;
  children: string;
  externo?: boolean;
}) {
  if (!href)
    return (
      <span className="ea-crm-botao ea-crm-botao--inativo" aria-disabled="true">
        {children} indisponível
      </span>
    );
  return (
    <a
      className="ea-crm-botao ea-crm-botao--principal"
      href={href}
      {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

function Kit({ blocos }: { blocos: BlocoKit[] }) {
  if (blocos.length === 0)
    return (
      <p className="ea-crm-vazio">
        O kit de mensagens ainda não foi gerado para este lead.
      </p>
    );
  return (
    <div className="ea-crm-kit">
      {ORDEM_KIT.map((canal) => {
        const doCanal = blocos.filter((b) => b.canal === canal);
        if (doCanal.length === 0) return null;
        return (
          <details
            key={canal}
            className="ea-crm-kit-grupo"
            open={canal === "dm"}
          >
            <summary>
              {ROTULO_CANAL_KIT[canal]} <b>{doCanal.length}</b>
            </summary>
            {doCanal.map((b) => (
              <article key={b.id} className="ea-crm-kit-bloco">
                <header>
                  <h4>{b.titulo}</h4>
                  <BotaoCopiar texto={textoParaCopiar(b)} />
                </header>
                {b.partes.map((p, i) => (
                  <div key={i} className="ea-crm-kit-parte">
                    {p.rotulo ? <strong>{p.rotulo}</strong> : null}
                    <p>{p.texto}</p>
                  </div>
                ))}
              </article>
            ))}
          </details>
        );
      })}
    </div>
  );
}

/** Ficha do cliente (/eahub/crm/lead/:id): contato em um toque, dossiê, kit, próximo passo e linha do tempo. */
export async function CrmFichaView(props: AdminViewServerProps) {
  const id = idDaRota(props.params);
  exigirLogin(props, id ? `/eahub/crm/lead/${id}` : "/eahub/crm");

  const ficha = id ? await carregarFicha(props.payload, id) : null;
  if (!id || !ficha) {
    return (
      <CrmShell>
        <p className="ea-crm-vazio">Lead não encontrado.</p>
        <Link className="ea-crm-botao ea-crm-botao--suave" href="/eahub/crm">
          Voltar ao Kanban
        </Link>
      </CrmShell>
    );
  }

  return (
    <CrmShell>
      <FichaConteudo ficha={ficha} />
    </CrmShell>
  );
}

export type Ficha = NonNullable<Awaited<ReturnType<typeof carregarFicha>>>;

/** O conteúdo da ficha, separado da leitura do banco para poder ser renderizado com dados de exemplo. */
export function FichaConteudo({ ficha }: { ficha: Ficha }) {
  const { lead, slim: l, interacoes, totalInteracoes, limite } = ficha;
  const dossie = dossieParaLeitura(lead.dossie);
  const blocos = kitParaBlocos(lead.kit);
  const cad = (lead.cadencia ?? {}) as Record<string, unknown>;
  const motivo = (lead.motivoResultado ?? {}) as {
    motivo?: string;
    detalhe?: string;
  };
  const motivoRotulo = MOTIVOS_RESULTADO.find(
    (m) => m.value === motivo.motivo,
  )?.label;
  const site =
    typeof lead.site === "string" && lead.site ? comHttp(lead.site) : null;
  const encerrados = l.canaisEncerrados.map((c) => ROTULO_CANAL[c] ?? c);

  return (
    <div className="ea-crm-ficha">
      <header className="ea-crm-ficha-topo ea-crm-bloco">
        <div className="ea-crm-ficha-titulo">
          <h1>{l.nome}</h1>
          {l.empresa ? <p>{l.empresa}</p> : null}
          <p className="ea-crm-ficha-sub">
            {[l.segmento, l.campanha].filter(Boolean).join(" · ") ||
              "Sem segmento nem campanha"}
          </p>
        </div>
        <div className="ea-crm-ficha-selos">
          <span className="ea-crm-etapa">{ETAPA_ROTULO[l.etapa]}</span>
          <SeloTemperatura temperatura={l.temperatura} pontos={l.pontos} />
        </div>
        <div className="ea-crm-ficha-contato">
          <BotaoLink href={linkLigar(l.whatsapp)} externo={false}>
            Ligar
          </BotaoLink>
          <BotaoLink href={linkWhatsapp(l.whatsapp)}>WhatsApp</BotaoLink>
          <BotaoLink href={linkInstagram(l.instagram)}>Instagram</BotaoLink>
          {l.email ? (
            <a
              className="ea-crm-botao ea-crm-botao--suave"
              href={`mailto:${l.email}`}
            >
              E-mail
            </a>
          ) : null}
          {site ? (
            <a
              className="ea-crm-botao ea-crm-botao--suave"
              href={site}
              target="_blank"
              rel="noopener noreferrer"
            >
              Site
            </a>
          ) : null}
          <Link
            className="ea-crm-botao ea-crm-botao--suave"
            href={`/eahub/collections/leads/${l.id}`}
          >
            Editar cadastro
          </Link>
        </div>
      </header>

      <div className="ea-crm-ficha-grade">
        <section className="ea-crm-bloco" aria-labelledby="f-passo">
          <h2 id="f-passo">Próximo passo e etapa</h2>
          <ProximoPasso
            leadId={l.id}
            textoInicial={l.proximoPasso}
            emInicial={l.proximoPassoEm}
          />
          <MoverEtapa leadId={l.id} nome={l.nome} etapa={l.etapa} />
          {motivoRotulo ? (
            <p className="ea-crm-nota">
              Último motivo registrado: <strong>{motivoRotulo}</strong>
              {motivo.detalhe ? ` (${motivo.detalhe})` : ""}
            </p>
          ) : null}
        </section>

        <section className="ea-crm-bloco" aria-labelledby="f-entrega">
          <h2 id="f-entrega">Entrega e cadência</h2>
          <IconesEntrega entrega={l.entrega} comTexto />
          <ul className="ea-crm-lista">
            <li>
              Cadência:{" "}
              <strong>
                {cad.pausada
                  ? `pausada (${String(cad.motivoPausa ?? "sem motivo")})`
                  : "ativa"}
              </strong>
            </li>
            {l.proximoCanal ? (
              <li>
                Próximo toque:{" "}
                <strong>
                  {ROTULO_CANAL[l.proximoCanal] ?? l.proximoCanal}
                </strong>
                {l.proximoToqueEm
                  ? ` em ${dataHoraBr(new Date(l.proximoToqueEm))}`
                  : ""}
              </li>
            ) : null}
            {encerrados.length ? (
              <li>Canais encerrados por falha: {encerrados.join(", ")}</li>
            ) : null}
            {l.primeiroToqueEm ? (
              <li>
                Primeiro toque: {dataHoraBr(new Date(l.primeiroToqueEm))} (
                {ROTULO_CANAL[
                  String(
                    (lead.origem as Record<string, unknown> | undefined)
                      ?.primeiroToqueCanal ?? "",
                  )
                ] ?? "canal não informado"}
                )
              </li>
            ) : null}
            {l.reuniaoCanal ? (
              <li>
                Reunião veio de:{" "}
                {ROTULO_CANAL[l.reuniaoCanal] ?? l.reuniaoCanal}
                {l.reuniaoToque ? `, toque ${l.reuniaoToque}` : ""}
              </li>
            ) : null}
            <li>Origem do lead: {l.origem ?? "não informada"}</li>
          </ul>
        </section>
      </div>

      <section className="ea-crm-bloco" aria-labelledby="f-dossie">
        <h2 id="f-dossie">Dossiê</h2>
        {dossie.length === 0 ? (
          <p className="ea-crm-vazio">
            O dossiê ainda não foi gerado para este lead.
          </p>
        ) : (
          <dl className="ea-crm-dossie">
            {dossie.map((p, i) => (
              <div key={i}>
                <dt>{p.rotulo}</dt>
                <dd>{p.valor}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="ea-crm-bloco" aria-labelledby="f-kit">
        <h2 id="f-kit">Kit de mensagens</h2>
        <Kit blocos={blocos} />
      </section>

      <section className="ea-crm-bloco" aria-labelledby="f-tempo">
        <h2 id="f-tempo">Linha do tempo</h2>
        {interacoes.length === 0 ? (
          <p className="ea-crm-vazio">Nenhuma interação registrada ainda.</p>
        ) : (
          <ol className="ea-crm-tempo">
            {interacoes.map((i) => (
              <li
                key={i.id}
                className={`ea-crm-tempo-item ea-crm-tempo-item--${i.direcao}`}
              >
                <div className="ea-crm-tempo-quando">
                  {dataHoraBr(new Date(i.data))}
                </div>
                <div className="ea-crm-tempo-corpo">
                  <div className="ea-crm-tempo-sinal">
                    <strong>{ROTULO_TIPO[i.tipo] ?? i.tipo}</strong>
                    <span>
                      {ROTULO_CANAL[i.canal] ?? i.canal} ·{" "}
                      {i.direcao === "entrada" ? "do lead" : "nosso"}
                    </span>
                    {i.pontos > 0 ? (
                      <span className="ea-crm-pontos">
                        +{i.pontos} {i.pontos === 1 ? "pt" : "pts"}
                      </span>
                    ) : null}
                  </div>
                  {i.conteudo ? <p>{i.conteudo}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
        {totalInteracoes > limite ? (
          <p className="ea-crm-nota">
            Mostrando as {limite} mais recentes de {totalInteracoes}.
          </p>
        ) : null}
      </section>
    </div>
  );
}
