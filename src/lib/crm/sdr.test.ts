import { describe, expect, it, vi } from "vitest";
import { alterarEstadoSdr, apresentarSdr, configSdr, SITUACAO_PADRAO, consultarEstadoSdr, contatoDoLead, textoLinhaDoTempo } from "./sdr";

const CONFIG = { url: "https://flow.exemplo.test", segredo: "segredo-de-teste" };
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

describe("apresentarSdr (estado para selo e botão)", () => {
  it("SDR atendendo: botão Tirar do SDR", () => {
    expect(apresentarSdr("sdr")).toMatchObject({ rotulo: "SDR atendendo", botao: { acao: "pausar", texto: "Tirar do SDR" } });
  });
  it("o estado padrão exibido é SDR atendendo (o SDR começa ligado)", () => {
    expect(apresentarSdr(SITUACAO_PADRAO).rotulo).toBe("SDR atendendo");
  });
  it("Com o Thiago: botão Voltar ao SDR", () => {
    expect(apresentarSdr("thiago")).toMatchObject({ rotulo: "Com o Thiago", botao: { acao: "retomar", texto: "Voltar ao SDR" } });
  });
  it("desligado: sem botão e com a dica da Secretaria", () => {
    const a = apresentarSdr("desligado");
    expect(a.rotulo).toBe("SDR desligado");
    expect(a.botao).toBeNull();
    expect(a.dica?.toLowerCase()).toContain("secretaria");
  });
  it("não configurado, sem contato e indisponível: sem botão", () => {
    expect(apresentarSdr("nao_configurado")).toMatchObject({ rotulo: "SDR não configurado", botao: null });
    expect(apresentarSdr("sem_contato").botao).toBeNull();
    expect(apresentarSdr("indisponivel").botao).toBeNull();
  });
  it("nenhum texto usa travessão", () => {
    for (const s of ["sdr", "thiago", "desligado", "nao_configurado", "sem_contato", "indisponivel"] as const) {
      const a = apresentarSdr(s);
      expect(`${a.rotulo} ${a.botao?.texto ?? ""} ${a.dica ?? ""}`).not.toMatch(/[—–]/);
    }
    expect(textoLinhaDoTempo("retomar")).not.toMatch(/[—–]/);
  });
});

describe("linha do tempo", () => {
  it("usa o texto combinado", () => {
    expect(textoLinhaDoTempo("retomar")).toBe("SDR retomado pelo Thiago");
    expect(textoLinhaDoTempo("pausar")).toBe("SDR pausado pelo Thiago");
  });
});

describe("configSdr", () => {
  it("exige as duas variáveis", () => {
    expect(configSdr({})).toBeNull();
    expect(configSdr({ EAFLOW_URL: "https://x.test" })).toBeNull();
    expect(configSdr({ SDR_SEGREDO: "s" })).toBeNull();
    expect(configSdr({ EAFLOW_URL: "  ", SDR_SEGREDO: "s" })).toBeNull();
  });
  it("tira a barra final e rejeita endereço sem http", () => {
    expect(configSdr({ EAFLOW_URL: "https://x.test/", SDR_SEGREDO: "s" })).toEqual({ url: "https://x.test", segredo: "s" });
    expect(configSdr({ EAFLOW_URL: "x.test", SDR_SEGREDO: "s" })).toBeNull();
  });
});

describe("contatoDoLead", () => {
  it("telefone em formato internacional e @ do Instagram", () => {
    expect(contatoDoLead({ whatsapp: "(11) 93340-0264", instagram: "https://instagram.com/Empresa/" })).toEqual({ telefone: "5511933400264", instagram: "@empresa" });
  });
  it("aceita só um dos dois e recusa nenhum", () => {
    expect(contatoDoLead({ whatsapp: null, instagram: "@so_insta" })).toEqual({ instagram: "@so_insta" });
    expect(contatoDoLead({ whatsapp: "11933400264", instagram: null })).toEqual({ telefone: "5511933400264" });
    expect(contatoDoLead({ whatsapp: "123", instagram: "" })).toBeNull();
  });
});

describe("consultarEstadoSdr", () => {
  it("GET autenticado com Bearer, pelo telefone", async () => {
    const f = vi.fn().mockResolvedValue(json({ estado: "thiago" }));
    const r = await consultarEstadoSdr({ telefone: "5511933400264", instagram: "@x" }, CONFIG, f);
    expect(r).toEqual({ ok: true, estado: "thiago" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://flow.exemplo.test/api/sdr/conversa?telefone=5511933400264");
    expect(init.method).toBe("GET");
    expect(init.headers.authorization).toBe("Bearer segredo-de-teste");
  });
  it("cai no Instagram (codificado) quando não há telefone", async () => {
    const f = vi.fn().mockResolvedValue(json({ estado: "sdr" }));
    await consultarEstadoSdr({ instagram: "@minha.empresa" }, CONFIG, f);
    expect(f.mock.calls[0][0]).toBe("https://flow.exemplo.test/api/sdr/conversa?instagram=%40minha.empresa");
  });
  it("sem configuração: não chama o EA Flow", async () => {
    const f = vi.fn();
    const r = await consultarEstadoSdr({ telefone: "5511933400264" }, null, f);
    expect(r).toMatchObject({ ok: false, situacao: "nao_configurado" });
    expect(f).not.toHaveBeenCalled();
  });
  it("erro HTTP, corpo inválido e falha de rede viram indisponível", async () => {
    expect(await consultarEstadoSdr({ telefone: "1" }, CONFIG, vi.fn().mockResolvedValue(json({}, 401)))).toMatchObject({ ok: false, situacao: "indisponivel" });
    expect(await consultarEstadoSdr({ telefone: "1" }, CONFIG, vi.fn().mockResolvedValue(json({ estado: "qualquer" })))).toMatchObject({ ok: false, situacao: "indisponivel" });
    expect(await consultarEstadoSdr({ telefone: "1" }, CONFIG, vi.fn().mockRejectedValue(new Error("rede")))).toMatchObject({ ok: false, situacao: "indisponivel" });
  });
});

describe("alterarEstadoSdr", () => {
  it("POST autenticado com { contato, acao }", async () => {
    const f = vi.fn().mockResolvedValue(json({ estado: "sdr" }));
    const contato = { telefone: "5511933400264", instagram: "@x" };
    const r = await alterarEstadoSdr(contato, "retomar", CONFIG, f);
    expect(r).toEqual({ ok: true, estado: "sdr" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://flow.exemplo.test/api/sdr/conversa");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer segredo-de-teste");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ contato, acao: "retomar" });
  });
  it("sem configuração: não chama o EA Flow", async () => {
    const f = vi.fn();
    expect(await alterarEstadoSdr({ telefone: "1" }, "pausar", null, f)).toMatchObject({ ok: false, situacao: "nao_configurado" });
    expect(f).not.toHaveBeenCalled();
  });
});
