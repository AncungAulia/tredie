import postgres from "postgres";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../config";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sql = postgres(config.DATABASE_URL, {
  ssl: "require",
  max: 1,
});

async function migrate() {
  const dir = join(__dirname, "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    console.log(`Running ${file}...`);
    const ddl = readFileSync(join(dir, file), "utf-8");
    await sql.unsafe(ddl);
  }
  console.log("✅ Migrations complete");
  await sql.end();
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
