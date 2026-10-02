# Pendências do Thiago (Projeto Outbound)

Atualizado em 30/09/2026 pela frente F0. Em ordem de prioridade: os itens 1 a 4 bloqueiam o
e-mail frio; o item 7 bloqueia o e-mail real; os demais destravam canais e métricas.
Nenhum envio real acontece sem você ligar (ver `RUNBOOK.md`).

| # | Pendência | Bloqueia | Tempo |
|---|---|---|---|
| 1 | DKIM do Microsoft 365 | e-mail frio (entregabilidade) | 15 min + espera |
| 2 | Enviar como comercial@ | e-mail frio | 10 min |
| 3 | Consentimento do token com `Mail.Read.Shared` | ler respostas de comercial@ | 10 min |
| 4 | Confirmar `dpo@` e `privacidade@` | LGPD (já citados na política) | 10 min |
| 5 | Chip do WhatsApp (perfil + 14 dias) | F9, WhatsApp frio | 14 dias |
| 6 | Plano da Vercel | sinal de vida e crons | 10 min |
| 7 | Teste de caixa de entrada (mail-tester) | ligar e-mail real | 10 min |
| 8 | Calendly ligado ao Outlook | `/conversa` (F6) | 10 min |
| 9 | Monitor de heartbeat | alerta de sinal de vida (F1) | 10 min |
| 10 | Decisão: o que pedir no fim da reunião | roteiro de reunião (F8) | decisão |
| 11 | Trocar as bios | identidade | 15 min |
| 12 | Segredo `CRM_INGEST_SECRET` na Vercel e no Hunter e no EA Flow | eventos do Hunter e do EA Flow no CRM (F2, F5, F9) | 10 min |
| 13 | Aprovar o protótipo do e-mail frio (F7) | primeiro envio real de e-mail | 10 min |
| 14 | Aprovar e publicar o e-book "Por que sua empresa fatura mais e sobra menos" (seção 21) | bloco de material do e-mail (hoje usa a Calculadora de Vazamento de Margem) | 20 min |
| 15 | Gravar a demo de 60 s por segmento (EA Demo Recorder) | prova `demo_segmento` (hoje a capa é um cartão da marca) | por segmento |
| 16 | SQL do enum de `email-logs` (aplicar no Neon) | só a etiqueta do monitor de Envios (não bloqueia) | 5 min |
| 17 | Chamador do orquestrador a cada 10 min e `CRON_SECRET` | envio real e rotinas do orquestrador (F6) | 10 min |
| 18 | Ligar o envio real do e-mail (`OUTBOUND_ENVIO_REAL`) e `OUTBOUND_LER_CAIXA` | e-mail real e leitura de respostas | 10 min |
| 22 | Lista de seguidores da página da EA no LinkedIn (F10) | fila do LinkedIn por seguidores (decisores do dossiê já entram) | 15 min |
| 23 | Hunter chamar `POST /api/outbound/heartbeat` (feito por sessão de IA no repositório do Hunter) | alertas de sinal de vida, sincronização e teto de IA | técnico |
| 24 | Hunter ler o descadastro feito no site (sync no sentido site para Hunter) | LGPD: lead que saiu da lista no site não receber DM | técnico |
| 25 | Rotina de retenção de 12 meses sem interação (`LGPD.md`) e exemplos de mensagens que geraram reunião para a IA do Hunter | LGPD e F11 (ainda não existem) | técnico |

---

## 1. DKIM do Microsoft 365 (prioridade máxima)

**Estado:** não ativo. Conferido de novo em 30/09/2026 pela frente F0:

```
nslookup -type=cname selector1._domainkey.empresarialacademy.com 8.8.8.8
-> Non-existent domain   (selector2 também)
```

SPF (`v=spf1 include:spf.protection.outlook.com -all`) e DMARC (`v=DMARC1; p=none;`) já estão
certos. O DMARC `p=none` fica como está.

**Passos** (documentação oficial:
https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dkim-configure ):

