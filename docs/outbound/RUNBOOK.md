# RUNBOOK do Outbound (Operação e Alertas — F12)

Atualizado em 01/10/2026 pela frente F12.
Fonte da verdade operacional do Projeto Outbound da Empresarial Academy.
Princípio: o sistema opera em **modo simulação por padrão**. O envio real é uma decisão explícita do Thiago por canal.
Na dúvida, desligar. Desligar nunca apaga dados.

---

## 1. Ligar e desligar o envio real por canal

Canais: DM do Instagram (Hunter), e-mail (Microsoft Graph comercial@), WhatsApp frio (chip dedicado via Evolution), LinkedIn (semiautomático na Fila do dia), ligação (manual pelo Thiago).

| Canal | Onde liga/desliga | Como operar | Estado atual |
|---|---|---|---|
| **E-mail** | Variável `OUTBOUND_ENVIO_REAL` no site (Vercel) | **Ligar:** `vercel env add OUTBOUND_ENVIO_REAL production` com valor `email` (ou lista separada por vírgula), seguido de redeploy.<br>**Desligar:** `vercel env rm OUTBOUND_ENVIO_REAL production` (ou remover `email` do valor) e redeploy. | [pronto] (F6/F7) |
| **DM Instagram** | Painel local do Hunter (`http://localhost:3000`) | **Ligar:** No painel, clicar em "Ativar Mensagens" (inicia Chrome dedicado na porta 9222 e limpa `desativado.flag`).<br>**Desligar:** Clicar em "Desativar Mensagens" (fecha o Chrome dedicado cirurgicamente e cria `data/desativado.flag`). | [pronto] (F1/F3) |
| **WhatsApp frio** | Variável `OUTBOUND_WHATSAPP_REAL` no EA Flow (Vercel) | **Ligar:** `cd C:\dev\ea-flow; vercel env add OUTBOUND_WHATSAPP_REAL production` com valor `true` (somente após 14 dias de aquecimento a partir de `OUTBOUND_WHATSAPP_INICIO`).<br>**Desligar:** Definir `OUTBOUND_WHATSAPP_REAL=false` ou desconectar a instância `prospeccao-ea` no painel da Evolution API. | [pronto] (F9) |
| **LinkedIn** | Fila do dia no CRM (`/eahub/crm/fila`) | **Operação:** Semiautomático (F10). O Thiago clica no link do perfil do decisor, copia a nota de até 200 caracteres gerada no kit e clica em "Marcar Enviado".<br>**Desligar/Pausar:** Basta não realizar os envios na fila. | [pronto] (F10) |
| **Ligação** | Fila do dia no CRM (`/eahub/crm/fila`) | **Operação:** O Thiago clica no botão "Ligar" (`tel:`) para leads engajados, seguindo o roteiro SPIN de 30 segundos do kit.<br>**Desligar/Pausar:** Operação 100% sob demanda do fundador. | [pronto] (F4/F8) |

> [!IMPORTANT]
> **Checklist obrigatório antes de ligar envio real:**
> 1. E-mail: DKIM ativo com `PASS`, teste no mail-tester com nota ≥ 9/10, consentimento Graph de thiago@ com permissão "Enviar como comercial@".
> 2. WhatsApp: chip dedicado com perfil comercial completo e 14 dias corridos de aquecimento humano sem automação.
> 3. Descadastro em 1 clique testado nos dois canais.
> 4. `PENDENCIAS-THIAGO.md` itens 1, 2, 4, 7 e 12 validados.

---

## 2. Trocar limites operacionais

Os limites protegem os domínios, números e contas contra bloqueios e garantem taxa de resposta consistente.

