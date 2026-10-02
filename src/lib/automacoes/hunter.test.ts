import { describe, expect, it } from "vitest";
import { automacaoValida, automacoesDoCorpo, automacoesDoHunter, CATALOGO_DO_HUNTER, LIMITE_SEM_SINAL_DO_HUNTER_MS, type StatusGuardadoDoHunter } from "./hunter";
import type { Automacao } from "./estado";

const agora = new Date("2026-10-02T14:00:00.000Z");
const haMin = (m: number) => new Date(agora.getTime() - m * 60_000);

const verde = (id: string, nome: string, grupo: Automacao["grupo"]): Automacao => ({
  id,
  nome,
  sistema: "hunter",
  grupo,
  estado: "ligado",
  numeros: [{ rotulo: "Itens", hoje: 3, semana: 9 }],
});
const statusCompleto = (): StatusGuardadoDoHunter => ({
  geradoEm: haMin(2).toISOString(),
  automacoes: CATALOGO_DO_HUNTER.map((c) => verde(c.id, c.nome, c.grupo)),
});

describe("automações do Hunter no painel", () => {
  it("nunca chegou sinal: todas paradas, sem sinal do PC e falta a chave do heartbeat", () => {
    const r = automacoesDoHunter({ agora, ultimoSinal: null, status: null });
    expect(r.automacoes).toHaveLength(CATALOGO_DO_HUNTER.length);
    expect(r.automacoes.every((a) => a.estado === "parado" && a.sistema === "hunter")).toBe(true);
    expect(r.automacoes[0]!.motivo).toBe("sem sinal do PC; falta a chave do heartbeat (OUTBOUND_TICK_SECRET no PC do Hunter)");
    expect(r.semSinal).toBe(r.automacoes[0]!.motivo);
  });

  it("sinal com mais de 45 min: todas paradas, PC sem sinal há tantos min, e os números velhos não aparecem", () => {
    const r = automacoesDoHunter({ agora, ultimoSinal: haMin(46), status: statusCompleto() });
    expect(r.automacoes.every((a) => a.estado === "parado" && a.numeros.length === 0)).toBe(true);
    expect(r.automacoes[0]!.motivo).toBe("PC sem sinal há 46 min");
  });

  it("o limite é de 45 min: 44 min ainda vale o status", () => {
    expect(LIMITE_SEM_SINAL_DO_HUNTER_MS).toBe(45 * 60_000);
    const r = automacoesDoHunter({ agora, ultimoSinal: haMin(44), status: statusCompleto() });
    expect(r.semSinal).toBeNull();
    expect(r.automacoes.every((a) => a.estado === "ligado")).toBe(true);
    expect(r.automacoes[0]!.numeros[0]).toEqual({ rotulo: "Itens", hoje: 3, semana: 9 });
  });

  it("sinal vivo mas sem status (Hunter antigo): paradas, pedindo para atualizar o Hunter", () => {
    const r = automacoesDoHunter({ agora, ultimoSinal: haMin(5), status: null });
    expect(r.automacoes.every((a) => a.estado === "parado")).toBe(true);
    expect(r.automacoes[0]!.motivo).toContain("atualizar o Hunter");
    expect(r.semSinal).toBeNull();
  });

  it("automação do catálogo que o Hunter não mandou aparece parada", () => {
    const s = statusCompleto();
    s.automacoes = s.automacoes.filter((a) => a.id !== "hunter-sdr");
    const r = automacoesDoHunter({ agora, ultimoSinal: haMin(5), status: s });
    expect(r.automacoes.find((a) => a.id === "hunter-sdr")).toMatchObject({ estado: "parado" });
    expect(r.automacoes.filter((a) => a.estado === "ligado")).toHaveLength(CATALOGO_DO_HUNTER.length - 1);
  });
});

