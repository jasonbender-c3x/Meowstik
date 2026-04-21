import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";
import fs from "fs";
import path from "path";

const repoDataDir = path.join(process.cwd(), "data");
const configuredDataDir = process.env.MEOWSTIK_DATA_DIR
  ? path.resolve(process.env.MEOWSTIK_DATA_DIR)
  : repoDataDir;

function ensureDataDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyIfExists(source: string, target: string) {
  if (fs.existsSync(source) && !fs.existsSync(target)) {
    fs.copyFileSync(source, target);
  }
}

function migrateLegacyDbIfNeeded(targetDir: string) {
  if (targetDir === repoDataDir) {
    return;
  }

  const legacyDbPath = path.join(repoDataDir, "meowstik.db");
  const targetDbPath = path.join(targetDir, "meowstik.db");

  if (!fs.existsSync(legacyDbPath) || fs.existsSync(targetDbPath)) {
    return;
  }

  ensureDataDir(targetDir);
  copyIfExists(legacyDbPath, targetDbPath);
  copyIfExists(`${legacyDbPath}-wal`, `${targetDbPath}-wal`);
  copyIfExists(`${legacyDbPath}-shm`, `${targetDbPath}-shm`);

  console.log(`[db] Migrated SQLite data from ${legacyDbPath} to ${targetDbPath}`);
}

ensureDataDir(repoDataDir);
ensureDataDir(configuredDataDir);
migrateLegacyDbIfNeeded(configuredDataDir);

const dataDir = configuredDataDir;
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
