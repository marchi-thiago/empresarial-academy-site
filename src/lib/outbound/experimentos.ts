import { createHash } from "crypto";

/**
 * Testes A/B do outbound (Plano Outbound, F11). Sem IA e sem sorteio solto:
 * - a variante de cada lead é uma função do id do lead e do id do experimento (a mesma sempre, em qualquer
 *   rodada, e reproduzível em teste);
 * - quem aplica a variante grava `metadados.variantes = { <variavel>: <idDaVariante> }` na interação `enviado`
 *   (o e-mail pelo orquestrador; DM e WhatsApp quando o Hunter e o EA Flow passarem a mandar o mesmo campo);
 * - a medição (`medirVariantes`) lê só o que está gravado: envios, respostas e reuniões por variante.
 * Regra do plano: uma variável muda por vez. Por isso há no máximo 1 experimento ativo por canal e variável,
 * e trocar o experimento (novo `id`) abre uma medição nova sem misturar com a anterior.
 */

export type VariavelAB = "assunto" | "gancho" | "cta";

export type Variante = {
  id: string;
  descricao: string;
  /** Texto com {{nome}} e {{empresa}}. Sem `modelo` = controle (o texto que o kit já traz). */
  modelo?: string;
};

export type Experimento = {
  id: string;
  canal: string;
  variavel: VariavelAB;
  variantes: readonly Variante[];
};

export const EXPERIMENTOS: readonly Experimento[] = [
  {
    id: "email-assunto-v1",
    canal: "email",
    variavel: "assunto",
    variantes: [
      { id: "kit", descricao: "Assunto escrito no kit do lead (controle)" },
      { id: "convite_20min", descricao: "Convite direto: empresa e 20 minutos", modelo: "{{empresa}}: uma conversa de 20 minutos" },
    ],
  },
];

/** Atribuição estável: o mesmo lead cai sempre na mesma variante de um experimento. */
export function indiceDaVariante(leadId: number, experimentoId: string, total: number): number {
  const h = createHash("sha256").update(`${experimentoId}:${leadId}`).digest();
  return h.readUInt32BE(0) % total;
}

export type VariantesEscolhidas = {
  /** variavel -> id da variante, só das que foram de fato aplicadas. */
  ids: Record<string, string>;
  /** Texto do assunto quando a variante sorteada não é o controle. */
  assunto?: string;
};

const preencherModelo = (modelo: string, v: { nome: string; empresa: string }) =>
  modelo
    .replace(/\{\{\s*(nome|empresa)\s*\}\}/g, (_, k: "nome" | "empresa") => v[k])
    .replace(/\s+/g, " ")
    .trim();

/**
 * Escolhe a variante de cada experimento do canal para o lead. Variante com modelo que depende de dado que o lead não
 * tem (ex.: {{empresa}} vazia) cai no controle, para a medição não contar uma variante que não saiu como descrita.
 */
export function escolherVariantes(
  canal: string,
  leadId: number,
  dados: { nome: string; empresa: string | null },
  experimentos: readonly Experimento[] = EXPERIMENTOS,
): VariantesEscolhidas {
  const r: VariantesEscolhidas = { ids: {} };
  for (const e of experimentos) {
    if (e.canal !== canal || e.variantes.length === 0) continue;
    const v = e.variantes[indiceDaVariante(leadId, e.id, e.variantes.length)];
    const controle = e.variantes.find((x) => !x.modelo) ?? e.variantes[0];
    let usada = v;
    let texto: string | undefined;
    if (v.modelo) {
      const nome = dados.nome.trim();
      const empresa = (dados.empresa ?? "").trim();
      const faltaDado = (/\{\{\s*empresa\s*\}\}/.test(v.modelo) && !empresa) || (/\{\{\s*nome\s*\}\}/.test(v.modelo) && !nome);
      if (faltaDado) usada = controle;
      else texto = preencherModelo(v.modelo, { nome, empresa });
    }
    r.ids[e.variavel] = usada.id;
    if (e.variavel === "assunto" && texto && usada === v) r.assunto = texto;
  }
  return r;
}

/**
 * Depois do render: se o assunto que saiu não é o da variante (o render troca assunto com termo proibido por um neutro),
 * a variante não foi aplicada de verdade e sai da medição.
 */
export function confirmarVariantes(escolhidas: VariantesEscolhidas, assuntoEnviado: string): Record<string, string> | undefined {
  const ids = { ...escolhidas.ids };
  if (escolhidas.assunto && assuntoEnviado.trim() !== escolhidas.assunto) delete ids.assunto;
  return Object.keys(ids).length ? ids : undefined;
}

