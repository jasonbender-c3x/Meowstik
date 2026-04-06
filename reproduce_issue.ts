import Database from "better-sqlite3";
import path from "path";

async function main() {
  const dataDir = path.join(process.cwd(), "data");
  const dbPath = path.join(dataDir, "meowstik.db");
  console.log(`[reproduce] Using SQLite at: ${dbPath}`);

  try {
    const sqlite = new Database(dbPath);
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log("Tables found:", tables);

    const usersTable = tables.find((t: any) => t.name === "users");
    if (usersTable) {
        console.log("USERS TABLE EXISTS!");
        const count = sqlite.prepare("SELECT COUNT(*) as count FROM users").get();
        console.log("User count:", count);
    } else {
        console.error("USERS TABLE MISSING!");
    }
    sqlite.close();
  } catch (error) {
    console.error("Error accessing DB:", error);
    process.exit(1);
  }
}

main();
