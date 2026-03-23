import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'meowstik.db');
console.log(`Checking database at: ${dbPath}`);

try {
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  
  if (row) {
    console.log("✅ Table 'users' EXISTS.");
    const count = db.prepare("SELECT count(*) as count FROM users").get();
    console.log(`📊 Users count: ${count.count}`);
  } else {
    console.error("❌ Table 'users' DOES NOT EXIST.");
    
    // List all tables to see what's there
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log("Existing tables:", tables.map(t => t.name).join(', '));
  }
} catch (error) {
  console.error("❌ Error accessing database:", error.message);
}
