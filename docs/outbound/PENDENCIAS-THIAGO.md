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

1. A frente F5 (resposta rápida) implementa a flag e a constante de escopos com
   `Mail.Read.Shared`. Enquanto isso não entrar, não refaça o consentimento.
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
