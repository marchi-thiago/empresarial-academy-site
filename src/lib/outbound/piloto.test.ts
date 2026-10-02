import { describe, expect, it } from "vitest";
import { canaisDisponiveis, emailDeExemplo, type LeadCadencia } from "./cadencia";
import { noPerfilDoDossie } from "./conversa";
import { regraFixa, sugerirDia } from "./dia-sugerido";
import { empresaConfiavel, gerarAssunto, nomeDePessoa, paragrafos, renderEmailOutbound, type DadosEmailOutbound } from "./email/render";
import { partesDoKit } from "./kit";
import { emBrasilia, semPreposicaoDoDia, textoDoDiaComPreposicao } from "./tempo";
import { preencher } from "./texto";

/**
 * Correções do piloto em simulação (relatório de 01/10/2026). Os kits abaixo têm o formato real gravado pelo EA Hunter
 * (`kitParaArmazenar`: `email1` objeto, `email2` e `dm3` texto), com leads e textos fictícios. Nenhum dado real de lead.
 */

const URL_CONVERSA = "https://empresarialacademy.com/r/631.email1.conversa.XoF0qoLfSSGXMnq3aaQalc";
const URL_DIAGNOSTICO = "https://empresarialacademy.com/r/631.email1.xLmRpYWdub3N0aWNv.AbCdEfGhIjKlMnOpQrStUv";

const kitDoHunter = {
  dm1: "Vi que a Distribuidora Modelo atende lojas em três estados. Posso te mandar uma ideia de 20 minutos? Consegue {{dia_sugerido}}?",
  dm2: "Em distribuidoras, o pedido que chega por WhatsApp costuma travar o financeiro. Consegue {{dia_sugerido}}?",
  dm3: "Oi, Carla! Vou deixar a porta aberta. Se fizer sentido, o diagnóstico gratuito mostra onde a gestão está mais frágil: {{link_diagnostico}}",
  dm_extra: "Muita distribuidora perde margem no frete. Faz sentido olhar isso? Consegue {{dia_sugerido}}?",
  email1: {
    assunto: "Distribuidora Modelo: gestão do pedido ao caixa",
    corpo: "(junção das partes)",
    gancho: "Vi que a Distribuidora Modelo atende lojas em três estados.",
    dor: "Em distribuidoras, o pedido que chega solto costuma travar o financeiro.",
    ponte_video: "Separei uma demonstração de 1 minuto de como isso funciona num negócio do seu setor.",
    convite: "Gostaria de propor uma conversa sobre como estruturar essa gestão. Consegue {{dia_sugerido}} pelo link {{link_conversa}}?",
  },
  email2: "Um ponto que vejo muito em distribuidoras: o preço muda e a tabela de vendas demora dias para acompanhar. Se quiser olhar isso comigo, escolha um horário aqui: {{link_conversa}}",
  whatsapp1: "Oi, tudo bem?",
};

const vars = { dia_sugerido: "na terça, às 15h", link_conversa: URL_CONVERSA, link_diagnostico: URL_DIAGNOSTICO };

const base = (extra: Partial<DadosEmailOutbound> = {}): DadosEmailOutbound => ({
  nome: "Carla Menezes",
  empresa: "Distribuidora Modelo",
  prova: "demo_segmento",
  diaSugerido: "na terça, às 15h",
  linkConversa: URL_CONVERSA,
  linkOptOut: "https://empresarialacademy.com/api/marketing/sair?l=631&t=PREVIA",
  kit: {},
  ...extra,
});

