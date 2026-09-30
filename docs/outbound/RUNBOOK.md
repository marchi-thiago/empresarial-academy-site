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
| Todos | Chave geral "envio real" por canal no painel do EA Leads (padrão: simulação) | [depende de F6] |
| DM Instagram | Campanha do Hunter em pausa + teto diário em 0 | [pronto] (teto diário e painel na F3) |
| E-mail | Chave de e-mail no EA Leads; até existir, o e-mail real simplesmente não é ligado | [depende de F6, F7] |
| WhatsApp frio | Desconectar a instância do chip no Evolution (não a do número pessoal) | [depende de F9] |
| LinkedIn | Não há envio automático; parar a fila | [depende de F10] |

Antes de ligar qualquer canal, o checklist mínimo: DKIM ativo e mail-tester 9/10 (e-mail);
chip com 14 dias de aquecimento (WhatsApp); descadastro testado; lista de supressão
consultada; `PENDENCIAS-THIAGO.md` itens 1, 2, 4 e 7 fechados.

## 2. Trocar limites

Limites iniciais (plano, decisão 11): DM 50 por dia, e-mail 50 por dia. WhatsApp frio
começa baixo (valor definido na F9).

- Painel do EA Leads > Campanhas/Envios > limites por canal [depende de F6].
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

## 9. Referências

- Plano: `Agentes/PLANO-OUTBOUND.md` (seções 9 e 10).
- LGPD: `docs/outbound/LGPD.md`. Pendências: `docs/outbound/PENDENCIAS-THIAGO.md`.
- Estado de cada repositório: `PROJECT_STATUS.md`.
