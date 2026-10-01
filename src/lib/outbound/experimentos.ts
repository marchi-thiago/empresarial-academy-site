import type { Canal } from "@/lib/crm/tipos";

export type VariavelAB = "assunto" | "gancho" | "cta";

export interface Variante {
  id: string;
  conteudo: string;
  peso: number;
}

export interface Experimento {
  id: string;
  canal: Canal;
  variavel: VariavelAB;
  ativo: boolean;
  variantes: Variante[];
}

// Experimentos em memria/cdigo conforme requisito para no onerar BD com tabelas extras,
// ou fceis de migrar depois.
export const EXPERIMENTOS_ATIVOS: Experimento[] = [
  {
    id: "exp_email_assunto_1",
    canal: "email",
    variavel: "assunto",
    ativo: true,
    variantes: [
      { id: "v1_curto", conteudo: "Ideia para {{empresa}}", peso: 1 },
      { id: "v2_direto", conteudo: "Consultoria para {{empresa}}", peso: 1 },
    ],
  },
  {
    id: "exp_email_gancho_1",
    canal: "email",
    variavel: "gancho",
    ativo: true,
    variantes: [
      { id: "v1_dor", conteudo: "Notei que empresas como a sua enfrentam {{dor}}.", peso: 1 },
      { id: "v2_oportunidade", conteudo: "Existe uma oportunidade de melhorar {{dor}} no seu setor.", peso: 1 },
    ],
  },
  {
    id: "exp_whatsapp_cta_1",
    canal: "whatsapp",
    variavel: "cta",
    ativo: true,
    variantes: [
      { id: "v1_reuniao", conteudo: "Podemos falar por 10 min na {{dia_sugerido}}?", peso: 1 },
      { id: "v2_material", conteudo: "Posso te enviar um material sobre isso?", peso: 1 },
    ],
  }
];

export function sortearVariante(canal: Canal, variavel: VariavelAB): Variante | null {
  const exp = EXPERIMENTOS_ATIVOS.find((e) => e.canal === canal && e.variavel === variavel && e.ativo);
  if (!exp || exp.variantes.length === 0) return null;

  const totalPeso = exp.variantes.reduce((sum, v) => sum + v.peso, 0);
  let sorteio = Math.random() * totalPeso;

  for (const v of exp.variantes) {
    if (sorteio < v.peso) return v;
    sorteio -= v.peso;
  }
  return exp.variantes[0];
}

export function aplicarExperimentos(canal: Canal, textosBase: Record<string, string>): { textos: Record<string, string>, variantesUsadas: Record<string, string> } {
  const textos = { ...textosBase };
  const variantesUsadas: Record<string, string> = {};

  const variaveis: VariavelAB[] = ["assunto", "gancho", "cta"];
  for (const varName of variaveis) {
    const variante = sortearVariante(canal, varName);
    if (variante) {
      textos[varName] = variante.conteudo;
      variantesUsadas[varName] = variante.id;
    }
  }

  return { textos, variantesUsadas };
}
