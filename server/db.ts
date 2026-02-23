import 'dotenv/config'; 
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon to use WebSocket
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set in your .env file.");
}

// [💭 Analysis] 
// Hardened Pool Configuration for Neon Serverless
// - ssl: true is mandatory for Neon
// - connectionTimeoutMillis: fail fast if we can't connect
// - idleTimeoutMillis: keep connections alive a bit longer to prevent thrashing
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: true,
  max: 20, 
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 5000, 
});

// Prevent unhandled errors on idle clients from crashing the process
pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle database client', err.message);
});

export const db = drizzle(pool, { schema });