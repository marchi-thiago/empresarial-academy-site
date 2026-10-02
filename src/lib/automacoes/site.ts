import { envioRealLigado, lerCaixaLigado } from "@/lib/outbound/config";
import { pausaPorBounce } from "@/lib/outbound/plano";
import { emBrasilia, partesBr, somarDias, dataIso } from "@/lib/outbound/tempo";
import { formatarDuracao, HORA_MS, montarAutomacao, type Automacao, type EntradaDeEstado, type NumeroDaAutomacao } from "./estado";

/**
 * Automações do SITE (EA Leads) no formato padrão do Painel de Automações.
 *
 * Função pura: recebe os números já agregados (`DadosDoSite`, lidos do banco só quando o painel é aberto)
 * e as variáveis de ambiente, e devolve cada automação com cor, motivo e números de hoje e da semana.
 */

/** Uma linha do agrupamento da tabela `interacoes` (ver `dados.ts`). Só conta o que o painel precisa. */
export interface LinhaAgregada {
  canal: string;
  direcao: string;
  tipo: string;
  /** `metadados.simulado === true`: o orquestrador gravou, mas nada saiu de verdade. */
  simulado: boolean;
  /** Partes da chave de idempotência: `out:email:...` vira p1 `out`, p2 `email`. */
  p1: string;
  p2: string;
  hoje: number;
  semana: number;
  ultimas24h: number;
  ultima: Date | null;
}

export interface RodadaDoOrquestrador {
  em: Date;
  modo: string | null;
  /** Rodadas por dia (`AAAA-MM-DD` de Brasília), últimos 8 dias. */
  contagem: Record<string, number>;
  /** Rotinas que rodaram nesta rodada. */
  rotinas: string[];
  /** Rotinas que falharam nesta rodada, com o texto do erro. */
  erros: Record<string, string>;
}

export interface DadosDoSite {
  linhas: LinhaAgregada[];
  leadsEmCadencia: number;
  leadsEngajados: number;
  emailsAtrasados48h: number;
  ligacoesNaFila: number;
  ligacoesAtrasadas48h: number;
  linkedinNaFila: number;
  linkedinAtrasados48h: number;
  rodada: RodadaDoOrquestrador | null;
}

type Env = Record<string, string | undefined>;
type Filtro = Partial<Pick<LinhaAgregada, "canal" | "direcao" | "tipo" | "simulado" | "p1" | "p2">> & { canais?: string[]; tipos?: string[] };

function filtrar(linhas: readonly LinhaAgregada[], f: Filtro): LinhaAgregada[] {
  return linhas.filter(
    (l) =>
      (f.canal === undefined || l.canal === f.canal) &&
      (f.canais === undefined || f.canais.includes(l.canal)) &&
      (f.direcao === undefined || l.direcao === f.direcao) &&
      (f.tipo === undefined || l.tipo === f.tipo) &&
      (f.tipos === undefined || f.tipos.includes(l.tipo)) &&
      (f.simulado === undefined || l.simulado === f.simulado) &&
      (f.p1 === undefined || l.p1 === f.p1) &&
      (f.p2 === undefined || l.p2 === f.p2),
  );
}

const somar = (ls: LinhaAgregada[], campo: "hoje" | "semana" | "ultimas24h"): number => ls.reduce((s, l) => s + l[campo], 0);

function ultimaDe(ls: LinhaAgregada[]): Date | null {
  let u: Date | null = null;
  for (const l of ls) if (l.ultima && (!u || l.ultima > u)) u = l.ultima;
  return u;
}

/** Número com hoje e semana de um filtro. */
function num(dados: DadosDoSite, rotulo: string, f: Filtro): NumeroDaAutomacao {
  const ls = filtrar(dados.linhas, f);
  return { rotulo, hoje: somar(ls, "hoje"), semana: somar(ls, "semana") };
}

const primeiro = (...t: Array<string | null | undefined | false>): string | null => t.find((x): x is string => Boolean(x)) ?? null;

/* -------------------------- relógio do horário comercial -------------------------- */

/** Segunda a sexta, das 8h às 18h de Brasília (a janela em que o Hunter chama o orquestrador). */
function emJanelaComercial(agora: Date): boolean {
  const p = partesBr(agora);
  return p.diaSemana >= 1 && p.diaSemana <= 5 && p.hora >= 8 && p.hora < 18;
}

