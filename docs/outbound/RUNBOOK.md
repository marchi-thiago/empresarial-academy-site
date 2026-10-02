# RUNBOOK do Outbound (operação e alertas, F12)

Revisado em 01/10/2026 (auditoria das PRs 23, 24 e 25). Cada nome de variável, tela e rota abaixo foi conferido no código.
Fonte da verdade operacional do Projeto Outbound da Empresarial Academy.
Princípio: o sistema começa em **simulação**. Envio real é decisão do Thiago, por canal. Na dúvida, desligar. Desligar nunca apaga dado.

Onde cada coisa roda:

| Sistema | Onde | O que faz no outbound |
|---|---|---|
| EA Leads (site) | Vercel, `empresarialacademy.com`, admin em `/eahub` | CRM, orquestrador de e-mail, alertas, revisão semanal |
| EA Hunter | PC do Thiago, painel em `http://localhost:3000` | Capta, analisa, envia DM, chama o orquestrador a cada 5 minutos em horário comercial |
| EA Flow | Vercel | WhatsApp frio pela Evolution (instância `prospeccao-ea`) e aviso ao Thiago no WhatsApp |

---

## 1. Ligar e desligar o envio real por canal

| Canal | Onde liga e desliga | Como |
|---|---|---|
| **E-mail** | Variável `OUTBOUND_ENVIO_REAL` no projeto do site na Vercel | Ligar: `vercel env add OUTBOUND_ENVIO_REAL production` com o valor `email`, depois redeploy. Desligar: `vercel env rm OUTBOUND_ENVIO_REAL production` e redeploy. Vazia ou ausente = simulação. |
| **Leitura de respostas e bounces** | `OUTBOUND_LER_CAIXA` no site (`1`, `true`, `sim` ou `on`) | Só depois do consentimento `Mail.Read.Shared` (PENDENCIAS-THIAGO.md, item 3). |
| **DM do Instagram** | Painel do Hunter, cartão **Mensagens**, botão Ligar ou Desligar | Desligar para só as DMs; o cartão **Análise de leads** segue ligado se estiver. Fora do horário (`OPERATING_HOURS`) ele não envia sozinho. |
| **WhatsApp frio** | Variável `OUTBOUND_WHATSAPP_REAL` no projeto do EA Flow | Só `true` envia de verdade; qualquer outro valor é simulação. Antes disso o EA Flow exige `OUTBOUND_WHATSAPP_INICIO` (AAAA-MM-DD, início do aquecimento) e recusa tudo nos 14 primeiros dias. |
| **LinkedIn** | Sem chave: é manual | `/eahub/crm/linkedin`. O sistema só prepara a fila (link, nota de até 200 caracteres). O Thiago abre o perfil, copia a nota, envia pelo LinkedIn e clica em **Marcar como Enviado**. **Nenhuma automação no LinkedIn.** |
| **Ligação** | Sem chave: é manual | Fila do dia, `/eahub/crm/fila`, botão Ligar. |

Checklist antes de ligar o e-mail real (resumo do `PENDENCIAS-THIAGO.md`): DKIM com `PASS`, enviar como comercial@ testado, teste de caixa de entrada com nota boa, descadastro em 1 clique testado, `CRON_SECRET` na Vercel e o chamador do orquestrador ativo (item 17).

---

## 2. Trocar limites

| Recurso | Padrão | Onde muda | Observação |
|---|---|---|---|
| E-mail frio | 50 por dia | `OUTBOUND_EMAIL_TETO_DIA` no site | Subir só se bounce abaixo de 3% e resposta ao e-mail acima de 3% (plano, seção 4). |
| DM do Instagram | começa em 50 por dia | Painel do Hunter, campo **Teto diário de DMs** (ou `DM_CAP_START` e `DM_CAP_STEP` no `.env` do Hunter) | Sobe `DM_CAP_STEP` (10) por semana sem sinal de bloqueio, até `MAX_DMS_PER_DAY` (80). Sinal de bloqueio da Meta para tudo por 24h e corta o teto pela metade. |
| WhatsApp frio | 0 nos 14 primeiros dias, depois 10, 20 e 30 por dia | Automático a partir de `OUTBOUND_WHATSAPP_INICIO` | Dias 15 a 21: 10. Dias 22 a 28: 20. Dia 29 em diante: 30. Janela de 9h às 18h, 3 a 8 minutos entre envios. |
| Chamadas de IA do Hunter | 300 por dia | Painel do Hunter, campo **Teto diário de chamadas de IA** (ou `AI_DAILY_CALL_CAP`) | Cota do Google AI Pro, renova a cada 5 horas. |
| LinkedIn | 15 convites por dia e cerca de 100 por semana | Contadores fixos em `/eahub/crm/linkedin` | São aviso: a tela mostra o limite e pede para parar, quem clica é o Thiago. |

