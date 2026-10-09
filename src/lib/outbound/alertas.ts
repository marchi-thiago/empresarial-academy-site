import { avisarThiago } from "@/lib/ea-flow-bridge";
import { envioRealLigado } from "./config";
import type { Deps } from "./orquestrador";
import { pausaPorBounce } from "./plano";
import { dataIso, inicioDoDia, partesBr } from "./tempo";

/**
 * Alertas operacionais do Outbound (F12).
 *
 * Verificações periódicas executadas pelo orquestrador (/api/cron/outbound):
 * 1. Sem sinal de vida do Hunter (último heartbeat há mais de 30 min em horário comercial; sem nenhum heartbeat recebido, não alarma).
 * 2. Falha de sincronização do Hunter para o EA Leads (sincronização informada há mais de 3h em horário comercial).
 *    Só vale depois que o Hunter informa `ultima_sincronizacao` no heartbeat; sem esse dado o alerta fica quieto
 *    (não dá para saber, e alarmar por falta de dado seria alarme falso todo dia).
 * 3. Bounce de e-mail acima de 3% no dia (a mesma regra `pausaPorBounce` que pausa o envio do dia).
 * 4. Fila travada (e-mails de cadência com envio real ligado e toque atrasado há mais de 48h).
 * 5. Teto diário de IA atingido no Hunter.
 *
 * Limite conhecido: o orquestrador é chamado pelo worker do Hunter. Se o Hunter cai, a rodada para e o alerta 1
 * deixa de ser avaliado aqui; quem cobre esse caso é o monitor externo de heartbeat (PENDENCIAS-THIAGO.md, item 9)
 * ou uma chamada de `/api/cron/outbound` vinda de outro lugar.
 *
 * Notificação enviada ao Thiago via WhatsApp comercial (POST /api/avisos/dono do EA Flow).
 * Deduplicação por cooldown de episódio por tipo (4h a 12h): não repete aviso a cada rodada de 5 minutos.
 */

export type TipoAlerta =
  | "sem_sinal_hunter"
  | "falha_sync_hunter"
  | "bounce_alto"
  | "fila_travada"
  | "teto_ia_hunter";

export interface AlertaDisparado {
  tipo: TipoAlerta;
  titulo: string;
  mensagem: string;
  severidade: "critica" | "aviso";
  dados?: Record<string, unknown>;
}

export interface DadosAvaliacaoAlertas {
  agora: Date;
  emHorarioComercial?: boolean;
  ultimoHeartbeat?: Date | null;
  ultimaSync?: Date | null;
  enviosHoje: number;
  bouncesHoje: number;
  leadsTravados: number;
  tetoIaAtingido?: boolean;
  chamadasIa?: number;
  tetoIa?: number;
}

export interface ResultadoAlertas {
  avaliados: number;
  disparados: AlertaDisparado[];
  notificados: TipoAlerta[];
  emHorarioComercial: boolean;
}

/** Cooldowns de renotificação para não incomodar no WhatsApp (em milissegundos). */
export const COOLDOWNS_MS: Record<TipoAlerta, number> = {
  sem_sinal_hunter: 4 * 3_600_000, // 4 horas
  falha_sync_hunter: 4 * 3_600_000, // 4 horas
  bounce_alto: 6 * 3_600_000, // 6 horas
  fila_travada: 6 * 3_600_000, // 6 horas
  teto_ia_hunter: 12 * 3_600_000, // 12 horas (1x por dia)
};

/**
 * Horário comercial da EA: segunda a sexta, das 8h às 18h de Brasília (UTC-3).
 */
export function emHorarioComercial(agora: Date): boolean {
  const p = partesBr(agora);
  // Segunda (1) a Sexta (5), das 08h00 às 17h59
  return p.diaSemana >= 1 && p.diaSemana <= 5 && p.hora >= 8 && p.hora < 18;
}

/**
 * Avaliação pura dos 5 alertas operacionais. Fácil de testar sem I/O ou banco.
 */
