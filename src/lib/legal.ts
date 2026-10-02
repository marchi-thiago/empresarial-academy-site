/**
 * Conteúdo legal (migrado do site atual). Fonte: páginas privacidade.html / termos.html.
 * Estrutura em dados para renderização consistente e fácil manutenção.
 */
export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] };

export type LegalSection = { title: string; blocks: LegalBlock[] };

export const legalUpdatedAt = "Setembro de 2026";

export const privacidadeSections: LegalSection[] = [
  {
    title: "1. Introdução",
    blocks: [
      {
        type: "p",
        text: "A Empresarial Academy está comprometida em proteger a privacidade e os dados pessoais de nossos usuários, clientes e visitantes. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD) — Lei nº 13.709/2018.",
      },
    ],
  },
  {
    title: "2. Informações que Coletamos",
    blocks: [
      { type: "p", text: "2.1 Dados fornecidos voluntariamente:" },
      {
        type: "list",
        items: [
          "Nome completo",
          "Endereço de e-mail",
          "Número de telefone/WhatsApp",
          "Nome da empresa",
          "Cargo/função",
          "Informações profissionais relevantes",
          "Mensagens e comunicações enviadas através de nossos formulários",
        ],
      },
      { type: "p", text: "2.2 Dados coletados automaticamente:" },
      {
        type: "list",
        items: [
          "Endereço IP",
          "Tipo de navegador e versão",
          "Sistema operacional",
          "Páginas visitadas e tempo de permanência",
          "Referências de sites que o direcionaram para nós",
          "Dados de cookies e tecnologias similares",
        ],
      },
    ],
  },
  {
    title: "3. Dados Coletados via Instagram, Messenger e WhatsApp",
    blocks: [
      {
        type: "p",
        text: "Quando você envia uma mensagem direta (DM) para o perfil comercial da Empresarial Academy no Instagram ou no Facebook, ou entra em contato pelo WhatsApp, coletamos e processamos os dados abaixo através de uma integração automatizada com a API da Meta (EA Flow), usada para responder mensagens, qualificar conversas e encaminhar o atendimento.",
      },
      { type: "p", text: "3.1 Dados coletados:" },
      {
        type: "list",
        items: [
          "Identificador da conta que enviou a mensagem (ID do Instagram ou do Messenger, fornecido pela Meta)",
          "Nome de perfil público, quando disponível",
          "Conteúdo das mensagens de texto trocadas na conversa",
          "Metadados da mensagem (horário de envio e recebimento, canal de origem)",
          "Comentários feitos em publicações do nosso perfil, quando respondemos a eles ou os encaminhamos para atendimento",
        ],
      },
      { type: "p", text: "3.2 Finalidade do tratamento:" },
      {
        type: "list",
        items: [
          "Responder automaticamente a mensagens recebidas, com base em fluxos de atendimento pré-configurados",
          "Encaminhar a conversa para atendimento humano quando necessário",
          "Manter histórico da conversa para dar continuidade ao atendimento",
          "Melhorar a qualidade e a relevância das respostas automatizadas",
        ],
      },
      {
        type: "p",
        text: "Não utilizamos os dados de mensagens do Instagram, Messenger ou WhatsApp para fins de publicidade, e não os compartilhamos com terceiros além dos prestadores de serviço estritamente necessários à operação técnica do atendimento (ver seção 6). Você pode solicitar a exclusão do histórico da sua conversa a qualquer momento pelos canais de contato listados na seção 14.",
      },
    ],
  },
  {
    title: "4. Como Utilizamos suas Informações",
    blocks: [
      {
        type: "list",
        items: [
          "Fornecer nossos serviços de consultoria (incluindo desenvolvimento de sistemas e automações), mentoria e treinamento",
          "Responder às suas solicitações e comunicações, inclusive por Instagram, Messenger e WhatsApp",
          "Enviar materiais educacionais e informativos",
          "Personalizar sua experiência em nosso site",
          "Melhorar nossos serviços e desenvolver novos produtos",
          "Cumprir obrigações legais e regulamentares",
          "Enviar comunicações de marketing (com seu consentimento)",
        ],
      },
    ],
  },
  {
    title: "5. Base Legal para o Tratamento",
    blocks: [
      {
        type: "list",
        items: [
          "Consentimento: quando você nos fornece consentimento explícito, inclusive ao iniciar uma conversa por Instagram, Messenger ou WhatsApp",
          "Execução de contrato: para cumprir obrigações contratuais",
          "Legítimo interesse: para melhorar nossos serviços e comunicação e para a prospecção comercial B2B descrita na seção 15",
          "Cumprimento de obrigação legal: quando exigido por lei",
        ],
      },
    ],
  },
  {
    title: "6. Compartilhamento de Informações",
    blocks: [
      {
        type: "p",
        text: "Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros, exceto nas seguintes situações:",
      },
      {
        type: "list",
        items: [
          "Com prestadores de serviços que nos auxiliam na operação do negócio, incluindo a infraestrutura técnica (hospedagem e banco de dados) que processa as mensagens do Instagram, Messenger e WhatsApp",
          "Com a Meta Platforms, na medida necessária para o funcionamento da integração de mensagens, conforme os Termos da Plataforma Meta",
          "Quando exigido por lei ou ordem judicial",
          "Para proteger nossos direitos, propriedade ou segurança",
          "Com seu consentimento explícito",
        ],
      },
    ],
  },
  {
    title: "7. Cookies e Tecnologias Similares",
    blocks: [
      {
        type: "p",
        text: "Utilizamos cookies e tecnologias similares para melhorar a funcionalidade do site, analisar o tráfego e uso, personalizar conteúdo e lembrar suas preferências. Você pode controlar o uso de cookies através das configurações do seu navegador.",
      },
    ],
  },
  {
    title: "8. Segurança dos Dados",
    blocks: [
      {
        type: "p",
        text: "Implementamos medidas de segurança técnicas e organizacionais apropriadas para proteger suas informações pessoais contra acesso não autorizado, alteração, divulgação, destruição, perda acidental e tratamento ilícito.",
      },
    ],
  },
  {
    title: "9. Retenção de Dados",
    blocks: [
      {
        type: "p",
        text: "Mantemos suas informações pessoais apenas pelo tempo necessário para cumprir as finalidades descritas nesta política, a menos que um período de retenção mais longo seja exigido ou permitido por lei.",
      },
    ],
  },
  {
    title: "10. Seus Direitos (LGPD)",
    blocks: [
      {
        type: "list",
        items: [
          "Confirmação da existência de tratamento de dados",
          "Acesso aos seus dados pessoais",
          "Correção de dados incompletos, inexatos ou desatualizados",
          "Anonimização, bloqueio ou eliminação de dados desnecessários",
          "Portabilidade dos dados",
          "Informação sobre compartilhamento",
          "Revogação do consentimento",
          "Oposição ao tratamento feito com base em legítimo interesse, inclusive à prospecção comercial",
        ],
      },
    ],
  },
  {
    title: "11. Transferência Internacional",
    blocks: [
      {
        type: "p",
        text: "Seus dados pessoais podem ser transferidos para países fora do Brasil apenas quando necessário para a prestação de nossos serviços e com garantias adequadas de proteção.",
      },
    ],
  },
  {
    title: "12. Menores de Idade",
    blocks: [
      {
        type: "p",
        text: "Nossos serviços são direcionados a adultos. Não coletamos intencionalmente informações pessoais de menores de 18 anos sem o consentimento dos pais ou responsáveis.",
      },
    ],
  },
  {
    title: "13. Alterações nesta Política",
    blocks: [
      {
        type: "p",
        text: "Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre mudanças significativas através de nosso site ou por e-mail. Última atualização: 2 de outubro de 2026.",
      },
    ],
  },
  {
    title: "14. Contato e Encarregado (DPO)",
    blocks: [
      {
        type: "p",
        text: "Para exercer seus direitos ou esclarecer dúvidas, entre em contato pelo e-mail contato@empresarialacademy.com ou pelo telefone +55 (11) 93340-0264 (São Paulo - SP, Brasil). Nosso Encarregado de Proteção de Dados (DPO) pode ser contatado em contato@empresarialacademy.com.",
      },
    ],
  },
  {
    title: "15. Prospecção Comercial B2B (Dados Públicos)",
    blocks: [
      {
        type: "p",
        text: "A Empresarial Academy pode entrar em contato com donos e gestores de empresas para apresentar a consultoria empresarial com IA e convidar para um bate-papo rápido e gratuito. O contato pode ser feito por mensagem direta (DM) no Instagram, e-mail, WhatsApp, LinkedIn ou ligação, sempre em um canal profissional da empresa. Para isso, tratamos dados profissionais de fontes públicas: nome e cargo do responsável pela empresa, nome da empresa, e-mail e telefone ou WhatsApp comerciais, informações do perfil público em redes sociais (como Instagram) e do site da empresa e dados do cadastro de CNPJ na Receita Federal.",
      },
      {
        type: "p",
        text: "Para adequar a mensagem ao segmento da empresa, usamos ferramentas de inteligência artificial que resumem essas informações públicas. Não coletamos nem inferimos dados sensíveis, não tomamos decisões automatizadas com efeito jurídico sobre você e não vendemos nem cedemos esses dados a terceiros. Nos e-mails, medimos a abertura e o clique nos links para saber se a mensagem foi útil; essa medição é feita por uma imagem e por links individuais da mensagem, e você pode se opor a ela pedindo o descadastro.",
      },
      {
        type: "p",
        text: "Base legal: legítimo interesse (art. 7º, inciso IX, da LGPD), com finalidade específica e limitada à oferta dos nossos serviços a empresas. Fizemos uma avaliação de legítimo interesse e adotamos estas salvaguardas: só contatamos pessoas em contexto profissional; dizemos de onde obtivemos o contato; oferecemos descadastro em toda mensagem; mantemos uma lista de supressão, com o mínimo de dados necessário, para nunca contatar de novo quem pediu para sair; e excluímos os dados de quem não interagir conosco em 12 meses.",
      },
      {
        type: "p",
        text: "Como sair: responda a mensagem pedindo para não receber mais contato, use o link de descadastro presente nos e-mails ou escreva para contato@empresarialacademy.com. Atendemos o pedido sem custo e sem exigir justificativa. Você também pode pedir acesso, correção ou exclusão dos seus dados pelo mesmo canal. O Encarregado de Proteção de Dados pode ser contatado em contato@empresarialacademy.com.",
      },
    ],
  },
  {
    title: "16. Marketing de Atração (Inbound) e Comunicações por E-mail",
    blocks: [
      {
        type: "p",
        text: "Quando você baixa um material, faz o Diagnóstico de Maturidade, preenche um formulário, agenda uma conversa pelo Calendly ou nos chama no WhatsApp, guardamos os dados que você informou (nome, e-mail, telefone, empresa, cargo e as respostas do diagnóstico) e a origem do contato (por exemplo, a página ou o material). Usamos esses dados para entregar o que você pediu, responder a você e enviar e-mails de acompanhamento sobre o tema que despertou seu interesse.",
      },
      {
        type: "p",
        text: "Todo e-mail de acompanhamento traz um link de descadastro de um clique, que vale para os próximos envios. Medimos a abertura e o clique nos e-mails para melhorar o conteúdo. Os dados ficam em nosso CRM e em ferramentas de e-mail, agendamento e hospedagem contratadas como prestadores de serviço. A base legal segue a seção 5 e os seus direitos, a seção 10.",
      },
    ],
  },
];