// ---------------------------------------------------------------- medição

export type EventoAB = {
  leadId: number;
  canal: string;
  direcao: "entrada" | "saida";
  tipo: string;
  data: Date;
  variantes?: Record<string, string>;
};

export type LinhaVariante = {
  canal: string;
  variavel: string;
  variante: string;
  envios: number;
  respostas: number;
  reunioes: number;
  taxaResposta: number | null;
  taxaReuniao: number | null;
};

export type StatusTeste = "vencedora" | "empate" | "em_teste";

export type ResultadoTeste = {
  canal: string;
  variavel: string;
  status: StatusTeste;
  vencedora: string | null;
  linhas: LinhaVariante[];
};

/** Amostra mínima por variante para declarar vencedora (a mesma do painel). */
export const AMOSTRA_MINIMA_AB = 30;

/**
 * Mede cada variante por lead distinto: `envios` = leads que receberam; `respostas` = leads com `respondido` de entrada
 * no mesmo canal depois do envio; `reunioes` = leads com `agendou` (qualquer canal) depois do envio. O lead conta na
 * variante do PRIMEIRO envio dela. Vencedora = maior taxa de resposta, só com amostra mínima em todas as variantes
 * do teste e sem empate; empate fica em aberto (nada de escolher por sorteio).
 */
export function medirVariantes(eventos: readonly EventoAB[], minAmostra = AMOSTRA_MINIMA_AB): ResultadoTeste[] {
  const primeiroEnvio = new Map<string, Map<number, Date>>();
  const respostas = new Map<number, EventoAB[]>();
  const reunioes = new Map<number, Date[]>();

  for (const e of eventos) {
    if (e.tipo === "enviado" && e.direcao === "saida" && e.variantes) {
      for (const [variavel, variante] of Object.entries(e.variantes)) {
        const k = `${e.canal}|${variavel}|${variante}`;
        const porLead = primeiroEnvio.get(k) ?? new Map<number, Date>();
        const antes = porLead.get(e.leadId);
        if (!antes || e.data < antes) porLead.set(e.leadId, e.data);
        primeiroEnvio.set(k, porLead);
      }
    } else if (e.tipo === "respondido" && e.direcao === "entrada") {
      respostas.set(e.leadId, [...(respostas.get(e.leadId) ?? []), e]);
    } else if (e.tipo === "agendou") {
      reunioes.set(e.leadId, [...(reunioes.get(e.leadId) ?? []), e.data]);
    }
  }

  const linhas: LinhaVariante[] = [];
  for (const [k, porLead] of primeiroEnvio) {
    const [canal, variavel, variante] = k.split("|");
    let r = 0;
    let m = 0;
    for (const [leadId, quando] of porLead) {
      if ((respostas.get(leadId) ?? []).some((x) => x.canal === canal && x.data >= quando)) r++;
      if ((reunioes.get(leadId) ?? []).some((d) => d >= quando)) m++;
    }
    const n = porLead.size;
    linhas.push({ canal, variavel, variante, envios: n, respostas: r, reunioes: m, taxaResposta: n ? r / n : null, taxaReuniao: n ? m / n : null });
  }

  const grupos = new Map<string, LinhaVariante[]>();
  for (const l of linhas) grupos.set(`${l.canal}|${l.variavel}`, [...(grupos.get(`${l.canal}|${l.variavel}`) ?? []), l]);

  const testes: ResultadoTeste[] = [];
  for (const [k, ls] of grupos) {
    const [canal, variavel] = k.split("|");
    ls.sort((a, b) => a.variante.localeCompare(b.variante));
    let status: StatusTeste = "em_teste";
    let vencedora: string | null = null;
    if (ls.length >= 2 && ls.every((l) => l.envios >= minAmostra)) {
      const ordenadas = [...ls].sort((a, b) => (b.taxaResposta ?? 0) - (a.taxaResposta ?? 0));
      if ((ordenadas[0].taxaResposta ?? 0) > (ordenadas[1].taxaResposta ?? 0)) {
        status = "vencedora";
        vencedora = ordenadas[0].variante;
      } else {
        status = "empate";
      }
    }
    testes.push({ canal, variavel, status, vencedora, linhas: ls });
  }
  return testes.sort((a, b) => `${a.canal}${a.variavel}`.localeCompare(`${b.canal}${b.variavel}`));
}
