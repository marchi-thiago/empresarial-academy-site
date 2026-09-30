/**
 * Conteúdo institucional (fonte da verdade: site atual + branding mestre).
 * Centralizado para reuso entre páginas e futura migração para CMS.
 */
import type { IconName } from "@/components/ui/Icon";

export const missao =
  "Transformar empresários e gestores em líderes estratégicos, oferecendo conhecimento prático e aplicável em gestão, vendas e liderança — com ferramentas e metodologias que constroem empresas sólidas, lucrativas e com impacto positivo.";

export const visao =
  "Ser reconhecida até 2030 como a principal referência em desenvolvimento empresarial no Brasil, capacitando no mínimo 10.000 empresários e gestores a atingirem crescimento sustentável, melhor gestão e aumento de faturamento.";

export const valores = [
  {
    titulo: "Mentalidade de Dono",
    desc: "Agimos com responsabilidade, autonomia e compromisso, como se cada desafio fosse nosso próprio negócio.",
  },
  {
    titulo: "Experiência Memorável",
    desc: "Foco total no cliente: encantar e superar expectativas, entregando conhecimento que realmente transforma.",
  },
  {
    titulo: "Fome de Crescimento",
    desc: "Nunca paramos de aprender e evoluir — o sucesso vem da busca constante por desenvolvimento.",
  },
  {
    titulo: "Evolução Contínua",
    desc: "Melhoramos a cada dia, aprimorando processos, estratégias e conteúdo para gerar mais impacto.",
  },
  {
    titulo: "Compromisso e Integridade",
    desc: "Construímos relações sólidas com base na lealdade, transparência e respeito.",
  },
] as const;

export const diferenciais = [
  "Conteúdo prático e direto ao ponto",
  "Ferramentas aplicáveis no dia a dia",
  "Sistemas com IA feitos sob medida para a sua operação",
  "Foco absoluto em geração de resultados",
] as const;

/** Os 6 pilares da metodologia Gestão 360. */
export const pilares = [
  {
    n: "01",
    icon: "target",
    titulo: "Fluxo de Alta Performance",
    desc: "Organiza a rotina, a liderança e a execução para eliminar o caos operacional e aumentar a produtividade.",
  },
  {
    n: "02",
    icon: "building",
    titulo: "Arquitetura do Crescimento",
    desc: "Estrutura a empresa com propósito, estratégia e um modelo de crescimento sustentável.",
  },
  {
    n: "03",
    icon: "compass",
    titulo: "Objetivos Estratégicos",
    desc: "Transforma a visão em metas, indicadores e processos claros para direcionar resultados.",
  },
  {
    n: "04",
    icon: "trending-up",
    titulo: "Métricas de Sucesso",
    desc: "Garante decisões inteligentes por meio de indicadores, desempenho e controle financeiro.",
  },
  {
    n: "05",
    icon: "tools",
    titulo: "Gestão de Desafios",
    desc: "Prepara o empresário para lidar com pessoas, pressão, conflitos e os desafios do crescimento.",
  },
  {
    n: "06",
    icon: "rocket",
    titulo: "Evolução Constante",
    desc: "Mantém a empresa competitiva com inovação, marketing, expansão e visão de futuro.",
  },
] as const;

export const fundador = {
  nome: "Thiago Marchi",
  cargo: "Fundador da Empresarial Academy",
  frase:
    "Meu propósito é, por meio da minha experiência, desenvolver e capacitar líderes para o sucesso.",
  bio: [
    "Durante 7 anos, Thiago Marchi foi sócio-proprietário de uma empresa de varejo — loja física, e-commerce e fábrica própria. Conhece por dentro a rotina de fechar o mês sem saber se sobrou e de segurar a operação porque o time ainda não dá conta.",
    "Depois disso, somou 19 anos estruturando operações comerciais dentro de empresas como Telefônica VIVO, Atento e Grupo Allcom — sempre à frente de Vendas, Marketing e Customer Experience, com método, indicador e meta. É MBA em Gerenciamento de Projetos pela FGV e Green Belt em Lean Six Sigma.",
    "O Gestão 360 nasceu de juntar as duas experiências: o rigor de método que a empresa grande usa, no tamanho e no orçamento de quem é dono de uma PME.",
  ],
} as const;

/**
 * Bloco de tecnologia e IA no institucional. Posicionamento revisto com o
 * Thiago em 2026-09-28 (Branding v3): a IA faz parte da proposta principal
 * como uma das entregas da consultoria, nunca um serviço vendido à parte.
 * Os sistemas em vídeo ficam em /solucoes-com-ia (ver `sistemasVideo`).
 */
export const tecnologiaIA = {
  titulo: "Consultoria que entrega o método e o sistema funcionando",
  paragrafos: [
    "Na Empresarial Academy, a inteligência artificial faz parte da consultoria: depois de organizar a gestão com o método Gestão 360™, colocamos o método para rodar com sistemas e automações feitos sob medida para a realidade de cada empresa.",
    "Na prática, isso significa desenvolver sistemas personalizados para a realidade de cada empresa e automatizar processos que hoje consomem tempo da equipe. O alvo mais frequente é o ruído de comunicação entre departamentos — o retrabalho que nasce quando uma informação se perde entre uma área e outra.",
    "O resultado esperado é direto: tempo operacional devolvido ao time, mais qualidade na entrega, menos falha entre as pontas e clientes mais bem atendidos.",
  ],
} as const;

/**
 * Jornada do Curso Gestão 360. Fica fora de `servicosDetalhe` porque o curso
 * tem página própria (não usa o `ServiceDetail`), mas reaproveita o mesmo
 * `ProcessFlow` das demais páginas de serviço para manter o padrão visual.
 * O curso é um produto ONLINE empacotado — a jornada é de aprendizado e
 * aplicação, não de entrega presencial.
 */