describe("validação do corpo que vem do PC", () => {
  it("aceita o formato padrão e normaliza", () => {
    const a = automacaoValida({
      id: "hunter-dms",
      nome: "DMs",
      sistema: "qualquer",
      grupo: "Prospecção",
      estado: "erro",
      motivo: "falhou",
      numeros: [{ rotulo: "Enviadas", hoje: 1, semana: null }],
      ultimaExecucao: "2026-10-02T10:00:00.000Z",
      extra: "lixo",
    });
    expect(a).toEqual({
      id: "hunter-dms",
      nome: "DMs",
      sistema: "hunter",
      grupo: "Prospecção",
      estado: "erro",
      motivo: "falhou",
      numeros: [{ rotulo: "Enviadas", hoje: 1, semana: null }],
      ultimaExecucao: "2026-10-02T10:00:00.000Z",
    });
  });

  it.each([
    ["id de outro sistema", { id: "site-x", nome: "x", grupo: "Prospecção", estado: "ligado", numeros: [] }],
    ["estado inventado", { id: "hunter-x", nome: "x", grupo: "Prospecção", estado: "verde", numeros: [] }],
    ["grupo inventado", { id: "hunter-x", nome: "x", grupo: "Outro", estado: "ligado", numeros: [] }],
    ["números fora do formato", { id: "hunter-x", nome: "x", grupo: "Prospecção", estado: "ligado", numeros: [{ rotulo: "a", hoje: "1", semana: 2 }] }],
    ["não é objeto", "texto"],
  ])("recusa: %s", (_nome, entrada) => {
    expect(automacaoValida(entrada)).toBeNull();
  });

  it("automacoesDoCorpo descarta o inválido e devolve lista vazia se não for lista", () => {
    expect(automacoesDoCorpo(undefined)).toEqual([]);
    expect(automacoesDoCorpo("x")).toEqual([]);
    expect(automacoesDoCorpo([{ id: "hunter-a", nome: "A", grupo: "Atendimento", estado: "parado", numeros: [] }, { lixo: true }])).toHaveLength(1);
  });
});

describe("grupo Infraestrutura (cotas do Neon e da Vercel)", () => {
  const infra = {
    id: "hunter-infra-neon-ea-flow",
    nome: "Neon: ea-flow",
    grupo: "Infraestrutura",
    estado: "erro",
    motivo: "Compute 72% da cota do mês",
    numeros: [{ rotulo: "Compute (CU-h)", hoje: 1.5, semana: 9 }],
    link: "https://empresarialacademy.com/eahub/apis",
  };

  it("aceita o grupo e o link https, sem filtrar", () => {
    const a = automacaoValida(infra)!;
    expect(a.grupo).toBe("Infraestrutura");
    expect(a.estado).toBe("erro");
    expect(a.link).toBe("https://empresarialacademy.com/eahub/apis");
  });

  it.each([["javascript:alert(1)"], ["http://sem-tls.example"], ["https://a b.example"], [123], ['https://x.example/"onmouseover=1']])("descarta link fora do padrão (%s)", (link) => {
    expect(automacaoValida({ ...infra, link })!.link).toBeUndefined();
  });

  it("os itens de infraestrutura que o Hunter manda aparecem como extras do status vivo", () => {
    const status: StatusGuardadoDoHunter = { geradoEm: haMin(2).toISOString(), automacoes: [...statusCompleto().automacoes, automacaoValida(infra)!] };
    const r = automacoesDoHunter({ agora, ultimoSinal: haMin(2), status });
    expect(r.automacoes.at(-1)!.id).toBe("hunter-infra-neon-ea-flow");
    expect(r.automacoes).toHaveLength(CATALOGO_DO_HUNTER.length + 1);
  });

  it("o corpo do sinal de vida comporta as automações de sempre mais as de infraestrutura (até 60)", () => {
    const muitas = Array.from({ length: 55 }, (_, i) => ({ ...infra, id: `hunter-infra-${i}` }));
    expect(automacoesDoCorpo(muitas)).toHaveLength(55);
    expect(automacoesDoCorpo([...muitas, ...muitas])).toHaveLength(60);
  });
});
