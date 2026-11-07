/**
 * Geração de texto de contrato · Empresarial Academy.
 *
 * Porta fiel da lógica de
 * `D:\Empresarial Academy\Projeto IA\Gerador_Contratos_Empresarial_Academy.html`
 * (fonte da verdade das cláusulas jurídicas) para TypeScript puro — sem
 * import de Payload/Next.js, testável isoladamente.
 *
 * Não reescrever os algoritmos de validação de CPF/CNPJ nem o conversor de
 * extenso: já testados no arquivo de referência, só portados aqui.
 * Não introduzir "—" (travessão) em nenhum texto: usar "·", vírgula, dois
 * pontos ou ponto (padrão da casa).
 */

// ───────────────────────── Tipos ─────────────────────────

export type ContractType =
  | "mentoria"
  | "consultoria"
  | "conselho"
  | "diagnostico"
  | "projeto";

export type Horizonte = "trimestral" | "semestral" | "anual";

export type TipoPessoa = "PF" | "PJ";

export type Etapa = {
  nome: string;
  prazo: string;
  descricao: string;
};

export type ContractInput = {
  contractType: ContractType;
  horizonte?: Horizonte;
  /** Valor mensal (editável) para mentoria/consultoria/conselho/diagnóstico. */
  valorMensal?: number;

  // Projeto personalizado
  projNome?: string;
  projDescricao?: string;
  etapas?: Etapa[];
  projDuracao?: string;
  /** ISO yyyy-mm-dd */
  projDataEntrega?: string;
  projValorTotal?: number;
  projParcelas?: number;
  projValorParcela?: number;

  // Contratante
  tipoPessoa: TipoPessoa;
  pfNome?: string;
  pfCpf?: string;
  pjRazao?: string;
  pjFantasia?: string;
  pjCnpj?: string;
  pjRepNome?: string;
  pjRepCpf?: string;
  pjRepCargo?: string;
  clienteEndereco?: string;
  clienteEmail?: string;
  clienteTelefone?: string;

  // Datas e pagamento
  /** ISO yyyy-mm-dd */
  dataInicio?: string;
  diaVencimento?: number;
  formaPagamento?: string;
  clausulaReajuste?: boolean;

  // Abatimento do Diagnóstico Executivo 360
  temDiagnostico?: boolean;
  diagValor?: number;
  /** ISO yyyy-mm-dd */
  diagData?: string;
  diagForaPrazo?: boolean;

  // Bônus e cláusulas especiais
  bonusMesGratis?: boolean;
  bonusVisitaExtra?: boolean;
  bonusIndicacao?: boolean;
  indicacaoPerc?: number;
  bonusIsencaoMulta?: boolean;
  bonusParcelamento?: boolean;
  parcelamentoN?: number;
  paragrafoLivre?: string;

  // Assinatura
  /**
   * Este fluxo (EA HUB → link de assinatura) sempre gera contrato para
   * assinatura eletrônica; o campo existe só por fidelidade ao arquivo de
   * referência, que também suporta assinatura manuscrita com testemunhas.
   */
  assinaturaEletronica?: boolean;
  localAssinatura?: string;
  /** ISO yyyy-mm-dd. Default: hoje, no momento da geração. */
  dataAssinatura?: string;
};

// ─────────────────── Dados fixos da CONTRATADA ───────────────────

export const EA = {
  nomeFantasia: "Empresarial Academy",
  razaoSocial: "52.281.916 THIAGO MARCHI",
  cnpj: "52.281.916/0001-60",
  natureza:
    "empresário individual, enquadrado como microempresa optante pelo Simples Nacional",
  endereco:
    "Rua Guilherme Wundt, nº 21, Jardim Imperador (Zona Leste), São Paulo/SP, CEP 03934-070",
  email: "thiago@empresarialacademy.com",
  telefone: "+55 11 93340-0264",
  titular: "Thiago Marchi",
};

// ───────────────────────── Planos ─────────────────────────

type PlanoRecorrente = {
  nome: string;
  objeto: string;
  horizontes: Record<Horizonte, { meses: number; valor: number; cadencia: string }>;
};

type PlanoFixo = {
  nome: string;
  objeto: string;
  valorFixo: number;
};

type PlanoProjeto = {
  nome: string;
};

