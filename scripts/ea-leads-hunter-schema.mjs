/**
 * EA Leads recebe os leads do EA Hunter (28/09/2026):
 *  - leads: e-mail opcional; colunas area_atuacao, site, hunter_id (único), prospectado_em
 *  - email_templates: texto livre por etapa + "ativo" (jornada por área de atuação)
 *  - modelos area:* com o texto que existia no fluxo de e-mail do EA Flow
 *    (C:\dev\ea-flow\scripts\criar-fluxo-nutricao-email.mjs), todos DESLIGADOS.
 *
 * Idempotente. Nunca sobrescreve modelo já editado (ON CONFLICT DO NOTHING).
 * Rodar ANTES do deploy que traz os campos novos. Uso: node scripts/ea-leads-hunter-schema.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uri = fs
  .readFileSync(path.join(ROOT, ".env.production.local"), "utf8")
  .match(/^\s*DATABASE_URI\s*=\s*(.+)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, "");

const CALENDLY = "https://calendly.com/thiago-empresarialacademy/new-meeting";
const DIAGNOSTICO = "https://empresarialacademy.com/diagnostico-maturidade-empresarial";
const CONVITE_E3 = (foco) =>
  `Oi {{nome}},\n\nConvite direto: uma Chamada de Diagnóstico Estratégico. São 30 a 40 minutos, online, sem custo, para olharmos ${foco} da sua empresa.\n\nEscolha um horário: ${CALENDLY}\n\nSe não for a hora agora, sem problema. Qualquer coisa, é só responder este e-mail.\n\nAbraço,`;

const AREAS = [
  {
    chave: "area:generico",
    nome: "Hunter · Genérico (área sem modelo próprio)",
    assuntos: ["{{nome}}, o convite também por e-mail", "O erro mais comum que vejo em empresa que cresceu rápido", "Última mensagem por aqui, {{nome}}"],
    corpos: [
      `Oi {{nome}},\n\nAqui é o Thiago, da Empresarial Academy. Mandei uma mensagem para você no Instagram e quis deixar o convite também por e-mail, sem depender só do Direct.\n\nTrabalho com donos de empresa que já não são mais pequenos: faturam bem, mas sentem que a gestão não acompanhou o tamanho do negócio. Processo bagunçado, decisão no feeling, time que não rende o que devia.\n\nSe isso soa familiar, o primeiro passo é simples: uma Chamada de Diagnóstico Estratégico, gratuita, de 30 a 40 minutos, para entender onde está o gargalo real da sua empresa. Sem compromisso.\n\nAgenda aqui: ${CALENDLY}\n\nAbraço,`,
      `Oi {{nome}},\n\nUma coisa que vejo direto: empresa que cresce rápido em faturamento, mas continua sendo gerida do jeito que era quando era pequena. O dono ainda decide tudo no improviso, e ninguém percebe até o caixa apertar ou a equipe começar a pedir demissão.\n\nNão é falta de esforço. É falta de estrutura.\n\nO Diagnóstico de Maturidade Empresarial é gratuito, leva poucos minutos e mostra onde a gestão está segurando o crescimento: ${DIAGNOSTICO}\n\nAbraço,`,
      `Oi {{nome}},\n\nNão quero encher sua caixa de entrada, então esta é a última mensagem desta sequência.\n\nSe em algum momento a gestão da sua empresa virar prioridade, o convite para a Chamada de Diagnóstico Estratégico continua de pé: ${CALENDLY}\n\nSe não for a hora agora, sem problema nenhum. Qualquer coisa, é só responder este e-mail.\n\nAbraço,`,
    ],
  },
  {
    chave: "area:Serviços B2B com equipe",
    nome: "Hunter · Serviços B2B com equipe",
    assuntos: ["{{nome}}, sua entrega depende de quem está de plantão hoje?", "Onde a IA entra numa prestadora de serviço", "Vamos conversar 30 minutos, sem custo?"],
    corpos: [
      `Oi {{nome}},\n\nUma coisa que vejo direto em prestadoras de serviço B2B: a qualidade da entrega varia conforme quem atendeu o cliente naquele dia. A proposta demora a sair, o cliente pergunta "e aí, como está meu projeto?" porque não existe um status visível em lugar nenhum, e o processo comercial mora só na cabeça de uma pessoa.\n\nIsso não é falta de time bom. É falta de processo escrito.\n\nNuma Chamada de Diagnóstico Estratégico (gratuita, 30 a 40 minutos) mapeamos onde a entrega e o comercial estão dependendo de gente em vez de processo.\n\nAgenda aqui: ${CALENDLY}\n\nAbraço,`,
      `Oi {{nome}},\n\nDepois que o processo de entrega está mapeado e padronizado, dá para automatizar o que hoje consome tempo de gente boa: follow-up de proposta que ninguém lembra de mandar, triagem inicial de cliente novo, atualização de status que hoje é manual.\n\nNão é trocar gente por IA. É tirar trabalho repetitivo de quem devia estar vendendo ou entregando.\n\nO Diagnóstico de Maturidade Empresarial é gratuito e mostra por onde começar: ${DIAGNOSTICO}\n\nAbraço,`,
      CONVITE_E3("o processo de entrega e o comercial"),
    ],
  },
  {
    chave: "area:Indústria e distribuição",
    nome: "Hunter · Indústria e distribuição",
    assuntos: ["{{nome}}, o estoque decide sozinho ou é decisão sua?", "Onde a IA entra numa operação de indústria e distribuição", "Vamos conversar 30 minutos, sem custo?"],
    corpos: [
      `Oi {{nome}},\n\nSinais que vejo direto em indústria e distribuição: falta produto numa hora e sobra parado em outra, a entrega atrasa com frequência, e a decisão de quanto produzir ou comprar acontece no feeling, sem dado por trás.\n\nO ponto de partida é simples: mapear o fluxo do pedido do início ao fim e ter UM indicador, entregas no prazo, para saber se está melhorando ou piorando.\n\nNuma Chamada de Diagnóstico Estratégico (gratuita, 30 a 40 minutos) vemos onde esse fluxo está travando.\n\nAgenda aqui: ${CALENDLY}\n\nAbraço,`,
      `Oi {{nome}},\n\nCom o fluxo do pedido mapeado, dá para automatizar o que hoje é feito no olho: previsão de demanda para não faltar nem sobrar produto, e ponto de reposição automático de estoque, em vez de alguém lembrar de repor na hora certa.\n\nO objetivo é decidir com dado, e não descobrir a falta de estoque quando o cliente já está reclamando.\n\nO Diagnóstico de Maturidade Empresarial é gratuito e mostra por onde começar: ${DIAGNOSTICO}\n\nAbraço,`,
      CONVITE_E3("o fluxo de pedido e estoque"),
    ],
  },
  {
    chave: "area:Clínicas e saúde com equipe",
    nome: "Hunter · Clínicas e saúde com equipe",
    assuntos: ["{{nome}}, quanto da sua agenda vira falta?", "Onde a IA entra numa clínica com equipe", "Vamos conversar 30 minutos, sem custo?"],
    corpos: [
      `Oi {{nome}},\n\nSinais comuns em clínicas com equipe: agenda com furo ou falta alta, paciente esperando retorno sem resposta, e a equipe sobrecarregada só no horário de pico, porque o atendimento varia de pessoa para pessoa, sem um processo padrão.\n\nO primeiro passo é medir: qual a taxa real de faltas hoje, e onde o fluxo do paciente (da marcação à alta) está sem dono.\n\nNuma Chamada de Diagnóstico Estratégico (gratuita, 30 a 40 minutos) mapeamos isso com você.\n\nAgenda aqui: ${CALENDLY}\n\nAbraço,`,
      `Oi {{nome}},\n\nCom o fluxo do paciente mapeado, dá para automatizar a confirmação e o lembrete de consulta (o que mais reduz falta) e usar triagem inicial por IA para aliviar a equipe no horário de pico.\n\nO objetivo é uma agenda previsível, e não uma equipe correndo atrás do prejuízo toda tarde.\n\nO Diagnóstico de Maturidade Empresarial é gratuito e mostra por onde começar: ${DIAGNOSTICO}\n\nAbraço,`,
      CONVITE_E3("o fluxo de atendimento"),
    ],
  },
];

const client = new pg.Client({ connectionString: uri });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(`ALTER TABLE leads ALTER COLUMN email DROP NOT NULL`);
  await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS area_atuacao varchar`);
  await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS site varchar`);
  await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS hunter_id numeric`);
  await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS prospectado_em timestamp(3) with time zone`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS leads_hunter_id_idx ON leads USING btree (hunter_id)`);

  for (const col of ["assunto_terceiro", "corpo_primeiro", "corpo_segundo", "corpo_terceiro"]) {
    await client.query(`ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS ${col} varchar`);
  }
  await client.query(`ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT false`);

  for (const a of AREAS) {
    const r = await client.query(
      `INSERT INTO email_templates (nome, chave, jornada, ativo, assunto_primeiro, assunto_segundo, assunto_terceiro, corpo_primeiro, corpo_segundo, corpo_terceiro)
       VALUES ($1,$2,'Nutrição por área de atuação (EA Hunter)',false,$3,$4,$5,$6,$7,$8) ON CONFLICT (chave) DO NOTHING`,
      [a.nome, a.chave, ...a.assuntos, ...a.corpos],
    );
    console.log(`${r.rowCount ? "criado    " : "já existia"} ${a.chave}`);
  }
  await client.query("COMMIT");
  console.log("OK");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("ROLLBACK:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
