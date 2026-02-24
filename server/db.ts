import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
});

pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", err.message);
});

export const db = drizzle(pool, { schema });

/**
 * Get the shared Drizzle database instance
 */
export function getDb(): NodePgDatabase {
  return db;
}

/**
 * Close the database connection pool
 * Call this on graceful shutdown
 */
export async function closeDb(): Promise<void> {
  await pool.end();
  console.log("[db] Database connection pool closed");
}