export const cursoJornada: MetodoServico = {
  titulo: "Como funciona a sua jornada no curso",
  subtitulo:
    "Um pacote completo, feito para ser assistido no seu ritmo e aplicado na sua empresa enquanto você avança. Cada módulo termina com algo implantado, não com uma prova.",
  trilhas: [
    {
      etapas: [
        {
          n: "01",
          titulo: "Diagnóstico de maturidade",
          desc: "Antes do primeiro módulo você descobre em que estágio a sua empresa está e quais pilares merecem atenção primeiro — para não gastar energia no lugar errado.",
          icon: "compass",
        },
        {
          n: "02",
          titulo: "Trilha pelos 6 pilares",
          desc: "O conteúdo segue a sequência lógica do método, disponível online para assistir quando e quantas vezes quiser, sem depender de agenda.",
          icon: "book",
        },
        {
          n: "03",
          titulo: "Ferramentas prontas para usar",
          desc: "Cada pilar vem com planilhas, checklists e modelos preenchíveis. Você não sai com anotações: sai com o instrumento montado.",
          icon: "tools",
        },
        {
          n: "04",
          titulo: "Aplicação no seu negócio",
          desc: "Ao fim de cada módulo há uma implantação prevista na sua empresa. O aprendizado acontece fazendo, sobre a sua realidade.",
          icon: "briefcase",
        },
        {
          n: "05",
          titulo: "Indicadores e evolução",
          desc: "Você define os indicadores que mostram o que mudou de fato e passa a acompanhar a empresa por dado, não por percepção.",
          icon: "trending-up",
        },
        {
          n: "06",
          titulo: "Melhoria contínua",
          desc: "O aprendizado não termina no último módulo: você revisa o que já resolveu, o que o crescimento trouxe de novo, e ajusta a rota — o método continua funcionando depois que o curso acaba.",
          icon: "rocket",
        },
      ],
    },
  ],
};

/** Uma etapa do método de trabalho, exibida no fluxograma do serviço. */
export type EtapaMetodo = {
  n: string;
  titulo: string;
  desc: string;
  icon: IconName;
};

/**
 * Uma trilha do método. Um serviço com uma única trilha vira um fluxo linear;
 * com duas ou mais, o `ProcessFlow` desenha a bifurcação (caso de Palestras:
 * "do escopo" vs. "personalizada").
 */
export type TrilhaMetodo = {
  rotulo?: string;
  descricao?: string;
  etapas: readonly EtapaMetodo[];
};

export type MetodoServico = {
  titulo: string;
  subtitulo?: string;
  trilhas: readonly TrilhaMetodo[];
  /** Como este serviço aplica os 6 pilares do Gestão 360. */
  ligacaoGestao360?: string;
};

/**
 * Caso prático apresentado com a estrutura SPIN Selling (Situação, Problema,
 * Implicação, Necessidade de solução) — usa a mesma técnica que ensinamos
 * para também estruturar a prova de que o método funciona. A empresa NUNCA é
 * nomeada nem identificável (decisão do Thiago, 2026-07-26): descreve o
 * cenário e as ações reais, sem expor o cliente.
 */
export type CasoPraticoSpin = {
  titulo: string;
  resumo?: string;
  /**
   * Os 4 campos abaixo (situacao/problema/implicacao/necessidadeIntro) NÃO
   * são exibidos com rótulo algum — viram parágrafos corridos, em ordem, de
   * modo que o leitor é conduzido pelo raciocínio do SPIN Selling sem nunca
   * ver a técnica nomeada (decisão do Thiago, 2026-07-26).
   */
  situacao: string;
  problema: string;
  implicacao: string;
  /** Frase de transição antes da lista de ações executadas. */
  necessidadeIntro: string;
  acoes: readonly string[];
  fechamento?: string;
  imagemSrc?: string;
  imagemAlt?: string;
};

/** Conteúdo das páginas de serviço (briefing "Estrutura do site"). */
export type ServicoDetalhe = {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  hero: string;
  subtitle: string;
  intro: string;
  bullets: readonly string[];
  ctaLabel: string;
  faq: readonly { q: string; a: string }[];
  image?: string;
  /** Vídeo do banner (autoplay mudo em loop, dentro do card do PageHero). */
  video?: string;
  /** Método de trabalho + fluxograma. Sem isso, a seção não é renderizada. */
  metodo?: MetodoServico;
  /** Título + texto de qualificação ("Como saber se precisa de...?"). */
  comoSaber?: { titulo: string; texto: string };
  /**
   * Bloco de abertura logo abaixo do banner, substituindo o parágrafo de
   * `intro` quando presente. Usado para consolidar textos que fariam sentido
   * juntos (ex.: para quem é o serviço + como ele aplica o Gestão 360).
   */
  paraQuem?: { titulo: string; texto: string };
  /** Caso prático real, anonimizado, estruturado em SPIN Selling. */
  casoPratico?: CasoPraticoSpin;
  /** Temas disponíveis (usado em Palestras). */
  temas?: readonly { titulo: string; desc: string }[];
  /**
   * Bloco de tecnologia/IA como diferencial transversal — aparece nos serviços
   * em que ela muda a entrega (consultoria, mentoria), não como serviço à parte.
   */
  diferencialIA?: { titulo: string; desc: string };
};

