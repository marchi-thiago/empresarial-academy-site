/**
 * Cria a tabela da coleção `email-templates` (EA Leads) no Neon de produção e
 * popula um modelo por tema de material e por pilar do diagnóstico, com o
 * texto padrão de src/lib/nurture-emails.ts.
 *
 * Por que SQL à mão: o Payload só faz push de schema fora de produção, e o
 * `next dev` contra este banco abre o prompt de DROP (ver fix-api-inventory-schema.mjs).
 *
 * Idempotente: CREATE ... IF NOT EXISTS e INSERT ... ON CONFLICT DO NOTHING,
 * então nunca sobrescreve um modelo editado no admin.
 *
 * Uso: node scripts/create-email-templates.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const uri = fs
  .readFileSync(path.join(ROOT, ".env.production.local"), "utf8")
  .match(/^\s*DATABASE_URI\s*=\s*(.+)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, "");

// Texto padrão direto da fonte (nurture-emails.ts), sem duplicar aqui.
const BUILT = path.join(__dirname, ".nurture-emails.built.mjs");
const esbuild = await import("esbuild");
await esbuild.build({
  entryPoints: [path.join(ROOT, "src", "lib", "nurture-emails.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  tsconfig: path.join(ROOT, "tsconfig.json"),
  outfile: BUILT,
  logLevel: "warning",
});
const { CATEGORY_COPY, PILLAR_COPY } = await import(pathToFileURL(BUILT).href);
fs.rmSync(BUILT, { force: true });

const client = new pg.Client({ connectionString: uri });
await client.connect();

try {
  await client.query("BEGIN");

  await client.query(`CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" serial PRIMARY KEY NOT NULL,
    "nome" varchar NOT NULL,
    "chave" varchar NOT NULL,
    "jornada" varchar,
    "tema" varchar,
    "assunto_primeiro" varchar,
    "assunto_segundo" varchar,
    "sinais" varchar,
    "acoes" varchar,
    "metodo" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  )`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_chave_idx" ON "public"."email_templates" USING btree ("chave")`);
  await client.query(`CREATE INDEX IF NOT EXISTS "email_templates_updated_at_idx" ON "public"."email_templates" USING btree ("updated_at")`);
  await client.query(`CREATE INDEX IF NOT EXISTS "email_templates_created_at_idx" ON "public"."email_templates" USING btree ("created_at")`);

  // Toda coleção nova ganha uma coluna nas tabelas de relação internas do Payload.
  for (const rels of ["payload_locked_documents_rels", "payload_preferences_rels"]) {
    const { rowCount } = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'email_templates_id'`,
      [rels],
    );
    if (rowCount === 0) {
      await client.query(`ALTER TABLE "public"."${rels}" ADD COLUMN "email_templates_id" integer`);
      await client.query(
        `ALTER TABLE "public"."${rels}" ADD CONSTRAINT "${rels}_email_templates_fk" FOREIGN KEY ("email_templates_id") REFERENCES "public"."email_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      );
      await client.query(`CREATE INDEX "${rels}_email_templates_id_idx" ON "public"."${rels}" USING btree ("email_templates_id")`);
      console.log(`coluna email_templates_id criada em ${rels}`);
    }
  }

  const { rows: categorias } = await client.query(`SELECT name, slug FROM material_categories ORDER BY name`);
  const modelos = [];
  for (const { name, slug } of categorias) {
    const c = CATEGORY_COPY[slug];
    if (!c) {
      console.log(`- tema "${slug}" sem texto próprio no código: fica no genérico até criar o modelo à mão`);
      continue;
    }
    const tema = c.tema ?? name.toLowerCase();
    const Tema = tema.charAt(0).toUpperCase() + tema.slice(1);
    modelos.push({
      nome: `Nutrição por tema · ${name}`,
      chave: `tema:${slug}`,
      jornada: "Nutrição por tema (download de material)",
      tema,
      assuntoPrimeiro: c.assuntoPrimeiro ?? `${Tema}: 3 sinais de que vale olhar com mais cuidado`,
      assuntoSegundo: c.assuntoSegundo ?? `Como o Gestão 360 trabalha ${tema}`,
      sinais: c.sinais.join("\n"),
      acoes: c.acoes.join("\n"),
      metodo: c.metodo,
    });
  }
  for (const [pilar, c] of Object.entries(PILLAR_COPY)) {
    modelos.push({
      nome: `Pós-diagnóstico · ${pilar}`,
      chave: `pilar:${pilar}`,
      jornada: "Nutrição pós-diagnóstico (pilar mais fraco)",
      tema: null,
      assuntoPrimeiro: `Sobre o seu pilar de ${pilar}: por onde começar`,
      assuntoSegundo: `Como destravamos ${pilar} na prática`,
      sinais: c.custo.join("\n"),
      acoes: c.acoes.join("\n"),
      metodo: c.metodo,
    });
  }

  for (const m of modelos) {
    const r = await client.query(
      `INSERT INTO email_templates (nome, chave, jornada, tema, assunto_primeiro, assunto_segundo, sinais, acoes, metodo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (chave) DO NOTHING`,
      [m.nome, m.chave, m.jornada, m.tema, m.assuntoPrimeiro, m.assuntoSegundo, m.sinais, m.acoes, m.metodo],
    );
    console.log(`${r.rowCount ? "criado " : "já existia"}  ${m.chave}`);
  }

  await client.query("COMMIT");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("ROLLBACK:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