describe("1. e-mail 2 e último toque com o kit real do Hunter", () => {
  it("email2 em texto vira o corpo do e-mail curto", () => {
    expect(partesDoKit(kitDoHunter, "email2")).toEqual({ dica: kitDoHunter.email2 });
  });

  it("email2 em lista de frases também serve", () => {
    expect(partesDoKit({ email2: ["Primeira ideia.", "Segunda ideia."] }, "email2")).toEqual({ dica: "Primeira ideia.\n\nSegunda ideia." });
    expect(partesDoKit({ email2: [] }, "email2")).toBeNull();
    expect(partesDoKit({ email2: "   " }, "email2")).toBeNull();
  });

  it("email2 em objeto continua valendo, e o e-mail 1 de texto vira gancho", () => {
    expect(partesDoKit({ email2: { dica: "D", assunto: "A" } }, "email2")).toEqual({ dica: "D", assunto: "A" });
    expect(partesDoKit({ email1: "Vi que vocês crescem." }, "email1")).toEqual({ gancho: "Vi que vocês crescem." });
  });

  it("o e-mail 1 do Hunter segue lendo as partes", () => {
    expect(partesDoKit(kitDoHunter, "email1")).toMatchObject({ gancho: kitDoHunter.email1.gancho, convite: kitDoHunter.email1.convite });
  });

  it("o último toque sai do dm3 do Hunter, sem a saudação de DM", () => {
    expect(partesDoKit(kitDoHunter, "ultimo")).toEqual({
      dica: "Vou deixar a porta aberta. Se fizer sentido, o diagnóstico gratuito mostra onde a gestão está mais frágil: {{link_diagnostico}}",
    });
  });

  it("o último toque aceita os dois nomes, `ultimo` e `dm3`, e prefere o texto escrito para e-mail", () => {
    expect(partesDoKit({ ultimo: "Porta aberta para quando fizer sentido." }, "ultimo")).toEqual({ dica: "Porta aberta para quando fizer sentido." });
    expect(partesDoKit({ ultimo: { dica: "Do objeto" }, dm3: "Da DM" }, "ultimo")).toEqual({ dica: "Do objeto" });
    expect(partesDoKit({ dm3: "Da DM", ultimo: "Do e-mail" }, "ultimo")).toEqual({ dica: "Do e-mail" });
    expect(partesDoKit({ dm3: "Da DM" }, "ultimo")).toEqual({ dica: "Da DM" });
    expect(partesDoKit({ dm3: "Olá, Carla Menezes, a porta segue aberta." }, "ultimo")).toEqual({ dica: "a porta segue aberta." });
    expect(partesDoKit({ dm3: "Oi! A porta segue aberta." }, "ultimo")).toEqual({ dica: "A porta segue aberta." });
    expect(partesDoKit({ dm3: "Oi, tudo bem? A porta segue aberta." }, "ultimo")).toEqual({ dica: "Oi, tudo bem? A porta segue aberta." });
  });

  it("o e-mail 2 renderiza e traz o link da conversa inteiro", async () => {
    const partes = partesDoKit(kitDoHunter, "email2")!;
    const kit = JSON.parse(preencher(JSON.stringify(partes), vars));
    const r = await renderEmailOutbound(base({ toque: 2, kit }));
    expect(r.texto).toContain(`escolha um horário aqui: ${URL_CONVERSA}`);
    expect(r.html).toContain(`<a href="${URL_CONVERSA}">${URL_CONVERSA}</a>`);
    // O texto já traz o convite e o link: sem a frase de credibilidade no meio e sem segundo convite padrão.
    expect(r.texto).not.toContain("Fui dono de uma PME");
    expect(r.texto).not.toMatch(/\b20 min/);
    expect(r.texto).toContain("Reservar meu bate-papo gratuito (terça, às 15h)");
  });
});

describe("2. link da conversa nunca quebra no corpo do e-mail", () => {
  const convite = preencher(kitDoHunter.email1.convite, vars);

  it("paragrafos mantém a URL do caso real inteira", () => {
    const p = paragrafos(convite);
    expect(p.join(" ")).toContain(URL_CONVERSA);
    expect(p.join("|")).not.toMatch(/\. com|\. email1|\. conversa/);
  });

  it("não quebra em número decimal, abreviação nem sigla", () => {
    expect(paragrafos("Somos mais de 2.000 clientes. Crescemos 3,5 por cento ao mês.", 40)).toEqual(["Somos mais de 2.000 clientes.", "Crescemos 3,5 por cento ao mês."]);
    expect(paragrafos("O Dr. Fábio Ramos, da Souza Ramos Advocacia Ltda. Costa & Filhos S.A. cresceu.", 30)).toEqual([
      "O Dr. Fábio Ramos, da Souza Ramos Advocacia Ltda. Costa & Filhos S.A. cresceu.",
    ]);
    expect(paragrafos("Custa R$ 1.500,00 por mês. Sem fidelidade.", 30)).toEqual(["Custa R$ 1.500,00 por mês.", "Sem fidelidade."]);
    expect(paragrafos("Veja empresarialacademy.com/materiais/calculadora. Depois me diga.", 40)).toEqual(["Veja empresarialacademy.com/materiais/calculadora.", "Depois me diga."]);
  });

  it("continua separando frases comuns e respeita o limite", () => {
    expect(paragrafos("Primeira frase. Segunda frase! Terceira frase?", 20)).toEqual(["Primeira frase.", "Segunda frase!", "Terceira frase?"]);
    expect(paragrafos("Uma. Duas.")).toEqual(["Uma. Duas."]);
    expect(paragrafos("Linha um.\n\nLinha dois.")).toEqual(["Linha um.", "Linha dois."]);
  });

  it("o e-mail 1 completo (kit real) sai com o link inteiro em HTML e em texto", async () => {
    const kit = JSON.parse(preencher(JSON.stringify(kitDoHunter.email1), vars));
    // Fora do perfil o convite do kit vale (no perfil o convite do e-mail 1 é fixo e vai só no botão).
    const r = await renderEmailOutbound(base({ noPerfil: false, kit: { email1: kit } }));
    for (const t of [r.texto, r.html]) {
      expect(t).not.toMatch(/empresarialacademy\. com|\/r\/631\. email1/);
    }
    expect(r.texto).toContain(`pelo link ${URL_CONVERSA}?`);
    expect(r.html).toContain(`<a href="${URL_CONVERSA}">${URL_CONVERSA}</a>?`);
    expect(r.avisos).toEqual([]);
  });
});