---

## 3. Pausar e retomar

Pausar interrompe novos toques. **Nunca desliga a recepção de respostas**: resposta de lead para a cadência dele na hora.

Pausar:
1. **Campanha do Hunter (DMs):** painel do Hunter, aba **Campanhas**, botão Pausar da campanha.
2. **Um lead:** ficha do lead (`/eahub/crm/lead/<id>`), **Mover para...** e escolher a etapa (Nutrição contínua ou Saiu da lista pausa a cadência dele).
3. **E-mail em massa:** tirar `email` de `OUTBOUND_ENVIO_REAL` (seção 1). Nutrição mensal e pedido de indicação também são e-mail e param junto.
4. **WhatsApp frio:** `OUTBOUND_WHATSAPP_REAL` diferente de `true`, ou desconectar a instância `prospeccao-ea` na Evolution.

Retomar: desfazer o passo e conferir no Kanban (`/eahub/crm`) e na Fila do dia (`/eahub/crm/fila`) se os próximos passos voltaram.

---

## 4. Pedido de exclusão ou oposição (LGPD)

Meta interna: atender em até 48 horas. Prazo legal: 15 dias (LGPD, art. 19, II).

1. **Reconhecer o pedido.** Chega por `privacidade@` ou `dpo@`, pelo link de descadastro do e-mail (`/api/marketing/sair`) ou em resposta com "sair", "pare", "não quero" em qualquer canal. O orquestrador já trata o descadastro e a resposta de e-mail com esse pedido sozinho; o resto é com o Thiago.
2. **Suprimir.** Na ficha do lead, **Mover para...** **Saiu da lista**. O CRM marca `marketingOptOut` e `nurtureOptOut`, pausa a cadência e o lead sai do orquestrador de e-mail, da nutrição mensal e do pedido de indicação.
3. **DM do Hunter: lacuna conhecida.** O Hunter marca "não contatar" quando o próprio lead pede na resposta à DM, mas **não lê** o descadastro feito no site. Se o pedido veio por e-mail ou WhatsApp, confira no Hunter (tela Leads) se o lead aparece como opt-out. Sincronizar essa direção está em `PENDENCIAS-THIAGO.md`.
4. **Exclusão definitiva** (art. 18, VI): apagar nome, empresa, telefone, e-mail, bio e dossiê do cadastro, mantendo só o identificador necessário para ele não ser captado de novo. Nunca mexer em histórico do git.
5. **Confirmar ao titular** em uma linha cordial, sem tentar reter.
6. **Retenção de 12 meses sem interação** está prevista em `LGPD.md`, mas **ainda não é automática**. Até virar rotina, fazer a revisão manual a cada trimestre.

---

## 5. Domínio em lista negra ou queda de reputação

Sinais: bounce do dia acima de 3%, e-mail na pasta de spam, alerta `bounce_alto`, erro `550 5.7.1` no envio.

1. **Desligar o e-mail real:** `vercel env rm OUTBOUND_ENVIO_REAL production` e redeploy. (O orquestrador já pausa o dia sozinho quando o bounce passa de 3%; isto é para garantir os dias seguintes.)
2. **Diagnosticar:**
   - reputação do domínio em https://mxtoolbox.com/blacklists.aspx;
   - nota em https://www.mail-tester.com, enviando de comercial@;
   - DNS: `nslookup -type=txt empresarialacademy.com 8.8.8.8` e `nslookup -type=cname selector1._domainkey.empresarialacademy.com 8.8.8.8`.
3. **Desbloqueio com a Microsoft** se o IP ou o domínio foi filtrado: ticket de remetente do Outlook com SPF e DKIM válidos e a base legal B2B.
4. **Retomar** só com nota boa no teste, começando com `OUTBOUND_EMAIL_TETO_DIA=20` por 7 dias.

---

## 6. Chip do WhatsApp banido ou restrito

Sinais: falha de envio da Evolution, instância desconectada, bloqueio ou denúncia relatados.