| Recurso | Limite padrão | Onde alterar | Regra de alteração |
|---|---|---|---|
| **E-mail frio** | 50 envios/dia | Variável `OUTBOUND_EMAIL_TETO_DIA` na Vercel do site | Subir no máximo 10/semana somente se a taxa de bounce estiver < 3% e resposta > 3%. Reduzir imediatamente para metade se houver qualquer alerta de bounce. |
| **DM Instagram** | 50 DMs/dia (máx 80) | Painel do Hunter > Teto diário de DMs (ou `DM_DAILY_CAP` no `.env`) | Rampa automática configurável: +10/semana até 80 se a taxa de resposta em 14 dias for ≥ 3%. Redução automática pela metade se houver sinal de bloqueio. |
| **WhatsApp frio** | Rampa por tempo | Automático no EA Flow a partir de `OUTBOUND_WHATSAPP_INICIO` | Dias 1–14: 0 envios.<br>Dias 15–21: máx 10/dia.<br>Dias 22–28: máx 20/dia.<br>Dia 29 em diante: teto fixo de 30/dia.<br>Intervalo entre envios de 3 a 8 min sorteado. |
| **Chamadas de IA (Hunter)** | 300 chamadas/dia | Painel do Hunter > Teto diário de IA (`system_state.ia_teto_diario`) | Renovação a cada 5 horas (cota Google AI Pro via Antigravity CLI `agy`). Se atingir teto, reprocessamento aguarda o dia seguinte. |
| **LinkedIn** | Até 15 convites/dia | Operação manual do Thiago na Fila do dia | Respeitar os limites semanais da conta gratuita do LinkedIn (~100 convites/semana). |

---

## 3. Pausar e retomar campanha

Pausar uma campanha interrompe novos toques de prospecção, mas **nunca desliga a recepção de respostas** — se qualquer lead responder, a cadência é interrompida imediatamente e o aviso chega no WhatsApp do Thiago.

### Como pausar:
1. **No EA Hunter (DMs):**
   - Acessar `http://localhost:3000` > aba **Campanhas**.
   - Clicar em "Pausar" na campanha desejada.
   - O worker deixa os leads daquela campanha em espera sem disparar DMs.
2. **No EA Leads (E-mail e Cadência):**
   - Para pausar leads individuais: abrir a ficha do lead em `/eahub/crm/lead/:id` e marcar "Pausar cadência" informando o motivo.
   - Para pausar a prospecção de e-mail em massa: remover `email` da variável `OUTBOUND_ENVIO_REAL` na Vercel e fazer redeploy.
3. **No WhatsApp frio:**
   - Desconectar a instância `prospeccao-ea` no painel da Evolution API ou setar `OUTBOUND_WHATSAPP_REAL=false` no EA Flow.

### Como retomar:
1. Reverter o toggle correspondente no painel do Hunter ou na variável de ambiente.
2. Conferir no Kanban (`/eahub/crm`) e na Fila do dia (`/eahub/crm/fila`) se os próximos passos reaparecem normalmente.

---

## 4. Pedido de exclusão ou oposição (LGPD)

Todo titular de dados tem direito de solicitar o encerramento do contato (oposição) ou a eliminação de seus dados pessoais (art. 18 da LGPD).
- **Meta interna da EA:** atendimento em até **48 horas**.
- **Prazo legal máximo:** até 15 dias (art. 19, II).

### Procedimento operacional passo a passo:

1. **Identificar o pedido:**
   - Pode chegar por: e-mail em `privacidade@empresarialacademy.com` ou `dpo@`, clique no link de descadastro (`/api/marketing/sair`), resposta com palavras como "SAIR", "PARE", "NÃO QUERO", "ME TIRE DA LISTA" em qualquer canal.
2. **Aplicar a supressão imediata (passo 1):**
   - Na ficha do lead (`/eahub/crm/lead/:id`): clicar em "Mover para" > **Saiu da lista** (ou botão "Descadastrar").
   - Isso atualiza automaticamente no banco do site:
     - `dealStatus: "saiu_da_lista"`
     - `marketingOptOut: true`
     - `nurtureOptOut: true`
     - `cadencia.pausada: true`
     - Registra a interação `descadastro` com a data e hora.
   - Uma vez em "Saiu da lista", o lead é ignorado por todos os orquestradores e filtros de disparo de todos os canais.
3. **Se o lead veio do Hunter:**
   - No EA Hunter, o lead é marcado como `doNotContact = true` pelo sincronizador ou pelo script `scripts/sincronizar-ea-leads.ts`.
