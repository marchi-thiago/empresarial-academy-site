# RUNBOOK do Outbound (esqueleto inicial, frente F0)

Criado em 30/09/2026. A frente F12 completa cada seção com os comandos e telas reais conforme
as frentes forem entregues. Legenda de estado:

- **[pronto]**: vale hoje.
- **[depende de Fx]**: o mecanismo só existe depois da frente indicada; até lá, vale o
  fallback escrito na seção.

Princípio: o sistema nasce em **modo simulação**. Envio real é decisão do Thiago, por canal.
Na dúvida, desligar. Desligar nunca apaga dado.

## 1. Ligar e desligar o envio real por canal

Canais: DM do Instagram (Hunter), e-mail (Microsoft Graph, comercial@), WhatsApp frio (chip
dedicado), LinkedIn (semiautomático, o Thiago clica), ligação (manual).

| Canal | Liga/desliga | Estado |
|---|---|---|
| Todos | Variável `OUTBOUND_ENVIO_REAL` do site (Vercel), lista de canais: `email`, `dm`, `whatsapp`, `linkedin`, `ligacao`. Ausente ou vazia = tudo em simulação. Hoje só o `email` é enviado pelo site; os outros canais leem a mesma chave quando suas frentes entrarem. Uma chave no painel do EA Leads exigiria coluna nova (DDL), por isso a chave é de ambiente | [pronto] (F6) |
| DM Instagram | Campanha do Hunter em pausa + teto diário em 0 | [pronto] (teto diário e painel na F3) |
| E-mail | Ligar: `vercel env add OUTBOUND_ENVIO_REAL production` com o valor `email`, depois redeploy. Desligar: `vercel env rm OUTBOUND_ENVIO_REAL production` e redeploy (ou trocar o valor). Veja a seção 9 | [pronto] (F6, com o formato da F7) |
| WhatsApp frio | Desconectar a instância do chip no Evolution (não a do número pessoal) | [depende de F9] |
| LinkedIn | Não há envio automático; parar a fila | [depende de F10] |

Antes de ligar qualquer canal, o checklist mínimo: DKIM ativo e mail-tester 9/10 (e-mail);
chip com 14 dias de aquecimento (WhatsApp); descadastro testado; lista de supressão
consultada; `PENDENCIAS-THIAGO.md` itens 1, 2, 4 e 7 fechados.

## 2. Trocar limites

Limites iniciais (plano, decisão 11): DM 50 por dia, e-mail 50 por dia. WhatsApp frio
começa baixo (valor definido na F9).

- E-mail: teto diário padrão 50 (`OUTBOUND_EMAIL_TETO_DIA` troca o valor, variável de ambiente); janela, intervalo de 5 a 15 min e limite de bounce estão em `src/lib/outbound/config.ts` [pronto] (F6).
- Teto diário de chamadas de IA (`agy`) no painel do Hunter [depende de F2].
- Regra de decisão: subir só depois de uma semana com bounce abaixo de 3% e sem reclamação.
  Descer imediatamente em qualquer alerta.

## 3. Pausar campanha

1. Painel do EA Leads > Campanhas > pausar [depende de F4, F6]. Pausar não cancela conversas
   já abertas: resposta de lead continua gerando aviso.
2. Enquanto a tela não existir: pausar a campanha no painel do Hunter (DM) e não ligar o
   envio real dos demais canais [pronto para DM].
3. Registrar motivo e data na `PROJECT_STATUS.md` do repositório afetado.

## 4. Pedido de exclusão ou oposição (LGPD)

Prazo: até 15 dias (art. 19, II); a meta interna é 48 horas.

1. Entra por `privacidade@empresarialacademy.com`, por resposta de mensagem ("SAIR",
   "me tire da lista") ou por DM. Qualquer forma vale.