1. **Parar o envio:** `OUTBOUND_WHATSAPP_REAL` diferente de `true` no EA Flow e pausar a instância `prospeccao-ea` na Evolution.
2. **Registrar o bloqueio** (a Evolution não avisa). Dois no mesmo dia pausam o envio até a meia-noite de São Paulo:
   ```bash
   curl -X POST "$EA_FLOW_URL/api/outbound/whatsapp/bloqueio" \
     -H "Authorization: Bearer $OUTBOUND_WHATSAPP_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"telefone":"<número do chip, só dígitos>","motivo":"bloqueio"}'
   ```
   `motivo` aceita `bloqueio` ou `denuncia`. `EA_FLOW_URL` e o segredo ficam no cofre do Thiago; nunca no repositório.
3. **Pedir revisão** uma única vez pelo app do WhatsApp Business. Proibido insistir e proibido usar o número pessoal.
4. **Trocar o chip:** perfil comercial completo e nova data em `OUTBOUND_WHATSAPP_INICIO`; mais 14 dias de aquecimento humano antes de qualquer envio.

---

## 7. PC do Thiago fora do ar

O EA Hunter, o Chrome do Instagram e o Antigravity CLI (`agy`) rodam no PC. Tirar essa dependência é a frente F13.

Durante a queda: sem captação, sem qualificação, sem DM e **sem o chamador do orquestrador** (o site só roda a cadência de e-mail quando o Hunter chama). O site, o EA Flow, a página `/conversa`, o Calendly e os avisos no WhatsApp continuam no ar.

Ao religar:
1. Subir o Hunter pelo atalho ou por `scripts\iniciar.ps1` (usa o Node 22.23.2 do fnm; outro Node derruba o `better-sqlite3`).
2. Painel `http://localhost:3000`: conferir o worker e ligar o cartão **Mensagens** se estava desligado.
3. `agy models` no terminal para conferir a IA.
4. Tela **Erros** do Hunter: reprocessar o que falhou durante a queda.

---

## 8. Alertas operacionais (F12)

Avaliados a cada rodada do orquestrador (`/api/cron/outbound`, chamado pelo Hunter a cada 5 minutos em horário comercial). Aviso ao Thiago no WhatsApp comercial pelo EA Flow (`POST /api/avisos/dono`, corpo `{ "texto": "..." }`, segredo `EA_FLOW_API_KEY`). Se `EA_FLOW_URL` ou `EA_FLOW_API_KEY` não existirem no site, o aviso não sai e a rodada tenta de novo na seguinte.

Teto de avisos: **cada tipo tem um intervalo mínimo entre avisos** (coluna Cooldown), gravado no banco (`alerta:notificado:<tipo>`). Aviso que falhou não conta e tenta de novo. Horário comercial é segunda a sexta, 8h às 18h de Brasília.

| Alerta | Dispara quando | Cooldown | Depende de |
|---|---|---|---|
| `sem_sinal_hunter` | último heartbeat há mais de 30 minutos em horário comercial. Sem nenhum heartbeat já recebido, **não alarma** | 4 h | O Hunter chamar `POST /api/outbound/heartbeat` (abaixo) |
| `falha_sync_hunter` | última sincronização informada há mais de 3 h em horário comercial. Sem sincronização informada, **não alarma** | 4 h | O Hunter mandar `ultima_sincronizacao` no heartbeat |
| `bounce_alto` | bounce do dia acima de 3% com 10 envios ou mais, ou 2 bounces com menos de 10 envios (a mesma regra que **pausa o e-mail do dia**) | 6 h | `OUTBOUND_LER_CAIXA` ligado (é a caixa que registra os bounces) |
| `fila_travada` | lead em cadência com e-mail atrasado há mais de 48 h, **só com e-mail real ligado** (em simulação o e-mail nunca sai) | 6 h | `OUTBOUND_ENVIO_REAL=email` |
| `teto_ia_hunter` | o Hunter avisou que o teto diário de IA estourou | 12 h | O Hunter mandar `ia_teto_atingido: true` no heartbeat |

### Contrato do heartbeat

`POST https://empresarialacademy.com/api/outbound/heartbeat` com `Authorization: Bearer <CRON_SECRET>` (o mesmo segredo do orquestrador). GET responde 405 e não grava nada; sem segredo no servidor responde 503; segredo errado, 401.

