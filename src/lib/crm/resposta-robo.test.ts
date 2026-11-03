import { describe, expect, it } from "vitest";

import { quemRespondeu } from "./resposta-robo";

describe("quemRespondeu (campanha 12, 30/10 a 03/11/2026)", () => {
  it.each([
    "Olá empresarial.academy, agradecemos o seu contato. Não estamos disponíveis no momento, pode nos informar seu número de contato?",
    "👋 Olá! Seja bem-vindo(a) à Somax Corretora. É um prazer ter você por aqui!",
    "Oi empresarial.academy, agradecemos seu contato. Para oportunidade de trabalho envie seu currículo para contato@genthe.com.br.",
    "Olá! 🚛💙Agradecemos o contato e seu interesse em falar conosco. ✅ Esta é uma confirmação de que recebemos a sua mensagem",
    "Obrigado por entrar em contato, nosso horário de atendimento por aqui já encerrou",
    "This business uses AI from Meta to generate messages. By chatting, you agree to the AI Terms.",
    "Se ainda *não* é associado e deseja nos conhecer, envie *#Sicredi*.",
    "Olá, Empresarial Academy! Sou o Astro, a Inteligência Artificial assistente de vendas da Cury Construtora.",
  ])("robô: %s", (t) => expect(quemRespondeu(t)).toBe("robo"));

  it.each([
    "Miqueias Alves: tudo integrado",
    "Um pouco dos 2, falta de governança faz ter problemas financeiros",
    "Leticia",
    "Por aqui eu não tenho o contato de ninguém da área comercial para te passar.",
    "YAGO sent a voice message.",
  ])("pessoa: %s", (t) => expect(quemRespondeu(t)).toBe("pessoa"));

  it.each(["Por nada! Foi um prazer te atender. Até a próxima!", "Muito obrigado! Um ótimo trabalho para você também!"])("agradecimento sozinho é indefinido: %s", (t) =>
    expect(quemRespondeu(t)).toBe("indefinido"),
  );

  it.each(["2 new messages", "(resposta recebida pelo EA Flow)"])("indefinido: %s", (t) => expect(quemRespondeu(t)).toBe("indefinido"));

  it("sem conteúdo segue contando como pessoa (comportamento de antes)", () => {
    expect(quemRespondeu("")).toBe("pessoa");
    expect(quemRespondeu(null)).toBe("pessoa");
  });
});
