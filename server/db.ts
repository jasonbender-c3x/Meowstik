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

// Mock pool for compatibility
export const pool = {
  connect: async () => ({ 
    release: () => {},
    query: (text: string, params: any[]) => {
      // Very basic mock - likely won't work for complex queries but keeps interface
      console.warn("[db] Mock pool query called - implementation may need review for SQLite compatibility");
      return Promise.resolve({ rows: [] }); 
    }
  }),
  query: (text: string, params: any[]) => {
     console.warn("[db] Mock pool query called");
     return Promise.resolve({ rows: [] });
  },
  end: async () => sqlite.close(),
  on: () => {},
};

export function getDb(): any {
  return db;
}

export async function closeDb(): Promise<void> {
  sqlite.close();
  console.log("[db] Database connection closed");
}