4. **Se o pedido for de eliminação definitiva (art. 18, VI):**
   - Limpar dados pessoais identificáveis (nome, empresa, telefone, bio, dossie) do cadastro do lead, mantendo apenas o identificador de supressão (hash do e-mail ou handle) para garantir que novos scrapes não o reimportem.
   - Nunca apagar o histórico de commits do git nem registros forenses de auditoria.
5. **Confirmar ao titular:**
   - Responder confirmando a exclusão em uma única linha cordial, sem questionamentos nem tentativa de retenção:
     > "Confirmamos que seus dados foram removidos de nossa lista de prospecção e nenhum novo contato será realizado. Atenciosamente, Empresarial Academy."
6. **Política de retenção periódica:**
   - Leads sem qualquer sinal de interação (abertura, clique, resposta) há mais de **12 meses** são automaticamente suprimidos do funil ativo.

---

## 5. Domínio em lista negra ou queda de reputação

Sinais: taxa de bounce diária > 3%, e-mails caindo na pasta de Spam/Lixo Eletrônico, alerta automático no WhatsApp comercial, erro `550 5.7.1` no envio da Microsoft Graph.

### Procedimento de emergência:
1. **Desligar imediatamente o envio real:**
   ```bash
   cd C:\dev\empresarial-academy-site
   vercel env rm OUTBOUND_ENVIO_REAL production
   ```
   Fazer redeploy. Todos os envios voltam ao modo simulação seguro.
2. **Diagnóstico técnico de entregabilidade:**
   - Consultar reputação em https://mxtoolbox.com/blacklists.aspx com o domínio `empresarialacademy.com`.
   - Realizar teste de pontuação em https://www.mail-tester.com enviando e-mail de teste de `comercial@empresarialacademy.com`.
   - Conferir DNS:
     ```bash
     nslookup -type=txt empresarialacademy.com 8.8.8.8
     nslookup -type=cname selector1._domainkey.empresarialacademy.com 8.8.8.8
     ```
3. **Desbloqueio com a Microsoft:**
   - Se o IP ou domínio foi filtrado pela Microsoft: acessar o portal de suporte de remetentes do Outlook (Sender Support / SNDS) e abrir ticket formal com as informações de conformidade B2B e SPF/DKIM válidos.
4. **Retomada:**
   - Somente religar após confirmação de liberação e nota ≥ 9/10 no mail-tester.
   - Retomar com limite reduzido para 20 envios/dia nos primeiros 7 dias.

---

## 6. Chip do WhatsApp banido ou restrito

Sinais: mensagens falhando com erro da Evolution, status da instância desconectado, alerta de bloqueio.

### Procedimento:
1. **Desconectar a instância imediatamente:**
   - No servidor Evolution API, pausar a instância `prospeccao-ea`.
   - No EA Flow, garantir que `OUTBOUND_WHATSAPP_REAL` está desligado.
2. **Relatar bloqueio na API:**
   - Chamar o endpoint de bloqueio do EA Flow para registrar o evento e acionar a proteção:
     ```bash
     curl -X POST https://ea-flow.vercel.app/api/outbound/whatsapp/bloqueio \
       -H "Authorization: Bearer <OUTBOUND_WHATSAPP_SECRET>" \
       -H "Content-Type: application/json" \
       -d '{"motivo":"bloqueio"}'
     ```
   - 2 bloqueios no mesmo dia pausam qualquer envio automaticamente até a meia-noite.
3. **Solicitação de revisão:**
   - Abrir solicitação de análise pelo próprio app do WhatsApp Business (uma única vez, justificando uso comercial legítimo).
   - **PROIBIDO** recorrer repetidas vezes ou tentar truques de terceiros.
   - **PROIBIDO** usar o número pessoal do Thiago ou a instância principal como estepe.
4. **Substituição de chip:**
   - Adquirir novo chip dedicado, configurar perfil comercial completo e registrar nova data em `OUTBOUND_WHATSAPP_INICIO`.
   - Cumprir integralmente o novo período de 14 dias de aquecimento humano antes de qualquer mensagem outbound.