export const PLANOS: {
  mentoria: PlanoRecorrente;
  consultoria: PlanoRecorrente;
  conselho: PlanoFixo;
  diagnostico: PlanoFixo;
  projeto: PlanoProjeto;
} = {
  mentoria: {
    nome: "Mentoria Executiva Gestão 360™",
    objeto:
      'prestará à CONTRATANTE serviços de mentoria executiva sob a metodologia Gestão 360™, compreendendo: (i) diagnóstico validado dos pilares prioritários da gestão da CONTRATANTE, realizado por meio de avaliações e entrevistas com os líderes e a equipe; (ii) encontros estratégicos quinzenais de direção e acompanhamento, com apresentação, análise e ajuste de rota do plano de ação; (iii) acompanhamento analítico da gestão de indicadores e metas ao longo do período contratado; (iv) orientação voltada ao desenvolvimento de autonomia da equipe da CONTRATANTE na execução do plano; e (v) acesso ao Painel Gestão 360™, ferramenta de acompanhamento de indicadores disponibilizada pela CONTRATADA durante toda a vigência contratual, com valor de referência de R$ 490,00 (quatrocentos e noventa reais) mensais, incluído sem custo adicional.',
    horizontes: {
      trimestral: {
        meses: 3,
        valor: 7900,
        cadencia:
          "Os encontros ocorrerão em cadência quinzenal, totalizando 6 (seis) sessões de 90 (noventa) minutos ao longo da vigência, realizadas on-line ou presencialmente conforme combinação prévia entre as partes.",
      },
      semestral: {
        meses: 6,
        valor: 6900,
        cadencia:
          "Os encontros ocorrerão em cadência quinzenal, totalizando 12 (doze) sessões de 90 (noventa) minutos ao longo da vigência, realizadas on-line ou presencialmente conforme combinação prévia entre as partes.",
      },
      anual: {
        meses: 12,
        valor: 6500,
        cadencia:
          "Os encontros ocorrerão em cadência quinzenal, totalizando 24 (vinte e quatro) sessões de 90 (noventa) minutos ao longo da vigência, realizadas on-line ou presencialmente conforme combinação prévia entre as partes.",
      },
    },
  },
  consultoria: {
    nome: "Consultoria de Negócios Hands-On Gestão 360™",
    objeto:
      "prestará à CONTRATANTE serviços de consultoria empresarial hands-on sob a metodologia Gestão 360™, compreendendo: (i) diagnóstico profundo dos processos críticos da operação da CONTRATANTE, com entrevistas à equipe e observação direta da rotina; (ii) desenho de processos, playbooks e roteiros operacionais, elaborados em conjunto com a equipe executora; (iii) treinamento prático da equipe da CONTRATANTE na aplicação dos processos desenhados, com ajustes em campo; (iv) acompanhamento da transição da gestão até que os processos operem sem dependência de presença constante da CONTRATADA; e (v) acesso ao Painel Gestão 360™, nas mesmas condições e com o mesmo valor de referência descritos para a Mentoria Executiva, incluído sem custo adicional.",
    horizontes: {
      trimestral: {
        meses: 3,
        valor: 8900,
        cadencia:
          "O acompanhamento ocorrerá em ritmo intensivo, com 2 (dois) encontros on-line e 2 (duas) visitas presenciais por mês.",
      },
      semestral: {
        meses: 6,
        valor: 8400,
        cadencia:
          "O acompanhamento ocorrerá com 2 (dois) encontros on-line e de 2 (duas) a 3 (três) visitas presenciais por mês.",
      },
      anual: {
        meses: 12,
        valor: 7970,
        cadencia:
          "O acompanhamento ocorrerá em ritmo intensivo nos primeiros 4 (quatro) meses de vigência, passando a cadência mensal a partir do 5º (quinto) mês.",
      },
    },
  },
  conselho: {
    nome: "Conselho Gestão 360™",
    objeto:
      "prestará à CONTRATANTE serviço de aconselhamento consultivo recorrente, sob a marca Conselho Gestão 360™, compreendendo: (i) 1 (um) encontro mensal de 2 (duas) horas com o titular da CONTRATADA; (ii) acesso contínuo ao Painel Gestão 360™, com valor de referência de R$ 490,00 (quatrocentos e noventa reais) mensais, incluído sem custo adicional; e (iii) canal direto para resposta a dúvidas de gestão entre os encontros mensais.",
    valorFixo: 2900,
  },
  diagnostico: {
    nome: "Diagnóstico Executivo 360™",
    objeto:
      "prestará à CONTRATANTE serviço avulso de diagnóstico executivo, sob a marca Diagnóstico Executivo 360™, compreendendo: (i) 1 (um) dia de imersão, presencial ou online, com o titular e as lideranças da CONTRATANTE; (ii) avaliação dos 6 (seis) pilares da metodologia Gestão 360™; (iii) relatório executivo priorizado; (iv) plano de ação de 90 (noventa) dias, executável pela própria CONTRATANTE; e (v) devolutiva com a liderança da CONTRATANTE.",
    valorFixo: 5900,
  },
  projeto: {
    nome: "Projeto Personalizado Empresarial Academy",
  },
};