describe("3. dia sugerido com preposição", () => {
  it("escreve 'na terça, às 15h', como os kits do Hunter assumem", () => {
    expect(textoDoDiaComPreposicao("2026-10-06", "15:00")).toBe("na terça, às 15h");
    expect(textoDoDiaComPreposicao("2026-10-07", "14:30")).toBe("na quarta, às 14h30");
    expect(textoDoDiaComPreposicao("2026-10-09", "11:00")).toBe("na sexta, às 11h");
    expect(textoDoDiaComPreposicao("2026-10-10", "11:00")).toBe("no sábado, às 11h");
  });

  it("a regra fixa e a agenda geram o texto com preposição", () => {
    expect(regraFixa(emBrasilia("2026-10-05", "09:00")).texto).toBe("na terça, às 15h");
    expect(regraFixa(emBrasilia("2026-10-09", "09:00")).texto).toBe("na segunda, às 15h"); // sexta -> segunda
    const ocupados = [{ inicio: emBrasilia("2026-10-06", "14:45"), fim: emBrasilia("2026-10-06", "15:45") }];
    expect(sugerirDia(emBrasilia("2026-10-05", "09:00"), ocupados).texto).toBe("na terça, às 14h");
  });

  it("a frase montada do kit fica natural, sem preposição dobrada", () => {
    const frase = preencher("Consegue {{dia_sugerido}} pelo link {{link_conversa}}?", { dia_sugerido: "na terça, às 15h", link_conversa: "L" });
    expect(frase).toBe("Consegue na terça, às 15h pelo link L?");
    expect(preencher(kitDoHunter.dm1, vars)).toContain("Consegue na terça, às 15h?");
    expect(preencher(kitDoHunter.dm1, vars)).not.toMatch(/\b(na|no|em|para) na /);
  });

  it("o rótulo do botão tira a preposição", async () => {
    expect(semPreposicaoDoDia("na terça, às 15h")).toBe("terça, às 15h");
    expect(semPreposicaoDoDia("terça, 6 de outubro, às 15h")).toBe("terça, 6 de outubro, às 15h");
    const r = await renderEmailOutbound(base({ kit: { email1: { gancho: "Vi que vocês crescem.", dor: "A gestão depende do dono." } } }));
    expect(r.texto).toContain("Reservar meu bate-papo gratuito (terça, às 15h)");
    expect(r.texto).toContain("Tenho terça, às 15h livre.");
    expect(r.texto).not.toContain("na terça-feira");
  });
});