---

## 7. PC do Thiago fora do ar

O EA Hunter, o Chrome dedicado do Instagram e o Antigravity CLI (`agy`) rodam localmente no computador do Thiago. (Tirar essa dependência é escopo da frente futura F13).

### O que acontece durante a queda:
- **Hunter:** sem novas descobertas de perfis, sem qualificação com IA, sem disparos de novas DMs.
- **Site e EA Flow:** **continuam operando normalmente na Vercel**. E-mails agendados, respostas de leads via webhook, página `/conversa`, agendamentos no Calendly e avisos no WhatsApp continuam funcionando.

### Procedimento ao religar:
1. Ligar o computador e aguardar inicialização.
2. Iniciar o Hunter pelo atalho ou rodar no PowerShell:
   ```powershell
   cd "D:\Empresarial Academy\Projeto IA\EA Hunter"
   .\scripts\iniciar.ps1
   ```
3. Acessar o painel em `http://localhost:3000`:
   - Conferir se o status do worker está ativo.
   - Clicar em "Ativar Mensagens" (abre o Chrome dedicado na porta 9222).
4. Conferir a saúde do Antigravity CLI no terminal:
   ```powershell
   agy models
   ```
5. Conferir a tela `/erros` no painel do Hunter. Caso haja jobs que falharam por indisponibilidade do Chrome ou IA durante a queda, clicar em "Reprocessar" para devolvê-los à fila de execução normal.

---

## 8. Alertas operacionais (F12)

Os alertas são avaliados periodicamente a cada execução do orquestrador (`/api/cron/outbound`, intervalo recomendado de 10 minutos).
Quando uma condição anômala é detectada, o sistema notifica o Thiago via WhatsApp comercial (POST `/api/avisos/dono` no EA Flow).
Deduplicação: cada tipo de alerta possui um cooldown para evitar notificações repetitivas dentro do mesmo episódio.

### Catálogo de alertas operacionais:

| Alerta | Severidade | Condição de disparo | Cooldown | Causa provável | Primeiro passo para resolver | Quem resolve |
|---|---|---|---|---|---|---|
| **Sem sinal de vida do Hunter** (`sem_sinal_hunter`) | Crítica | Mais de 30 minutos sem ping/heartbeat do Hunter durante horário comercial (seg–sex, 8h às 18h). | 4 horas | PC do Thiago desligado, worker travado, sem internet no escritório ou falha no script de heartbeat. | Conferir se o PC do Thiago está ligado; abrir o painel local `http://localhost:3000`; verificar se o worker está rodando e se a rota `/api/outbound/heartbeat` está respondendo. | Thiago |
| **Falha de sincronização** (`falha_sync_hunter`) | Crítica | Mais de 3 horas sem sincronização de leads entre o Hunter e o EA Leads durante horário comercial. | 4 horas | Queda de rede local, credencial `EA_LEADS_DATABASE_URI` expirada ou Neon Postgres fora do ar. | Acessar o painel do Hunter > tela `/erros`; rodar manualmente `pnpm tsx scripts/sincronizar-ea-leads.ts` para inspecionar a mensagem de erro exata. | Thiago / Engenharia |
| **Bounce de e-mail alto** (`bounce_alto`) | Crítica | Taxa de bounce no dia > 3% com pelo menos 2 bounces registrados. | 6 horas | Envio para e-mails inválidos, domínio em blacklist, alteração indevida de DNS (DKIM/SPF) ou bloqueio do remetente. | O envio real de e-mails é pausado automaticamente. Conferir `email-logs` no admin do EA Leads; rodar teste no mail-tester; verificar se o remetente comercial@ está funcional no Outlook. | Engenharia / Thiago |
| **Fila travada** (`fila_travada`) | Aviso | Pelo menos 1 lead em cadência ativa cujo próximo toque programado está atrasado há mais de 48 horas. | 6 horas | Orquestrador `/api/cron/outbound` não está sendo chamado regularmente (falha no cron), ou canal específico sem despachante ativo. | Verificar logs do chamador de cron; chamar manualmente `GET /api/cron/outbound` com Bearer `CRON_SECRET`; conferir se os canais devidos estão operando. | Engenharia |
| **Teto de IA atingido** (`teto_ia_hunter`) | Aviso | Hunter atingiu o teto diário de chamadas de IA do Antigravity CLI (padrão 300 chamadas/dia). | 12 horas | Lote grande de leads qualificados no mesmo dia consumiu a cota diária do `agy`. | Normal. A geração de dossiês pausa com segurança até a renovação da cota (a cada 5 horas ou meia-noite). Se necessário aumentar o volume, ajustar o teto no painel do Hunter. | Thiago |

