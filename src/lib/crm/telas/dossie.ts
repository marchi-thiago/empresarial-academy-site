/**
 * Leitura tolerante do dossiê e do kit de mensagens. Quem grava é o EA Hunter (F2),
 * e o formato exato ainda pode mudar: por isso nada aqui depende de chave fixa.
 * Tudo vira texto legível; o que não se entende aparece com o nome da chave humanizado.
 */

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Chave comparável: sem acento, minúscula, sem separador ("dor_provavel" = "dorProvavel"). */
export const normalizarChave = (s: string) => semAcento(s).toLowerCase().replace(/[^a-z0-9]/g, "");

/** Rótulos com acento para os termos que o dossiê e o kit do plano usam (seção 10, F2). */
const TERMOS: Record<string, string> = {
  decisor: "Decisor",
  empresa: "Empresa",
  dorprovavel: "Dor provável",
  dor: "Dor",
  gancho: "Gancho",
  prova: "Prova",
  provaescolhida: "Prova escolhida",
  tom: "Tom",
  noperfil: "Está no perfil",
  estanoperfil: "Está no perfil",
  dadosquefaltam: "Dados que faltam",
  faltam: "Dados que faltam",
  nome: "Nome",
  cargo: "Cargo",
  segmento: "Segmento",
  porte: "Porte",
  faturamento: "Faturamento",
  resumo: "Resumo",
  assunto: "Assunto",
  corpo: "Mensagem",
  texto: "Mensagem",
  mensagem: "Mensagem",
  objecoes: "Objeções",
  objecao: "Objeção",
  resposta: "Resposta",
  ligacao: "Ligação",
  roteiro: "Roteiro",
  ultimotoque: "Último toque",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  email: "E-mail",
  dm: "DM",
};

export function humanizar(chave: string): string {
  const n = normalizarChave(chave);
  if (TERMOS[n]) return TERMOS[n];
  const joined = chave
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .trim()
    .toLowerCase();
  // "dm1" / "email 2" -> "DM 1" / "E-mail 2"
  const m = /^([a-z]+?)\s?(\d+)$/.exec(semAcento(joined));
  if (m && TERMOS[m[1]]) return `${TERMOS[m[1]]} ${m[2]}`;
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

const ehObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const vazio = (v: unknown) =>
  v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.length === 0) || (ehObj(v) && Object.keys(v).length === 0);

/** Valor simples (texto, número, sim/não) como texto. */
function escalar(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return null;
}

/** O campo json pode chegar como texto (importação antiga): tenta ler. */
function comoObjeto(d: unknown): unknown {
  if (typeof d === "string") {
    try {
      return JSON.parse(d);
    } catch {
      return d;
    }
  }
  return d;
}

/* ------------------------------------------------------------------ dossiê */

export type Par = { rotulo: string; valor: string };

/** Dossiê como lista de pares rótulo e valor, pronta para exibir. Objeto aninhado vira "Pai: filho". */
export function dossieParaLeitura(d: unknown): Par[] {
  const dados = comoObjeto(d);
  if (typeof dados === "string") return dados.trim() ? [{ rotulo: "Dossiê", valor: dados.trim() }] : [];
  const out: Par[] = [];
  const visitar = (v: unknown, rotulo: string) => {
    if (vazio(v)) return;
    const esc = escalar(v);
    if (esc !== null) {
      out.push({ rotulo, valor: esc });
      return;
    }
    if (Array.isArray(v)) {
      const itens = v
        .map((x) => escalar(x) ?? (ehObj(x) ? Object.values(x).map(escalar).filter(Boolean).join(": ") : ""))
        .filter(Boolean);
      if (itens.length) out.push({ rotulo, valor: itens.join("\n") });
      return;
    }
    if (ehObj(v)) for (const [k, x] of Object.entries(v)) visitar(x, `${rotulo}: ${humanizar(k)}`);
  };
  if (ehObj(dados)) for (const [k, x] of Object.entries(dados)) visitar(x, humanizar(k));
  return out;
}

type Folha = { caminho: string; valor: string };

/** Todos os textos do dossiê, com o caminho normalizado ("decisor.nome"). */
function folhas(v: unknown, caminho = "", acc: Folha[] = []): Folha[] {
  const esc = escalar(v);
  if (esc !== null) acc.push({ caminho, valor: esc });
  else if (Array.isArray(v)) v.forEach((x, i) => folhas(x, `${caminho}.${i}`, acc));
  else if (ehObj(v)) for (const [k, x] of Object.entries(v)) folhas(x, caminho ? `${caminho}.${normalizarChave(k)}` : normalizarChave(k), acc);
  return acc;
}

/** Primeiro texto do dossiê cuja chave (qualquer nível) começa por `termo`: "faturamento", "dorprovavel"... */
export function campoDoDossie(d: unknown, termo: string): string | null {
  const alvo = normalizarChave(termo);
  return folhas(comoObjeto(d)).find((f) => f.caminho.split(".").some((seg) => seg.startsWith(alvo)))?.valor ?? null;
}