describe("4. saudação sem nome de pessoa confiável", () => {
  it.each([
    ["Coagru", "Coagru", ""], // só a empresa
    ["Otima Distribuidora", "Otima Distribuidora", ""], // nome = empresa
    ["Coagru", "Coagru Cooperativa Agroindustrial", ""], // nome é o começo da empresa
    ["Blog Contato Unidade Curitiba", "Sobre nós", ""], // título de página raspado
    ["Home", null, ""],
    ["Brasil Fixo", "Brasil Fixo Telecom", ""],
    ["caartesatelietricot", "Ateliê do Tricô", ""], // @ do Instagram sem maiúscula
    ["@marcos.silva", null, ""],
    ["marcos_silva", null, ""],
    ["", "Empresa", ""],
    [null, null, ""],
    ["Glauco de Amorim Perdigão", "Dr. Glauco de Amorim Perdigão", "Glauco"], // pessoa de verdade, empresa com o nome dela
    ["Dra. Helena Prado", "Clínica Prado", "Helena"],
    ["Carla Menezes", "Distribuidora Modelo", "Carla"],
  ])("nomeDePessoa(%j, %j) = %j", (nome, empresa, esperado) => {
    expect(nomeDePessoa(nome, empresa)).toBe(esperado);
  });

  it("o e-mail abre com 'Olá,' quando só há empresa, e com o nome quando há pessoa", async () => {
    const kit = { email1: { gancho: "Vi que vocês crescem.", dor: "A gestão depende do dono." } };
    const semNome = await renderEmailOutbound(base({ nome: "Coagru", empresa: "Coagru", kit }));
    expect(semNome.texto.includes("\n\nOlá,\n\nVi que")).toBe(true);
    expect(semNome.texto).not.toContain("Olá, Coagru");
    const pagina = await renderEmailOutbound(base({ nome: "Blog Contato Unidade Curitiba", empresa: "Sobre nós", kit }));
    expect(pagina.texto.includes("\n\nOlá,\n\n")).toBe(true);
    const arroba = await renderEmailOutbound(base({ nome: "@marcos.silva", empresa: "Silva Ltda", kit }));
    expect(arroba.texto.includes("\n\nOlá,\n\n")).toBe(true);
    const pessoa = await renderEmailOutbound(base({ kit }));
    expect(pessoa.texto.includes("\n\nOlá, Carla,\n\n")).toBe(true);
  });

  it("o assunto de reserva não cita título de página nem usa o nome da empresa como pessoa", () => {
    expect(gerarAssunto({ nome: "Coagru", empresa: "Coagru" })).toBe("Uma ideia para a gestão da Coagru");
    expect(gerarAssunto({ nome: "Home", empresa: "Sobre nós" })).toBe("Uma ideia para a gestão da sua empresa");
    expect(gerarAssunto({ nome: "Carla Menezes", empresa: "Distribuidora Modelo" })).toBe("Carla, uma ideia para a gestão da Distribuidora Modelo");
    expect(empresaConfiavel("Google Maps")).toBe("");
    expect(empresaConfiavel("Mendes &#8211; Distribuidora")).toBe("");
    expect(empresaConfiavel("Mendes Distribuidora")).toBe("Mendes Distribuidora");
  });
});

