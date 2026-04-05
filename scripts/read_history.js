import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "meowstik.db");
const sqlite = new Database(dbPath);

try {
  const messages = sqlite.prepare("SELECT role, content FROM messages ORDER BY id DESC LIMIT 5").all();
  console.log("LAST 5 MESSAGES:");
  console.log(JSON.stringify(messages, null, 2));
} catch (error) {
  console.error("ERROR READING HISTORY:", error.message);
} finally {
  sqlite.close();
}
