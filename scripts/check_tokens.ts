
import { pool } from "../server/db";

async function main() {
  const client = await pool.connect();
  const res = await client.query("SELECT * FROM google_oauth_tokens");
  console.log("Tokens found:", res.rows.length);
  if (res.rows.length > 0) {
    console.log("Token ID:", res.rows[0].id);
    console.log("Expiry:", new Date(Number(res.rows[0].expiry_date) * 1000));
    console.log("Scope:", res.rows[0].scope);
  }
  client.release();
  await pool.end();
}

main();