// ───────────────────────── Extenso ─────────────────────────

const UN = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const D10_19 = [
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const DEZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CEN = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CEN[c]);
  if (r > 0) {
    if (r < 10) partes.push(UN[r]);
    else if (r < 20) partes.push(D10_19[r - 10]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      partes.push(u === 0 ? DEZ[d] : DEZ[d] + " e " + UN[u]);
    }
  }
  return partes.join(" e ");
}

export function extensoInteiro(n: number): string {
  if (n === 0) return "zero";
  const milhar = Math.floor(n / 1000);
  const resto = n % 1000;
  const milharTxt = milhar > 0 ? (milhar === 1 ? "mil" : ate999(milhar) + " mil") : "";
  const restoTxt = resto > 0 ? ate999(resto) : "";
  if (milhar > 0 && resto > 0) {
    if (resto < 100 || resto % 100 === 0) return milharTxt + " e " + restoTxt;
    return milharTxt + ", " + restoTxt;
  }
  return milhar > 0 ? milharTxt : restoTxt;
}

export function valorExtenso(valor: number): string {
  valor = Math.round(valor * 100) / 100;
  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);
  let txt = extensoInteiro(inteiro) + " " + (inteiro === 1 ? "real" : "reais");
  if (centavos > 0) txt += " e " + extensoInteiro(centavos) + " " + (centavos === 1 ? "centavo" : "centavos");
  return txt;
}

export function moeda(v: number | undefined): string {
  return (
    "R$ " +
    Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

// ───────────────────────── Datas ─────────────────────────

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function dataExtenso(iso: string | undefined): string {
  if (!iso) return "____/____/______";
  const [y, m, d] = iso.split("-").map(Number);
  return d + " de " + MESES[m - 1] + " de " + y;
}

function addMeses(iso: string, n: number): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1 + n, d);
}

function dataExtensoObj(dt: Date): string {
  return dt.getDate() + " de " + MESES[dt.getMonth()] + " de " + dt.getFullYear();
}

function diffDias(iso1: string, iso2: string): number {
  const a = new Date(iso1);
  const b = new Date(iso2);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** yyyy-mm-dd de hoje, no fuso do servidor (usado como default de dataAssinatura). */
export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────── Ordinais das cláusulas ───────────────────

const ORDINAIS = [
  "PRIMEIRA",
  "SEGUNDA",
  "TERCEIRA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SÉTIMA",
  "OITAVA",
  "NONA",
  "DÉCIMA",
  "DÉCIMA PRIMEIRA",
  "DÉCIMA SEGUNDA",
  "DÉCIMA TERCEIRA",
  "DÉCIMA QUARTA",
  "DÉCIMA QUINTA",
];

// ─────── Validação e máscara de documentos e contato ───────

export function limparNumeros(v: string | undefined): string {
  return (v || "").replace(/\D/g, "");
}

export function formatarCPF(v: string): string {
  v = limparNumeros(v).slice(0, 11);
  if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
  if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
  if (v.length > 3) return v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
  return v;
}

export function validarCPF(cpfRaw: string): boolean {
  const cpf = limparNumeros(cpfRaw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf[10])) return false;
  return true;
}

export function formatarCNPJ(v: string): string {
  v = limparNumeros(v).slice(0, 14);
  if (v.length > 12) return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, "$1.$2.$3/$4-$5");
  if (v.length > 8) return v.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, "$1.$2.$3/$4");
  if (v.length > 5) return v.replace(/(\d{2})(\d{3})(\d{1,3})/, "$1.$2.$3");
  if (v.length > 2) return v.replace(/(\d{2})(\d{1,3})/, "$1.$2");
  return v;
}

export function validarCNPJ(cnpjRaw: string): boolean {
  const cnpj = limparNumeros(cnpjRaw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += parseInt(base[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  if (calc(cnpj.slice(0, 12)) !== parseInt(cnpj[12])) return false;
  if (calc(cnpj.slice(0, 13)) !== parseInt(cnpj[13])) return false;
  return true;
}

export function formatarTelefone(v: string): string {
  v = limparNumeros(v).slice(0, 11);
  if (v.length > 10) return v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (v.length > 6) return v.replace(/(\d{2})(\d{4})(\d{1,4})/, "($1) $2-$3");
  if (v.length > 2) return v.replace(/(\d{2})(\d{1,4})/, "($1) $2");
  if (v.length > 0) return "(" + v;
  return v;
}

export function validarTelefone(v: string): boolean {
  const n = limparNumeros(v);
  return n.length === 10 || n.length === 11;
}

export function validarEmail(v: string | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || "").trim());
}

/**
 * Compara nomes tolerando maiúsculas/minúsculas e acentos. Usado tanto no
 * cliente (ContractSignForm.tsx, aviso visual) quanto no servidor
 * (api/contracts/[token]/sign/route.ts, reverificação — o cliente não é
 * confiável). Fica aqui, não em contract-token.ts, porque este módulo é
 * seguro de importar do lado do navegador (sem `crypto` do Node).
 */
export function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  return norm(a) === norm(b);
}

