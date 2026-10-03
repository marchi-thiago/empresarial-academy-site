/**
 * Gera as prévias do e-mail outbound (F7) em docs/outbound/previas/, com leads FICTÍCIOS e kits no formato real gravado
 * pelo EA Hunter (`email1` objeto; `email2` e `dm3` em texto). Passa pelo mesmo caminho do orquestrador: partes do kit,
 * variáveis ({{dia_sugerido}}, {{link_conversa}}, {{link_diagnostico}}), saudação, CTA por perfil e último toque.
 * Abre direto no navegador (as imagens vêm de public/email/ por caminho relativo). Nada é enviado.
 *
 * Uso: npx tsx scripts/previa-email-outbound.ts
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderEmailOutbound, type DadosEmailOutbound } from "../src/lib/outbound/email/render";
import { mapearTextos, partesDoKit } from "../src/lib/outbound/kit";
import { preencher } from "../src/lib/outbound/texto";

const saida = join(__dirname, "..", "docs", "outbound", "previas");
mkdirSync(saida, { recursive: true });
for (const f of readdirSync(saida)) if (/\.(html|txt)$/.test(f)) rmSync(join(saida, f));

const SITE = "https://empresarialacademy.com";
const DIA = "na terça, às 15h";
const vars = (id: number, toque: string) => ({
  dia_sugerido: DIA,
  link_conversa: `${SITE}/r/${id}.${toque}.conversa.EXEMPLO`,
  link_diagnostico: `${SITE}/r/${id}.${toque}.diagnostico.EXEMPLO`,
});

type Caso = {
  arquivo: string;
  id: number;
  toque: "email1" | "email2" | "ultimo";
  nome: string;
  empresa: string;
  prova: DadosEmailOutbound["prova"];
  noPerfil?: boolean;
  kit: Record<string, unknown>;
};

const casos: Caso[] = [
  {
    arquivo: "01-email1-fabio-escritorio-de-advocacia",
    id: 101,
    toque: "email1",
    nome: "Marcos Teixeira",
    empresa: "Teixeira & Lima Advocacia",
    prova: "fabio",
    kit: {
      email1: {
        assunto: "Teixeira & Lima: gestão do escritório sem depender do sócio",
        gancho: "Vi no perfil da Teixeira & Lima que o escritório atende empresas da região.",
        dor: "Em escritório de serviços, a gestão costuma depender do sócio: toda decisão passa por ele e a agenda enche com o que poderia estar delegado.",
        ponte_video: "Um cliente, também do ramo jurídico, conta em um vídeo curto como organizou a gestão sem depender só do dono.",
        convite: "Gostaria de propor uma conversa sobre como estruturar essa gestão. Consegue {{dia_sugerido}} pelo link {{link_conversa}}?",
      },
    },
  },
  {
    arquivo: "02-email1-daniella-so-empresa-no-nome",
    id: 102,
    toque: "email1",
    nome: "Alves Solar Energia",
    empresa: "Alves Solar Energia",
    prova: "daniella",
    kit: {
      email1: {
        assunto: "Alves Solar: o time comercial e as propostas sob medida",
        gancho: "Vi no site da Alves Solar que vocês vendem projetos sob medida, com proposta para cada cliente.",
        dor: "Quando cada venda é uma proposta nova, o time perde tempo com o que se repete e o dono vira o fechador de tudo.",
        ponte_video: "A coordenadora comercial de um cliente conta, em um vídeo curto, o que mudou na rotina do time.",
        convite: "Gostaria de propor uma conversa. Consegue {{dia_sugerido}} pelo link {{link_conversa}}?",
      },
    },
  },
  {
    arquivo: "03-email1-erik-financeiro-e-cobranca",
    id: 103,
    toque: "email1",
    nome: "Carlos Mendes",
    empresa: "Mendes Distribuidora",
    prova: "erik",
    kit: {
      email1: {
        assunto: "Carlos, cobrança e caixa na Mendes Distribuidora",
        gancho: "Encontrei a Mendes Distribuidora pelo Instagram e vi que vocês vendem a prazo para o varejo.",
        dor: "Venda a prazo traz um problema conhecido: o dinheiro entra tarde, a cobrança consome a equipe e o relatório do mês chega depois da hora de decidir.",
        ponte_video: "O time financeiro de um cliente mostra, em um vídeo curto, como essa rotina mudou.",
        pergunta: "O dinheiro da venda a prazo entra tarde na Mendes Distribuidora?", // exemplo de pergunta vinda do kit/dossiê
        convite: "Posso te mostrar? Consegue {{dia_sugerido}} pelo link {{link_conversa}}?",
      },
    },
  },
  {
    arquivo: "04-email1-demo-de-segmento",
    id: 104,
    toque: "email1",
    nome: "Renata Prado",
    empresa: "Metalúrgica Modelo",
    prova: "demo_segmento",
    kit: {
      email1: {
        assunto: "Metalúrgica Modelo e a esteira de orçamentos",
        gancho: "Vi que a Metalúrgica Modelo fabrica peças sob encomenda há 18 anos.",
        dor: "Em fábrica sob encomenda, o time de vendas costuma perder muito tempo montando orçamento técnico à mão, mais de 2.000 itens por ano.",
        ponte_video: "Preparei uma demonstração de 1 minuto de como isso funciona num negócio do seu setor.",
        convite: "Gostaria de propor uma conversa. Consegue {{dia_sugerido}} pelo link {{link_conversa}}?",
      },
    },
  },
  {
    arquivo: "05-email2-texto-do-hunter",
    id: 105,
    toque: "email2",
    nome: "Carlos Mendes",
    empresa: "Mendes Distribuidora",
    prova: "erik",
    kit: {
      email2:
        "Um ponto que vejo muito em distribuidoras: o preço muda e a tabela de vendas demora dias para acompanhar. Se quiser olhar isso comigo, escolha um horário aqui: {{link_conversa}}",
    },
  },
  {
    arquivo: "06-ultimo-toque-porta-aberta",
    id: 106,
    toque: "ultimo",
    nome: "Carlos Mendes",
    empresa: "Mendes Distribuidora",
    prova: "erik",
    kit: {
      dm3: "Oi, Carlos! Vou deixar a porta aberta. Se fizer sentido, o diagnóstico gratuito mostra onde a gestão está mais frágil: {{link_diagnostico}}",
    },
  },
  {
    arquivo: "07-email1-lead-fora-do-perfil",
    id: 107,
    toque: "email1",
    nome: "Home",
    empresa: "Ateliê Modelo",
    prova: "fabio",
    noPerfil: false,
    kit: {
      email1: {
        assunto: "Ateliê Modelo: organizar os pedidos sob encomenda",
        gancho: "Vi que o Ateliê Modelo trabalha com peças feitas sob encomenda.",
        dor: "Quem trabalha com encomenda costuma perder tempo com pedido solto em várias conversas.",
        ponte_video: "Separei um depoimento em vídeo de 1 minuto de um cliente.",
        convite: "Se quiser um retrato rápido da gestão, o diagnóstico gratuito está aqui: {{link_diagnostico}}",
      },
    },
  },
];

async function main() {
  for (const c of casos) {
    const v = vars(c.id, c.toque);
    const partes = partesDoKit(c.kit, c.toque);
    if (!partes) throw new Error(`${c.arquivo}: kit sem texto para ${c.toque}`);
    const kit = mapearTextos(partes, (t) => preencher(t, v));
    const dados: DadosEmailOutbound = {
      nome: c.nome,
      empresa: c.empresa,
      kit,
      toque: c.toque === "email1" ? 1 : 2,
      ultimoToque: c.toque === "ultimo",
      tema: c.toque === "email2" ? "vendas" : c.toque === "ultimo" ? "processos" : undefined,
      noPerfil: c.noPerfil,
      prova: c.prova,
      diaSugerido: DIA,
      linkConversa: `${SITE}/conversa?t=EXEMPLO`,
      linkDiagnostico: v.link_diagnostico,
      linkOptOut: `${SITE}/api/marketing/sair?l=${c.id}&t=EXEMPLO`,
      baseUrlImagens: "../../../public",
    };
    const r = await renderEmailOutbound(dados);
    writeFileSync(join(saida, `${c.arquivo}.html`), r.html, "utf8");
    writeFileSync(join(saida, `${c.arquivo}.txt`), `Assunto: ${r.assunto}\n\n${r.texto}\n`, "utf8");
    console.log(`${c.arquivo}: assunto "${r.assunto}", ${Buffer.byteLength(r.html)} bytes de HTML${r.avisos.length ? `, avisos: ${r.avisos.join("; ")}` : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
