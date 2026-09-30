-- Outbound F4 (CRM no EA Leads): modelo de dados. SOMENTE aditivo e idempotente.
-- Produção é manual (o push do Payload não roda em produção): aplicar ANTES do deploy do código.
-- Nomes seguem a convenção do Payload (conferida em @payloadcms/drizzle):
--   grupo: <grupo>_<campo>; enum: enum_<tabela>_<grupo>_<campo>; índice: <tabela>_<campo>_idx.
-- Nenhum DROP, nenhum ALTER TYPE que perca dado, nenhuma linha de lead alterada,
-- exceto o preenchimento de base_legal (NULL para legitimo_interesse) nos leads do Hunter.
--
-- Como aplicar: o bloco 1 (ALTER TYPE ... ADD VALUE) em uma execução própria; o resto em outra.
-- (Postgres não deixa usar um valor de enum recém-criado na mesma transação. Aqui ninguém usa.)

-- 1) Etapas novas em deal_status (valores antigos em_andamento, ganho e perdido permanecem)
ALTER TYPE "public"."enum_leads_deal_status" ADD VALUE IF NOT EXISTS 'captado';
ALTER TYPE "public"."enum_leads_deal_status" ADD VALUE IF NOT EXISTS 'qualificado';
ALTER TYPE "public"."enum_leads_deal_status" ADD VALUE IF NOT EXISTS 'em_cadencia';
ALTER TYPE "public"."enum_leads_deal_status" ADD VALUE IF NOT EXISTS 'engajado';
ALTER TYPE "public"."enum_leads_deal_status" ADD VALUE IF NOT EXISTS 'respondeu';
ALTER TYPE "public"."enum_leads_deal_status" ADD VALUE IF NOT EXISTS 'reuniao_marcada';
ALTER TYPE "public"."enum_leads_deal_status" ADD VALUE IF NOT EXISTS 'reuniao_feita';
ALTER TYPE "public"."enum_leads_deal_status" ADD VALUE IF NOT EXISTS 'proposta_enviada';
ALTER TYPE "public"."enum_leads_deal_status" ADD VALUE IF NOT EXISTS 'nutricao_continua';
ALTER TYPE "public"."enum_leads_deal_status" ADD VALUE IF NOT EXISTS 'saiu_da_lista';

