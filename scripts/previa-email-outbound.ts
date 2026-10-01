/**
 * Gera as prévias do e-mail outbound (F7) em docs/outbound/previas/, uma por tipo de prova
 * com lead fictício. Abre direto no navegador (as imagens vêm de public/email/ por caminho relativo).
 * Nada é enviado.
 *
 * Uso: npx tsx scripts/previa-email-outbound.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderEmailOutbound, type DadosEmailOutbound } from "../src/lib/outbound/email/render";

const saida = join(__dirname, "..", "docs", "outbound", "previas");
mkdirSync(saida, { recursive: true });

const comum = {
  linkConversa: "https://empresarialacademy.com/conversa?t=EXEMPLO",
  linkOptOut: "https://empresarialacademy.com/api/marketing/sair?l=0&t=EXEMPLO",
  diaSugerido: "terça, 6 de outubro, às 15h",
  baseUrlImagens: "../../../public",
} satisfies Partial<DadosEmailOutbound>;

const exemplos: Array<{ arquivo: string; dados: DadosEmailOutbound }> = [
  {
    arquivo: "01-fabio-escritorio-de-advocacia",
    dados: {
      ...comum,
      nome: "Marcos Teixeira",
      empresa: "Teixeira & Lima Advocacia",
      prova: "fabio",
      kit: {
        email1: {
          assunto: "Marcos, uma ideia para a gestão da Teixeira & Lima",
          gancho: "Vi no perfil da Teixeira & Lima que o escritório atende empresas da região. Por isso escrevo direto.",
          dor: "Em escritório de serviços, a gestão costuma depender do sócio: toda decisão passa por ele e a agenda enche com o que poderia estar delegado.",
          ponte_para_o_video: "Um cliente nosso, também do ramo jurídico, conta em um vídeo curto como saiu dessa.",
          convite: "Posso te mostrar em 20 minutos como organizamos isso na prática? Terça, às 15h, serve?",
        },
      },
    },
  },
  {
    arquivo: "02-daniella-time-comercial",
    dados: {
      ...comum,
      nome: "Renata Alves",
      empresa: "Alves Solar Energia",
      prova: "daniella",
      kit: {
        email1: {
          assunto: { texto: "Renata, o time comercial da Alves Solar" },
          gancho: { texto: "Vi no site da Alves Solar que vocês vendem projetos sob medida, com proposta para cada cliente." },
          dor: ["Quando cada venda é uma proposta nova, o time de vendas perde tempo com o que se repete e o dono vira o fechador de tudo."],
          ponte: "A coordenadora comercial de um cliente conta o que mudou na rotina do time.",
          convite: { corpo: "Que tal 20 minutos para eu mostrar o caminho? Terça, às 15h, funciona?" },
        },
      },
    },
  },
  {
    arquivo: "03-erik-financeiro-e-cobranca",
    dados: {
      ...comum,
      nome: "Carlos Mendes",
      empresa: "Mendes Distribuidora",
      prova: "erik",
      kit: {
        email1: {
          assunto: "Carlos, cobrança e caixa na Mendes Distribuidora",
          gancho: "Encontrei a Mendes Distribuidora pelo Instagram e vi que vocês vendem a prazo para o varejo.",
          dor: "Venda a prazo traz um problema conhecido: o dinheiro entra tarde, a cobrança consome a equipe e o relatório do mês chega depois da hora de decidir.",
          ponte: "O time financeiro de um cliente mostra, em um vídeo curto, como essa rotina mudou.",
          convite: "Posso te mostrar em 20 minutos? Terça, às 15h?",
        },
      },
    },
  },
];

async function main() {
  for (const { arquivo, dados } of exemplos) {
    const r = await renderEmailOutbound(dados);
    writeFileSync(join(saida, `${arquivo}.html`), r.html, "utf8");
    writeFileSync(join(saida, `${arquivo}.txt`), `Assunto: ${r.assunto}\n\n${r.texto}\n`, "utf8");
    console.log(`${arquivo}: assunto "${r.assunto}", ${Buffer.byteLength(r.html)} bytes de HTML${r.avisos.length ? `, avisos: ${r.avisos.join("; ")}` : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