export const servicosDetalhe: Record<string, ServicoDetalhe> = {
  mentorias: {
    slug: "mentorias",
    metaTitle: "Mentorias Estratégicas",
    metaDescription:
      "Mentoria empresarial individual com Thiago Marchi: diagnóstico, plano de ação e acompanhamento direto em vendas, liderança, processos, cultura e finanças.",
    hero: "Mentoria empresarial com Thiago Marchi",
    subtitle: "Direção estratégica e personalizada para o seu momento.",
    image: "/images/mentoria-executiva.jpg",
    intro:
      "Uma jornada individual com Thiago Marchi, para empresários e gestores que querem tomar decisões com mais clareza, segurança e planejamento estratégico — destravando o crescimento do negócio.",
    bullets: [],
    ctaLabel: "Agendar sessão estratégica",
    paraQuem: {
      titulo: "A mentoria é para quem?",
      texto:
        "A mentoria é uma jornada individual com Thiago Marchi, para empresários e gestores que querem tomar decisões com mais clareza, segurança e planejamento estratégico. Os 6 pilares do Gestão 360 servem de mapa para escolher onde focar: o diagnóstico mostra em quais pilares está o gargalo hoje, e o plano de desenvolvimento ataca esses pilares na ordem que realmente destrava o crescimento do seu negócio.",
    },
    metodo: {
      titulo: "Como conduzimos a mentoria",
      subtitulo:
        "Trabalho personalizado: parte do seu momento como empresário e do momento da empresa. Não existe programa de prateleira, porque a trava de cada negócio é diferente.",
      trilhas: [
        {
          etapas: [
            {
              n: "01",
              titulo: "Momento profissional e da empresa",
              desc: "Entendemos onde você está como gestor e onde a empresa está — dois estágios que nem sempre andam juntos e que precisam ser tratados em conjunto.",
              icon: "compass",
            },
            {
              n: "02",
              titulo: "Diagnóstico da necessidade real",
              desc: "Separamos o problema declarado do problema de fato. Aqui ficam claros os objetivos e as dificuldades que travam o crescimento hoje.",
              icon: "target",
            },
            {
              n: "03",
              titulo: "Plano de desenvolvimento",
              desc: "Definimos os temas a trabalhar, combinando competências técnicas (indicadores, finanças, processos, vendas) e comportamentais (liderança, delegação, comunicação, decisão sob pressão).",
              icon: "book",
            },
            {
              n: "04",
              titulo: "Encontros de trabalho",
              desc: "Cada encontro trata de decisões reais em curso na sua empresa. Você sai com o que aplicar antes do próximo, não com teoria para arquivar.",
              icon: "users",
            },
            {
              n: "05",
              titulo: "Indicadores de evolução",
              desc: "Definimos o que vai medir o avanço nas duas frentes: os indicadores da empresa e os sinais concretos da sua evolução como líder.",
              icon: "chart",
            },
            {
              n: "06",
              titulo: "Revisão e ajuste do plano",
              desc: "O plano é revisto conforme o resultado aparece. O que já está resolvido sai, o que o crescimento trouxe de novo entra.",
              icon: "rocket",
            },
          ],
        },
      ],
    },
    casoPratico: {
      titulo: "Como a mentoria funciona na prática",
      resumo:
        "Um cenário comum entre os empresários que buscam mentoria — não é um caso específico, mas um padrão que se repete.",
      situacao:
        "A empresa cresceu, mas todas as decisões — grandes ou pequenas — ainda passam pela mesma pessoa. A agenda vira uma sequência de apagar incêndio, e o tempo que deveria ir para pensar o negócio vira tempo de operar o negócio.",
      problema:
        "O empresário sabe que precisa delegar, mas cada tentativa de soltar as rédeas trouxe um problema maior do que resolver ele mesmo — o que reforça a ideia de que só ele consegue fazer certo. Ao mesmo tempo, faltam indicadores claros: as decisões são tomadas pela percepção de como as coisas estão indo, não por número.",
      implicacao:
        "Sem uma virada, o crescimento da empresa esbarra na capacidade de uma única pessoa dar conta de tudo. O empresário se esgota, decisões importantes ficam represadas esperando um horário livre, e a equipe aprende a não decidir nada sem antes perguntar.",
      necessidadeIntro:
        "A mentoria trabalha essa dupla frente ao mesmo tempo — o momento do empresário e o momento da empresa:",
      acoes: [
        "Diagnóstico do momento pessoal e do momento da empresa, para entender por que as tentativas de delegar até agora não deram certo",
        "Plano de desenvolvimento combinando temas técnicos (indicadores, processos) e comportamentais (delegação, comunicação, decisão sob pressão)",
        "Encontros que tratam decisões reais em curso — não teoria genérica de liderança",
        "Definição de indicadores de evolução, tanto do negócio quanto da forma como o empresário está liderando",
      ],
      fechamento:
        "O resultado esperado não é o empresário virar espectador do próprio negócio, mas parar de ser o único ponto de decisão — abrindo espaço para pensar estrategicamente, em vez de só operar.",
      imagemSrc: "/images/mentoria-caso-delegacao.png",
      imagemAlt:
        "Ilustração de um único ponto de decisão se transformando em estrutura distribuída de liderança",
    },
    diferencialIA: {
      titulo: "Inteligência artificial aplicada ao seu negócio",
      desc: "Boa parte dos empresários hoje sabe que precisa usar IA, mas não sabe por onde começar sem desperdiçar dinheiro. Quando faz sentido para o seu momento, esse vira um dos temas do plano: onde a IA e a automação realmente geram ganho na sua operação, o que priorizar primeiro e o que ainda não vale o investimento.",
    },
    faq: [
      {
        q: "Como funciona a mentoria?",
        a: "É uma jornada individual com encontros estratégicos: diagnóstico do negócio, plano de ação personalizado e acompanhamento direto para implementar as melhorias.",
      },
      {
        q: "A mentoria é online ou presencial?",
        a: "Pode ser nas duas modalidades, conforme a sua necessidade e localização.",
      },
      {
        q: "Para quem é indicada?",
        a: "Para empresários e gestores de pequenas e médias empresas que querem resolver problemas reais e alcançar metas mais rápido.",
      },
    ],
  },
  palestras: {
    slug: "palestras",
    metaTitle: "Palestras Inspiradoras",
    metaDescription:
      "Palestras de alto impacto sobre liderança, vendas, gestão estratégica, cultura organizacional e crescimento — presenciais ou online, com Thiago Marchi.",
    hero: "Palestras que transformam e inspiram",
    subtitle: "Conhecimento de alto nível com linguagem prática e inspiradora.",
    image: "/images/palestras.jpg",
    intro:
      "Leve para o seu evento ou empresa uma palestra impactante sobre liderança, vendas, gestão estratégica, cultura organizacional e crescimento empresarial — com insights valiosos e aplicáveis.",
    bullets: [],
    ctaLabel: "Levar essa palestra para meu time",
    paraQuem: {
      titulo: "As palestras são para quem?",
      texto:
        "As palestras são para empresas e eventos que querem levar ao time uma conversa de alto nível sobre liderança, vendas, gestão estratégica, cultura organizacional e crescimento — com insights aplicáveis, não só teoria motivacional. Todos os temas nascem dos 6 pilares do Gestão 360 e do conteúdo que publicamos: a palestra não é um evento isolado, é o primeiro passo de uma conversa que pode continuar em diagnóstico, mentoria ou consultoria, se fizer sentido para a empresa.",
    },
    metodo: {
      titulo: "Dois caminhos, conforme o seu objetivo",
      subtitulo:
        "Você pode escolher um tema já estruturado do nosso escopo ou uma palestra construída sob medida, a partir do que está acontecendo dentro da sua empresa.",
      trilhas: [
        {
          rotulo: "Palestra do nosso escopo",
          descricao: "Tema já estruturado, adaptado ao seu público.",
          etapas: [
            {
              n: "01",
              titulo: "Escolha do tema e alinhamento",
              desc: "Definimos o tema a partir do objetivo do evento e do perfil de quem vai assistir — dono, liderança ou equipe operacional.",
              icon: "target",
            },
            {
              n: "02",
              titulo: "Adaptação ao seu contexto",
              desc: "Os exemplos e casos são ajustados ao setor e ao porte da empresa, para que a plateia se reconheça no que está sendo dito.",
              icon: "tools",
            },
            {
              n: "03",
              titulo: "Entrega",
              desc: "Apresentação presencial ou online, com linguagem direta e conteúdo que a equipe consegue aplicar na semana seguinte.",
              icon: "mic",
            },
          ],
        },
        {
          rotulo: "Palestra personalizada",
          descricao: "Construída a partir do que a sua empresa está vivendo.",
          etapas: [
            {
              n: "01",
              titulo: "Briefing com a liderança",
              desc: "Conversa inicial para entender o objetivo real: o que a empresa quer que mude no comportamento das pessoas depois da palestra.",
              icon: "briefcase",
            },
            {
              n: "02",
              titulo: "Entrevistas com líderes e equipe",
              desc: "Ouvimos quem vive o problema por dentro. É o que separa uma palestra genérica de uma que fala exatamente da dor daquele time.",
              icon: "users",
            },
            {
              n: "03",
              titulo: "Construção sob medida",
              desc: "O conteúdo é montado com a linguagem, os exemplos e os desafios levantados nas entrevistas — inclusive temas específicos que a empresa solicitar.",
              icon: "bulb",
            },
            {
              n: "04",
              titulo: "Entrega",
              desc: "Apresentação presencial ou online, calibrada para o público que participou do levantamento.",
              icon: "mic",
            },
            {
              n: "05",
              titulo: "Devolutiva ao gestor",
              desc: "Depois do evento, você recebe a leitura do que apareceu: percepções, pontos de atenção e o que merece atenção da gestão daqui para frente.",
              icon: "chart",
            },
          ],
        },
      ],
    },
    temas: [
      {
        titulo: "Como sair do operacional",
        desc: "O caminho prático para o dono deixar de ser o gargalo da própria empresa.",
      },
      {
        titulo: "Sua empresa ainda cabe na sua cabeça?",
        desc: "Quando a informalidade para de funcionar e a estrutura precisa existir no papel.",
      },
      {
        titulo: "Fatura mais, lucra menos",
        desc: "Onde a margem vaza enquanto o faturamento cresce — e como enxergar isso a tempo.",
      },
      {
        titulo: "Delegar sem perder qualidade",
        desc: "Como transferir tarefas com segurança, sem virar refém do retrabalho.",
      },
      {
        titulo: "Decidir por indicador, não por achismo",
        desc: "Como montar um painel que a empresa realmente usa na rotina de decisão.",
      },
      {
        titulo: "Cultura que não vira manual de gaveta",
        desc: "Como formalizar a cultura de um jeito que a equipe vive, e não apenas lê.",
      },
      {
        titulo: "IA aplicada à PME: por onde começar",
        desc: "O que a inteligência artificial já resolve em uma empresa pequena e média, o que ainda não vale o investimento e como priorizar sem desperdiçar dinheiro.",
      },
      {
        titulo: "Liderança que a equipe segue de verdade",
        desc: "A diferença entre mandar e liderar — e por que os melhores profissionais saem primeiro de empresas com liderança fraca.",
      },
      {
        titulo: "Da visão à meta: por que a estratégia não sai do papel",
        desc: "Como transformar intenção em objetivo, indicador e prazo — sem isso, estratégia continua sendo só desejo.",
      },
    ],
    faq: [
      {
        q: "Quais temas são abordados?",
        a: "Liderança, vendas, gestão estratégica, cultura organizacional, performance e crescimento empresarial — adaptados ao seu público.",
      },
      {
        q: "As palestras são presenciais ou online?",
        a: "Ambas. O formato é definido conforme o evento e o objetivo da sua equipe.",
      },
    ],
  },
  consultoria: {
    slug: "consultoria",
    video: "/videos/consultoria.mp4",
    metaTitle: "Consultoria",
    metaDescription:
      "Consultoria empresarial com IA para PMEs: diagnóstico, plano de ação, implantação do método com sistemas sob medida e acompanhamento com indicadores (KPIs).",
    hero: "Consultoria empresarial que entrega o método e o sistema funcionando",
    subtitle: "Diagnóstico, plano, implantação com sistemas e automações com IA feitos sob medida, e acompanhamento até o resultado aparecer.",
    intro:
      "Para empresas que desejam uma atuação próxima e intensiva. Analisamos, propomos e implementamos soluções reais que geram lucro, eficiência e estrutura, e colocamos o método para rodar com sistemas e automações com IA feitos sob medida para a sua operação.",
    bullets: [],
    ctaLabel: "Falar sobre uma consultoria",
    paraQuem: {
      titulo: "A consultoria é para quem?",
      texto:
        "A consultoria é para empresas que querem uma atuação próxima e intensiva, sem depender de relatório genérico. Aplicamos os pilares do Gestão 360 ao seu caso específico: o mapeamento organiza o Fluxo de Alta Performance, os gaps expõem onde a Arquitetura do Crescimento não sustenta mais a operação, e o acompanhamento instala as Métricas de Sucesso que mantêm a decisão baseada em dado, não em achismo. O resultado é lucro, eficiência e estrutura — com indicadores e uma cultura de performance que continua depois que a consultoria termina.",
    },
    metodo: {
      titulo: "Como trabalhamos na consultoria",
      subtitulo:
        "Um caminho definido, do primeiro diagnóstico até o time operando sozinho. Cada etapa entrega algo concreto — nada de relatório que termina na gaveta.",
      trilhas: [
        {
          etapas: [
            {
              n: "01",
              titulo: "Diagnóstico e imersão",
              desc: "Entramos na operação para entender os números, a rotina e o que de fato acontece no dia a dia — não apenas o que se diz na reunião.",
              icon: "compass",
            },
            {
              n: "02",
              titulo: "Mapeamento dos processos",
              desc: "Registramos como o trabalho acontece hoje, ponta a ponta, incluindo os desvios que viraram hábito e ninguém mais enxerga.",
              icon: "tools",
            },
            {
              n: "03",
              titulo: "Identificação dos gaps",
              desc: "Apontamos onde a empresa perde tempo, margem e qualidade — priorizado por impacto no resultado, para atacar primeiro o que mais pesa.",
              icon: "target",
            },
            {
              n: "04",
              titulo: "Solução desenhada e apresentada",
              desc: "Você recebe um plano com responsáveis, prazos e os indicadores que vão medir cada mudança, definidos antes de começar a executar.",
              icon: "bulb",
            },
            {
              n: "05",
              titulo: "Implantação com sistemas e treinamento",
              desc: "Executamos junto com o time, colocamos o processo para rodar em sistemas e automações com IA feitos sob medida e capacitamos quem vai tocar, para que o novo padrão sobreviva sem depender de nós.",
              icon: "users",
            },
            {
              n: "06",
              titulo: "Acompanhamento operacional",
              desc: "Acompanhamos os indicadores até a mudança virar rotina. A saída é planejada: o objetivo é a sua equipe autônoma, não um contrato eterno.",
              icon: "trending-up",
            },
          ],
        },
      ],
    },
    casoPratico: {
      titulo: "Um caso real de reestruturação comercial",
      resumo:
        "Sem identificar o cliente, mas sem esconder o que foi feito — veja como conduzimos a reestruturação comercial de uma empresa em pleno crescimento.",
      situacao:
        "A empresa vinha de um crescimento acelerado da operação comercial, mas sem uma rotina estruturada para sustentar esse ritmo: cada vendedor conduzia a negociação à própria maneira, sem um roteiro comum, e a gestão não tinha uma ferramenta única para enxergar o andamento de cada oportunidade.",
      problema:
        "As reuniões de vendas eram guiadas por sensação, não por dado. O follow-up se perdia entre uma conversa e outra, e o padrão de atendimento variava conforme quem atendia o cliente — um problema que a liderança sentia, mas não sabia dizer exatamente de onde vinha.",
      implicacao:
        "Sem correção, esse cenário custava oportunidades reais: vendas esfriavam por falta de acompanhamento, os supervisores não tinham visibilidade para intervir a tempo, e a experiência inconsistente de atendimento colocava em risco a própria percepção que o cliente tinha da empresa.",
      necessidadeIntro:
        "O trabalho começou pelo mesmo caminho de qualquer consultoria nossa — entrevistas com a liderança, os supervisores e o time de vendas, um estudo preliminar do funil e da operação, e a apresentação do projeto antes de qualquer ação. A partir daí, a execução:",
      acoes: [
        "Implantação de CRM, com uma rotina diária definida para a equipe extrair o máximo da ferramenta — não bastava ter o sistema, era preciso saber planejar o dia de trabalho usando ele",
        "Treinamento da equipe de vendedores, supervisores e gestão nas técnicas SPIN Selling e BANT, para qualificar oportunidades e conduzir a venda consultiva com critério",
        "Padronização do atendimento, para que a experiência do cliente deixasse de depender de quem estava do outro lado da linha",
      ],
      fechamento:
        "O resultado: uma equipe com processo definido, pipeline visível para a gestão em tempo real e um padrão de atendimento consistente entre vendedores. É isso que a consultoria muda — tirar a gestão comercial do improviso e colocá-la sob controle.",
      imagemSrc: "/images/consultoria-caso-reestruturacao-comercial.jpg",
      imagemAlt:
        "Ilustração de uma taça-funil dourada organizando ícones de negócio em resultado",
    },
    diferencialIA: {
      titulo: "Sistemas com IA: o método rodando no dia a dia",
      desc: "Quando o gargalo está na comunicação entre áreas, processo redesenhado só no papel não resolve. Usamos sistemas personalizados e inteligência artificial para facilitar a comunicação entre as áreas e os processos, eliminando o ruído que gera retrabalho e informação perdida de um departamento para o outro. O resultado é uma operação mais fluida, com melhores resultados e mais qualidade em cada entrega.",
    },
    faq: [
      {
        q: "Como começa a consultoria?",
        a: "Começa por um diagnóstico do negócio, que orienta um plano de ação com priorização por impacto e indicadores claros.",
      },
      {
        q: "A consultoria é presencial?",
        a: "Atuamos de forma próxima, presencial ou remota, com alinhamento direto com líderes e times.",
      },
      {
        q: "A consultoria inclui sistemas e automações?",
        a: "Sim. A implantação inclui sistemas e automações com IA feitos sob medida para a sua operação, sempre medidos por resultado: tempo ganho, menos retrabalho, custo menor e mais lucro. Veja exemplos na página Soluções com IA.",
      },
    ],
  },
};

