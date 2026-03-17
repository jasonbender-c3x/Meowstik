
const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

console.log("Connecting...");
client.connect()
  .then(() => {
    console.log("Connected!");
    return client.query('SELECT NOW()');
  })
  .then(res => {
    console.log("Time:", res.rows[0]);
    return client.end();
  })
  .catch(err => {
    console.error("Connection error:", err);
    process.exit(1);
  });