/** Compara CPF/CNPJ ignorando pontuação. Mesmo motivo de namesMatch acima. */
export function documentsMatch(a: string, b: string): boolean {
  const digits = (s: string) => s.replace(/\D/g, "");
  return digits(a) === digits(b) && digits(a).length > 0;
}

/**
 * Monta o link https://wa.me/... para enviar o link de assinatura por
 * WhatsApp. Sempre um clique manual (abre o WhatsApp Web/app com a
 * mensagem pronta) — a EA não tem WhatsApp Business API, não existe envio
 * automático. Usado tanto no envio inicial (ContractGeneratorForm.tsx)
 * quanto no reenvio (ContractSaveButton.tsx).
 */
export function buildWhatsAppSignUrl(opts: {
  clientPhone: string;
  clientName?: string;
  planoNome: string;
  signUrl: string;
}): string {
  const digits = (opts.clientPhone || "").replace(/\D/g, "");
  const msg = `Olá${opts.clientName ? ", " + opts.clientName : ""}! Segue o contrato de ${opts.planoNome} da Empresarial Academy para leitura e assinatura eletrônica: ${opts.signUrl}`;
  return `https://wa.me/55${digits}?text=${encodeURIComponent(msg)}`;
}

// ───────────────────── Etapas (projeto) ─────────────────────

function textoEtapas(etapas: Etapa[] | undefined): string {
  const validas = (etapas || []).filter((e) => (e.nome || "").trim());
  if (!validas.length) return "[ETAPAS DO PROJETO A DEFINIR]";
  return validas
    .map((e, i) => `${i + 1}) ${e.nome}${e.prazo ? " (" + e.prazo + ")" : ""}${e.descricao ? ": " + e.descricao : ""}.`)
    .join(" ");
}

// ───────────────────── Construção das cláusulas ─────────────────────

function construirQualificacao(input: ContractInput): { bloco: string; endereco: string; email: string; tel: string } {
  let bloco: string;
  if (input.tipoPessoa === "PF") {
    const nome = input.pfNome || "[NOME DO CLIENTE]";
    const cpf = input.pfCpf || "[CPF]";
    bloco = `<b>${nome}</b>, inscrito(a) no CPF sob o nº ${cpf}, doravante denominado(a) simplesmente <b>CONTRATANTE</b>`;
  } else {
    const razao = input.pjRazao || "[RAZÃO SOCIAL]";
    const fantasia = input.pjFantasia;
    const cnpj = input.pjCnpj || "[CNPJ]";
    const repNome = input.pjRepNome || "[NOME DO REPRESENTANTE]";
    const repCpf = input.pjRepCpf || "[CPF DO REPRESENTANTE]";
    const repCargo = input.pjRepCargo || "representante legal";
    bloco = `<b>${razao}</b>${fantasia ? " (" + fantasia + ")" : ""}, inscrita no CNPJ sob o nº ${cnpj}, doravante denominada simplesmente <b>CONTRATANTE</b>, neste ato representada por seu(sua) ${repCargo} ${repNome}, inscrito(a) no CPF sob o nº ${repCpf}`;
  }
  const endereco = input.clienteEndereco || "[ENDEREÇO DO CLIENTE]";
  const email = input.clienteEmail || "[E-MAIL]";
  const tel = input.clienteTelefone || "[TELEFONE]";
  return { bloco, endereco, email, tel };
}

function clausulaPartes(qual: ReturnType<typeof construirQualificacao>): string {
  return (
    `<p><b>CONTRATADA:</b> ${EA.razaoSocial}, ${EA.natureza}, inscrita no CNPJ sob o nº ${EA.cnpj}, com sede na ${EA.endereco}, operando sob o nome fantasia ${EA.nomeFantasia}, neste ato representada por seu titular ${EA.titular}, doravante denominada simplesmente <b>CONTRATADA</b>.</p>` +
    `<p><b>CONTRATANTE:</b> ${qual.bloco}, com endereço em ${qual.endereco}, e-mail ${qual.email} e telefone ${qual.tel}.</p>` +
    `<p>As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas e condições a seguir estabelecidas.</p>`
  );
}

