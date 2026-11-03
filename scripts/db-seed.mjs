#!/usr/bin/env node
// Runs supabase/seed.sql against the linked project (Management API).  `npm run db:seed`
import { readFileSync } from "node:fs";

process.loadEnvFile?.(".env.local");
const { SUPABASE_PROJECT_REF: ref, SUPABASE_ACCESS_TOKEN: token } = process.env;
if (!ref || !token) {
  console.error("Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN in .env.local");
  process.exit(1);
}
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: readFileSync("supabase/seed.sql", "utf8") }),
});
if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
console.log("Seeded.");