```json
{
  "status": "ok",
  "pid": 1234,
  "ia_teto_atingido": false,
  "chamadas_ia": 120,
  "teto_ia": 300,
  "ultima_sincronizacao": "2026-10-05T12:00:00.000Z",
  "automacoes": [ { "id": "hunter-dms", "nome": "Envio de DMs no Instagram", "sistema": "hunter", "grupo": "Prospecção", "estado": "ligado", "numeros": [ { "rotulo": "DMs enviadas", "hoje": 12, "semana": 48 } ], "ultimaExecucao": "2026-10-05T12:00:00.000Z" } ],
  "automacoes_geradas_em": "2026-10-05T12:00:00.000Z"
}
```

Todos os campos são opcionais. `automacoes` é o status das automações do Hunter para o Painel de Automações (seção 12): a lista é validada aqui (id `hunter-...`, estado `ligado`, `erro` ou `parado`, grupo e números no formato padrão) e guardada num registro único, `sistema:status:hunter`, que a próxima chamada sobrescreve. **Estado hoje:** o Hunter ainda não chama este endpoint (ele pinga só a URL de `HEARTBEAT_PING_URL`, que é para um monitor externo). Enquanto isso, os alertas `sem_sinal_hunter`, `falha_sync_hunter` e `teto_ia_hunter` ficam quietos por falta de dado (nenhum alarme falso, mas também nenhum alarme verdadeiro). A mudança no Hunter está em `PENDENCIAS-THIAGO.md`.

**Limite conhecido:** o orquestrador roda quando o Hunter o chama. Com o Hunter parado, nenhuma rodada acontece e nenhum alerta é avaliado. Quem cobre a queda do Hunter é o monitor externo de heartbeat (item 9 das pendências).

---

## 9. Orquestrador e rotinas (`/api/cron/outbound`)

`GET` ou `POST https://empresarialacademy.com/api/cron/outbound`, com `Authorization: Bearer <CRON_SECRET>` (sem segredo, 401). `?dry=1` calcula tudo e devolve o relatório **sem gravar nada e sem enviar**.

Cada rodada, nesta ordem:
1. **Temperatura:** recalcula pontos e temperatura (uma vez por dia).
2. **Caixa comercial@:** lê bounces e respostas, se `OUTBOUND_LER_CAIXA` estiver ligada.
3. **Agenda do Outlook:** confere reuniões (uma vez por hora) e liga ao lead.
4. **Reunião e venda (F8):** em cada rodada, para as reuniões futuras em "Reunião marcada": confirmação na hora do agendamento, lembretes 24h e 1h antes (WhatsApp e e-mail) e ficha pré-reunião ao Thiago (aviso no WhatsApp comercial, a partir de 24h antes, entre 7h e 22h). Para leads em "Proposta enviada": follow-up D2, D5 e D10 em dia útil, das 8h às 18h. Tudo é idempotente por chave em `interacoes` (`lembrete:...`, `ficha:...`, `followup:...`). Lembretes e follow-ups seguem `OUTBOUND_ENVIO_REAL`: só o e-mail pode ser real; o WhatsApp fica em simulação até o envio ser ligado ao EA Flow. Para pausar só esta parte, não há chave própria: desligue o envio real do e-mail (ficam só os registros simulados e o aviso ao Thiago).
5. **Alertas** da seção 8.
6. **Revisão semanal** (seção 10): na segunda, a partir das 8h, uma vez por semana.
7. **Agendamento de toques:** atualiza `proximoToqueEm` e `proximoCanal` de cada lead.
8. **E-mail:** em simulação, grava em `interacoes` o que sairia hoje (`metadados.simulado = true`). Com `OUTBOUND_ENVIO_REAL=email`, envia no máximo 1 por chamada, na janela de 8h às 18h, com 5 a 15 minutos entre envios, teto diário e 1 por domínio corporativo por dia. A nutrição mensal e o pedido de indicação (seção 10) entram na fila depois da cadência e dividem o mesmo teto.

---

## 10. Aprendizado: testes A/B, revisão semanal e nutrição (F11)

Nada aqui usa IA. Tudo é contagem e regra, a partir do que o CRM registrou.