-- 2) Tipos novos (CREATE TYPE não tem IF NOT EXISTS: o bloco ignora se já existe)
DO $$ BEGIN CREATE TYPE "public"."enum_leads_temperatura" AS ENUM ('frio','morno','engajado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_leads_cadencia_proximo_canal" AS ENUM ('dm','email','whatsapp','ligacao','linkedin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_leads_status_entrega_email" AS ENUM ('nao_enviado','enviado','entregue','devolvido','aberto','clicado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_leads_status_entrega_whatsapp" AS ENUM ('nao_enviado','enviado','entregue','lido','falhou','sem_whatsapp'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_leads_status_entrega_dm" AS ENUM ('nao_enviada','enviada','vista','falhou'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_leads_status_entrega_linkedin" AS ENUM ('nao_enviado','convite_enviado','aceito'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_leads_origem_primeiro_toque_canal" AS ENUM ('dm','email','whatsapp','ligacao','linkedin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_leads_origem_reuniao_canal" AS ENUM ('dm','email','whatsapp','ligacao','linkedin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_leads_origem_venda_canal" AS ENUM ('dm','email','whatsapp','ligacao','linkedin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_leads_motivo_resultado_motivo" AS ENUM ('preco','momento','concorrente','sem_fit','sem_resposta','interno','valor_percebido','indicacao','outro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_leads_base_legal" AS ENUM ('legitimo_interesse','consentimento','contrato'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_interacoes_canal" AS ENUM ('email','whatsapp','dm','ligacao','linkedin','nota','sistema'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_interacoes_direcao" AS ENUM ('entrada','saida'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_interacoes_tipo" AS ENUM ('enviado','entregue','aberto','clicado','lido','respondido','bounce','falha','resultado_ligacao','movimento_manual','lembrete','agendou','deu_play','abriu_pagina','descadastro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Colunas novas em leads (todas opcionais)
ALTER TABLE "public"."leads"
  ADD COLUMN IF NOT EXISTS "temperatura" "public"."enum_leads_temperatura",
  ADD COLUMN IF NOT EXISTS "pontos_engajamento" numeric,
  ADD COLUMN IF NOT EXISTS "cadencia_etapa_atual" varchar,
  ADD COLUMN IF NOT EXISTS "cadencia_proximo_toque_em" timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS "cadencia_proximo_canal" "public"."enum_leads_cadencia_proximo_canal",
  ADD COLUMN IF NOT EXISTS "cadencia_pausada" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cadencia_motivo_pausa" varchar,
  ADD COLUMN IF NOT EXISTS "cadencia_canais_encerrados" jsonb,
  ADD COLUMN IF NOT EXISTS "cadencia_movido_manual_em" timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS "status_entrega_email" "public"."enum_leads_status_entrega_email",
  ADD COLUMN IF NOT EXISTS "status_entrega_whatsapp" "public"."enum_leads_status_entrega_whatsapp",
  ADD COLUMN IF NOT EXISTS "status_entrega_dm" "public"."enum_leads_status_entrega_dm",
  ADD COLUMN IF NOT EXISTS "status_entrega_linkedin" "public"."enum_leads_status_entrega_linkedin",
  ADD COLUMN IF NOT EXISTS "origem_primeiro_toque_canal" "public"."enum_leads_origem_primeiro_toque_canal",
  ADD COLUMN IF NOT EXISTS "origem_primeiro_toque_em" timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS "origem_ultimo_toque_canal" varchar,
  ADD COLUMN IF NOT EXISTS "origem_ultimo_toque_rotulo" varchar,
  ADD COLUMN IF NOT EXISTS "origem_reuniao_canal" "public"."enum_leads_origem_reuniao_canal",
  ADD COLUMN IF NOT EXISTS "origem_reuniao_toque" varchar,
  ADD COLUMN IF NOT EXISTS "origem_venda_canal" "public"."enum_leads_origem_venda_canal",
  ADD COLUMN IF NOT EXISTS "origem_venda_toque" varchar,
  ADD COLUMN IF NOT EXISTS "proximo_passo" varchar,
  ADD COLUMN IF NOT EXISTS "proximo_passo_em" timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS "motivo_resultado_motivo" "public"."enum_leads_motivo_resultado_motivo",
  ADD COLUMN IF NOT EXISTS "motivo_resultado_detalhe" varchar,
  ADD COLUMN IF NOT EXISTS "base_legal" "public"."enum_leads_base_legal",
  ADD COLUMN IF NOT EXISTS "token_conversa" varchar,
  ADD COLUMN IF NOT EXISTS "dossie" jsonb,
  ADD COLUMN IF NOT EXISTS "kit" jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS "leads_token_conversa_idx" ON "public"."leads" USING btree ("token_conversa");

-- Leads do EA Hunter entram por legítimo interesse B2B (docs/outbound/LGPD.md). Só preenche NULL.
UPDATE "public"."leads" SET "base_legal" = 'legitimo_interesse' WHERE "hunter_id" IS NOT NULL AND "base_legal" IS NULL;

-- 4) Coleção interacoes
CREATE TABLE IF NOT EXISTS "public"."interacoes" (
  "id" serial PRIMARY KEY NOT NULL,
  "lead_id" integer,
  "canal" "public"."enum_interacoes_canal" NOT NULL,
  "direcao" "public"."enum_interacoes_direcao" NOT NULL,
  "tipo" "public"."enum_interacoes_tipo" NOT NULL,
  "conteudo" varchar,
  "pontos" numeric DEFAULT 0,
  "metadados" jsonb,
  "data" timestamp(3) with time zone NOT NULL,
  "chave" varchar,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
  ALTER TABLE "public"."interacoes" ADD CONSTRAINT "interacoes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "interacoes_lead_idx" ON "public"."interacoes" USING btree ("lead_id");
CREATE INDEX IF NOT EXISTS "interacoes_data_idx" ON "public"."interacoes" USING btree ("data");
CREATE UNIQUE INDEX IF NOT EXISTS "interacoes_chave_idx" ON "public"."interacoes" USING btree ("chave");
CREATE INDEX IF NOT EXISTS "interacoes_updated_at_idx" ON "public"."interacoes" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "interacoes_created_at_idx" ON "public"."interacoes" USING btree ("created_at");

-- Toda coleção nova ganha coluna nas tabelas de relação internas do Payload.
ALTER TABLE "public"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "interacoes_id" integer;
ALTER TABLE "public"."payload_preferences_rels" ADD COLUMN IF NOT EXISTS "interacoes_id" integer;
DO $$ BEGIN
  ALTER TABLE "public"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_interacoes_fk" FOREIGN KEY ("interacoes_id") REFERENCES "public"."interacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_interacoes_fk" FOREIGN KEY ("interacoes_id") REFERENCES "public"."interacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_interacoes_id_idx" ON "public"."payload_locked_documents_rels" USING btree ("interacoes_id");
CREATE INDEX IF NOT EXISTS "payload_preferences_rels_interacoes_id_idx" ON "public"."payload_preferences_rels" USING btree ("interacoes_id");

-- 5) Global crm-config (pesos do engajamento); a linha nasce quando o Thiago salva no admin
CREATE TABLE IF NOT EXISTS "public"."crm_config" (
  "id" serial PRIMARY KEY NOT NULL,
  "abertura" numeric DEFAULT 1,
  "aberturas_contadas" numeric DEFAULT 2,
  "clique" numeric DEFAULT 3,
  "video" numeric DEFAULT 4,
  "material" numeric DEFAULT 3,
  "diagnostico" numeric DEFAULT 5,
  "leitura" numeric DEFAULT 1,
  "engajado_a" numeric DEFAULT 5,
  "janela_dias" numeric DEFAULT 7,
  "updated_at" timestamp(3) with time zone,
  "created_at" timestamp(3) with time zone
);