/** O fim (18h) da janela comercial mais recente que já terminou. */
function fimDaUltimaJanela(agora: Date): Date {
  let d = agora;
  for (let i = 0; i < 10; i++) {
    const p = partesBr(d);
    const fim = emBrasilia(dataIso(d), "18:00");
    if (p.diaSemana >= 1 && p.diaSemana <= 5 && fim <= agora) return fim;
    d = somarDias(d, -1);
  }
  return agora;
}

/**
 * Quanto tempo a rotina está atrasada, em ms (0 = no prazo). O Hunter chama o orquestrador a cada 5 min só em
 * horário comercial; por isso o prazo conta dentro da janela, e fora dela vale a última rodada da janela anterior.
 */
export function atrasoComercial(agora: Date, ultima: Date | null, folgaMs = 30 * 60_000): number {
  if (!ultima) return 0;
  if (emJanelaComercial(agora)) {
    const inicio = emBrasilia(dataIso(agora), "08:00");
    const ref = ultima > inicio ? ultima : inicio;
    return Math.max(0, agora.getTime() - ref.getTime() - folgaMs);
  }
  return Math.max(0, fimDaUltimaJanela(agora).getTime() - ultima.getTime() - folgaMs);
}

/* -------------------------------------- automações -------------------------------------- */

const erroDe = (d: DadosDoSite, rotinas: string[], agora: Date): string | null => {
  const r = d.rodada;
  if (!r || agora.getTime() - r.em.getTime() > 24 * HORA_MS) return null;
  const nome = rotinas.find((x) => r.erros[x]);
  return nome ? `a rotina "${nome}" falhou na última rodada: ${r.erros[nome]}` : null;
};