/** Endereço de perfil do LinkedIn do decisor, se o dossiê trouxer. */
export function linkedinDoDossie(d: unknown): string | null {
  for (const f of folhas(comoObjeto(d))) {
    const m = /(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/in\/[^\s"')]+/i.exec(f.valor);
    if (m) return m[0].startsWith("http") ? m[0] : `https://${m[0]}`;
  }
  return null;
}

/** Nome do decisor, se o dossiê trouxer (texto em `decisor` ou em `decisor.nome`). */
export function decisorDoDossie(d: unknown): string | null {
  const fs = folhas(comoObjeto(d));
  const pega = (c: string) => fs.find((f) => f.caminho === c)?.valor ?? null;
  return pega("decisor.nome") ?? pega("decisor") ?? pega("nomedodecisor") ?? pega("decisornome");
}

/* --------------------------------------------------------------------- kit */

export type CanalKit = "dm" | "email" | "whatsapp" | "ligacao" | "linkedin" | "geral";

export type BlocoKit = {
  id: string;
  titulo: string;
  canal: CanalKit;
  partes: { rotulo?: string; texto: string }[];
};

function canalDoCaminho(caminho: string): CanalKit {
  const n = normalizarChave(caminho);
  if (n.includes("linkedin")) return "linkedin";
  if (n.includes("ligac") || n.includes("roteiro") || n.includes("objec") || n.includes("telefon") || n.includes("call")) return "ligacao";
  if (n.includes("whats") || n.includes("zap")) return "whatsapp";
  if (n.includes("email")) return "email";
  if (n.startsWith("dm") || n.includes("direct") || n.includes("instagram")) return "dm";
  return "geral";
}

function soFolhas(v: Record<string, unknown>): boolean {
  return Object.values(v).every((x) => vazio(x) || escalar(x) !== null || (Array.isArray(x) && x.every((y) => escalar(y) !== null)));
}

/** Kit de mensagens em blocos exibíveis e copiáveis. */
export function kitParaBlocos(kit: unknown): BlocoKit[] {
  const dados = comoObjeto(kit);
  const blocos: BlocoKit[] = [];
  let n = 0;

  const novo = (caminho: string, titulo: string, partes: BlocoKit["partes"]) => {
    const p = partes.filter((x) => x.texto.trim());
    if (p.length) blocos.push({ id: `b${n++}`, titulo, canal: canalDoCaminho(caminho), partes: p });
  };

  const visitar = (v: unknown, caminho: string, titulo: string) => {
    if (vazio(v)) return;
    const esc = escalar(v);
    if (esc !== null) return novo(caminho, titulo, [{ texto: esc }]);
    if (Array.isArray(v)) {
      if (v.every((x) => escalar(x) !== null)) {
        // Variantes de uma mesma mensagem (ou lista de objeções em texto).
        return v.forEach((x, i) => novo(caminho, v.length > 1 ? `${titulo} (${i + 1})` : titulo, [{ texto: escalar(x)! }]));
      }
      return v.forEach((x, i) => visitar(x, `${caminho}.${i}`, v.length > 1 ? `${titulo} ${i + 1}` : titulo));
    }
    if (ehObj(v)) {
      if (soFolhas(v)) {
        const partes = Object.entries(v).flatMap(([k, x]) => {
          if (vazio(x)) return [];
          const rotulo = humanizar(k);
          return [{ rotulo, texto: Array.isArray(x) ? x.map((y) => escalar(y)).filter(Boolean).join("\n") : escalar(x)! }];
        });
        // "Assunto" sempre primeiro.
        partes.sort((a, b) => Number(normalizarChave(b.rotulo) === "assunto") - Number(normalizarChave(a.rotulo) === "assunto"));
        return novo(caminho, titulo, partes);
      }
      for (const [k, x] of Object.entries(v)) visitar(x, `${caminho}.${k}`, humanizar(k));
    }
  };

  if (ehObj(dados)) for (const [k, x] of Object.entries(dados)) visitar(x, k, humanizar(k));
  return blocos;
}

/** Texto do bloco pronto para colar: e-mail leva "Assunto:" na primeira linha. */
export function textoParaCopiar(b: BlocoKit): string {
  return b.partes
    .map((p) => {
      const r = normalizarChave(p.rotulo ?? "");
      if (r === "assunto") return `Assunto: ${p.texto}`;
      if (p.rotulo && !["mensagem", "corpo", "texto", "nota"].includes(r)) return `${p.rotulo}: ${p.texto}`;
      return p.texto;
    })
    .join("\n\n");
}

/** Roteiro da ligação para a Fila do dia (blocos do canal ligação, em texto corrido). */
export function roteiroDoKit(kit: unknown): string | null {
  const t = kitParaBlocos(kit)
    .filter((b) => b.canal === "ligacao")
    .map((b) => `${b.titulo}\n${textoParaCopiar(b)}`)
    .join("\n\n");
  return t || null;
}

/** Nota do convite do LinkedIn (primeiro bloco do canal LinkedIn). */
export function notaLinkedinDoKit(kit: unknown): string | null {
  const b = kitParaBlocos(kit).find((x) => x.canal === "linkedin");
  return b ? textoParaCopiar(b) : null;
}