/** Os 5 banners do carrossel da Home (briefing "Estrutura do site"). */
export const heroSlides = [
  {
    eyebrow: "Consultoria empresarial com IA",
    title: "Consultoria empresarial que entrega o método e o sistema funcionando",
    subtitle:
      "Organizamos a gestão da sua empresa com o Gestão 360™ e criamos, com inteligência artificial, as ferramentas que fazem o método rodar no dia a dia.",
    ctaLabel: "Conheça a consultoria",
    ctaHref: "/servicos/consultoria",
    image: "/images/banner-sobre.jpg",
  },
  {
    eyebrow: "Curso Gestão 360",
    title: "Transforme seu negócio em uma máquina de resultados",
    subtitle:
      "A metodologia prática para organizar processos, multiplicar lucros e liderar com mais clareza. Ideal para otimizar a gestão, engajar equipes e crescer com inteligência.",
    ctaLabel: "Conhecer o curso",
    ctaHref: "/servicos/curso-gestao-360",
    image: "/images/curso-gestao-360.jpg",
  },
  {
    eyebrow: "Mentorias Estratégicas",
    title: "Mentoria empresarial com Thiago Marchi",
    subtitle:
      "Orientação personalizada para empresários e gestores que querem resolver problemas reais e alcançar metas mais rápido — foco em vendas, liderança, processos, cultura e finanças.",
    ctaLabel: "Agendar sessão estratégica",
    ctaHref: "/servicos/mentorias",
    image: "/images/mentoria-executiva.jpg",
  },
  {
    eyebrow: "Palestras Inspiradoras",
    title: "Leve inspiração, estratégia e ação para seus eventos",
    subtitle:
      "Conteúdo de impacto para motivar equipes, fortalecer a cultura organizacional e gerar insights poderosos sobre performance e gestão.",
    ctaLabel: "Levar essa palestra para meu time",
    ctaHref: "/servicos/palestras",
    image: "/images/palestras.jpg",
  },
  {
    eyebrow: "Livro Gestão 360",
    title: "O livro que transforma a mentalidade dos empresários",
    subtitle:
      "Aprendizados reais de quem viveu os desafios da liderança e construiu negócios lucrativos com propósito. Leitura leve, prática e provocativa, com aplicação imediata.",
    ctaLabel: "Saber mais sobre o livro",
    ctaHref: "/livro-gestao-360",
    image: "/images/livro-gestao-360.jpg",
    video: "/videos/banner-livro-gestao.mp4",
  },
] as const;

