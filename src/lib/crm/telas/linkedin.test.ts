import { describe, expect, it } from "vitest";
import {
  calcularContadoresLinkedin,
  ehCandidatoLinkedin,
  ehSeguidorEa,
  MARCA_SEGUIDOR_EA,
  limparNotaLinkedin,
  montarFilaLinkedin,
  temDecisorDossie,
} from "./linkedin";
import { planejarAcao } from "./acoes";
import { aplicarEvento, type EstadoLead } from "../regras";
import { PESOS_PADRAO } from "../pesos";
import type { InteracaoFila, LeadFila } from "./fila";

const AGORA = new Date("2026-10-01T12:00:00.000Z");
const iso = (horasDelta: number) => new Date(AGORA.getTime() + horasDelta * 3_600_000).toISOString();

function lead(parcial: Partial<LeadFila> = {}): LeadFila {
  return {
    id: 1,
    nome: "Carlos Silva",
    empresa: "Metalúrgica Silva",
    segmento: "Indústria",
    campanha: null,
    origem: "hunter",
    etapa: "qualificado",
    temperatura: "frio",
    pontos: 0,
    entrega: { email: "nao_enviado", whatsapp: "nao_enviado", dm: "nao_enviada", linkedin: "nao_enviado" },
    proximoPasso: null,
    proximoPassoEm: null,
    proximoCanal: null,
    proximoToqueEm: null,
    pausada: false,
    canaisEncerrados: [],
    whatsapp: null,
    instagram: null,
    email: null,
    primeiroToqueEm: null,
    ultimoToqueCanal: null,
    reuniaoCanal: null,
    reuniaoToque: null,
    vendaCanal: null,
    vendaToque: null,
    atualizadoEm: AGORA.toISOString(),
    ...parcial,
  };
}