export const termosSections: LegalSection[] = [
  {
    title: "1. Aceitação dos Termos",
    blocks: [
      {
        type: "p",
        text: "Ao acessar e usar o site da Empresarial Academy e nossos serviços, você concorda em cumprir e estar vinculado a estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não deve usar nossos serviços.",
      },
    ],
  },
  {
    title: "2. Descrição dos Serviços",
    blocks: [
      {
        type: "list",
        items: [
          "Cursos de desenvolvimento empresarial",
          "Serviços de mentoria e consultoria",
          "Palestras e workshops",
          "Materiais educacionais e informativos",
          "Conteúdo de blog e recursos gratuitos",
          "Livros e publicações especializadas",
        ],
      },
    ],
  },
  {
    title: "3. Elegibilidade",
    blocks: [
      {
        type: "list",
        items: [
          "Pessoas físicas maiores de 18 anos",
          "Empresas e organizações legalmente constituídas",
          "Profissionais e empresários que buscam desenvolvimento",
        ],
      },
    ],
  },
  {
    title: "4. Registro e Conta de Usuário",
    blocks: [
      { type: "p", text: "Ao criar uma conta ou fornecer informações, você se compromete a:" },
      {
        type: "list",
        items: [
          "Fornecer informações verdadeiras, precisas e atualizadas",
          "Manter a confidencialidade de suas credenciais de acesso",
          "Notificar-nos imediatamente sobre uso não autorizado",
          "Ser responsável por todas as atividades em sua conta",
        ],
      },
    ],
  },
  {
    title: "5. Uso Aceitável",
    blocks: [
      { type: "p", text: "5.1 Condutas permitidas — você pode usar nossos serviços para acessar conteúdo educacional, participar de cursos, solicitar consultoria/mentoria e baixar materiais gratuitos." },
      { type: "p", text: "5.2 É expressamente proibido:" },
      {
        type: "list",
        items: [
          "Usar nossos serviços para atividades ilegais",
          "Reproduzir, distribuir ou vender nosso conteúdo sem autorização",
          "Tentar acessar sistemas ou dados não autorizados",
          "Interferir no funcionamento do site ou serviços",
          "Enviar spam, vírus ou código malicioso",
          "Violar direitos de propriedade intelectual",
        ],
      },
    ],
  },
  {
    title: "6. Propriedade Intelectual",
    blocks: [
      {
        type: "p",
        text: "Todo o conteúdo do site — textos, imagens, vídeos, logotipos, metodologias e materiais educacionais — é de propriedade da Empresarial Academy e está protegido por leis de direitos autorais. Concedemos uma licença limitada, não exclusiva e revogável para acessar e usar o conteúdo conforme permitido.",
      },
    ],
  },
  {
    title: "7. Pagamentos e Reembolsos",
    blocks: [
      {
        type: "p",
        text: "Os preços de nossos serviços são informados no momento da contratação. Oferecemos garantia de satisfação conforme especificado em cada serviço; reembolsos podem ser solicitados dentro do prazo estabelecido e estão sujeitos à análise.",
      },
    ],
  },
  {
    title: "8. Privacidade e Proteção de Dados",
    blocks: [
      {
        type: "p",
        text: "O tratamento de seus dados pessoais é regido por nossa Política de Privacidade, que faz parte integrante destes Termos de Uso.",
      },
    ],
  },
  {
    title: "9. Limitação de Responsabilidade",
    blocks: [
      {
        type: "p",
        text: "Nossos serviços são fornecidos no estado em que se encontram. Não garantimos resultados específicos, que dependem da aplicação prática por parte do usuário. Na máxima extensão permitida por lei, não nos responsabilizamos por danos indiretos decorrentes do uso dos serviços.",
      },
    ],
  },
  {
    title: "10. Alterações dos Termos",
    blocks: [
      {
        type: "p",
        text: "Podemos atualizar estes Termos periodicamente. O uso contínuo dos serviços após alterações implica concordância com os novos termos.",
      },
    ],
  },
  {
    title: "11. Lei Aplicável e Foro",
    blocks: [
      {
        type: "p",
        text: "Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de São Paulo - SP para dirimir eventuais controvérsias.",
      },
    ],
  },
  {
    title: "12. Contato",
    blocks: [
      {
        type: "p",
        text: "Dúvidas sobre estes Termos podem ser enviadas para contato@empresarialacademy.com ou pelo telefone +55 (11) 93340-0264.",
      },
    ],
  },
];