export function clausulaObjeto(input: ContractInput): string {
  if (input.contractType === "projeto") {
    const nome = input.projNome || "[NOME DO PROJETO]";
    const desc = input.projDescricao || "[DESCRIÇÃO DO ESCOPO A DEFINIR]";
    return `<p>A CONTRATADA prestará à CONTRATANTE o projeto personalizado denominado "${nome}", com o seguinte escopo geral: ${desc}</p><p>O projeto será executado nas seguintes etapas: ${textoEtapas(input.etapas)}</p>`;
  }
  const plano = PLANOS[input.contractType] as PlanoRecorrente | PlanoFixo;
  let texto = `<p>A CONTRATADA ${plano.objeto}</p>`;
  if (input.contractType === "mentoria" || input.contractType === "consultoria") {
    const h = input.horizonte || "trimestral";
    texto += `<p>${(plano as PlanoRecorrente).horizontes[h].cadencia}</p>`;
  }
  return texto;
}

export function clausulaPrazo(input: ContractInput): string {
  const inicio = input.dataInicio;
  if (input.contractType === "mentoria" || input.contractType === "consultoria") {
    const h = input.horizonte || "trimestral";
    const meses = (PLANOS[input.contractType] as PlanoRecorrente).horizontes[h].meses;
    const fim = inicio ? dataExtensoObj(addMeses(inicio, meses)) : "[DATA DE TÉRMINO]";
    return `<p>O presente contrato vigorará pelo prazo de ${meses} (${extensoInteiro(meses)}) meses, com início em ${dataExtenso(inicio)} e término em ${fim}, podendo ser renovado mediante acordo expresso e por escrito entre as partes.</p>`;
  }
  if (input.contractType === "conselho") {
    return `<p>O presente contrato vigorará por prazo indeterminado, com início em ${dataExtenso(inicio)}, podendo ser rescindido por qualquer das partes na forma prevista na cláusula de rescisão.</p>`;
  }
  if (input.contractType === "projeto") {
    const duracao = input.projDuracao || "[DURAÇÃO A DEFINIR]";
    const entrega = input.projDataEntrega;
    return `<p>O projeto terá duração total estimada de ${duracao}, com início em ${dataExtenso(inicio)} e entrega final prevista para ${entrega ? dataExtenso(entrega) : "[DATA A DEFINIR]"}.</p>`;
  }
  return `<p>O serviço objeto deste contrato será executado em prestação única, com a imersão, presencial ou online, a ser agendada em comum acordo entre as partes e a entrega do relatório executivo e do plano de ação em até 10 (dez) dias úteis após a sua realização.</p>`;
}

export function clausulaValor(input: ContractInput): string {
  const dia = input.diaVencimento || 10;
  const forma = input.formaPagamento || "PIX";
  const inicio = input.dataInicio;

  if (input.contractType === "projeto") {
    const total = input.projValorTotal || 0;
    const n = input.projParcelas || 1;
    const parcela = input.projValorParcela || total / n;
    return `<p>Pelo projeto descrito na Cláusula Primeira, a CONTRATANTE pagará à CONTRATADA o valor total de ${moeda(total)} (${valorExtenso(total)}), a ser quitado em ${n} (${extensoInteiro(n)}) ${n > 1 ? "parcelas" : "parcela única"} de ${moeda(parcela)} cada, com vencimento todo dia ${dia} de cada mês, mediante ${forma}, iniciando-se em ${dataExtenso(inicio)}.</p>`;
  }

  const valor = input.valorMensal || 0;
  let texto = "";

  if (input.contractType === "diagnostico") {
    texto += `<p>Pela prestação do serviço descrito na Cláusula Primeira, a CONTRATANTE pagará à CONTRATADA o valor único de ${moeda(valor)} (${valorExtenso(valor)}), mediante ${forma}, cujo pagamento condiciona o agendamento da imersão.</p>`;
    texto += `<p>Caso a CONTRATANTE venha a contratar a Mentoria Executiva Gestão 360™ ou a Consultoria de Negócios Hands-On Gestão 360™ em até 30 (trinta) dias contados da data de pagamento deste contrato, o valor aqui pago será integralmente abatido da primeira mensalidade do contrato subsequente.</p>`;
    return texto;
  }

  texto += `<p>Pela prestação dos serviços descritos na Cláusula Primeira, a CONTRATANTE pagará à CONTRATADA o valor mensal de ${moeda(valor)} (${valorExtenso(valor)}), com vencimento todo dia ${dia} de cada mês, mediante ${forma}, iniciando-se em ${dataExtenso(inicio)}.</p>`;

  if (input.temDiagnostico) {
    const diagValor = input.diagValor || 0;
    const diagData = input.diagData;
    const foraPrazo = Boolean(input.diagForaPrazo);
    const dias = diagData && inicio ? diffDias(diagData, inicio) : null;
    if (dias !== null && dias <= 30) {
      texto += `<p>A CONTRATANTE contratou anteriormente o Diagnóstico Executivo 360™, no valor de ${moeda(diagValor)}, em ${dataExtenso(diagData)}. Em razão de o presente contrato ter sido firmado em até 30 (trinta) dias contados daquela contratação, o valor integral do Diagnóstico Executivo 360™ será abatido da primeira mensalidade devida neste contrato.</p>`;
    } else if (dias !== null && dias > 30 && foraPrazo) {
      texto += `<p>A CONTRATANTE contratou anteriormente o Diagnóstico Executivo 360™, no valor de ${moeda(diagValor)}, em ${dataExtenso(diagData)}. Ainda que o prazo padrão de 30 (trinta) dias para o abatimento tenha decorrido, a CONTRATADA concede, por liberalidade e a título de condição especial deste contrato, o abatimento integral do valor do Diagnóstico Executivo 360™ na primeira mensalidade devida neste contrato.</p>`;
    } else if (dias !== null && dias > 30) {
      texto += `<p>A CONTRATANTE contratou anteriormente o Diagnóstico Executivo 360™, no valor de ${moeda(diagValor)}, em ${dataExtenso(diagData)}, fora do prazo padrão de 30 (trinta) dias para abatimento na primeira mensalidade deste contrato. Nenhum crédito é aplicado, salvo condição especial pactuada em cláusula própria.</p>`;
    }
  }

  if (input.clausulaReajuste) {
    texto += `<p>Em caso de renovação após o término da vigência inicial, o valor mensal poderá ser reajustado, por acordo entre as partes, com base na variação acumulada do IPCA (Índice Nacional de Preços ao Consumidor Amplo) no período, ou outro índice que vier a substituí-lo.</p>`;
  }

  return texto;
}

