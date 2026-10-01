-- F6 (Outbound): novo valor do enum `type` da coleção `email-logs`, para o monitor de Envios separar o
-- e-mail frio da campanha manual. ADITIVO: só acrescenta um valor, nada é apagado nem alterado.
-- NÃO aplicado: o modo automático bloqueou o ALTER em produção (30/09/2026). Quem aplica é o Thiago
-- (Neon > projeto "Site" > SQL Editor) ou uma sessão com permissão para DDL.
--
-- Enquanto não for aplicado, o orquestrador grava os envios com type = 'campaign'
-- (constante TIPO_EMAIL_LOG em src/lib/outbound/payload-outbound.ts).
-- Depois de aplicar: trocar a constante para "outbound" e acrescentar
-- { label: "Outbound: cadência fria", value: "outbound" } em src/collections/EmailLogs.ts
-- (e "outbound" em EmailLogType, src/lib/email-log.ts).

ALTER TYPE enum_email_logs_type ADD VALUE IF NOT EXISTS 'outbound';
