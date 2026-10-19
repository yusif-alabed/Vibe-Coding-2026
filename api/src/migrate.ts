import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { CATALOG } from "@beaver/shared";

/** Applies any SQL files in api/migrations that haven't run yet, then syncs the cosmetic catalog. */
const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL ?? "postgres://beaver:beaver@localhost:5432/beaver_banff" });
await client.connect();

const exists = await client.query(`SELECT to_regclass('schema_migrations') AS t`);
const applied = new Set<string>(
  exists.rows[0].t ? (await client.query("SELECT version FROM schema_migrations")).rows.map((r) => r.version) : [],
);

for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
  if (applied.has(file)) continue;
  console.log(`Applying ${file}…`);
  await client.query("BEGIN");
  await client.query(await readFile(dir + file, "utf8"));
  await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
  await client.query("COMMIT");
}

for (const item of CATALOG) {
  await client.query(
    `INSERT INTO cosmetic_items (id, name, slot, price, data) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slot = EXCLUDED.slot, price = EXCLUDED.price, data = EXCLUDED.data`,
    [item.id, item.name, item.slot, item.price, { color: item.color, shape: item.shape }],
  );
}
console.log(`Database ready. ${CATALOG.length} cosmetic items synced.`);
await client.end();
