"use client";

import { useState } from "react";
import Link from "next/link";
import type { Fila, ItemFila, SecaoFila } from "@/lib/crm/telas/fila";
import { deInputLocal, inicioDoDia, paraInputLocal } from "@/lib/crm/telas/tempo";
import { BotaoCopiar, Dialogo, DialogoMotivo, enviarAcao } from "./cliente";
import { SeloTemperatura } from "./compartilhado";
import { ProximoPasso } from "./FichaClient";

type Resultado = "atendeu" | "sem_resposta" | "reuniao_marcada" | "sem_interesse" | "enviado_linkedin" | "respondi";

const SECOES: { chave: keyof Fila; secao: SecaoFila; titulo: string; vazio: string }[] = [
  { chave: "respostas", secao: "resposta", titulo: "Respostas pendentes", vazio: "Nenhuma resposta esperando por você." },
  { chave: "engajados", secao: "engajado", titulo: "Engajados: ligue hoje", vazio: "Nenhum lead engajado para ligar." },
  { chave: "ligacoes", secao: "ligacao", titulo: "Ligações do dia", vazio: "Nenhuma ligação devida." },
  { chave: "reunioes", secao: "reuniao", titulo: "Reuniões de hoje", vazio: "Nenhuma reunião hoje." },
  { chave: "linkedin", secao: "linkedin", titulo: "Convites do LinkedIn", vazio: "Nenhum convite do LinkedIn para hoje." },
];

const BOTOES: Record<SecaoFila, [Resultado, string][]> = {
  resposta: [["respondi", "Já respondi"], ["reuniao_marcada", "Reunião marcada"], ["sem_interesse", "Sem interesse"]],
  engajado: [["atendeu", "Atendeu"], ["sem_resposta", "Sem resposta"], ["reuniao_marcada", "Reunião marcada"], ["sem_interesse", "Sem interesse"]],
  ligacao: [["atendeu", "Atendeu"], ["sem_resposta", "Sem resposta"], ["reuniao_marcada", "Reunião marcada"], ["sem_interesse", "Sem interesse"]],
  reuniao: [],
  linkedin: [["enviado_linkedin", "Enviado"]],
};

/** Canal que o resultado vale: a ligação nas seções de ligação, o canal da resposta nas respostas. */
const canalDaSecao = (i: ItemFila) => (i.secao === "linkedin" ? "linkedin" : i.secao === "resposta" ? i.canalResposta ?? "dm" : "ligacao");

type DialogoAberto = { item: ItemFila; tipo: "reuniao" | "interesse" } | null;

