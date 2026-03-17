
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pkg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: true, // Neon requires SSL
  connectionTimeoutMillis: 5000,
});

console.log("Attempting to connect to database...");

async function check() {
  try {
    await client.connect();
    console.log("✅ Connected successfully!");
    const res = await client.query('SELECT NOW() as now');
    console.log("🕒 Database time:", res.rows[0].now);
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  }
}

check();