/** Módulos do Curso Gestão 360 (fonte: briefing "Estrutura do site"). */
export const cursoModulos = [
  "Planejamento Estratégico e OKRs",
  "Estruturação Comercial e Funil de Vendas",
  "Gestão de Pessoas e Liderança de Equipes",
  "Marketing Estratégico e Posicionamento Digital",
  "Experiência do Cliente e Fidelização",
  "Processos, Eficiência Operacional e Qualidade",
  "Finanças para Empresários (Controle, Custo, Preço e Lucro)",
  "Indicadores de Desempenho e Gestão à Vista",
  "Cultura Organizacional e Comunicação Interna",
  "Estratégias de Expansão e Escalabilidade",
] as const;

/** Técnicas e ferramentas do Curso Gestão 360. */
export const cursoFerramentas = [
  "Canvas Estratégico do Negócio",
  "Análise SWOT aplicada à sua empresa",
  "Fluxo de Trabalho e Matriz de Responsabilidade",
  "Jornada do Cliente e Mapas de Experiência",
  "Matriz BCG para produtos e serviços",
  "Liderança Situacional e Comunicação Assertiva",
  "Construção de KPIs com painéis de gestão",
  "Melhoria Contínua (PDCA, 5W2H)",
  "Precificação e análise de lucratividade",
  "Modelos de Expansão e Escalabilidade",
] as const;