export function clausulaObrigacoesContratada(): string {
  return "<p>Constituem obrigações da CONTRATADA: (i) prestar os serviços descritos neste contrato com zelo, diligência e observância da metodologia Gestão 360™; (ii) manter sigilo sobre as informações da CONTRATANTE a que tiver acesso em razão da prestação dos serviços; (iii) disponibilizar os materiais e ferramentas previstos no objeto deste contrato; e (iv) comunicar previamente a CONTRATANTE sobre qualquer impedimento que afete a realização dos encontros ou atividades programadas, propondo nova data.</p>";
}

export function clausulaObrigacoesContratante(): string {
  return "<p>Constituem obrigações da CONTRATANTE: (i) fornecer, em tempo hábil, as informações e os dados necessários à execução dos serviços; (ii) viabilizar o acesso da CONTRATADA às pessoas, processos e sistemas relevantes ao objeto deste contrato; (iii) efetuar os pagamentos nas datas e condições pactuadas; e (iv) designar um responsável interno para interlocução com a CONTRATADA ao longo da vigência contratual.</p>";
}

export function clausulaConfidencialidade(): string {
  return '<p>As partes se comprometem a manter sigilo sobre todas as informações confidenciais trocadas em razão deste contrato, incluindo dados comerciais, financeiros, operacionais e estratégicos, não as divulgando a terceiros sem autorização prévia e por escrito da outra parte, sob pena de responsabilização pelas perdas e danos causados.</p><p>O tratamento de dados pessoais realizado no âmbito deste contrato observará a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais), sendo os dados coletados utilizados exclusivamente para a execução dos serviços aqui previstos.</p>';
}

export function clausulaPropriedadeIntelectual(): string {
  return "<p>A metodologia Gestão 360™, o Painel Gestão 360™, os materiais, roteiros, templates e demais conteúdos desenvolvidos ou utilizados pela CONTRATADA na prestação dos serviços permanecem de titularidade exclusiva da CONTRATADA. A CONTRATANTE recebe licença de uso não exclusiva, restrita ao uso interno da própria empresa, durante e após a vigência deste contrato, vedadas a reprodução, distribuição ou comercialização a terceiros sem autorização expressa da CONTRATADA.</p>";
}