export function montarAutomacoesDoSite(dados: DadosDoSite, agora: Date, env: Env): Automacao[] {
  const itens: Automacao[] = [];
  const grupo = "Cadência e CRM" as const;
  const base = { sistema: "site" as const, grupo };
  const hoje = dataIso(agora);
  const emailReal = envioRealLigado("email", env);
  const graphOk = Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET && env.MICROSOFT_REFRESH_TOKEN);
  const semGraph = "falta a conexão com o Outlook (MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET ou MICROSOFT_REFRESH_TOKEN)";
  const simulacao = "em simulação: o envio real de e-mail está desligado (OUTBOUND_ENVIO_REAL)";
  const rodada = dados.rodada;

  // 1. Orquestrador da cadência
  {
    const contagem = rodada?.contagem ?? {};
    let semana = 0;
    for (let i = 0; i < 7; i++) semana += contagem[dataIso(somarDias(agora, -i))] ?? 0;
    const atraso = atrasoComercial(agora, rodada?.em ?? null);
    const entrada: EntradaDeEstado = {
      agora,
      semChave: env.CRON_SECRET ? null : "falta a chave CRON_SECRET no site",
      semSinal: !rodada
        ? "ainda não rodou (o chamador do Hunter ainda não chegou ao site)"
        : atraso > 0
          ? `sem rodar há ${formatarDuracao(agora.getTime() - rodada.em.getTime())}: o chamador do Hunter, no PC, não chamou o site no horário comercial`
          : null,
      ultimaExecucao: rodada?.em ?? null,
      erroRecente: erroDe(dados, rodada?.rotinas ?? [], agora),
      filaTravada: emailReal && dados.emailsAtrasados48h > 0 ? `${dados.emailsAtrasados48h} leads com e-mail atrasado há mais de 48 h` : null,
    };
    itens.push(
      montarAutomacao(
        {
          id: "site-orquestrador",
          nome: "Orquestrador da cadência",
          ...base,
          numeros: [
            { rotulo: "Rodadas", hoje: contagem[hoje] ?? 0, semana },
            { rotulo: "Leads em cadência (agora)", hoje: dados.leadsEmCadencia, semana: null },
          ],
        },
        entrada,
      ),
    );
  }

  // 2. E-mail frio
  {
    const email = { canal: "email", simulado: false } as const;
    const enviados = filtrar(dados.linhas, { ...email, direcao: "saida", tipo: "enviado" });
    const bounces = filtrar(dados.linhas, { ...email, tipo: "bounce" });
    const falhas = filtrar(dados.linhas, { ...email, tipo: "falha" });
    const enviadosHoje = somar(enviados, "hoje");
    const bouncesHoje = somar(bounces, "hoje");
    itens.push(
      montarAutomacao(
        {
          id: "site-email-frio",
          nome: "E-mail frio",
          ...base,
          numeros: [
            num(dados, "Enviados", { ...email, direcao: "saida", tipo: "enviado" }),
            num(dados, "Entregues", { ...email, tipo: "entregue" }),
            num(dados, "Abertos", { ...email, tipo: "aberto" }),
            num(dados, "Cliques", { ...email, tipo: "clicado" }),
            num(dados, "Respostas", { ...email, direcao: "entrada", tipo: "respondido" }),
            num(dados, "Bounces", { ...email, tipo: "bounce" }),
            num(dados, "Simulados (não saíram)", { canal: "email", simulado: true, direcao: "saida", tipo: "enviado" }),
          ],
        },
        {
          agora,
          simulacao: emailReal ? null : simulacao,
          semChave: emailReal && !graphOk ? semGraph : null,
          ultimaExecucao: ultimaDe(enviados),
          erroRecente: primeiro(
            pausaPorBounce(enviadosHoje, bouncesHoje) && `bounce alto hoje (${bouncesHoje} de ${enviadosHoje}): o envio do dia foi pausado`,
            somar(falhas, "ultimas24h") > 0 && `${somar(falhas, "ultimas24h")} e-mails falharam nas últimas 24 h`,
          ),
          filaTravada: emailReal && dados.emailsAtrasados48h > 0 ? `${dados.emailsAtrasados48h} leads com e-mail atrasado há mais de 48 h` : null,
        },
      ),
    );
  }

  // 3. Leitura da caixa comercial@
  {
    const caixa = { p1: "caixa", simulado: false } as const;
    const lida = rodada?.rotinas.includes("caixa") ? rodada.em : null;
    const atraso = atrasoComercial(agora, lida);
    itens.push(
      montarAutomacao(
        {
          id: "site-caixa",
          nome: "Leitura da caixa comercial@",
          ...base,
          numeros: [num(dados, "Respostas lidas", { ...caixa, tipo: "respondido" }), num(dados, "Bounces lidos", { ...caixa, tipo: "bounce" })],
        },
        {
          agora,
          desligada: lerCaixaLigado(env) ? null : "leitura da caixa desligada (OUTBOUND_LER_CAIXA); falta o consentimento Mail.Read.Shared no Outlook",
          semChave: graphOk ? null : semGraph,
          semSinal: lerCaixaLigado(env) && graphOk && rodada && atraso > 0 ? `a caixa não é lida há ${formatarDuracao(agora.getTime() - (lida ?? rodada.em).getTime())}` : null,
          ultimaExecucao: lida,
          erroRecente: erroDe(dados, ["caixa"], agora),
        },
      ),
    );
  }

  // 4 e 5. Filas de ligação e de LinkedIn (manuais: o sistema só prepara a fila, quem age é o Thiago)
  {
    const lig = filtrar(dados.linhas, { canal: "ligacao", tipo: "resultado_ligacao", simulado: false });
    itens.push(
      montarAutomacao(
        {
          id: "site-fila-ligacao",
          nome: "Fila de ligação (manual)",
          ...base,
          numeros: [
            num(dados, "Ligações registradas", { canal: "ligacao", tipo: "resultado_ligacao", simulado: false }),
            { rotulo: "Na fila (agora)", hoje: dados.ligacoesNaFila, semana: null },
          ],
        },
        {
          agora,
          ultimaExecucao: ultimaDe(lig),
          filaTravada: dados.ligacoesAtrasadas48h > 0 ? `${dados.ligacoesAtrasadas48h} ligações esperando há mais de 48 h na Fila do dia` : null,
        },
      ),
    );
    const lin = filtrar(dados.linhas, { canal: "linkedin", tipo: "enviado", simulado: false });
    itens.push(
      montarAutomacao(
        {
          id: "site-fila-linkedin",
          nome: "Fila do LinkedIn (manual)",
          ...base,
          numeros: [
            num(dados, "Convites marcados como enviados", { canal: "linkedin", tipo: "enviado", simulado: false }),
            { rotulo: "Na fila (agora)", hoje: dados.linkedinNaFila, semana: null },
          ],
        },
        {
          agora,
          ultimaExecucao: ultimaDe(lin),
          filaTravada: dados.linkedinAtrasados48h > 0 ? `${dados.linkedinAtrasados48h} convites esperando há mais de 48 h na fila do LinkedIn` : null,
        },
      ),
    );
  }

  // 6. Rastreio e página /conversa
  {
    const abriu = filtrar(dados.linhas, { tipo: "abriu_pagina" });
    const play = filtrar(dados.linhas, { tipo: "deu_play" });
    const agendou = filtrar(dados.linhas, { tipo: "agendou", simulado: false });
    itens.push(
      montarAutomacao(
        {
          id: "site-rastreio",
          nome: "Rastreio e página /conversa",
          ...base,
          numeros: [
            num(dados, "Aberturas da página", { tipo: "abriu_pagina" }),
            num(dados, "Plays do vídeo", { tipo: "deu_play" }),
            num(dados, "Agendamentos", { tipo: "agendou", simulado: false }),
          ],
        },
        { agora, ultimaExecucao: ultimaDe([...abriu, ...play, ...agendou]) },
      ),
    );
  }

  // 7. Temperatura e engajamento (recalculada uma vez por dia útil, dentro do orquestrador)
  {
    const temperatura = ultimaDe(filtrar(dados.linhas, { p1: "rotina", p2: "temperatura" }));
    itens.push(
      montarAutomacao(
        {
          id: "site-temperatura",
          nome: "Temperatura e engajamento",
          ...base,
          numeros: [
            { rotulo: "Leads engajados (agora)", hoje: dados.leadsEngajados, semana: null },
            num(dados, "Recálculos", { p1: "rotina", p2: "temperatura" }),
          ],
        },
        {
          agora,
          ultimaExecucao: temperatura,
          // Roda uma vez por dia útil; de sexta a segunda cabem 3 dias.
          prazoMs: 80 * HORA_MS,
          erroRecente: erroDe(dados, ["temperatura"], agora),
        },
      ),
    );
  }

  // 8. Lembretes e follow-up (mensagens ao lead; seguem o envio real)
  {
    const lembretes = filtrar(dados.linhas, { p1: "lembrete", canais: ["email", "whatsapp"] });
    const follow = filtrar(dados.linhas, { p1: "followup" });
    itens.push(
      montarAutomacao(
        {
          id: "site-lembretes-followup",
          nome: "Lembretes e follow-up",
          ...base,
          numeros: [
            num(dados, "Lembretes de reunião enviados", { p1: "lembrete", canais: ["email", "whatsapp"], simulado: false }),
            num(dados, "Follow-ups da proposta", { p1: "followup" }),
            num(dados, "Registrados em simulação", { p1: "lembrete", canais: ["email", "whatsapp"], simulado: true }),
          ],
        },
        {
          agora,
          simulacao: emailReal ? null : "em simulação: os lembretes e follow-ups só são registrados, não saem (envio real desligado)",
          ultimaExecucao: ultimaDe([...lembretes, ...follow].filter((l) => !l.simulado)),
          erroRecente: erroDe(dados, ["lembretes", "followUps"], agora),
        },
      ),
    );
  }

  // 9. Ficha pré-reunião (aviso ao Thiago, não depende do envio real)
  {
    const fichas = filtrar(dados.linhas, { p1: "ficha" });
    itens.push(
      montarAutomacao(
        { id: "site-ficha-pre-reuniao", nome: "Ficha pré-reunião", ...base, numeros: [num(dados, "Fichas geradas", { p1: "ficha" })] },
        { agora, ultimaExecucao: ultimaDe(fichas), erroRecente: erroDe(dados, ["lembretes"], agora) },
      ),
    );
  }

  // 10. Revisão semanal e testes A/B (uma por semana, a partir de segunda 8h)
  {
    const revisoes = filtrar(dados.linhas, { p1: "revisao", p2: "semanal" });
    const ultima = ultimaDe(revisoes);
    itens.push(
      montarAutomacao(
        {
          id: "site-revisao-semanal",
          nome: "Revisão semanal e testes A/B",
          ...base,
          numeros: [{ rotulo: "Revisões geradas", hoje: somar(revisoes, "hoje"), semana: somar(revisoes, "semana") }],
        },
        {
          agora,
          ultimaExecucao: ultima,
          prazoMs: 8 * 24 * HORA_MS,
          erroRecente: erroDe(dados, ["revisaoSemanal"], agora),
        },
      ),
    );
    // A primeira revisão ainda não existe: explica quando vem, em vez de só "ainda não rodou".
    const ultimoItem = itens[itens.length - 1]!;
    if (!ultima && ultimoItem.motivo === "ainda não rodou") ultimoItem.motivo = "ainda não rodou (a primeira sai na segunda-feira, a partir das 8h, quando o chamador do Hunter estiver ativo)";
  }

  return itens;
}