export const cursoBeneficios = [
  "Aplicação imediata dos conceitos",
  "Metodologia validada no mercado",
  "Aulas dinâmicas e práticas",
  "Acompanhamento estratégico e ferramentas exclusivas",
  "100% online, com acesso flexível e certificação",
  "Apoio contínuo para aplicar, revisar e melhorar sempre",
] as const;

/** Conquistas do fundador (briefing "Estrutura do site"). */
/** Formação acadêmica e certificações do fundador (informadas por ele). */
export const fundadorFormacao = [
  {
    titulo: "MBA em Gerenciamento de Projetos",
    instituicao: "Fundação Getulio Vargas (FGV)",
  },
  {
    titulo: "Graduação em Recursos Humanos",
    instituicao: "Universidade Nove de Julho",
  },
  {
    titulo: "Dupla certificação internacional em Customer Experience",
    instituicao: "Customer Experience Scientist",
  },
  {
    titulo: "Green Belt em Lean Six Sigma",
    instituicao: "Certificação em melhoria de processos e redução de desperdício",
  },
] as const;

export const fundadorConquistas = [
  "Desenvolveu e escalou operações comerciais com foco em lucratividade",
  "Implementou estratégias de marketing inbound e outbound orientadas à conversão",
  "Estruturou processos de gestão e vendas com base em indicadores (KPIs)",
  "Capacitou líderes e gestores para assumir o controle dos seus resultados",
  "Criou e consolidou culturas empresariais voltadas para performance e propósito",
] as const;