export function textoBonus(input: ContractInput): string[] {
  const trechos: string[] = [];
  if (input.bonusMesGratis) {
    trechos.push(
      "A CONTRATADA concede à CONTRATANTE 1 (um) mês adicional de prestação dos serviços descritos na Cláusula Primeira, sem custo adicional, como condição especial de fechamento deste contrato.",
    );
  }
  if (input.bonusVisitaExtra) {
    trechos.push(
      "A CONTRATADA concede à CONTRATANTE 1 (uma) visita presencial adicional, sem custo adicional, a ser realizada no primeiro mês de vigência deste contrato.",
    );
  }
  if (input.bonusIndicacao) {
    const perc = input.indicacaoPerc || 10;
    trechos.push(
      `Em razão de a presente contratação decorrer de indicação de cliente já atendido pela CONTRATADA, no âmbito do Programa Indique um Sócio, fica concedido desconto de ${perc}% (${extensoInteiro(perc)} por cento) sobre o valor da primeira mensalidade devida neste contrato.`,
    );
  }
  if (input.bonusIsencaoMulta) {
    trechos.push(
      "Fica a CONTRATANTE isenta da multa rescisória prevista na Cláusula de Rescisão caso a rescisão ocorra dentro dos primeiros 3 (três) meses de vigência deste contrato, mantendo-se, ainda assim, a obrigatoriedade do aviso prévio ali estabelecido.",
    );
  }
  if (input.bonusParcelamento) {
    const n = input.parcelamentoN || 2;
    trechos.push(
      `Fica facultado à CONTRATANTE o parcelamento da primeira mensalidade devida neste contrato em ${n} (${extensoInteiro(n)}) vezes, sem acréscimo, mediante acordo prévio com a CONTRATADA sobre as datas de vencimento de cada parcela.`,
    );
  }
  const livre = (input.paragrafoLivre || "").trim();
  if (livre) trechos.push(livre);
  return trechos;
}

export function clausulaAssinaturaEletronica(): string {
  return (
    '<p>As partes reconhecem e aceitam que o presente contrato poderá ser firmado por meio de assinatura eletrônica, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001, sendo válida entre as partes independentemente de certificação pela Infraestrutura de Chaves Públicas Brasileira (ICP-Brasil), desde que a forma de comprovação de autoria e integridade aqui descrita seja por elas aceita.</p>' +
    "<p>A assinatura eletrônica será realizada mediante acesso a link exclusivo enviado ao e-mail e/ou telefone informados na qualificação das partes, sendo a autoria do aceite atribuída à CONTRATANTE mediante confirmação de nome completo e CPF (ou CNPJ e dados do representante legal, quando pessoa jurídica) e manifestação expressa de ciência e concordância com os termos deste contrato.</p>" +
    "<p>Serão registrados como evidência da assinatura, e ficarão arquivados pela CONTRATADA à disposição de ambas as partes: a data e a hora do aceite, o endereço de protocolo de internet (IP) do signatário, e um código de verificação (hash) do documento assinado, apto a comprovar que o conteúdo do contrato não foi alterado após a assinatura. A CONTRATADA enviará confirmação da assinatura por e-mail à CONTRATANTE e manterá cópia da confirmação em seus próprios registros.</p>" +
    "<p>A CONTRATANTE declara estar ciente de que a assinatura eletrônica prevista nesta cláusula tem, para os fins deste contrato, a mesma validade jurídica da assinatura manuscrita, comprometendo-se a não impugnar sua validade ou executoriedade unicamente em razão do meio eletrônico utilizado.</p>"
  );
}

export function clausulaRescisao(input: ContractInput): string {
  if (input.contractType === "conselho") {
    return "<p>Qualquer das partes poderá rescindir o presente contrato a qualquer tempo, mediante aviso prévio por escrito com antecedência mínima de 1 (um) mês, sem incidência de multa, por se tratar de contrato de prazo indeterminado.</p>";
  }
  if (input.contractType === "diagnostico") {
    return "<p>O cancelamento pela CONTRATANTE após a confirmação do agendamento da imersão, com antecedência inferior a 5 (cinco) dias úteis da data marcada, sujeitará a CONTRATANTE à retenção de 30% (trinta por cento) do valor pago, a título de custos de preparação e reserva de agenda. Cancelamentos com antecedência superior ensejam devolução integral do valor pago.</p>";
  }
  if (input.contractType === "projeto") {
    return "<p>Em caso de rescisão pela CONTRATANTE após o início da execução do projeto, serão devidos os valores proporcionais às etapas já iniciadas ou concluídas até a data da rescisão, além de multa equivalente a 20% (vinte por cento) do saldo remanescente do valor total do projeto, ressalvadas as hipóteses de rescisão por justa causa devidamente comprovada. O aviso prévio mínimo para rescisão é de 1 (um) mês.</p>";
  }
  return "<p>Qualquer das partes poderá rescindir o presente contrato antes do término da vigência, mediante aviso prévio por escrito com antecedência mínima de 1 (um) mês. A rescisão imotivada por iniciativa de qualquer das partes antes do término da vigência acarretará multa equivalente a 1 (uma) mensalidade vigente à data da rescisão, devida pela parte que der causa, ressalvadas as hipóteses de rescisão por justa causa devidamente comprovada. A multa não se aplica ao término natural da vigência contratual nem à hipótese de não renovação.</p>";
}