1. Entrar como administrador em https://security.microsoft.com e ir em **E-mail e
   colaboração > Políticas e regras > Políticas de ameaças > Configurações de autenticação de
   e-mail** (direto: https://security.microsoft.com/authentication). Abrir a aba **DKIM**.
2. Na linha `empresarialacademy.com`, tentar ligar o botão **Habilitado**. Vai aparecer um
   erro de cliente, o que é esperado: o status passa a **CnameMissing**.
3. Clicar na linha para abrir o painel do domínio. Em **Publicar CNAMEs**, anotar os dois
   registros (ou usar **Copiar**). O formato, para conferir, é:
   - Nome `selector1._domainkey`, valor `selector1-empresarialacademy-com._domainkey.<prefixo>.<letra>-v1.dkim.mail.microsoft`
   - Nome `selector2._domainkey`, valor `selector2-empresarialacademy-com._domainkey.<prefixo>.<letra>-v1.dkim.mail.microsoft`
   Use os valores exatos que o painel mostrar (o prefixo vem do domínio `.onmicrosoft.com`
   do tenant).
4. Em outra aba, abrir o DNS da Hostinger (hPanel > Domínios > `empresarialacademy.com` >
   DNS / Servidores de nomes > Registros DNS; os nameservers são `ns1.dns-parking.com` e
   `ns2.dns-parking.com`, então é lá que o DNS vale). Criar os 2 registros **CNAME**: no
   campo Nome, só `selector1._domainkey` (e `selector2._domainkey`), sem o domínio no fim; no
   campo Destino/Aponta para, o valor do passo 3; TTL padrão. Sem ponto final, salvo se o
   painel exigir.
5. Esperar alguns minutos (pode levar até algumas horas), voltar ao painel do domínio no
   Defender e ligar **Assinar mensagens deste domínio com assinaturas DKIM**. Status final:
   "Signing DKIM signatures for this domain".
6. Conferir pelo terminal:
   ```
   nslookup -type=cname selector1._domainkey.empresarialacademy.com 8.8.8.8
   ```
   Deve responder com o destino `...dkim.mail.microsoft`.
7. Prova final: mandar um e-mail de comercial@ para um Gmail seu, abrir a mensagem > três
   pontos > **Mostrar original**. Precisa aparecer `DKIM: PASS` e `SPF: PASS` (e `DMARC: PASS`).

Critério de pronto da F0: os itens 6 e 7 acima.

## 2. Enviar como comercial@ (teste pela Graph)

A caixa comercial@ já envia e recebe. Falta provar que o acesso do token (thiago@) permite
enviar como ela. O token vive só na Vercel; por isso o teste é feito com o seu login no
Graph Explorer, que usa a mesma regra de permissão do Exchange.

1. Abrir https://developer.microsoft.com/graph/graph-explorer e entrar com thiago@.
2. Método **POST**, URL `https://graph.microsoft.com/v1.0/me/sendMail`. Em **Modify
   permissions**, consentir `Mail.Send` (e `Mail.Send.Shared`, necessário se você usar o
   endpoint `/users/comercial@empresarialacademy.com/sendMail` no lugar de `/me/sendMail`).
3. Corpo (troque o destinatário por um Gmail seu):
   ```json
   {
     "message": {
       "subject": "Teste F0: envio como comercial@",
       "body": { "contentType": "Text", "content": "Teste de envio. Pode apagar." },
       "from": { "emailAddress": { "address": "comercial@empresarialacademy.com" } },
       "toRecipients": [ { "emailAddress": { "address": "SEU_GMAIL@gmail.com" } } ]
     }
   }
   ```
4. Resposta **202 Accepted** e o e-mail chega com remetente comercial@ = aprovado. Se a
   resposta for 403 (`ErrorSendAsDenied` ou similar), liberar as permissões:
   - Centro de administração do Exchange: https://admin.exchange.microsoft.com > Destinatários
     > Caixas de correio compartilhadas (ou Caixas de correio) > comercial@ > **Delegação de
     caixa de correio**.
   - Em **Enviar como**, adicionar thiago@. Em **Acesso total** (ler e gerenciar), adicionar
     thiago@. Salvar e esperar até 15 minutos.
   - Doc: https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/manage-permissions-for-recipients
5. Repetir o teste. Se ainda falhar, anotar o código de erro na issue "[Outbound F0]".

Observação técnica: o código atual usa `/me/sendMail` com escopo `Mail.Send`. Mudar o
remetente (`from`) exige só a permissão "Enviar como" no Exchange, sem novo consentimento. Ler
respostas de comercial@ exige o item 3.

## 3. Novo consentimento do token com `Mail.Read` e `Mail.Read.Shared`

Situação: `Mail.Read` já foi consentido em 30/08 (token do EA Assessor). Para ler a caixa
comercial@ falta `Mail.Read.Shared` (e `Mail.Send.Shared`, se a F7 optar por
`/users/comercial@.../sendMail`).

Regras aprendidas (não repetir o erro de 30/08): o refresh token fica preso aos escopos do
`/authorize` que o gerou; pedir escopo de fora derruba Calendar e Teams junto
(`AADSTS65001`). Por isso o consentimento novo precisa de `prompt=consent`, e o código só
pode pedir o escopo novo depois que o token novo estiver em produção, sob uma flag (nova
variável de ambiente, nos moldes de `MICROSOFT_MAIL_READ_OK`). **Não adicione escopo direto em
`MICROSOFT_SCOPES` do ea-flow**: isso quebra a renovação inteira.

Passos:

1. O site já tem a flag `OUTBOUND_LER_CAIXA` (F6): com ela ligada, a leitura de comercial@ pede
   `Mail.Read.Shared` na renovação do token (`getAccessToken([...])` em `microsoft-graph.ts`); desligada, o
   escopo não muda. O EA Flow (F5) ainda precisa da própria flag. Não refaça o consentimento antes de
   ter o código do EA Flow pronto.
2. Com isso pronto, logado como admin no EA Flow, abrir
   `https://<domínio do ea-flow>/api/microsoft-oauth/start` (faz o `/authorize` com
   `prompt=consent`), aceitar as permissões com a conta thiago@.
3. O callback mostra o refresh token uma vez. Guardar na Vercel (variável
   `MICROSOFT_REFRESH_TOKEN`, marcada Sensitive) e só então ligar a flag nova.
4. Testar com o diagnóstico do assessor que lê comercial@ (200 OK) e conferir que Calendar e
   Teams continuam 200.

Alternativa sem escopo novo: regra de encaminhamento no Exchange de comercial@ para thiago@ e
a F5 lê a cópia pela caixa dele. Menos limpa (mistura caixas), mas não mexe em token.

## 4. Encarregado de dados: `dpo@` e `privacidade@`

A política de privacidade já citava `privacidade@empresarialacademy.com` e
`dpo@empresarialacademy.com`, e a seção 15 (prospecção B2B, publicada nesta frente) também.
Confirmar que os dois endereços existem:

1. https://admin.microsoft.com > Grupos > Grupos de distribuição (ou Caixas compartilhadas).
2. Se não existirem, criar dois aliases/grupos que entregam em thiago@. Teste: mandar um
   e-mail de um Gmail para cada um e ver chegar.
3. Se preferir um endereço só, o fallback definido pela F0 é `contato@empresarialacademy.com`;
   troque em `src/lib/legal.ts` (seções 14 e 15).

## 5. Chip do WhatsApp (perfil comercial e 14 dias de aquecimento)

1. Comprar o chip dedicado (número só do outbound) e ativar o WhatsApp Business nele.
2. Perfil comercial completo: foto (logo de fundo azul-marinho), nome, descrição (texto em
   `BIOS-PARA-TROCAR.md`), horário, endereço, site e catálogo (Consultoria empresarial com IA e
   Diagnóstico de Maturidade gratuito).
3. Aquecimento de 14 dias: conversar com contatos conhecidos que respondam (começar com 5 a
   10 conversas por dia, crescendo devagar), entrar em grupos normais, nenhuma mensagem fria
   nesse período. Sem automação até o 15º dia.
4. Só depois conectar o chip ao Evolution (frente F9). Não envie mensagem fria pelo número
   atual.
5. Segredo do envio (F9). O endpoint do EA Flow responde 503 até existir:
   `cd C:\dev\ea-flow; vercel env add OUTBOUND_WHATSAPP_SECRET production` (valor longo e
   aleatório, o mesmo que o Hunter vai usar; guardar no cofre).
6. No servidor Evolution, criar a instância `prospeccao-ea`, ler o QR code com o chip e, no
   webhook da instância, apontar para `https://ea-flow.vercel.app/api/webhooks/evolution`
   assinando `MESSAGES_UPSERT` (respostas) e `MESSAGES_UPDATE` (entregue, lido, falha).
7. No dia em que o chip começar o aquecimento: `vercel env add OUTBOUND_WHATSAPP_INICIO
   production` com a data `AAAA-MM-DD`. Sem ela o endpoint recusa todo envio. O envio só passa
   a existir a partir do 15º dia (10 por dia na 3ª semana, 20 na 4ª, teto 30).
8. Só depois dos 14 dias e do teste simulado: `OUTBOUND_WHATSAPP_REAL=true` (qualquer outro
   valor continua simulando). Para testar a simulação antes, use temporariamente uma data de
   início com mais de 14 dias e volte para a data real antes de ligar o envio real.
9. Bloqueio ou denúncia no chip: relatar em `POST /api/outbound/whatsapp/bloqueio` (a Evolution
   não avisa). Dois no dia pausam o envio até a meia-noite.

## 6. Plano da Vercel do site (Hobby ou Pro)

- O `vercel.json` do site tem 2 crons diários, compatíveis com o Hobby. Cron a cada 10
  minutos exige **Pro** (custo novo, decisão sua).
- Sem Pro: o worker do Hunter chama o endpoint do site a cada 10 minutos (já previsto no
  plano) e o restante usa GitHub Actions, como o EA Flow faz.
- Conferir também os termos do plano Hobby para uso comercial: https://vercel.com/docs/limits/fair-use-guidelines
  (Hobby é voltado a uso pessoal não comercial; o site é comercial).
- Decisão para registrar na issue "[Outbound F0]": Pro ou Hobby. Sem decisão, o projeto segue
  pelo caminho Hobby.

## 7. Teste de caixa de entrada (antes de ligar o e-mail real)

Depois do item 1 (DKIM ativo):

1. Abrir https://www.mail-tester.com e copiar o endereço de teste que ele mostra.
2. De comercial@ (Outlook), enviar uma mensagem parecida com a carta do fundador (assunto
   normal, texto curto, assinatura e link do site) para esse endereço.
3. Clicar em "Então, como está minha pontuação?". Meta: **9/10 ou mais**, com SPF, DKIM e
   DMARC passando. O plano gratuito permite alguns testes por dia.
4. Se ficar abaixo, o relatório aponta o que corrigir (registro DNS, assunto, links). Anotar o
   resultado na issue "[Outbound F0]".
5. Teste complementar: enviar para um Gmail e um Outlook seus e ver se caiu na caixa de
   entrada, não em spam.

## 8. Calendly ligado ao Outlook

1. Calendly > Integrations > Calendar Connections > **Outlook Calendar** (conta
   thiago@empresarialacademy.com) > autorizar.
2. Em "Check for conflicts" marcar o calendário principal do Outlook e em "Add new events
   to" escolher o mesmo calendário.
3. Manter as regras atuais (horários, duração, antecedência). A reunião do outbound é de 20
   minutos; conferir se já existe esse tipo de evento.
4. Teste: marcar uma reunião pelo link e ver o evento aparecer no Outlook, e um horário
   ocupado no Outlook sumir do Calendly.

## 9. Monitor de heartbeat (sinal de vida do Hunter)

1. Criar conta gratuita em um serviço de heartbeat, por exemplo Healthchecks.io (confirme que
   o plano escolhido é gratuito antes de cadastrar cartão).
2. Criar um check com período de **15 minutos** e tolerância de 15 minutos. Ativar aviso por
   e-mail (thiago@) e, se o serviço permitir, por WhatsApp/Telegram.
3. Copiar a URL de ping do check e guardá-la no seu cofre. Quando a F1 pedir, ela entra como
   variável de ambiente do Hunter (nunca no repositório).

## 10. Decisão de negócio: o que pedir no fim da reunião de 20 minutos

Hipótese de trabalho (marcada como pendente, não decidida): **Implantação Gestão 360**. Recuo
se o dono ainda não estiver pronto: **Diagnóstico Executivo**. Preço e formato ainda sem
confirmação. O roteiro da reunião (F8) sai com a hipótese e você confirma ou troca antes do
piloto. Responda na issue "[Outbound F8]" com: oferta principal, oferta de recuo e faixa de
preço a citar (ou "não citar preço").

## 11. Trocar as bios

Lista e textos prontos em `docs/outbound/BIOS-PARA-TROCAR.md` (Instagram, LinkedIn pessoal e da
página, WhatsApp Business, assinatura do Outlook).

## 12. Segredo da ingestão de eventos do CRM (`CRM_INGEST_SECRET`)

O endpoint `POST /api/crm/eventos` (frente F4) só responde com um segredo; sem a variável ele
recusa tudo (503). O valor é seu: gere, guarde no cofre e use o mesmo nos três sistemas.

1. Gerar um valor longo e aleatório (exemplo no PowerShell, o valor não aparece em arquivo):
   `[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))`
2. No site (produção):
   `cd C:\dev\empresarial-academy-site; vercel env add CRM_INGEST_SECRET production`
   e colar o valor quando o comando pedir. Depois fazer um redeploy (ou esperar o próximo push).
3. No EA Hunter: colocar `CRM_INGEST_SECRET=<mesmo valor>` no `.env` do Hunter (não vai para o git).
4. No EA Flow: `cd C:\dev\ea-flow; vercel env add CRM_INGEST_SECRET production` com o mesmo valor.
5. Teste (sem o cabeçalho deve responder 401; com o segredo e um evento válido, 200):
   ```
   curl -s -o NUL -w "%{http_code}" -X POST https://empresarialacademy.com/api/crm/eventos
   ```
   Contrato dos eventos: `docs/outbound/CONTRATO-EVENTOS.md`.

## 13. Metas editáveis no painel do CRM (migração aditiva)

Hoje o painel do CRM usa as metas iniciais do plano (código, `src/lib/crm/telas/metas.ts`). Para
editar pelo admin (global "Pesos do engajamento (CRM)", grupo "Metas"), falta aplicar no Neon o
SQL aditivo `docs/outbound/migracoes/F4-crm-metas.sql` (só `ADD COLUMN IF NOT EXISTS`, sem
apagar nada) e pedir para reativar o grupo `metas` no `src/globals/CrmConfig.ts` (8 campos
numéricos, padrão = metas do plano). Não é urgente: o painel funciona sem isso.

## 14. Conferir no iPhone (Safari)

1. Abrir `https://empresarialacademy.com/eahub/crm/fila` logado.
2. Compartilhar, "Adicionar à Tela de Início". O ícone é o monograma EA em fundo azul-marinho e o
   nome é "Fila do dia".
3. Conferir: Fila do dia, Kanban (menu "Mover para"), ficha (Ligar, WhatsApp) e Painel, sem
   rolagem lateral da página. Se algo ficar torto, anotar a tela e o que aconteceu.

## 15. Aprovar o protótipo do e-mail frio (F7, antes do primeiro envio real)

Prévias geradas com 7 leads fictícios e kits no formato real do Hunter, em `docs/outbound/previas/`:
`01-email1-fabio-escritorio-de-advocacia`, `02-email1-daniella-so-empresa-no-nome` (saudação sem nome),
`03-email1-erik-financeiro-e-cobranca`, `04-email1-demo-de-segmento`, `05-email2-texto-do-hunter`,
`06-ultimo-toque-porta-aberta` e `07-email1-lead-fora-do-perfil` (convite do diagnóstico), cada uma em `.html` com o
`.txt` da versão texto. Abrir os `.html` no
navegador, no computador e depois no celular (ou reduzir a janela para 390 px).

1. Conferir: faixa de logo, tom da carta, capa do vídeo com play, botão com o dia e horário,
   bloco de material, assinatura e rodapé de LGPD.
2. Dizer o que mudar (texto fixo, ordem, tamanho). O texto da carta (gancho, dor, ponte e convite)
   vem do kit gerado por lead; as partes fixas são assinatura, rodapé e bloco de material.
3. Teste real de renderização (critério da F7): depois do deploy, enviar um e-mail de teste para
   `thiago@` (Outlook) e para um Gmail pessoal e conferir imagens, botão, descadastro, clique e
   abertura. Isso só vale depois que a F6 estiver no ar e o item 2 desta lista estiver resolvido.
4. Aprovando, a issue F7 (#9) pode ser fechada.

Observações que dependem de você ou de outra frente:
- As imagens ficam em `https://empresarialacademy.com/email/` e só aparecem para o destinatário
  depois que este código for publicado no site (deploy da Vercel).
- **Partes fixas editáveis:** o texto padrão está no código e o e-mail funciona sem nada no admin.
  Para editar pelo admin, criar em EA Leads > Modelos de e-mail três modelos com o código interno
  `outbound:assinatura`, `outbound:rodape`, `outbound:material` e `outbound:pergunta` (frase de impacto do cabeçalho) e o texto no campo "Texto" do
  1º e-mail (textos padrão em `src/lib/outbound/email/render.ts`: `PADRAO_ASSINATURA`,
  `PADRAO_RODAPE`, `PADRAO_MATERIAL`). Não criei as linhas direto no banco de produção: o modo
  automático bloqueou a escrita. Não exige migração.
- **E-book:** pronto para aprovação, ainda não publicado. Texto, PDF e rascunho no site estão descritos na seção 19. Enquanto não for publicado, o bloco usa a Calculadora de Vazamento de Margem e o artigo do blog sobre margem.
- **Demo de 60 s:** para segmento sem caso parecido, a capa é um cartão da marca com play; o link
  leva à `/conversa` (F6), que precisa exibir o vídeo de demo quando existir.
## 16. SQL do enum de `email-logs` (aplicar no Neon)

O orquestrador grava cada e-mail frio em EA Leads > Envios. O tipo `outbound` não existe no enum do banco
(o modo automático bloqueou o `ALTER TYPE` em produção em 30/09/2026), então por enquanto os envios entram como
"Campanha manual" (campo `via` = "outlook-graph (outbound)" os distingue). Para separar:

1. Neon > projeto "Site" > SQL Editor: rodar `docs/outbound/migracoes/F6-email-logs-outbound.sql` (um `ALTER TYPE ... ADD VALUE IF NOT EXISTS`, aditivo).
2. Pedir a uma sessão de IA: "trocar TIPO_EMAIL_LOG para outbound" (constante em `src/lib/outbound/payload-outbound.ts`, mais a opção em `src/collections/EmailLogs.ts` e o tipo em `src/lib/email-log.ts`).

## 17. Chamador do orquestrador e `CRON_SECRET`

1. Conferir que `CRON_SECRET` existe na Vercel do site (o cron de nutrição já usa): `vercel env ls production`. Sem ele o endpoint responde 401 para todo mundo.
2. O endpoint `GET https://empresarialacademy.com/api/cron/outbound` (cabeçalho `Authorization: Bearer <CRON_SECRET>`) precisa ser chamado a cada 10 minutos, de segunda a sexta. Opções: o worker do Hunter (frente futura) ou, no plano Pro, um cron `*/10 * * * 1-5` no `vercel.json`. Não há custo novo no Hobby; no Hobby o `vercel.json` não aceita mais do que o cron diário que já existe.
3. Teste (sem o cabeçalho deve responder 401; com ele, simula e devolve `sairiaHoje`):
   ```
   curl -s -o NUL -w "%{http_code}" https://empresarialacademy.com/api/cron/outbound
   ```
   Para ver a simulação sem gravar nada: mesma URL com `?dry=1` e o cabeçalho.

## 18. Ligar o envio real do e-mail e a leitura da caixa

Só depois dos itens 1, 2, 4, 7 e 17, e do consentimento do item 3 (para a leitura da caixa).

1. `cd C:\dev\empresarial-academy-site; vercel env add OUTBOUND_ENVIO_REAL production` e responder `email`. Redeploy.
2. Para ler respostas e bounces: `vercel env add OUTBOUND_LER_CAIXA production` com o valor `1` (só depois do consentimento com `Mail.Read.Shared`; antes disso a renovação do token falha só nessa chamada, o envio segue).
3. Antes de ligar, rodar a simulação por alguns dias e revisar o "o que sairia hoje" (EA Leads > Interações, canal e-mail, tipo `enviado`).
4. Conferir no primeiro e-mail real o "Mostrar original" do Gmail: `DKIM: PASS`, `SPF: PASS` e se o corpo traz as partes texto e HTML. O envio pela Graph manda só o HTML; o Exchange Online costuma gerar a parte texto sozinho. Se não gerar, avisar para trocar o envio para MIME.
5. O formato do e-mail é o da F7 (MJML), já ligado ao orquestrador. Aprove o protótipo (item 13) antes de ligar.

## 19. O próximo passo pedido no fim da reunião (F8, decisão sua)

O roteiro (`docs/outbound/ROTEIRO-REUNIAO.md`) tem 6 minutos para pedir o próximo passo, e esse pedido é decisão sua. Hipótese registrada: **Implantação Gestão 360** como alvo e **Diagnóstico Executivo** como recuo. Nada disso está decidido.

1. Responda na issue #8 (ou a uma sessão de IA) qual é o pedido principal e qual é o recuo.
2. Se mudar, ajustar `OFERTAS_REGUA` em `src/lib/outbound/ficha-pre-reuniao.ts` (nome e investimento de cada oferta). Hoje a ficha usa Implantação R$ 20.700 e Diagnóstico Executivo R$ 5.900, valores da esteira de 04/08/2026, para calcular a faixa de faturamento pela régua de 0,5% a 2,5%.
3. Ligar o envio real de e-mail (item 18) também liga os lembretes de reunião e o follow-up da proposta por e-mail. O WhatsApp desses toques fica em simulação até o envio ser ligado ao EA Flow.

## 20. Conferir a F8 em simulação antes do envio real

1. Marcar uma reunião de teste com o seu e-mail pela `/conversa` (ou pela ficha) e rodar `GET /api/cron/outbound` com o cabeçalho: a confirmação aparece na ficha do lead (EA Leads > Interações, tipo `lembrete`, `simulado = true`).
2. A ficha pré-reunião chega no seu WhatsApp comercial a partir de 24 horas antes da reunião (entre 7h e 22h) e fica na linha do tempo do lead e no bloco "Ficha pré-reunião" da ficha.
3. Na Fila do dia, a reunião passada continua aparecendo até você clicar em **Reunião feita**.

## 21. Aprovar e publicar o e-book "Por que sua empresa fatura mais e sobra menos"

**Estado em 01/10/2026:** texto e PDF finais prontos, rascunho cadastrado no site e não publicado.

- PDF (14 páginas, A4, na identidade da marca): `D:\Empresarial Academy\Projeto IA\EA Content Engine\Materiais\fatura-mais-sobra-menos.pdf`
- Texto final (markdown): `D:\Empresarial Academy\Projeto IA\EA Content Engine\Materiais\fatura-mais-sobra-menos-FINAL.md` (o rascunho antigo e o PDF de 05/08 ficam na mesma pasta, sem uso).
- Cadastro no site: Materiais, id 30, status Rascunho, tipo E-book, categoria Gestão, PDF e capa já anexados. Não é público: `/materiais/fatura-mais-sobra-menos` ainda mostra "Material não encontrado".

**Passos:**

1. Ler o PDF. O que conferir: os números do exemplo da página 6 são hipotéticos e dizem isso no texto; a minibiografia (7 anos como sócio de uma PME, 19 anos de carreira, MBA pela FGV, Green Belt) vem do Branding v3; o retrato da página 13 é o da foto de perfil oficial.
2. Abrir `https://empresarialacademy.com/admin/collections/materials/30`, conferir título, descrição, capa e arquivo e clicar em **Publicar**. Atenção: ao publicar, o site envia o aviso de "novo material" aos assinantes da newsletter (comportamento da coleção `materials`). Para um e-book de captação isso é aceitável; se não quiser o aviso, avise a sessão de IA antes (o campo é somente leitura no admin).
3. Conferir `https://empresarialacademy.com/materiais/fatura-mais-sobra-menos` e o download do PDF.
4. Só depois de publicado, pedir a uma sessão de IA: "trocar `MATERIAL_PADRAO` para o e-book". A troca é em `src/lib/outbound/email/render.ts`:
   ```ts
   export const MATERIAL_PADRAO = {
     titulo: "Por que sua empresa fatura mais e sobra menos",
     link: `${siteConfig.url}/materiais/fatura-mais-sobra-menos`,
   };
   ```
   mais o comentário acima da constante e a regeneração das prévias em `docs/outbound/previas/`. Não trocar antes: o link do e-mail não pode apontar para página inexistente.
5. Se pedir ajuste no texto ou no layout: o PDF é gerado de `fatura-mais-sobra-menos-FINAL.md` por `Materiais\_fonte-ebook\build_ebook.py`; depois de regerar, o arquivo anexado no id 30 precisa ser trocado pelo admin.

## 22. Lista de seguidores da página da EA no LinkedIn (F10)

A fila `/eahub/crm/linkedin` já mostra os decisores achados nos dossiês. Para entrarem também os seguidores da página da EA:

1. Exporte a lista de seguidores da página (nome, empresa, link do perfil) e entregue a uma sessão de IA para importar como leads.
2. A importação **tem de gravar `seguidor_pagina_ea` em `fonteCaptacao`** de cada lead. Só essa marca conta: "seguidores" sozinho é como o Hunter descreve a captação em perfis de concorrentes, e esses não são seguidores da EA.
3. A base legal desses contatos é decisão sua (eles seguiram a página, o que pode servir de consentimento para o LinkedIn, mas não para e-mail).

## 23. Hunter chamar o heartbeat do site (técnico)

Contrato em `RUNBOOK.md`, seção 8: `POST /api/outbound/heartbeat` com `Authorization: Bearer <CRON_SECRET>` e JSON `{ status, pid, ia_teto_atingido, chamadas_ia, teto_ia, ultima_sincronizacao }`, a cada 15 minutos (o worker já tem `baterCoracao` e o chamador do orquestrador, que já usa o mesmo segredo em `OUTBOUND_TICK_SECRET`). GET não grava nada. Sem isso os três alertas ligados ao Hunter ficam quietos. Não exige ação sua além de aprovar a mudança no Hunter.

## 24. Descadastro do site chegar ao Hunter (técnico)

O site marca `marketingOptOut` e `nurtureOptOut` e a etapa Saiu da lista, mas o Hunter só marca "não contatar" quando o próprio lead pede na resposta à DM. O sync do Hunter só escreve no site, nunca lê. Até corrigir, um pedido de saída feito por e-mail ou WhatsApp precisa ser conferido à mão no Hunter (RUNBOOK, seção 4).

## 25. Retenção e exemplos para a IA (técnico, ainda não existem)

- A exclusão automática depois de 12 meses sem interação está em `LGPD.md`, mas nenhuma rotina a executa. Fazer revisão manual trimestral até existir.
- Plano F11: "as mensagens que geraram reunião viram exemplos para a IA". A revisão semanal do site não faz isso; depende do Hunter (`calibrationExamples`) ler do site as mensagens dos leads que marcaram reunião.
