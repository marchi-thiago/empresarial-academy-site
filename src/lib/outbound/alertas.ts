import { avisarThiago } from "@/lib/ea-flow-bridge";
import type { Deps, OutboundDb } from "./orquestrador";
import { dataIso, partesBr } from "./tempo";

/**
 * Alertas operacionais do Outbound (F12).
 *
 * Verificações periódicas executadas pelo orquestrador (/api/cron/outbound):
 * 1. Sem sinal de vida do Hunter (sem heartbeat por mais de 30 min em horário comercial).
 * 2. Falha de sincronização do Hunter para o EA Leads (sem sincronização há mais de 3h em horário comercial).
 * 3. Taxa de bounce de e-mail acima de 3% no dia.
 * 4. Fila travada (leads em cadência com próximo toque atrasado há mais de 48h).
 * 5. Teto diário de IA atingido no Hunter.
 *
 * Notificação enviada ao Thiago via WhatsApp comercial (POST /api/avisos/dono do EA Flow).
 * Deduplicação por cooldown de episódio: não repete aviso no WhatsApp a cada ciclo de 10 minutos.
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

  // 1. Sem sinal de vida do Hunter (30 min sem heartbeat em horário comercial)
  if (comercial) {
    const semSinal = !dados.ultimoHeartbeat || agora.getTime() - dados.ultimoHeartbeat.getTime() > 30 * 60_000;
    if (semSinal) {
      const ultimoStr = dados.ultimoHeartbeat ? dados.ultimoHeartbeat.toISOString() : "nenhum sinal registrado";
      disparados.push({
        tipo: "sem_sinal_hunter",
        titulo: "Sem sinal de vida do Hunter",
        mensagem:
          `⚠️ Alerta Outbound: Sem sinal de vida do EA Hunter há mais de 30 minutos em horário comercial (último sinal: ${ultimoStr}).\n` +
          `Verifique se o computador do Thiago está ligado e se o worker do Hunter está em execução.`,
        severidade: "critica",
        dados: { ultimoHeartbeat: dados.ultimoHeartbeat?.toISOString() ?? null },
      });
    }
  }

  // 2. Falha de sincronização com o Hunter (mais de 3h sem sync em horário comercial)
  if (comercial) {
    const semSync = !dados.ultimaSync || agora.getTime() - dados.ultimaSync.getTime() > 3 * 3_600_000;
    if (semSync) {
      const ultimaStr = dados.ultimaSync ? dados.ultimaSync.toISOString() : "nenhuma sincronização recente";
      disparados.push({
        tipo: "falha_sync_hunter",
        titulo: "Falha de sincronização Hunter -> EA Leads",
        mensagem:
          `⚠️ Alerta Outbound: EA Hunter sem sincronização com o EA Leads há mais de 3 horas (última: ${ultimaStr}).\n` +
          `Verifique a conexão de rede ou a string de conexão com o banco Neon no Hunter.`,
        severidade: "critica",
        dados: { ultimaSync: dados.ultimaSync?.toISOString() ?? null },
      });
    }
  }

  // 3. Bounce de e-mail acima de 3%
  const total = dados.enviosHoje;
  const bounces = dados.bouncesHoje;
  const taxaBounce = total > 0 ? bounces / total : 0;
  const bounceAlto = bounces >= 2 && (total < 10 || taxaBounce > 0.03);
  if (bounceAlto) {
    const perc = (taxaBounce * 100).toFixed(1);
    disparados.push({
      tipo: "bounce_alto",
      titulo: "Bounce de e-mail acima de 3%",
      mensagem:
        `⚠️ Alerta Outbound: Taxa de bounce de e-mail em ${perc}% (${bounces} bounces em ${total} envios hoje).\n` +
        `O envio real foi pausado automaticamente para proteção da reputação do domínio.`,
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
        `⚠️ Alerta Outbound: ${dados.leadsTravados} lead(s) em cadência estão com o próximo toque atrasado há mais de 48 horas.\n` +
        `Verifique se os despachantes dos canais (Hunter, WhatsApp, Fila do dia) estão operando.`,
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
        `⚠️ Alerta Outbound: Teto diário de chamadas de IA atingido no EA Hunter (${dados.chamadasIa ?? "N/A"} de ${dados.tetoIa ?? "N/A"}).\n` +
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

  // 3. Obter envios e bounces de e-mail de hoje
  const inicioHoje = new Date(agora);
  inicioHoje.setUTCHours(0, 0, 0, 0);
  const enviosHoje = (await db.enviosDeEmail(inicioHoje)).length;
  const bouncesHoje = await db.bouncesDeEmail(inicioHoje);

  // 4. Obter leads travados na cadência (> 48h de atraso)
  const desde = new Date(agora.getTime() - 21 * 86_400_000);
  const candidatos = await db.candidatos(desde);
  const limite48h = agora.getTime() - 48 * 3_600_000;
  let leadsTravados = 0;
  for (const c of candidatos) {
    if (c.etapa === "em_cadencia" && !c.pausada) {
      if (c.agendaGravada.em && c.agendaGravada.em.getTime() < limite48h) {
        leadsTravados++;
      } else if (!c.agendaGravada.em && c.primeiroToqueEm && c.primeiroToqueEm.getTime() < limite48h) {
        leadsTravados++;
      }
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
        const gravar = (db as OutboundDb & { gravarMarcador?: (k: string, m: Record<string, unknown>, d?: Date) => Promise<void> }).gravarMarcador;
        if (gravar) {
          await gravar.call(db, chaveNotif, { disparadoEm: agora.toISOString(), mensagem: alerta.mensagem }, agora);
        } else {
          await db.criarMarcador(chaveNotif, { disparadoEm: agora.toISOString(), mensagem: alerta.mensagem });
        }
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
