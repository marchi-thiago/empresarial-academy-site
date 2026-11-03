-- CRM: coleção `tarefas` (src/collections/Tarefas.ts). SOMENTE aditivo e idempotente.
-- Produção é manual (o push do Payload não roda em produção): aplicar ANTES do deploy do código,
-- com pg_dump do banco antes. Nomes na convenção do Payload (ver F4-crm-dados.sql).
-- lead_id fica sem NOT NULL de propósito: a chave estrangeira é ON DELETE SET NULL, como em interacoes.

DO $$ BEGIN CREATE TYPE "public"."enum_tarefas_tipo" AS ENUM ('ligacao','email','whatsapp','reuniao','visita','linkedin','dm','tarefa'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_tarefas_origem" AS ENUM ('manual','proximo_passo'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "public"."tarefas" (
  "id" serial PRIMARY KEY NOT NULL,
  "lead_id" integer,
  "tipo" "public"."enum_tarefas_tipo" DEFAULT 'tarefa' NOT NULL,
  "titulo" varchar NOT NULL,
  "vence_em" timestamp(3) with time zone,
  "concluida_em" timestamp(3) with time zone,
  "responsavel_id" integer,
  "notas" varchar,
  "origem" "public"."enum_tarefas_origem" DEFAULT 'manual',
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
  ALTER TABLE "public"."tarefas" ADD CONSTRAINT "tarefas_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."tarefas" ADD CONSTRAINT "tarefas_responsavel_id_users_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "tarefas_lead_idx" ON "public"."tarefas" USING btree ("lead_id");
CREATE INDEX IF NOT EXISTS "tarefas_vence_em_idx" ON "public"."tarefas" USING btree ("vence_em");
CREATE INDEX IF NOT EXISTS "tarefas_concluida_em_idx" ON "public"."tarefas" USING btree ("concluida_em");
CREATE INDEX IF NOT EXISTS "tarefas_responsavel_idx" ON "public"."tarefas" USING btree ("responsavel_id");
CREATE INDEX IF NOT EXISTS "tarefas_updated_at_idx" ON "public"."tarefas" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "tarefas_created_at_idx" ON "public"."tarefas" USING btree ("created_at");

-- Toda coleção nova ganha coluna nas tabelas de relação internas do Payload.
ALTER TABLE "public"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "tarefas_id" integer;
ALTER TABLE "public"."payload_preferences_rels" ADD COLUMN IF NOT EXISTS "tarefas_id" integer;
DO $$ BEGIN
  ALTER TABLE "public"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tarefas_fk" FOREIGN KEY ("tarefas_id") REFERENCES "public"."tarefas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_tarefas_fk" FOREIGN KEY ("tarefas_id") REFERENCES "public"."tarefas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_tarefas_id_idx" ON "public"."payload_locked_documents_rels" USING btree ("tarefas_id");
CREATE INDEX IF NOT EXISTS "payload_preferences_rels_tarefas_id_idx" ON "public"."payload_preferences_rels" USING btree ("tarefas_id");
