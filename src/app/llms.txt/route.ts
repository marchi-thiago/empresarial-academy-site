import { siteConfig } from "@/lib/site-config";
import { pilares } from "@/lib/content";

export const revalidate = 3600;

// /llms.txt — descreve o site para assistentes de IA (LLMO/GEO).
export function GET() {
  const base = siteConfig.url;
  const pilaresList = pilares
    .map((p) => `- ${p.titulo}: ${p.desc}`)
    .join("\n");

  const body = `# Empresarial Academy

> ${siteConfig.description}

A Empresarial Academy é uma consultoria empresarial com IA para pequenas e médias empresas (PMEs) no Brasil, fundada por ${siteConfig.founder}. Organiza a gestão com a metodologia proprietária Gestão 360 e coloca esse método para rodar com sistemas e automações com inteligência artificial feitos sob medida para cada empresa. O software é uma das entregas da consultoria, nunca um produto avulso, e é medido por resultado: ganho de tempo, qualidade, produtividade, redução de custo e aumento de lucro. Também oferece mentoria executiva, palestras, curso e livro Gestão 360. Slogan: "${siteConfig.slogan}". Tagline: "Método para crescer. Gestão para permanecer.".

## Páginas principais
- [Início](${base}/): visão geral da marca e dos serviços.
- [Institucional](${base}/institucional): história, missão, visão, valores e o fundador ${siteConfig.founder}.
- [Serviços](${base}/servicos): visão geral dos produtos e serviços.
- [Curso Gestão 360](${base}/servicos/curso-gestao-360): curso completo de gestão empresarial em 6 pilares.
- [Mentorias Estratégicas](${base}/servicos/mentorias): mentoria individual com ${siteConfig.founder}.
- [Palestras](${base}/servicos/palestras): palestras sobre liderança, vendas e gestão.
- [Consultoria](${base}/servicos/consultoria): consultoria empresarial com IA: diagnóstico, plano de ação, implantação com sistemas sob medida e acompanhamento com KPIs.
- [Soluções com IA](${base}/solucoes-com-ia): os sistemas com IA que rodam a Empresarial Academy e o tipo de solução construída sob medida para clientes.
- [Livro Gestão 360](${base}/livro-gestao-360): livro de ${siteConfig.founder} (em breve).
- [Materiais Gratuitos](${base}/materiais): e-books, planilhas, templates e checklists.
- [Diagnóstico de Maturidade Empresarial](${base}/diagnostico-maturidade-empresarial.html): avaliação gratuita e interativa nos 6 pilares do Gestão 360, com 36 perguntas, resultado imediato e plano de melhoria.
- [Blog](${base}/blog): artigos sobre gestão, vendas, processos e liderança.
- [Contato](${base}/contato): formulário e canais de atendimento.
- [Perguntas Frequentes](${base}/faq): dúvidas comuns sobre os serviços.

## Metodologia proprietária Gestão 360 (6 pilares)
O Gestão 360 se manifesta em consultoria, mentoria, curso, livro, diagnóstico e materiais — todos derivam da mesma metodologia.
${pilaresList}

## Público-alvo
Empresários, empreendedores, gestores e líderes de pequenas e médias empresas (PMEs) no Brasil que buscam crescimento estruturado, mais lucro e melhor gestão.

## Contato
- E-mail: ${siteConfig.contact.email}
- WhatsApp / Telefone: ${siteConfig.contact.phone}
- Localização: ${siteConfig.contact.address}
- Instagram: ${siteConfig.social.instagram}
- LinkedIn: ${siteConfig.social.linkedin}
- YouTube: ${siteConfig.social.youtube}
- TikTok: ${siteConfig.social.tiktok}

## Observações
- Idioma do conteúdo: Português (Brasil).
- A empresa atua com consultoria empresarial com IA (principal), mentoria executiva, palestras, curso e livro.
`;

  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
