import postgres from "postgres";

const MAX_RETRIES = 30;
const url = process.env.DATABASE_URL ?? "";

for (let i = 1; i <= MAX_RETRIES; i++) {
  try {
    const sql = postgres(url, { connect_timeout: 5 });
    await sql`SELECT 1`;
    await sql.end();
    console.log("DB connection OK");
    process.exit(0);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  Retry ${i}/${MAX_RETRIES}: ${message}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

console.error("PostgreSQL not reachable after max retries");
process.exit(1);
