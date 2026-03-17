
import "dotenv/config";
import { pool } from "../server/db";

async function main() {
  console.log("Testing DB connection...");
  try {
    const client = await pool.connect();
    console.log("Connected to pool.");
    const res = await client.query('SELECT NOW()');
    console.log("Query result:", res.rows[0]);
    client.release();
    console.log("Released client.");
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await pool.end();
    console.log("Pool ended.");
  }
}

main();