describe("F10 — LinkedIn semiautomático", () => {
  describe("limparNotaLinkedin", () => {
    it("remove travessões (em-dash e en-dash) substituindo por hífen", () => {
      const original = "Olá Carlos — vi sua empresa no mercado – excelente trabalho!";
      const limpo = limparNotaLinkedin(original);
      expect(limpo).toBe("Olá Carlos - vi sua empresa no mercado - excelente trabalho!");
      expect(limpo).not.toContain("—");
      expect(limpo).not.toContain("–");
    });

    it("limita a nota a no máximo 200 caracteres", () => {
      const longo = "A".repeat(250);
      const limpo = limparNotaLinkedin(longo, 200);
      expect(limpo).toHaveLength(200);
    });

    it("trata valores vazios e nulos", () => {
      expect(limparNotaLinkedin(null)).toBeNull();
      expect(limparNotaLinkedin(undefined)).toBeNull();
      expect(limparNotaLinkedin("   ")).toBeNull();
    });
  });

  describe("detecção de candidatos (decisor do dossiê ou seguidor EA)", () => {
    it("reconhece seguidor da página só com a marca explícita", () => {
      expect(ehSeguidorEa({ fonteCaptacao: MARCA_SEGUIDOR_EA })).toBe(true);
      expect(ehSeguidorEa({ source: "linkedin:seguidor_pagina_ea" })).toBe(true);
      expect(ehSeguidorEa({ campanha: "Seguidor_Pagina_EA 2026" })).toBe(true);
      expect(ehSeguidorEa({ origem: MARCA_SEGUIDOR_EA })).toBe(true);
    });

    it("seguidores de perfil de concorrente captados pelo Hunter NÃO são seguidores da EA", () => {
      expect(ehSeguidorEa({ fonteCaptacao: "seguidores de @concorrente" })).toBe(false);
      expect(ehSeguidorEa({ fonteCaptacao: "seguidores da página EA" })).toBe(false);
      expect(ehSeguidorEa({ campanha: "seguidores de um perfil", source: "EA Hunter" })).toBe(false);
      expect(ehSeguidorEa({ fonteCaptacao: "hashtag #industria" })).toBe(false);
    });

    it("reconhece decisor no dossiê por nome ou link", () => {
      expect(temDecisorDossie({ decisor: { nome: "Roberto Ramos" } })).toBe(true);
      expect(temDecisorDossie({ decisor: "Roberto Ramos" })).toBe(true);
      expect(temDecisorDossie({ contatos: ["https://www.linkedin.com/in/roberto-ramos/"] })).toBe(true);
      expect(temDecisorDossie({})).toBe(false);
      expect(temDecisorDossie(null)).toBe(false);
    });

    it("ehCandidatoLinkedin é verdadeiro para quem tem decisor OU seguidor", () => {
      expect(ehCandidatoLinkedin(lead({ dossie: { decisor: "João" } }))).toBe(true);
      expect(ehCandidatoLinkedin(lead({ campanha: MARCA_SEGUIDOR_EA }))).toBe(true);
      expect(ehCandidatoLinkedin(lead({}))).toBe(false);
    });
  });

  describe("calcularContadoresLinkedin (anti-ban: 15/dia, 100/semana)", () => {
    it("conta envios de hoje e da semana corretamente", () => {
      const interacoes: InteracaoFila[] = [
        { leadId: 1, canal: "linkedin", direcao: "saida", tipo: "enviado", data: iso(-2), pontos: 0 },
        { leadId: 2, canal: "linkedin", direcao: "saida", tipo: "enviado", data: iso(-5), pontos: 0 },
        // Envio de 3 dias atrás (entra na semana, não entra no dia)
        { leadId: 3, canal: "linkedin", direcao: "saida", tipo: "enviado", data: iso(-72), pontos: 0 },
        // Envio de 10 dias atrás (fora da semana de 7 dias)
        { leadId: 4, canal: "linkedin", direcao: "saida", tipo: "enviado", data: iso(-240), pontos: 0 },
        // Entrada (aceite) não conta como envio
        { leadId: 5, canal: "linkedin", direcao: "entrada", tipo: "entregue", data: iso(-1), pontos: 0 },
      ];

      const c = calcularContadoresLinkedin(interacoes, AGORA);
      expect(c.enviadosHoje).toBe(2);
      expect(c.restantesHoje).toBe(13);
      expect(c.limiteDiario).toBe(15);
      expect(c.atingiuLimiteDiario).toBe(false);

      expect(c.enviadosSemana).toBe(3);
      expect(c.restantesSemana).toBe(97);
      expect(c.limiteSemanal).toBe(100);
      expect(c.atingiuLimiteSemanal).toBe(false);
    });

    it("sinaliza quando atinge o limite diário de 15 convites", () => {
      const interacoes: InteracaoFila[] = Array.from({ length: 15 }, (_, i) => ({
        leadId: i + 1,
        canal: "linkedin",
        direcao: "saida",
        tipo: "enviado",
        data: iso(-1),
        pontos: 0,
      }));

      const c = calcularContadoresLinkedin(interacoes, AGORA);
      expect(c.enviadosHoje).toBe(15);
      expect(c.restantesHoje).toBe(0);
      expect(c.atingiuLimiteDiario).toBe(true);
    });
  });

  describe("montarFilaLinkedin", () => {
    it("organiza pendentes, enviados e aceitos, priorizando D2 da cadência", () => {
      const l1 = lead({
        id: 1,
        nome: "Ana Pereira",
        empresa: "Alpha Tech",
        dossie: { decisor: { nome: "Ana Pereira", linkedin: "https://www.linkedin.com/in/ana-tech/" } },
        kit: { linkedin: { nota: "Oi Ana — conheça nossa consultoria." } },
        proximoCanal: "linkedin", // D2 na cadência
      });
      const l2 = lead({
        id: 2,
        nome: "Bruno Souza",
        empresa: "Beta Alimentos",
        dossie: { decisor: "Bruno Souza" },
        kit: { linkedin: { nota: "Olá Bruno, vi sua empresa." } },
      });
      const l3 = lead({
        id: 3,
        nome: "Carla Dias",
        empresa: "Carla Flores",
        campanha: MARCA_SEGUIDOR_EA,
        entrega: { email: "nao_enviado", whatsapp: "nao_enviado", dm: "nao_enviada", linkedin: "convite_enviado" },
      });
      const l4 = lead({
        id: 4,
        nome: "Daniel Lima",
        empresa: "Daniel Log",
        dossie: { decisor: "Daniel" },
        entrega: { email: "nao_enviado", whatsapp: "nao_enviado", dm: "nao_enviada", linkedin: "aceito" },
      });

      const fila = montarFilaLinkedin([l1, l2, l3, l4], [], AGORA);

      expect(fila.pendentes).toHaveLength(2);
      expect(fila.enviados).toHaveLength(1);
      expect(fila.aceitos).toHaveLength(1);
      expect(fila.todos).toHaveLength(4);

      // l1 tem prioridade nos pendentes por estar no D2 da cadência
      expect(fila.pendentes[0].leadId).toBe(1);
      expect(fila.pendentes[0].emCadenciaD2).toBe(true);
      expect(fila.pendentes[0].linkedinDireto).toBe(true);
      expect(fila.pendentes[0].linkedinUrl).toBe("https://www.linkedin.com/in/ana-tech/");
      // Nota limpa sem travessão
      expect(fila.pendentes[0].nota).toBe("Oi Ana - conheça nossa consultoria.");

      // l2 usa busca por decisor + empresa
      expect(fila.pendentes[1].leadId).toBe(2);
      expect(fila.pendentes[1].linkedinDireto).toBe(false);
      expect(fila.pendentes[1].linkedinUrl).toContain("search/results/people");

      // l3 está em enviados
      expect(fila.enviados[0].leadId).toBe(3);

      // l4 está em aceitos
      expect(fila.aceitos[0].leadId).toBe(4);
    });
  });

  describe("planejarAcao com ações do LinkedIn", () => {
    it("planeja enviado_linkedin com canal linkedin e metadados", () => {
      const r = planejarAcao({ acao: "resultado", leadId: 10, resultado: "enviado_linkedin" }, "qualificado");
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.interacoes).toHaveLength(1);
      expect(r.interacoes[0]).toMatchObject({
        canal: "linkedin",
        direcao: "saida",
        tipo: "enviado",
        metadados: { toque: "linkedin" },
      });
    });

    it("planeja aceito_linkedin com tipo entregue (já existente no enum do banco)", () => {
      const r = planejarAcao({ acao: "resultado", leadId: 10, resultado: "aceito_linkedin" }, "qualificado");
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.interacoes).toHaveLength(1);
      expect(r.interacoes[0]).toMatchObject({
        canal: "linkedin",
        direcao: "entrada",
        tipo: "entregue",
        metadados: { toque: "linkedin" },
      });
    });
  });

  describe("regras do CRM com eventos de LinkedIn", () => {
    const estadoBase: EstadoLead = {
      etapa: "qualificado",
      temperatura: "frio",
      pontos: 0,
      cadencia: { pausada: false, motivoPausa: null, proximoCanal: "linkedin", canaisEncerrados: [], movidoManualEm: null },
      statusEntrega: { email: "nao_enviado", whatsapp: "nao_enviado", dm: "nao_enviada", linkedin: "nao_enviado" },
      origem: {
        primeiroToqueCanal: null,
        primeiroToqueEm: null,
        ultimoToqueCanal: null,
        ultimoToqueRotulo: null,
        reuniaoCanal: null,
        reuniaoToque: null,
        vendaCanal: null,
        vendaToque: null,
      },
      optOut: false,
    };

    it("atualiza statusEntrega.linkedin para convite_enviado e avança para em_cadencia", () => {
      const res = aplicarEvento(
        estadoBase,
        { canal: "linkedin", direcao: "saida", tipo: "enviado", data: AGORA },
        { pesos: PESOS_PADRAO, aberturasNaJanela: 0, pontosNaJanela: 0, agora: AGORA },
      );

      expect(res.lead.statusEntrega.linkedin).toBe("convite_enviado");
      expect(res.lead.etapa).toBe("em_cadencia");
      expect(res.lead.origem.primeiroToqueCanal).toBe("linkedin");
    });

    it("atualiza statusEntrega.linkedin para aceito quando o convite é aceito", () => {
      const estadoComEnvio: EstadoLead = {
        ...estadoBase,
        statusEntrega: { ...estadoBase.statusEntrega, linkedin: "convite_enviado" },
      };

      const res = aplicarEvento(
        estadoComEnvio,
        { canal: "linkedin", direcao: "entrada", tipo: "entregue", data: AGORA },
        { pesos: PESOS_PADRAO, aberturasNaJanela: 0, pontosNaJanela: 0, agora: AGORA },
      );

      expect(res.lead.statusEntrega.linkedin).toBe("aceito");
    });
  });
});