export function clausulaDisposicoesGerais(): string {
  return "<p>O presente contrato obriga as partes e seus eventuais sucessores a qualquer título. Nenhuma tolerância quanto ao descumprimento de qualquer cláusula será considerada novação ou renúncia ao direito de exigi-la. Alterações a este contrato somente produzirão efeitos se formalizadas por escrito e assinadas por ambas as partes.</p>";
}

export function clausulaForo(): string {
  return "<p>Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer questões oriundas do presente contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>";
}

// ───────────────────── Montagem completa ─────────────────────

export type BuiltContract = {
  /** HTML completo do contrato, igual ao render() do arquivo de referência. */
  html: string;
  /** Nome do plano contratado (subtítulo do contrato). */
  planoNome: string;
  /** Nome/razão social do contratante (para assunto de e-mail etc.). */
  nomeContratante: string;
};

/**
 * Monta o contrato completo (mesma numeração de cláusulas via ordinais
 * portugueses, mesmas referências cruzadas do arquivo de referência: note
 * que a Cláusula de Valor referencia corretamente "Cláusula Primeira" para
 * o Objeto, sem reintroduzir o off-by-one já corrigido lá).
 *
 * A assinatura eletrônica é sempre incluída (este fluxo só existe para
 * contratos assinados eletronicamente pelo link de EA HUB) e o bloco de
 * testemunhas do arquivo de referência (usado só na assinatura manuscrita)
 * é omitido.
 */
export function buildContractHtml(input: ContractInput): BuiltContract {
  const plano = input.contractType === "projeto" ? PLANOS.projeto : PLANOS[input.contractType];
  const qual = construirQualificacao(input);

  const clausulas: { titulo: string; corpo: string }[] = [
    { titulo: "Do Objeto", corpo: clausulaObjeto(input) },
    { titulo: "Do Prazo e da Vigência", corpo: clausulaPrazo(input) },
    { titulo: "Do Valor e das Condições de Pagamento", corpo: clausulaValor(input) },
    { titulo: "Das Obrigações da CONTRATADA", corpo: clausulaObrigacoesContratada() },
    { titulo: "Das Obrigações da CONTRATANTE", corpo: clausulaObrigacoesContratante() },
    { titulo: "Da Confidencialidade e da Proteção de Dados Pessoais", corpo: clausulaConfidencialidade() },
    { titulo: "Da Propriedade Intelectual", corpo: clausulaPropriedadeIntelectual() },
  ];

  const bonus = textoBonus(input);
  if (bonus.length) {
    clausulas.push({
      titulo: "Dos Bônus, Exceções e Condições Especiais",
      corpo: bonus.map((t) => `<p>${t}</p>`).join(""),
    });
  }

  clausulas.push({ titulo: "Da Rescisão", corpo: clausulaRescisao(input) });
  clausulas.push({ titulo: "Da Assinatura Eletrônica", corpo: clausulaAssinaturaEletronica() });
  clausulas.push({ titulo: "Das Disposições Gerais", corpo: clausulaDisposicoesGerais() });
  clausulas.push({ titulo: "Do Foro", corpo: clausulaForo() });

  let html = "<h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h2>";
  html += `<p class="subtitulo">${plano.nome}</p>`;
  html += `<div class="partes">${clausulaPartes(qual)}</div>`;

  clausulas.forEach((c, i) => {
    html += `<p class="clausula-titulo">CLÁUSULA ${ORDINAIS[i]} &middot; ${c.titulo.toUpperCase()}</p>`;
    html += c.corpo;
  });

  const local = input.localAssinatura || "São Paulo/SP";
  const dataAss = input.dataAssinatura || hojeISO();
  html += `<p class="local-data">${local}, ${dataExtenso(dataAss)}.</p>`;
  html +=
    "<p>As partes firmam o presente instrumento por meio de assinatura eletrônica, na forma da Cláusula de Assinatura Eletrônica acima, dispensando-se reconhecimento de firma e testemunhas.</p>";

  const nomeContratante =
    input.tipoPessoa === "PF" ? input.pfNome || "[NOME DO CLIENTE]" : input.pjRazao || "[RAZÃO SOCIAL]";

  html += "<div class='assinaturas'>";
  html += `<div class="linha-assinatura">${EA.razaoSocial}<br>CONTRATADA</div>`;
  html += `<div class="linha-assinatura">${nomeContratante}<br>CONTRATANTE</div>`;
  html += "</div>";

  return { html, planoNome: plano.nome, nomeContratante };
}

/** Remove tags HTML para gerar uma versão texto simples (e-mail, cópia). */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<\/(p|div|h2)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
