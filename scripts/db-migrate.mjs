#!/usr/bin/env node
// Applies pending supabase/migrations/*.sql to the linked project over HTTPS
// (Supabase Management API), recording each version in
// supabase_migrations.schema_migrations — the same table the Supabase CLI uses,
// so `supabase db push` and this script stay interchangeable.
//
//   npm run db:migrate            # apply pending migrations
//   npm run db:migrate -- --dry   # list pending only
//
// Needs SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN (personal access token) in .env.local.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

process.loadEnvFile?.(".env.local");
const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error("Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN in .env.local");
  process.exit(1);
}
const dry = process.argv.includes("--dry");

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
  return JSON.parse(body);
}

const lit = (s) => `'${s.replaceAll("'", "''")}'`;

await sql(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key, statements text[], name text
  );`);
const applied = new Set((await sql("select version from supabase_migrations.schema_migrations")).map((r) => r.version));

const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
const pending = files.filter((f) => !applied.has(f.split("_")[0]));

if (pending.length === 0) {
  console.log("Database is up to date.");
  process.exit(0);
}
for (const f of pending) {
  const [version, ...rest] = f.replace(/\.sql$/, "").split("_");
  if (dry) {
    console.log(`pending  ${f}`);
    continue;
  }
  const body = readFileSync(join(dir, f), "utf8");
  // One transaction: the migration and its bookkeeping row succeed or fail together.
  await sql(`begin;\n${body}\n;\ninsert into supabase_migrations.schema_migrations (version, name, statements)
    values (${lit(version)}, ${lit(rest.join("_"))}, array[${lit(body)}]);\ncommit;`);
  console.log(`applied  ${f}`);
}