export function avaliarAlertas(dados: DadosAvaliacaoAlertas): AlertaDisparado[] {
  const { agora } = dados;
  const comercial = dados.emHorarioComercial ?? emHorarioComercial(agora);
  const disparados: AlertaDisparado[] = [];

  // 1. Sem sinal de vida do Hunter (30 min sem heartbeat em horário comercial). Sem nenhum heartbeat já recebido o
  // Hunter ainda não foi configurado para mandá-lo: não alarma (o orquestrador mesmo roda por chamada do Hunter).
  if (comercial && dados.ultimoHeartbeat) {
    const semSinal = agora.getTime() - dados.ultimoHeartbeat.getTime() > 30 * 60_000;
    if (semSinal) {
      const ultimoStr = dados.ultimoHeartbeat.toISOString();
      disparados.push({
        tipo: "sem_sinal_hunter",
        titulo: "Sem sinal de vida do Hunter",
        mensagem:
          `Alerta Outbound: Sem sinal de vida do EA Hunter há mais de 30 minutos em horário comercial (último sinal: ${ultimoStr}).\n` +
          `Verifique se o computador do Thiago está ligado e se o worker do Hunter está em execução.`,
        severidade: "critica",
        dados: { ultimoHeartbeat: dados.ultimoHeartbeat.toISOString() },
      });
    }
  }

  // 2. Falha de sincronização com o Hunter (mais de 3h sem sync em horário comercial).
  // Sem `ultimaSync` não há como saber: não alarma.
  if (comercial && dados.ultimaSync) {
    const semSync = agora.getTime() - dados.ultimaSync.getTime() > 3 * 3_600_000;
    if (semSync) {
      const ultimaStr = dados.ultimaSync.toISOString();
      disparados.push({
        tipo: "falha_sync_hunter",
        titulo: "Falha de sincronização do Hunter com o EA Leads",
        mensagem:
          `Alerta Outbound: EA Hunter sem sincronização com o EA Leads há mais de 3 horas (última: ${ultimaStr}).\n` +
          `Verifique a conexão de rede ou a string de conexão com o banco Neon no Hunter.`,
        severidade: "critica",
        dados: { ultimaSync: dados.ultimaSync.toISOString() },
      });
    }
  }

  // 3. Bounce de e-mail acima de 3%
  const total = dados.enviosHoje;
  const bounces = dados.bouncesHoje;
  const taxaBounce = total > 0 ? bounces / total : 0;
  if (pausaPorBounce(total, bounces)) {
    const perc = (taxaBounce * 100).toFixed(1);
    disparados.push({
      tipo: "bounce_alto",
      titulo: "Bounce de e-mail acima de 3%",
      mensagem:
        `Alerta Outbound: Taxa de bounce de e-mail em ${perc}% (${bounces} bounces em ${total} envios hoje).\n` +
        `O envio NÃO pausa por bounce (decisão do dono): segue até o teto do dia. Acompanhe a reputação do domínio.`,
      severidade: "critica",
      dados: { enviosHoje: total, bouncesHoje: bounces, taxa: taxaBounce },
    });
  }

  // 4. Fila travada (N leads em cadência sem toque há mais de 48h)
  if (dados.leadsTravados > 0) {
    disparados.push({
      tipo: "fila_travada",
      titulo: "Fila do outbound travada",
      mensagem:
        `Alerta Outbound: ${dados.leadsTravados} lead(s) em cadência estão com o e-mail atrasado há mais de 48 horas.\n` +
        `Verifique se o chamador de /api/cron/outbound está rodando e se o envio de e-mail não está pausado (bounce, teto ou janela).`,
      severidade: "aviso",
      dados: { leadsTravados: dados.leadsTravados },
    });
  }

  // 5. Teto de IA atingido no Hunter
  if (dados.tetoIaAtingido) {
    disparados.push({
      tipo: "teto_ia_hunter",
      titulo: "Teto de IA do Hunter atingido",
      mensagem:
        `Alerta Outbound: Teto diário de chamadas de IA atingido no EA Hunter (${dados.chamadasIa ?? "N/A"} de ${dados.tetoIa ?? "N/A"}).\n` +
        `Geração de novos dossiês e kits pausada até a meia-noite.`,
      severidade: "aviso",
      dados: { chamadasIa: dados.chamadasIa, tetoIa: dados.tetoIa },
    });
  }

  return disparados;
}

/**
 * Lê data a partir de string ISO ou Date.
 */