/** Por que confiar na Empresarial Academy (briefing). */
export const porqueConfiar = [
  {
    icon: "briefcase",
    titulo: "Experiência real de quem já esteve na prática",
    desc: "Fundada por Thiago Marchi, sócio-proprietário de uma PME por 7 anos e com 19 anos estruturando operações comerciais em empresas como Telefônica VIVO e Grupo Allcom.",
  },
  {
    icon: "trending-up",
    titulo: "Métodos testados e aplicáveis",
    desc: "Tudo o que ensinamos é baseado em experiências reais, com estratégias que funcionam no dia a dia e geram resultado.",
  },
  {
    icon: "tools",
    titulo: "Conteúdo prático, direto ao ponto",
    desc: "Nada de teorias distantes da prática — ferramentas, materiais e treinamentos que você aplica hoje mesmo no seu negócio.",
  },
  {
    icon: "target",
    titulo: "Foco em resultado, lucro e autonomia",
    desc: "Nosso compromisso é dar a você mais domínio sobre a empresa, com estrutura, clareza e crescimento sustentável.",
  },
  {
    icon: "bulb",
    titulo: "Formação de líderes de verdade",
    desc: "Mais do que técnicas, entregamos conhecimento que transforma a mentalidade e a postura do empresário.",
  },
] as const;

/** Depoimentos em vídeo (prova social), reaproveitados na LP `/consultoria-pme`
 * e em seções "O impacto do nosso método" pelo site. Consentimento por
 * escrito confirmado pelo Thiago em 2026-07-19 — ver Termo de Consentimento
 * na pasta do funil. */
export const depoimentosVideo = {
  fabio: {
    video: "/videos/depoimento-fabio-ramos.mp4",
    poster: "/images/depoimento-fabio-ramos.jpg",
    name: "Dr. Fábio Ramos",
    role: "CEO",
    chamada: "Veja o que o CEO da Souza Ramos Advogados diz sobre os resultados obtidos",
    texto:
      "Fábio Ramos, CEO da Souza Ramos Advogados, conta como a consultoria ajudou a organizar a gestão do escritório e destravar resultados que dependiam só dele. Assista para ver o relato na íntegra.",
  },
  daniella: {
    video: "/videos/depoimento-daniella-higa.mp4",
    poster: "/images/depoimento-daniella-higa.jpg",
    name: "Daniella Higa",
    role: "Coordenadora Comercial",
    chamada: "O que a responsável pela área comercial diz sobre a equipe e os resultados",
    texto:
      "Daniella Higa, Coordenadora Comercial, fala sobre o impacto do método no dia a dia do time de vendas — mais organização na rotina comercial e resultados que se sustentam mês a mês.",
  },
  erik: {
    video: "/videos/depoimento-erik-dantas.mp4",
    poster: "/images/depoimento-erik-dantas.jpg",
    name: "Erik Dantas",
    role: "Estagiário Financeiro",
    chamada: "Economia de tempo, recuperação de inadimplentes e resultados mais claros",
    texto:
      "Erik Dantas, do time financeiro, conta como a rotina mudou depois da consultoria: menos tempo perdido em tarefas manuais, mais inadimplentes recuperados e relatórios de resultado mais claros para a gestão.",
  },
} as const;

export const faq = [
  {
    q: "Para quem é a Empresarial Academy?",
    a: "Para empresários, gestores e líderes de pequenas e médias empresas que querem organizar a gestão, aumentar lucros e crescer com método.",
  },
  {
    q: "Como funciona a avaliação gratuita?",
    a: "Você responde online o Diagnóstico de Maturidade Empresarial: 36 perguntas sobre os 6 pilares do método Gestão 360. O resultado sai na hora, com pontuação por pilar e um plano de melhoria com ações, indicadores e prazos sugeridos — sem custo e sem compromisso.",
  },
  {
    q: "Vocês atendem presencialmente ou online?",
    a: "Atendemos nas duas modalidades. Mentorias e consultorias podem ser online ou presenciais, conforme a necessidade do seu negócio.",
  },
  {
    q: "O Curso Gestão 360 já está disponível?",
    a: "O Curso e o Livro Gestão 360 estão em fase de lançamento. O curso será um pacote online completo, para você assistir no seu ritmo e aplicar na empresa enquanto avança. Entre em contato para entrar na lista de prioridade.",
  },
  {
    q: "Qual a diferença entre mentoria e consultoria?",
    a: "Na mentoria o trabalho é com você: desenvolvemos sua capacidade de decidir e conduzir o negócio, com um plano que combina competências técnicas e comportamentais. Na consultoria o trabalho é na empresa: entramos na operação, mapeamos processos, apontamos os gaps e implantamos as soluções junto com o time. Quem precisa de direção escolhe mentoria; quem precisa de execução escolhe consultoria. Em muitos casos, uma leva à outra.",
  },
  {
    q: "Vocês desenvolvem sistemas e automações?",
    a: "Sim, e isso é parte da nossa consultoria: somos uma consultoria empresarial com IA. Durante o trabalho, identificamos onde um sistema sob medida ou uma automação elimina trabalho manual e remove o ruído de comunicação entre departamentos, e entregamos o sistema funcionando. Não vendemos tecnologia como serviço isolado. O objetivo é ganho de tempo, mais qualidade, menos custo e mais lucro. Veja exemplos na página Soluções com IA.",
  },
  {
    q: "A palestra pode ser sobre um tema específico da minha empresa?",
    a: "Pode. Você escolhe um tema já estruturado do nosso escopo ou uma palestra personalizada, construída a partir de um briefing com a liderança e de entrevistas com líderes e equipe. Na versão personalizada, o conteúdo trata do que a sua empresa está vivendo de verdade e você recebe uma devolutiva depois do evento.",
  },
  {
    q: "Quanto tempo dura cada trabalho?",
    a: "Depende do tamanho do desafio e do ritmo da empresa. Preferimos definir o formato depois do diagnóstico, quando já se sabe o que precisa ser feito, em vez de vender um pacote fechado que pode ficar curto ou longo demais. O diagnóstico inicial é gratuito e é o que orienta essa definição.",
  },
] as const;

