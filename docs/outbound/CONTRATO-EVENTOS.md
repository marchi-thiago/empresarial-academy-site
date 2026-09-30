# Contrato de eventos do CRM (EA Leads)

Usado pelas frentes F2 (Hunter), F5 (resposta rápida), F6 (orquestrador e `/conversa`) e F9
(WhatsApp). Qualquer sistema que saiba algo sobre um lead manda **um evento**; o site grava a
linha do tempo (`interacoes`) e aplica os efeitos no lead (pontos, temperatura, status de
entrega, etapa, pausa da cadência). Código: `src/lib/crm/` e `src/app/api/crm/eventos/route.ts`.

## Endpoint

`POST https://empresarialacademy.com/api/crm/eventos`

- Cabeçalho `Authorization: Bearer <CRM_INGEST_SECRET>` e `Content-Type: application/json`.
- Sem o cabeçalho ou com valor errado: **401**. Variável não configurada no ambiente: **503**
  (a rota nunca fica aberta). Corpo inválido: 400. Mais de 100 eventos: 413.
- Corpo: um evento solto ou `{ "eventos": [ ... ] }` (até 100, processados em ordem).
- Resposta **200** com `resultados`, um item por evento, na mesma ordem.

## Evento

```json
{
  "lead": { "hunterId": 123 },
  "canal": "dm",
  "direcao": "saida",
  "tipo": "enviado",
  "conteudo": "texto da mensagem (opcional)",
  "pontos": null,
  "metadados": { "toque": "dm1" },
  "data": "2026-10-05T14:30:00-03:00",
  "chave": "hunter:dm:123:msg-8841"
}
```

| Campo | Regra |
|---|---|
| `lead` | Pelo menos um de: `leadId` (id no EA Leads), `hunterId`, `instagram` (`@handle`, handle ou URL), `email`, `whatsapp` (qualquer formato; compara DDD + número). Testados nessa ordem; o primeiro que achar vale. |
| `canal` | `email`, `whatsapp`, `dm`, `ligacao`, `linkedin`, `nota`, `sistema` |
| `direcao` | `entrada` (veio do lead ou do comportamento dele) ou `saida` (nós enviamos) |
| `tipo` | ver tabela abaixo |
| `conteudo` | texto livre (mensagem, resumo da ligação). Opcional |
| `pontos` | Normalmente omitir: o site calcula pelos pesos do admin. Informar só para forçar um valor |
| `metadados` | objeto livre; chaves com significado estão na tabela abaixo |
| `data` | ISO 8601. Omitido = agora. Evento com mais de 7 dias não pontua |
| `chave` | Idempotência. Mesma `chave` de novo não grava duas vezes. **Sempre mandar** quando o evento vem de um sync que pode repetir (Hunter: `hunter:<canal>:<hunterId>:<id da mensagem>`) |

### Tipos e efeitos

| `tipo` | Quando usar | Efeito no lead |
|---|---|---|
| `enviado` (saida) | mensagem saiu | status do canal vira enviado/enviada/convite enviado; Qualificado vai para **Em cadência**; 1º envio grava `origem.primeiroToque*`; `metadados.toque` (ex. `dm1`, `email2`) grava o último toque |
| `entregue` | entregue ao destino | status do canal: entregue (LinkedIn: aceito) |
| `aberto` | e-mail aberto | status e-mail: aberto; **1 ponto**, no máximo 2 aberturas contadas na janela |
| `clicado` | clique em link | e-mail: clicado; **3 pontos** |
| `lido` | WhatsApp lido / DM vista | WhatsApp: lido (**1 ponto**); DM: vista (sem ponto) |
| `deu_play` | assistiu ao vídeo de prova | **4 pontos** |
| `abriu_pagina` | abriu página pelo link | `metadados.destino`: `material` ou `blog` = **3**, `diagnostico` = **5**, `conversa` = 0 |
| `respondido` (entrada) | o lead respondeu | **Respondeu** e **pausa a cadência em todos os canais**. `metadados.intencao` opcional: `nao_agora` leva a **Nutrição contínua**; `descadastro` leva a **Saiu da lista** e marca opt-out; `positiva`, `duvida`, `pessoa_errada` só registram |
| `agendou` | reunião marcada (Calendly) | **Reunião marcada**, pausa a cadência, grava `origem.reuniaoCanal` (`metadados.canalOrigem`, senão o último toque) e `reuniaoToque` (`metadados.toque`) |
| `descadastro` | pedido de saída (link de 1 clique, resposta) | **Saiu da lista**, `nurtureOptOut` e `marketingOptOut` ligados, cadência pausada |
| `bounce` (email) | e-mail devolvido | e-mail: devolvido; **permanente** por padrão (`metadados.temporario: true` para o caso contrário): o e-mail sai da cadência deste lead |
| `falha` | envio falhou | status do canal: falhou (WhatsApp com `metadados.motivo: "sem_whatsapp"`: número sem WhatsApp). É **definitiva** se `metadados.definitiva: true` ou `motivo` em `sem_whatsapp`, `sem_botao_mensagem`, `perfil_privado`, `bounce_permanente`: o canal sai da cadência do lead |
| `resultado_ligacao` | Thiago ligou | só registra (`metadados.resultado`) |
| `lembrete` | lembrete enviado | só registra |
| `movimento_manual` | arraste no Kanban | `metadados.para` = etapa de destino. Registra o instante: o automático não desfaz (ver abaixo) |

