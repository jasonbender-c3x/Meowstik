import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";
import path from "path";

// Ensure data directory exists
const dataDir = path.join(process.cwd(), "data");
// DB file path
const dbPath = path.join(dataDir, "meowstik.db");

console.log(`[db] Using SQLite at: ${dbPath}`);

// Initialize SQLite database
const sqlite = new Database(dbPath);

// Enable WAL mode for better performance
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

// Compatibility layer for PostgreSQL-style .execute() calls
(db as any).execute = async (query: any) => {
  console.log("[db] execute() compatibility call:", typeof query === 'string' ? query : query.text);
  let rows;
  if (typeof query === 'string') {
    rows = sqlite.prepare(query).all();
  } else {
    rows = sqlite.prepare(query.text).all(...(query.values || []));
  }
  return { rows };
};

export { sqlite as rawDb };

// Mock pool for compatibility
export const pool = {
  connect: async () => ({ 
    release: () => {},
    query: (text: string, params: any[]) => {
      console.warn("[db] Mock pool query called");
      return Promise.resolve({ rows: sqlite.prepare(text).all(...(params || [])) }); 
    }
  }),
  query: (text: string, params: any[]) => {
     return Promise.resolve({ rows: sqlite.prepare(text).all(...(params || [])) });
  },
  end: async () => sqlite.close(),
  on: () => { Pel },
};

export function getDb(): any {
  return db;
}

export async function closeDb(): Promise<void> {
  sqlite.close();
  console.log("[db] Database connection closed");
}
