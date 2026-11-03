import { describe, expect, it } from "vitest";
import { dadosDoNovoLead } from "./novo-lead";

const base = { direcao: "entrada" as const, tipo: "respondido" as const };

describe("card novo para quem responde e não é lead", () => {
  it("DM: grava o @ normalizado e usa o nome do perfil", () => {
    expect(dadosDoNovoLead({ ...base, canal: "dm", lead: { instagram: "@Padaria_Sol" }, novoLead: { nome: " Ana  Souza ", empresa: "Padaria Sol" } })).toEqual({
      name: "Ana Souza",
      company: "Padaria Sol",
      instagram: "@padaria_sol",
      source: "EA Flow (Instagram)",
      dealStatus: "captado",
    });
  });

  it("WhatsApp sem nome: o número vira o nome", () => {
    expect(dadosDoNovoLead({ ...base, canal: "whatsapp", lead: { whatsapp: "+55 11 93340-0264" }, novoLead: {} })).toEqual({
      name: "+5511933400264",
      company: undefined,
      whatsapp: "5511933400264",
      source: "EA Flow (WhatsApp)",
      dealStatus: "captado",
    });
  });

  it("sem pedido explícito do chamador, nada é criado", () => {
    expect(dadosDoNovoLead({ ...base, canal: "dm", lead: { instagram: "@x" }, novoLead: undefined })).toBeNull();
    expect(dadosDoNovoLead({ ...base, canal: "dm", lead: { instagram: "@x" }, novoLead: [] })).toBeNull();
  });

  it("só resposta de entrada por DM ou WhatsApp cria card", () => {
    const novoLead = { nome: "Ana" };
    expect(dadosDoNovoLead({ ...base, tipo: "descadastro", canal: "dm", lead: { instagram: "@x" }, novoLead })).toBeNull();
    expect(dadosDoNovoLead({ ...base, direcao: "saida", canal: "dm", lead: { instagram: "@x" }, novoLead })).toBeNull();
    expect(dadosDoNovoLead({ ...base, canal: "email", lead: { email: "a@b.com" }, novoLead })).toBeNull();
    expect(dadosDoNovoLead({ ...base, canal: "whatsapp", lead: { whatsapp: "12345" }, novoLead })).toBeNull();
    expect(dadosDoNovoLead({ ...base, canal: "dm", lead: { whatsapp: "11933400264" }, novoLead })).toBeNull();
  });
});
