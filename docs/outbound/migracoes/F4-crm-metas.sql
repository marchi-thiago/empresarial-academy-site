-- Outbound F4 (telas do CRM): metas do painel no global crm-config. SOMENTE aditivo e idempotente.
-- NÃO APLICADO em produção (o classificador do modo automático bloqueou DDL em produção; decisão do Thiago).
-- Produção é manual (o push do Payload não roda em produção). Depois de aplicar, reativar o grupo "metas" no global
-- src/globals/CrmConfig.ts (ver PENDENCIAS-THIAGO.md). Até lá as metas do painel são as do plano (src/lib/crm/telas/metas.ts).
-- Convenção do Payload: grupo "metas", campo entregaEmail -> coluna metas_entrega_email.
-- Valores padrão = metas do plano (seção 4). Nenhum DROP, nenhum dado existente alterado.

ALTER TABLE "public"."crm_config"
  ADD COLUMN IF NOT EXISTS "metas_entrega_email" numeric DEFAULT 95,
  ADD COLUMN IF NOT EXISTS "metas_resposta_dm" numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "metas_resposta_email" numeric DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "metas_resposta_whatsapp" numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "metas_respostas_positivas" numeric DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "metas_reuniao_marcada" numeric DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "metas_comparecimento" numeric DEFAULT 70,
  ADD COLUMN IF NOT EXISTS "metas_reuniao_com_proximo_passo" numeric DEFAULT 50;
