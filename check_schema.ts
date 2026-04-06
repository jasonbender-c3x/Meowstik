
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('data/meowstik.db');
const db = new Database(dbPath);

const info = db.prepare("PRAGMA table_info(messages)").all();
console.log(JSON.stringify(info, null, 2));
db.close();
