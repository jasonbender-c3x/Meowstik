import './load-env.js';
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { Pool } from "pg";
import * as schema from "@shared/schema";

// Check if we should use PGlite (local file-based Postgres)
// Use PGlite if DATABASE_URL starts with "file:" or USE_PGLITE is set
export const usePglite = process.env.DATABASE_URL?.startsWith("file:") || process.env.USE_PGLITE === "true";

if (!process.env.DATABASE_URL && !usePglite) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// We need to export 'pool' and 'db' to maintain compatibility
// but PGlite doesn't use a Pool. We'll mock it if using PGlite.
let _pool: any;
let _db: any;

if (usePglite) {
  const dataDir = process.env.DATABASE_URL?.startsWith("file:") 
    ? process.env.DATABASE_URL.replace("file:", "") 
    : "./data/pglite";
    
  console.log(`[db] Using PGlite with data directory: ${dataDir}`);
  
  const client = new PGlite(dataDir, {
    extensions: {
      vector,
    },
  });
  _db = drizzlePglite(client, { schema });
  
  // Mock pool for compatibility
  _pool = {
    connect: async () => ({ 
      release: () => {},
      query: (text: string, params: any[]) => client.query(text, params)
    }),
    query: (text: string, params: any[]) => client.query(text, params),
    end: async () => await client.close(),
    on: () => {},
  };
} else {
  _pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
    max: 10,
  });
  
  _pool.on("connect", () => {
    console.log("[db] New client connected to pool");
  });

  _pool.on("error", (err: Error) => {
    console.error("[db] Unexpected pool error:", err.message);
  });
  
  _db = drizzle(_pool, { schema });
}

export const pool = _pool;
export const db = _db;

/**
 * Get the shared Drizzle database instance
 */
export function getDb(): any {
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