/**
 * Instruções de exclusão de dados. Página exigida pela Meta (campo "URL de
 * instruções de exclusão de dados" nas configurações do app) para qualquer app
 * que trate dados de usuário — no nosso caso, as mensagens recebidas por
 * Instagram Direct, Messenger e WhatsApp através do EA Flow. Precisa ser uma
 * URL pública, acessível sem login, descrevendo como a pessoa pede a exclusão.
 */
export const exclusaoDadosSections: LegalSection[] = [
  {
    title: "1. O que esta página explica",
    blocks: [
      {
        type: "p",
        text: "Esta página descreve como solicitar a exclusão dos dados pessoais que a Empresarial Academy tenha armazenado sobre você, incluindo o histórico de mensagens trocadas com nossos canais de atendimento no Instagram Direct, Messenger e WhatsApp. O procedimento é gratuito e vale para qualquer pessoa, seja cliente ou não.",
      },
    ],
  },
  {
    title: "2. Quais dados podem ser excluídos",
    blocks: [
      { type: "p", text: "A pedido, excluímos:" },
      {
        type: "list",
        items: [
          "O histórico das mensagens que você trocou com nossos canais de atendimento automatizado",
          "O identificador da sua conta fornecido pela Meta (ID do Instagram ou do Messenger) ou o número de telefone, no caso do WhatsApp",
          "O nome de exibição e a foto de perfil, quando tiverem sido recebidos junto com a mensagem",
          "Dados de contato que você tenha enviado por formulário no site (nome, e-mail, telefone, empresa)",
        ],
      },
    ],
  },
  {
    title: "3. Como solicitar",
    blocks: [
      {
        type: "p",
        text: "Envie um e-mail para contato@empresarialacademy.com com o assunto “Exclusão de dados”, informando o canal usado (Instagram, Messenger, WhatsApp ou site) e o nome de usuário, telefone ou e-mail que você utilizou no contato. Precisamos desse dado apenas para localizar seu registro — não pedimos senha, documento nem qualquer outra informação sensível.",
      },
      {
        type: "p",
        text: "Se preferir, você também pode fazer o pedido pelo telefone +55 (11) 93340-0264 ou respondendo diretamente na própria conversa em que falou conosco, com a frase “solicito a exclusão dos meus dados”.",
      },
    ],
  },
  {
    title: "4. Prazo e confirmação",
    blocks: [
      {
        type: "p",
        text: "A exclusão é concluída em até 15 dias corridos a partir do recebimento do pedido, e enviamos uma confirmação pelo mesmo canal usado na solicitação. Esse prazo atende ao artigo 18 da Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).",
      },
      {
        type: "p",
        text: "Podemos reter parte dos dados por prazo maior apenas quando houver obrigação legal ou regulatória que exija a guarda, como registros fiscais e contábeis de contratos já firmados. Nesse caso, informamos qual dado foi mantido e por qual motivo.",
      },
    ],
  },
  {
    title: "5. Exclusão pelo próprio Instagram ou Facebook",
    blocks: [
      {
        type: "p",
        text: "Você também pode revogar o acesso do nosso aplicativo diretamente na Meta, sem falar conosco: no Instagram, em Configurações → Aplicativos e sites; no Facebook, em Configurações e privacidade → Configurações → Aplicativos e sites. Ao revogar, deixamos de receber novas mensagens suas — mas o histórico já armazenado só é apagado mediante a solicitação descrita na seção 3.",
      },
    ],
  },
  {
    title: "6. Encarregado de Proteção de Dados",
    blocks: [
      {
        type: "p",
        text: "Dúvidas sobre este procedimento ou sobre o tratamento dos seus dados podem ser enviadas ao nosso Encarregado de Proteção de Dados (DPO) em contato@empresarialacademy.com. Para o detalhamento completo de como tratamos dados pessoais, consulte a nossa Política de Privacidade.",
      },
    ],
  },
];