Status de entrega só anda para frente (clicado não volta a aberto). Falha definitiva
(`devolvido`, `sem_whatsapp`) não é desfeita por evento posterior.

### Etapas (`metadados.para` do movimento manual)

`captado`, `qualificado`, `em_cadencia`, `engajado`, `respondeu`, `reuniao_marcada`,
`reuniao_feita`, `proposta_enviada`, `ganho`, `nutricao_continua`, `saiu_da_lista`. Os valores
antigos `em_andamento` e `perdido` seguem válidos no banco e contam como Qualificado e
Nutrição contínua.

### Engajado e temperatura

Pontos somados nos últimos 7 dias (pesos editáveis em **EA Leads > Pesos do engajamento**).
0 pontos = frio, 1 a 4 = morno, 5 ou mais = **engajado** (move para a etapa Engajado). Resposta
não pontua: vai direto para Respondeu.

### Regra do movimento manual

O automático só avança (nunca volta etapa). Se o Thiago arrastou o card, eventos fracos
(envio, pontos) nunca o mexem; eventos fortes (resposta, agendamento, descadastro) só valem se
aconteceram **depois** do arraste. Quem está em Ganho ou Saiu da lista não sai por regra
automática.

## Resposta

```json
{ "resultados": [
  { "indice": 0, "ok": true, "leadId": 812, "interacaoId": 5531, "pontos": 0,
    "etapa": "em_cadencia", "movimento": { "de": "qualificado", "para": "em_cadencia", "automatico": true } },
  { "indice": 1, "ok": false, "erro": "duplicado" },
  { "indice": 2, "ok": false, "erro": "lead_nao_encontrado" }
] }
```

Erros por evento: `duplicado` (já gravado: tratar como sucesso), `lead_nao_encontrado`,
`canal inválido`, `direcao inválida`, `tipo inválido`, `data inválida`,
`pontos deve ser número`, `lead sem identificador`, `erro_interno` (tentar de novo depois).

## Exemplos

DM enviada pelo Hunter:
```json
{ "lead": { "hunterId": 123 }, "canal": "dm", "direcao": "saida", "tipo": "enviado",
  "metadados": { "toque": "dm1" }, "chave": "hunter:dm:123:m1" }
```

Lead respondeu no WhatsApp (EA Flow):
```json
{ "lead": { "whatsapp": "+55 11 93340-0264" }, "canal": "whatsapp", "direcao": "entrada",
  "tipo": "respondido", "conteudo": "Pode ser terça às 10h", "metadados": { "intencao": "positiva" },
  "chave": "evolution:3EB0A1" }
```

Número sem WhatsApp:
```json
{ "lead": { "leadId": 812 }, "canal": "whatsapp", "direcao": "saida", "tipo": "falha",
  "metadados": { "motivo": "sem_whatsapp" } }
```

## Garantias e limites

- Nunca apaga nem edita interação: corrigir é mandar outro evento.
- Sem `CRM_INGEST_SECRET`, nada entra. O valor não fica em repositório (ver `PENDENCIAS-THIAGO.md`, item 12).
- Dois eventos do mesmo lead em chamadas simultâneas podem sobrescrever o estado um do outro
  (leitura e gravação sem trava). No volume do piloto (dezenas por minuto) é aceitável; mandar
  em lote, em ordem, na mesma chamada, evita o problema.
- `whatsapp` identifica o lead por DDD + número (11 últimos dígitos) com varredura da tabela
  `leads`. Quando a base passar de dezenas de milhares de leads, criar coluna normalizada.
- O Hunter, hoje, grava direto na tabela `leads`. Ele deve continuar assim para os dados do lead
  e passar a usar este endpoint para tudo que é **fato** (envio, resposta, falha).

## Como as telas do CRM leem os dados (F4, telas)

- **Reunião marcada:** a data e a hora da reunião ficam em `proximoPassoEm` (com `proximoPasso` = "Reunião de 20 min"). A Fila do dia lista "reuniões de hoje" por esse campo. Quem registrar o evento `agendou` (página `/conversa`, F6) deve gravar também esses dois campos.
- **Ligação e LinkedIn na Fila:** entram quando `cadencia.proximoCanal` é `ligacao` ou `linkedin`, `cadencia.proximoToqueEm` é de hoje ou anterior e a cadência não está pausada. O item sai da Fila quando existe `resultado_ligacao` (ou `enviado` no LinkedIn) com data igual ou posterior ao `proximoToqueEm`. Quem reagenda (orquestrador, F6) muda o `proximoToqueEm`.
- **Resposta pendente:** etapa Respondeu sem interação de saída do tipo `enviado` depois da última `respondido` de entrada. Mensagem do lead vem de `conteudo` da interação `respondido`.
- **Dossiê e kit (JSON):** a leitura é tolerante: qualquer chave vira rótulo legível. Para o canal certo aparecer agrupado, use nomes com o canal: `dm1`, `dm2`, `email1` ({assunto, corpo}), `whatsapp1`, `ligacao` ({roteiro, objecoes}), `linkedin` ({nota}). Decisor em `decisor.nome` e perfil em qualquer texto com `linkedin.com/in/...`.
- **Intenção da resposta (F5):** `metadados.intencao` = `positiva`, `duvida`, `nao_agora`, `pessoa_errada` ou `descadastro`. O painel calcula "respostas positivas" com `positiva` e `duvida`.
- **Status de entrega do Hunter (F2):** o painel só conta o que o CRM registrou (interações e `statusEntrega`). As DMs anteriores entram quando o Hunter sincronizar `statusEntrega.dm`.