export function FilaClient({ fila, agoraIso }: { fila: Fila; agoraIso: string }) {
  const [restantes, setRestantes] = useState<Record<string, true>>(() =>
    Object.fromEntries(Object.values(fila).flatMap((l) => l.map((i) => [`${i.secao}:${i.leadId}`, true as const]))),
  );
  const [atendidos, setAtendidos] = useState<Record<number, true>>({});
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState<{ leadId: number; texto: string } | null>(null);
  const [dialogo, setDialogo] = useState<DialogoAberto>(null);
  const [quando, setQuando] = useState("");

  const chave = (i: ItemFila) => `${i.secao}:${i.leadId}`;
  const total = Object.keys(restantes).length;
  const concluir = (i: ItemFila) => setRestantes((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== chave(i))) as Record<string, true>);

  async function executar(i: ItemFila, resultado: Resultado, extra: Record<string, unknown> = {}) {
    setOcupado(i.leadId);
    setErro(null);
    const r = await enviarAcao({ acao: "resultado", leadId: i.leadId, resultado, canal: canalDaSecao(i), ...extra });
    setOcupado(null);
    if (!r.ok) {
      setErro({ leadId: i.leadId, texto: r.erro });
      return false;
    }
    setDialogo(null);
    if (resultado === "atendeu") setAtendidos((a) => ({ ...a, [i.leadId]: true }));
    else concluir(i);
    return true;
  }

  function clicar(i: ItemFila, resultado: Resultado) {
    if (resultado === "reuniao_marcada") {
      // Sugestão: amanhã às 10h, horário de Brasília.
      setQuando(paraInputLocal(new Date(inicioDoDia(new Date(agoraIso)).getTime() + 34 * 3_600_000)));
      return setDialogo({ item: i, tipo: "reuniao" });
    }
    if (resultado === "sem_interesse") return setDialogo({ item: i, tipo: "interesse" });
    void executar(i, resultado);
  }

  return (
    <div className="ea-crm-fila">
      <div className="ea-crm-fila-topo">
        <p className="ea-crm-resumo" aria-live="polite">
          {total === 0 ? "Fila do dia vazia. Nada pendente agora." : `${total} ${total === 1 ? "item" : "itens"} na fila`}
        </p>
        <button type="button" className="ea-crm-botao ea-crm-botao--suave" onClick={() => window.location.reload()}>
          Atualizar
        </button>
      </div>

      <nav className="ea-crm-fila-atalhos" aria-label="Seções da fila">
        {SECOES.map((s) => {
          const n = fila[s.chave].filter((i) => restantes[chave(i)]).length;
          return (
            <a key={s.chave} href={`#fila-${s.chave}`} className="ea-crm-aba">
              {s.titulo} <b>{n}</b>
            </a>
          );
        })}
      </nav>

      {SECOES.map((s) => {
        const itens = fila[s.chave].filter((i) => restantes[chave(i)]);
        return (
          <section key={s.chave} id={`fila-${s.chave}`} className="ea-crm-secao" aria-labelledby={`t-${s.chave}`}>
            <h2 id={`t-${s.chave}`}>
              {s.titulo} <span>{itens.length}</span>
            </h2>
            {itens.length === 0 ? <p className="ea-crm-vazio">{s.vazio}</p> : null}
            <ul className="ea-crm-itens">
              {itens.map((i) => (
                <li key={chave(i)} className="ea-crm-item">
                  <div className="ea-crm-item-cabeca">
                    <div>
                      <Link className="ea-crm-card-nome" href={`/eahub/crm/lead/${i.leadId}`}>
                        {i.nome}
                      </Link>
                      {i.empresa ? <div className="ea-crm-card-empresa">{i.empresa}</div> : null}
                    </div>
                    <SeloTemperatura temperatura={i.temperatura as "frio" | "morno" | "engajado"} pontos={i.pontos} />
                  </div>
                  <p className="ea-crm-item-motivo">
                    {i.motivo}
                    {i.desdeTexto ? <em> ({i.desdeTexto})</em> : null}
                  </p>
                  {i.mensagem ? <blockquote className="ea-crm-citacao">{i.mensagem}</blockquote> : null}
                  {i.ligacaoDevida ? <p className="ea-crm-nota">Também é a ligação do dia na cadência.</p> : null}
                  {i.proximoPasso ? <p className="ea-crm-nota">Próximo passo registrado: {i.proximoPasso}</p> : null}

                  <div className="ea-crm-item-contato">
                    {i.secao === "linkedin" && i.linkedinUrl ? (
                      <a className="ea-crm-botao ea-crm-botao--principal" href={i.linkedinUrl} target="_blank" rel="noopener noreferrer">
                        {i.linkedinDireto ? "Abrir perfil no LinkedIn" : "Buscar no LinkedIn"}
                      </a>
                    ) : null}
                    {i.secao !== "linkedin" && i.ligar ? (
                      <a className="ea-crm-botao ea-crm-botao--principal" href={i.ligar}>
                        Ligar
                      </a>
                    ) : null}
                    {i.secao !== "linkedin" && i.whatsapp ? (
                      <a className="ea-crm-botao ea-crm-botao--suave" href={i.whatsapp} target="_blank" rel="noopener noreferrer">
                        WhatsApp
                      </a>
                    ) : null}
                    {i.secao !== "linkedin" && i.instagram ? (
                      <a className="ea-crm-botao ea-crm-botao--suave" href={i.instagram} target="_blank" rel="noopener noreferrer">
                        Instagram
                      </a>
                    ) : null}
                    {i.secao === "linkedin" && i.notaLinkedin ? <BotaoCopiar texto={i.notaLinkedin} rotulo="Copiar nota" /> : null}
                    <Link className="ea-crm-botao ea-crm-botao--suave" href={`/eahub/crm/lead/${i.leadId}`}>
                      Ficha
                    </Link>
                  </div>

                  {i.secao === "linkedin" && i.notaLinkedin ? <blockquote className="ea-crm-citacao">{i.notaLinkedin}</blockquote> : null}
                  {i.secao === "linkedin" && !i.notaLinkedin ? <p className="ea-crm-nota">O kit deste lead não trouxe nota de LinkedIn. Escreva uma nota curta (até 200 caracteres).</p> : null}
                  {i.roteiro ? (
                    <details className="ea-crm-roteiro">
                      <summary>Roteiro da ligação</summary>
                      <p>{i.roteiro}</p>
                    </details>
                  ) : i.secao === "ligacao" || i.secao === "engajado" ? (
                    <p className="ea-crm-nota">Sem roteiro no kit deste lead ainda.</p>
                  ) : null}

                  {atendidos[i.leadId] ? (
                    <div className="ea-crm-atendido">
                      <p className="ea-crm-nota">Atendeu. Defina o próximo passo ou registre o desfecho.</p>
                      <ProximoPasso leadId={i.leadId} textoInicial={i.proximoPasso ?? null} emInicial={null} compacto aoSalvar={() => concluir(i)} />
                      <div className="ea-crm-resultados">
                        <button type="button" className="ea-crm-botao ea-crm-botao--suave" onClick={() => clicar(i, "reuniao_marcada")}>
                          Reunião marcada
                        </button>
                        <button type="button" className="ea-crm-botao ea-crm-botao--suave" onClick={() => clicar(i, "sem_interesse")}>
                          Sem interesse
                        </button>
                        <button type="button" className="ea-crm-botao ea-crm-botao--suave" onClick={() => concluir(i)}>
                          Concluir
                        </button>
                      </div>
                    </div>
                  ) : BOTOES[i.secao].length > 0 ? (
                    <div className="ea-crm-resultados" role="group" aria-label={`Resultado para ${i.nome}`}>
                      {BOTOES[i.secao].map(([r, rotulo]) => (
                        <button key={r} type="button" className="ea-crm-botao ea-crm-botao--resultado" disabled={ocupado === i.leadId} onClick={() => clicar(i, r)}>
                          {rotulo}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {erro?.leadId === i.leadId ? <p className="ea-crm-erro" role="alert">{erro.texto}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {dialogo?.tipo === "reuniao" ? (
        <Dialogo
          titulo={`Reunião de 20 minutos com ${dialogo.item.nome}`}
          confirmar="Marcar reunião"
          ocupado={ocupado === dialogo.item.leadId}
          desabilitarConfirmar={!deInputLocal(quando)}
          onCancelar={() => setDialogo(null)}
          onConfirmar={() => {
            const d = deInputLocal(quando);
            if (d) void executar(dialogo.item, "reuniao_marcada", { reuniaoEm: d.toISOString() });
          }}
        >
          <label className="ea-crm-campo">
            <span>Dia e horário (Brasília)</span>
            <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} autoFocus />
          </label>
          {erro?.leadId === dialogo.item.leadId ? <p className="ea-crm-erro" role="alert">{erro.texto}</p> : null}
        </Dialogo>
      ) : null}
      {dialogo?.tipo === "interesse" ? (
        <DialogoMotivo
          titulo={`${dialogo.item.nome}: sem interesse agora`}
          destino="nutricao_continua"
          confirmar="Mandar para Nutrição contínua"
          ocupado={ocupado === dialogo.item.leadId}
          erro={erro?.leadId === dialogo.item.leadId ? erro.texto : null}
          onCancelar={() => setDialogo(null)}
          onConfirmar={(motivo, detalhe) => void executar(dialogo.item, "sem_interesse", { motivo, detalhe })}
        />
      ) : null}
    </div>
  );
}