---

## 9. Orquestrador de e-mail e rotinas (`/api/cron/outbound`)

Endpoint central da cadência: `GET` ou `POST https://empresarialacademy.com/api/cron/outbound`.
Autenticação: `Authorization: Bearer <CRON_SECRET>`. Sem o segredo correto, responde HTTP 401.

### Parâmetros úteis:
- `?dry=1`: executa todo o planejamento, regras e avaliações e devolve o relatório JSON **sem gravar nada no banco e sem enviar mensagens**.

### O que cada rodada do orquestrador executa:
1. **Temperatura:** Recalcula a pontuação e temperatura de engajamento dos leads (janela de 7 dias, executada 1 vez ao dia).
2. **Caixa comercial@:** Lê bounces e respostas da caixa comercial@ quando `OUTBOUND_LER_CAIXA=1`.
3. **Agenda do Outlook:** Confere reuniões agendadas a cada hora e vincula ao lead no CRM.
4. **Alertas operacionais:** Avalia as 5 regras de saúde operacional descritas na seção 8 e envia notificações ao Thiago no WhatsApp quando necessário.
5. **Agendamento de toques:** Atualiza `proximoToqueEm` e `proximoCanal` de cada lead elegível na cadência adaptativa.
6. **E-mail:**
   - Em simulação: grava em `interacoes` os e-mails que sairiam hoje (`metadados.simulado = true`).
   - Em envio real (`OUTBOUND_ENVIO_REAL=email`): envia no máximo 1 e-mail por chamada dentro da janela comercial, respeitando intervalo de 5 a 15 min, teto diário e limite de 1 por domínio corporativo.

7. **Reunião e venda (F8):** em cada rodada, para as reuniões futuras em "Reunião marcada": confirmação na hora do agendamento, lembretes 24h e 1h antes (WhatsApp e e-mail) e ficha pré-reunião ao Thiago (aviso no WhatsApp comercial, a partir de 24h antes, entre 7h e 22h). Para leads em "Proposta enviada": follow-up D2, D5 e D10 em dia útil, das 8h às 18h. Tudo é idempotente por chave em `interacoes` (`lembrete:...`, `ficha:...`, `followup:...`). Lembretes e follow-ups seguem `OUTBOUND_ENVIO_REAL`: só o e-mail pode ser real; o WhatsApp fica em simulação até o envio ser ligado ao EA Flow. Para pausar só esta parte, não há chave própria: desligue o envio real do e-mail (ficam só os registros simulados e o aviso ao Thiago).

### Endpoint de Heartbeat do Hunter:
- `GET` ou `POST https://empresarialacademy.com/api/outbound/heartbeat`
- Permite ao Hunter registrar sinal de vida a cada 15 minutos, informando PID, status e estado da cota de IA.
- Utilizado pelo alerta `sem_sinal_hunter` para confirmar que a máquina de prospecção local está ativa.

---

## 10. Referências normativas

- Plano mestre: `Agentes/PLANO-OUTBOUND.md` (revisão com 14 melhorias aprovadas).
- Documento de conformidade e avaliação de legítimo interesse: `docs/outbound/LGPD.md`.
- Lista de pendências técnicas e de negócio do fundador: `docs/outbound/PENDENCIAS-THIAGO.md`.
- Contrato de ingestão de eventos do CRM: `docs/outbound/CONTRATO-EVENTOS.md`.
- Status em tempo real dos sistemas: `PROJECT_STATUS.md` em cada repositório.