/**
 * Sistemas próprios da EA mostrados em /solucoes-com-ia e na home (Branding v3,
 * 28/09/2026): prova de que a consultoria entrega o sistema funcionando.
 * Descritos SEMPRE pelo problema do dono e pelo resultado, nunca pela
 * tecnologia. `youtubeId`/`publicadoEm` entram quando o vídeo sobe no canal;
 * sem eles o cartão aparece só com o texto.
 * ponytail: lista fixa no código, como o resto do site; vira campo no
 * `system-links` do Payload se o Thiago quiser cadastrar vídeo pelo admin.
 */
export type SistemaVideo = {
  slug: string;
  nome: string;
  grupo: "Atrair clientes" | "Atender e vender" | "Formalizar a venda" | "Diagnosticar e gerir";
  problema: string;
  resultado: string;
  youtubeId?: string;
  publicadoEm?: string;
};

export const sistemasVideo: SistemaVideo[] = [
  {
    slug: "ea-post",
    youtubeId: "FEACKl-BQWc",
    publicadoEm: "2026-09-29",
    nome: "EA Post",
    grupo: "Atrair clientes",
    problema: "Produzir conteúdo toda semana para cinco redes consome horas que o dono não tem.",
    resultado: "Planeja, escreve e desenha as peças no padrão da marca; o dono só aprova. Presença constante sem virar refém da produção.",
  },
  {
    slug: "site-conteudo",
    youtubeId: "EtZlaMVNdII",
    publicadoEm: "2026-09-30",
    nome: "Site, blog e materiais",
    grupo: "Atrair clientes",
    problema: "Site parado não traz cliente.",
    resultado: "Artigos e materiais gratuitos publicados com regularidade, captando contatos de quem já procura solução.",
  },
  {
    slug: "ea-ads",
    youtubeId: "4u5IzwGsUWs",
    publicadoEm: "2026-09-29",
    nome: "EA Ads",
    grupo: "Atrair clientes",
    problema: "Anúncio no Google sem acompanhamento queima verba sem ninguém perceber.",
    resultado: "Verba, alertas e previsão dos próximos 30 dias num painel só: cada real investido acompanhado.",
  },
  {
    slug: "ea-flow",
    youtubeId: "yAfsCVWp0_E",
    publicadoEm: "2026-09-29",
    nome: "EA Flow",
    grupo: "Atender e vender",
    problema: "Lead que espera resposta esfria, e o dono não consegue responder todo mundo na hora.",
    resultado: "Fluxos de atendimento no WhatsApp, Instagram e Messenger, montados e revisados com IA: resposta na hora, a qualquer hora.",
  },
  {
    slug: "ea-assessor",
    youtubeId: "qkuEjwwBE1Q",
    publicadoEm: "2026-09-30",
    nome: "EA Assessor",
    grupo: "Atender e vender",
    problema: "Agenda, e-mail e o primeiro contato com cada lead tomam o dia do dono.",
    resultado: "Assistente executivo no WhatsApp: organiza agenda e e-mail e qualifica o lead antes de ele chegar ao dono.",
  },
  {
    slug: "contratos",
    youtubeId: "568sQG_mixU",
    publicadoEm: "2026-09-30",
    nome: "Contratos e assinatura",
    grupo: "Formalizar a venda",
    problema: "Proposta e contrato feitos à mão atrasam o fechamento e abrem espaço para erro.",
    resultado: "Contrato gerado em minutos a partir da tabela de preços, com assinatura digital.",
  },
  {
    slug: "diagnostico",
    youtubeId: "RRLU2NsoQWQ",
    publicadoEm: "2026-09-30",
    nome: "Diagnóstico de Maturidade",
    grupo: "Diagnosticar e gerir",
    problema: "Sem medir, o dono não sabe onde a gestão trava.",
    resultado: "36 perguntas, nota nos 6 pilares do Gestão 360™ e plano de melhoria na hora, sem custo.",
  },
  {
    slug: "ea-hub",
    youtubeId: "4KSaVWny9CU",
    publicadoEm: "2026-09-29",
    nome: "EA HUB",
    grupo: "Diagnosticar e gerir",
    problema: "Informação espalhada em planilhas e ferramentas soltas.",
    resultado: "Um painel só, na ordem da jornada do cliente: da atração ao contrato assinado.",
  },
];
