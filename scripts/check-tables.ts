import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const result = await db.execute(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    console.log("Tables:", result.rows);
    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}

main();