**Testes A/B.** Os experimentos ficam em `src/lib/outbound/experimentos.ts`. Hoje há um: assunto do e-mail, `kit` (o assunto escrito no kit do lead) contra `convite_20min` ("<empresa>: uma conversa de 20 minutos"). Cada lead cai sempre na mesma variante (hash do id do lead). A variante usada fica em `metadados.variantes` da interação `enviado`, e só conta se o assunto saiu como a variante descreve. O painel (`/eahub/crm/painel`, bloco **Testes A/B**) mostra, por variante, envios, respostas no mesmo canal depois do envio e reuniões. Só declara vencedora com 30 envios em cada variante e sem empate. Regra do plano: **uma variável muda por vez**. Para abrir um teste novo, troque o `id` do experimento (a medição antiga fica separada). DM e WhatsApp entram na mesma conta quando o Hunter e o EA Flow gravarem `variantes` no evento de envio; hoje só o e-mail é aplicado.

**Revisão semanal.** Toda segunda, a partir das 8h de Brasília (se perdida, até sexta), o orquestrador gera a revisão da semana anterior, grava em `interacoes` (chave `revisao:semanal:<segunda>`) e manda um resumo ao Thiago no WhatsApp. O texto completo aparece no painel, no bloco **Revisão semanal**. Traz: envios, respostas e reuniões da semana por canal, metas contra o real, segmentos com mais retorno, testes A/B, motivos de ganho e de "não fechar agora" e a decisão da semana (a regra do plano para a primeira meta abaixo). O tempo de resposta aparece como "ainda não medido" até a frente F5 existir. Usar as mensagens que geraram reunião como exemplos para a IA é do Hunter e **não está feito**.

**Nutrição mensal.** Vai por e-mail, pelo mesmo funil (simulação por padrão, mesmo teto, janela e pausa por bounce), 1 por lead por mês, só para base legal legítimo interesse. Recebem: leads em **Nutrição contínua** e leads cuja cadência de 21 dias terminou sem resposta. **Nunca** recebe quem pediu para sair, e-mail suprimido ou devolvido. O texto leva o post mais recente do blog (que já recebe os artigos do EA Post) que combina com o segmento do lead, ou o mais recente se nenhum combina; sem post publicado, não sai. Textos fixos em `src/lib/outbound/nutricao.ts`.

**Pedido de indicação.** Quem respondeu "não é o momento" recebe, uma vez, um e-mail cordial pedindo a indicação de um dono de empresa (só com a autorização da pessoa indicada) e, depois, o material do mês.

Para parar só a nutrição de alguém: **Mover para... Saiu da lista**. Para parar toda a nutrição: desligar o envio real do e-mail.

---

## 12. Painel de Automações

O Thiago acompanha cada automação, com números, numa tela do EA Flow (bolinha verde, amarela ou vermelha). O site entrega os dados em `GET /api/automacoes/status`, com `Authorization: Bearer <SDR_SEGREDO>` (o segredo compartilhado entre Hunter, EA Flow e site; sem ele no servidor a rota responde 503, com segredo errado 401). Só lê: não grava nada. O banco só é consultado quando alguém abre o painel.

A resposta traz as dez automações do site (orquestrador, e-mail frio, caixa comercial@, filas de ligação e de LinkedIn, rastreio e `/conversa`, temperatura, lembretes e follow-up, ficha pré-reunião, revisão semanal), as nove do Hunter (o último status que o PC mandou no heartbeat) e a hora do último sinal do Hunter.

| Cor | Quando |
|---|---|
| Verde | ligada e a última execução sem erro |
| Amarela | ligada, mas com erro recente (24 h) ou fila travada |
| Vermelha | desligada, sem chave, **em simulação** (e-mail frio, lembretes e follow-up enquanto `OUTBOUND_ENVIO_REAL` não inclui `email`) ou sem rodar no prazo |

O Hunter sem sinal há mais de 45 minutos aparece todo vermelho ("PC sem sinal"). Sem nenhum sinal já recebido, o motivo é "falta a chave do heartbeat". O orquestrador deixa a marca de cada rodada em `sistema:orquestrador:rodada` (hora, modo, rotinas que rodaram e falharam, rodadas por dia): é daí que vêm "sem rodar há X" e a contagem de rodadas.

## 11. Referências

- Plano mestre: `Agentes/PLANO-OUTBOUND.md`.
- Conformidade e legítimo interesse: `docs/outbound/LGPD.md`.
- Pendências do fundador: `docs/outbound/PENDENCIAS-THIAGO.md`.
- Contrato de eventos do CRM: `docs/outbound/CONTRATO-EVENTOS.md`.
- Estado vivo: `PROJECT_STATUS.md` de cada repositório.