function parseData(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Executa a verificação completa de alertas e envia notificações ao Thiago com deduplicação.
 */
export async function verificarAlertas(
  d: Deps,
  opcoes: { forcarAviso?: boolean; avisarFn?: (texto: string) => Promise<boolean> } = {},
): Promise<ResultadoAlertas> {
  const { db, agora } = d;
  const avisar = opcoes.avisarFn ?? d.avisar ?? avisarThiago;
  const comercial = emHorarioComercial(agora);

  // 1. Obter estado do Heartbeat do Hunter
  const metaHeartbeat = await db.lerMarcador("sistema:heartbeat:hunter");
  const dataHeartbeat = parseData(metaHeartbeat?.recebidoEm ?? metaHeartbeat?.at ?? metaHeartbeat?.data);

  // 2. Obter estado da última sincronização
  const metaSync = await db.lerMarcador("sistema:sync:hunter");
  const dataSync = parseData(metaSync?.ultimaSincronizacao ?? metaSync?.at ?? metaSync?.data);

  // 3. Obter envios e bounces de e-mail de hoje (dia de Brasília, o mesmo do plano de envio)
  const inicioHoje = inicioDoDia(agora);
  const enviosHoje = (await db.enviosDeEmail(inicioHoje)).length;
  const bouncesHoje = await db.bouncesDeEmail(inicioHoje);

  // 4. Leads travados: só e-mail com envio real ligado. Em simulação o e-mail nunca sai (não é fila travada) e os
  // outros canais são do Hunter (coberto pelo sinal de vida), do EA Flow ou da Fila do dia (ação do Thiago).
  let leadsTravados = 0;
  if (envioRealLigado("email", d.env)) {
    const candidatos = await db.candidatos(new Date(agora.getTime() - 21 * 86_400_000));
    const limite48h = agora.getTime() - 48 * 3_600_000;
    for (const c of candidatos) {
      if (c.etapa !== "em_cadencia" || c.pausada || c.agendaGravada.canal !== "email") continue;
      if (c.agendaGravada.em && c.agendaGravada.em.getTime() < limite48h) leadsTravados++;
    }
  }

  // 5. Obter teto de IA atingido hoje
  const chaveTetoHoje = `sistema:ia_teto:${dataIso(agora)}`;
  const metaTeto = await db.lerMarcador(chaveTetoHoje);
  const tetoIaAtingido = Boolean(metaTeto || metaHeartbeat?.ia_teto_atingido);
  const chamadasIa = typeof metaTeto?.chamadas === "number" ? metaTeto.chamadas : (metaHeartbeat?.chamadas_ia as number | undefined);
  const tetoIa = typeof metaTeto?.teto === "number" ? metaTeto.teto : (metaHeartbeat?.teto_ia as number | undefined);

  // Avaliação
  const disparados = avaliarAlertas({
    agora,
    emHorarioComercial: comercial,
    ultimoHeartbeat: dataHeartbeat,
    ultimaSync: dataSync,
    enviosHoje,
    bouncesHoje,
    leadsTravados,
    tetoIaAtingido,
    chamadasIa,
    tetoIa,
  });

  const notificados: TipoAlerta[] = [];

  // Disparo com verificação de cooldown
  for (const alerta of disparados) {
    const chaveNotif = `alerta:notificado:${alerta.tipo}`;
    const metaNotif = await db.lerMarcador(chaveNotif);
    const ultimaNotifEm = parseData(metaNotif?.disparadoEm ?? metaNotif?.data);

    const cooldown = COOLDOWNS_MS[alerta.tipo];
    const emCooldown = !opcoes.forcarAviso && ultimaNotifEm && agora.getTime() - ultimaNotifEm.getTime() < cooldown;

    if (!emCooldown) {
      const enviou = await avisar(alerta.mensagem);
      if (enviou) {
        notificados.push(alerta.tipo);
        // Atualiza ou cria o marcador para aplicar o cooldown
        const meta = { disparadoEm: agora.toISOString(), mensagem: alerta.mensagem };
        if (db.gravarMarcador) await db.gravarMarcador(chaveNotif, meta, agora);
        else await db.criarMarcador(chaveNotif, meta);
      }
    }
  }

  return {
    avaliados: disparados.length,
    disparados,
    notificados,
    emHorarioComercial: comercial,
  };
}
