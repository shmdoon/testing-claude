// Validates the sample content and writes supabase/seed.sql.  `npm run db:seed:gen`
import { writeFileSync } from "node:fs";
import { courses, tools } from "../src/content/seed/data.ts";
import { seedToSql } from "../src/content/seed/to-sql.ts";

writeFileSync("supabase/seed.sql", seedToSql(tools, courses));
console.log("Wrote supabase/seed.sql");