describe("5. lead fora do perfil recebe o diagnóstico, não a reunião", () => {
  it("lê `no_perfil` do dossiê, com os valores estranhos que o Hunter ou o CRM possam gravar", () => {
    expect(noPerfilDoDossie({ no_perfil: false })).toBe(false);
    expect(noPerfilDoDossie({ no_perfil: true })).toBe(true);
    expect(noPerfilDoDossie({ noPerfil: "false" })).toBe(false);
    expect(noPerfilDoDossie({ está_no_perfil: "Não" })).toBe(false);
    expect(noPerfilDoDossie(JSON.stringify({ no_perfil: false }))).toBe(false);
    expect(noPerfilDoDossie({ prova: "fabio" })).toBe(true); // sem o campo: comportamento antigo
    expect(noPerfilDoDossie(null)).toBe(true);
    expect(noPerfilDoDossie("lixo")).toBe(true);
  });

  const kitFora = {
    email1: {
      gancho: "Vi que você faz peças de tricô sob encomenda.",
      dor: "Quem trabalha sozinho costuma perder tempo com pedidos soltos.",
      ponte_video: "Separei um depoimento em vídeo de 1 minuto.",
      convite: `Se quiser um retrato rápido da sua gestão, o diagnóstico gratuito está aqui: ${URL_DIAGNOSTICO}`,
    },
  };

  it("o botão leva ao diagnóstico, sem 'Reservar meu bate-papo' nem dia sugerido", async () => {
    const chamados: string[] = [];
    const rastrear = (url: string, rotulo?: string) => {
      chamados.push(`${rotulo}|${url}`);
      return url;
    };
    const r = await renderEmailOutbound(base({ noPerfil: false, kit: kitFora, rastrear, linkDiagnostico: "https://empresarialacademy.com/diagnostico-maturidade-empresarial.html" }));
    expect(r.texto).toContain("Fazer o diagnóstico gratuito\nhttps://empresarialacademy.com/diagnostico-maturidade-empresarial.html");
    expect(r.texto).not.toMatch(/Reservar meu bate-papo|na terça|\b20 min/);
    expect(r.html).not.toMatch(/Reservar meu bate-papo|na terça/);
    expect(r.html).toContain("Fazer o diagnóstico gratuito");
    expect(r.html).toContain("Diagnóstico gratuito da gestão da sua empresa");
    expect(chamados.some((c) => c.startsWith("diagnostico|"))).toBe(true);
    expect(chamados.some((c) => c.startsWith("convite|"))).toBe(false);
  });

  it("sem convite no kit, usa um texto de diagnóstico, sem prometer reunião", async () => {
    const r = await renderEmailOutbound(base({ noPerfil: false, kit: { email1: { gancho: "Vi que você faz peças de tricô.", dor: "Pedidos soltos tomam o dia." } } }));
    expect(r.texto).toContain("o diagnóstico gratuito é rápido e não tem compromisso");
    expect(r.texto).not.toContain("Reserve agora um bate-papo");
  });

  it("lead no perfil continua com o convite para o bate-papo", async () => {
    const r = await renderEmailOutbound(base({ noPerfil: true, kit: { email1: { gancho: "Vi que vocês crescem.", dor: "A gestão depende do dono." } } }));
    expect(r.texto).toContain("Reservar meu bate-papo gratuito (terça, às 15h)");
    expect(r.texto).not.toContain("Fazer o diagnóstico gratuito");
  });

  it("o último toque (porta aberta) leva ao diagnóstico mesmo para lead no perfil", async () => {
    const partes = partesDoKit(kitDoHunter, "ultimo")!;
    const kit = JSON.parse(preencher(JSON.stringify(partes), vars));
    const r = await renderEmailOutbound(base({ ultimoToque: true, kit }));
    expect(r.texto).toContain(`onde a gestão está mais frágil: ${URL_DIAGNOSTICO}`);
    expect(r.texto).toContain("Fazer o diagnóstico gratuito");
    expect(r.texto).not.toContain("Reservar meu bate-papo");
    expect(r.texto).not.toMatch(/^Olá, Carla,\n\nOi/);
    expect(r.texto).not.toContain("Fui dono de uma PME");
    expect(r.texto).not.toContain("é rápido e não tem compromisso"); // o diagnóstico já está no texto: só o botão fecha a carta
  });
});

describe("7. endereços de exemplo não entram na cadência", () => {
  it.each([
    "seu@email.com",
    "email@exemplo.com",
    "exemplo@dominio.com",
    "exemplo@empresa.com.br",
    "teste@empresa.com.br",
    "teste@teste.com",
    "nome@example.com",
    "contato@exemplo.com.br",
    "fulano@exemplo.org",
    "seuemail@gmail.com",
    "seu.nome@seudominio.com.br",
    "nome.sobrenome@empresa.com.br",
    "nome@email.com",
    "  SEU@EMAIL.COM  ",
  ])("%s é endereço de exemplo", (e) => {
    expect(emailDeExemplo(e)).toBe(true);
  });

  it.each([
    "contato@distribuidoramodelo.com.br",
    "carla@gmail.com",
    "comercial@testeira.com.br",
    "vendas@seuvizinho.com.br",
    "mkt@otimadistribuidora.com.br",
    "email@minhaempresa.com.br",
    "atendimento@clinicaprado.com.br",
    "",
    "sem-arroba",
  ])("%s pode receber", (e) => {
    expect(emailDeExemplo(e)).toBe(false);
  });

  it("o lead com e-mail de exemplo fica sem o canal de e-mail", () => {
    const l = (email: string): LeadCadencia => ({
      id: 1,
      etapa: "em_cadencia",
      temperatura: "frio",
      pausada: false,
      optOut: false,
      email,
      instagram: "@modelo",
      whatsapp: null,
      canaisEncerrados: [],
      statusEntrega: { email: "nao_enviado", whatsapp: "nao_enviado", dm: "enviada", linkedin: "nao_enviado" },
      primeiroToqueEm: emBrasilia("2026-10-05", "10:00"),
      linkedinDecisor: false,
    });
    expect(canaisDisponiveis(l("seu@email.com")).has("email")).toBe(false);
    expect(canaisDisponiveis(l("email@exemplo.com")).has("email")).toBe(false);
    expect(canaisDisponiveis(l("contato@distribuidoramodelo.com.br")).has("email")).toBe(true);
  });
});
