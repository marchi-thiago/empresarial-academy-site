/**
 * Preenche `interest_category` nos leads de download de material captados
 * ANTES da rota /api/newsletter passar a gravar esse campo. Sem isso, a
 * nutrição por tema (cron/nutricao) não enxerga esses leads antigos.
 *
 * Casa leads.source = "Download: <título>" com materials.title (o
 * DownloadButton grava o título em `origem`) e herda material_categories.slug.
 * Material com título duplicado pelo prefixo gera 2 linhas: a última vence.
 *
 * Usa `pg` direto de propósito: getPayload() contra o Neon de produção abre o
 * prompt interativo de push de schema (DATA LOSS WARNING) e trava.
 *
 * Uso: node scripts/backfill-interest-category.mjs [--aplicar]   (padrão: dry-run)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APLICAR = process.argv.includes("--aplicar");

for (const line of fs.readFileSync(path.join(ROOT, ".env.production.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*DATABASE_URI\s*=\s*(.+)\s*$/);
  if (m) process.env.DATABASE_URI = m[1].replace(/^["']|["']$/g, "");
}
if (!process.env.DATABASE_URI?.startsWith("postgres")) {
  console.error("DATABASE_URI de producao nao carregada.");
  process.exit(1);
}
console.log(APLICAR ? "MODO: aplicando." : "MODO: dry-run (use --aplicar para gravar).");

const client = new pg.Client({ connectionString: process.env.DATABASE_URI });
await client.connect();

const { rows } = await client.query(`
  SELECT l.id, l.email, l.source, mc.slug AS categoria
  FROM leads l
  -- /api/newsletter corta a origem em 60 caracteres: compara pelo prefixo.
  LEFT JOIN materials m ON left('Download: ' || m.title, length(l.source)) = l.source
  LEFT JOIN material_categories mc ON mc.id = m.category_id
  WHERE l.source LIKE 'Download:%'
    AND (l.interest_category IS NULL OR l.interest_category = '')
  ORDER BY l.id
`);

const comCategoria = rows.filter((r) => r.categoria);
for (const r of rows) {
  console.log(r.categoria
    ? `- lead ${r.id} (${r.email}) -> ${r.categoria}`
    : `- [SEM MATERIAL] lead ${r.id} (${r.email}) — "${r.source}"`);
}

if (APLICAR && comCategoria.length) {
  await client.query("BEGIN");
  for (const r of comCategoria) {
    await client.query("UPDATE leads SET interest_category = $1 WHERE id = $2", [r.categoria, r.id]);
  }
  await client.query("COMMIT");
}

console.log(`\nLeads de download sem tema: ${rows.length} | com material achado: ${comCategoria.length} | ${APLICAR ? "gravados" : "não gravados (dry-run)"}`);
await client.end();