2. **Suprimir primeiro**: incluir o contato na lista de supressão global (todos os canais) e
   cancelar qualquer toque agendado [depende de F4, F6; até lá, marcar o lead como "não
   contatar" na base do EA Leads e avisar o Hunter para pular o perfil].
3. Se o pedido for de exclusão: apagar o lead, o dossiê e as mensagens, mantendo só o
   identificador mínimo na supressão. Nunca apagar histórico git nem backup sem registro.
4. Responder confirmando (uma linha, sem tentar reter).
5. Anotar data e canal do pedido no registro de atendimento da LGPD [depende de F12].

Retenção automática: lead sem interação há 12 meses é excluído por rotina agendada
[depende de F12].

## 5. Domínio em lista negra ou queda de reputação

Sinais: bounce acima de 3%, reclamações, mensagens indo para spam, erro de bloqueio do
Outlook.

1. Desligar o envio real de e-mail (seção 1).
2. Conferir o domínio em https://mxtoolbox.com/blacklists.aspx e o remetente no mail-tester.
3. Conferir SPF, DKIM e DMARC (`nslookup` do `PENDENCIAS-THIAGO.md`, item 1).
4. Se Microsoft bloquear o remetente: seguir o processo de desbloqueio do Outlook (pelo
   portal de suporte de remetentes da Microsoft) e aguardar; não trocar de domínio às pressas.
5. Retomar com volume reduzido (metade) e subir devagar (seção 2).

## 6. Chip do WhatsApp banido ou restrito

1. Desconectar a instância do chip no Evolution [depende de F9] e parar qualquer fila.
2. Não recorrer repetidas vezes; abrir uma única solicitação de revisão pelo próprio app.
3. Não usar o número pessoal do Thiago nem o do EA Flow como reserva.
4. Novo chip = novo ciclo completo de 14 dias de aquecimento (`PENDENCIAS-THIAGO.md`, item 5).
5. Revisar volume e texto antes de voltar: taxa de resposta baixa e denúncias são a causa usual.

## 7. PC do Thiago fora do ar

O Hunter, as rotinas de resposta e o agy rodam no PC (dependência conhecida; tirar isso é a
F13, fora do piloto).

1. Alerta de "sem sinal de vida por 30 minutos em horário comercial" [depende de F1 e do
   item 9 das pendências].
2. Efeitos: sem DM, sem captação, sem dossiês novos. O site e o EA Flow seguem no ar; e-mail
   e avisos de resposta que já estão no site continuam.
3. Religar o PC, abrir o Chrome dedicado do Instagram, conferir o worker do Hunter e o login
   do `agy`. Rodar a checagem de saúde [depende de F1].
4. Jobs que ficaram pendentes são reprocessados dentro do teto diário, sem duplicar envio
   [depende de F1].
5. Queda longa (mais de 24 horas): pausar as campanhas para a cadência não atrasar toques.

## 8. Alertas esperados (F12)

Falha de sincronização Hunter para o EA Leads, bounce acima de 3%, fila travada, teto de IA
atingido, sem sinal de vida. Cada alerta terá aqui: causa provável, primeiro passo e quem
resolve. [depende de F1, F12]

## 9. Orquestrador de e-mail e página /conversa (F6)

Endpoint: `GET` ou `POST https://empresarialacademy.com/api/cron/outbound`, com `Authorization: Bearer <CRON_SECRET>`.
Sem o cabeçalho, ou sem `CRON_SECRET` no ambiente, responde 401 (nunca fica aberto). `?dry=1` calcula e responde sem gravar nada.

**Quem chama.** O plano Hobby da Vercel só aceita cron diário, e o site já usa os 2 do plano, então o `vercel.json`
não mudou. O worker do Hunter (frente futura) chama o endpoint **a cada 10 minutos**; no Pro dá para pôr o cron da
Vercel (`*/10 * * * 1-5`). Cada chamada envia **no máximo 1 e-mail**: com chamadas de 10 em 10 minutos e intervalo
sorteado de 5 a 15 minutos, saem de 30 a 45 por dia; para chegar perto do teto de 50, chamar a cada 5 minutos.

**O que cada chamada faz**
1. Recalcula a temperatura pela janela de 7 dias (1 vez por dia, marcador `rotina:temperatura:AAAA-MM-DD`).
2. Lê a caixa comercial@ e registra bounces e respostas, **só com `OUTBOUND_LER_CAIXA=1`** (precisa do consentimento `Mail.Read.Shared`, pendência 3).
3. Confere a agenda do Outlook (1 vez por hora): reunião com o e-mail do lead entra no CRM e preenche o horário.
4. Agenda o próximo toque de cada lead em `cadencia.proximoToqueEm` e `proximoCanal` (DM para o Hunter, WhatsApp para o EA Flow, ligação e LinkedIn para a Fila do dia). Só grava o que mudou.
5. E-mail: simulação ou envio real (abaixo).

**Simulação (padrão).** Grava em `interacoes` uma linha por e-mail que sairia no dia (canal e-mail, tipo `enviado`,
`metadados.simulado = true`, conteúdo começando por "[simulação]"), sem enviar e sem mexer no lead. A resposta do endpoint
traz `sairiaHoje` (lead, e-mail, toque, assunto, horário previsto, dia sugerido) e `descartados` (motivo de cada um
que ficou de fora: domínio repetido, teto, texto bloqueado, sem e-mail no kit). No admin: EA Leads > Interações,
filtrando tipo `enviado` e canal `email`. Simulado nunca entra no painel nem na Fila.

**Ligar o envio real do e-mail** (só depois do checklist da seção 1: DKIM, mail-tester 9/10, descadastro testado, pendências 1, 2, 4 e 7):
1. `cd C:\dev\empresarial-academy-site; vercel env add OUTBOUND_ENVIO_REAL production` e responder `email`.
2. Redeploy. A partir da próxima chamada dentro da janela (seg a sex, 8h às 18h de Brasília), sai 1 e-mail por vez, como comercial@.
3. Conferir na primeira hora: EA Leads > Envios (aparecem como "Campanha manual", ver pendência 16), `statusEntrega.email` do lead e o "Mostrar original" no Gmail (`DKIM: PASS`, `SPF: PASS` e a parte texto do e-mail).
4. Para parar: remover a variável e redeploy. Nada é apagado.

**Proteções automáticas:** pausa do dia quando o bounce passa de 3% (com menos de 10 envios, 2 bounces já pausam; depende da leitura da caixa); teto diário; 1 por domínio corporativo por dia (Gmail, Outlook e outros provedores gratuitos ficam de fora da regra, senão o volume não fecha); no máximo 1 toque por dia por lead; 2 dias entre e-mails ao mesmo lead; opt-out, "Saiu da lista", resposta e bounce nunca recebem. Texto com marcador sobrando (`{{...}}`) ou travessão não sai e fica registrado como bloqueio por 24 horas.

**Rastreio.** Links de clique `https://empresarialacademy.com/r/<codigo>` (registra `clicado`, 3 pontos, e redireciona; só para o próprio site) e pixel `/o/<codigo>.gif` (registra `aberto`, 1 ponto, no máximo 2 por semana). Os códigos são assinados com `PAYLOAD_SECRET`: trocar esse segredo invalida os links de e-mails já enviados. Robôs e pré-visualizadores são ignorados. Descadastro: o link do rodapé usa `/api/marketing/sair`, que já leva o lead para "Saiu da lista".

**Página `/conversa?t=<token>`.** Sem menu nem rodapé; vídeo de prova (`dossie.prova`), Calendly com nome, e-mail e dia sugerido. Registra `abriu_pagina` (0 pontos), `deu_play` (4) e `agendou` (Reunião marcada e cadência pausada). O horário exato da reunião vem da agenda do Outlook (passo 3 acima); até lá o próximo passo mostra "Reunião de 20 min". Token inválido: a mesma página, genérica.

## 10. Referências

- Plano: `Agentes/PLANO-OUTBOUND.md` (seções 9 e 10).
- LGPD: `docs/outbound/LGPD.md`. Pendências: `docs/outbound/PENDENCIAS-THIAGO.md`.
- Estado de cada repositório: `PROJECT_STATUS.md`.
