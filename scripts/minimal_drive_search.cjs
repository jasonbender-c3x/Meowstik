
require("dotenv").config();
const { google } = require("googleapis");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("Starting minimal drive search (JS)...");
  let client;
  try {
    console.log("Connecting to DB...");
    client = await pool.connect();
    const res = await client.query("SELECT * FROM google_oauth_tokens WHERE id = 'default'");
    
    if (res.rows.length === 0) {
      console.log("No tokens found.");
      return;
    }

    const tokens = res.rows[0];
    console.log("Tokens found.");

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "http://localhost:5000/api/auth/google/callback"
    );

    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date ? Number(tokens.expiry_date) : undefined,
      token_type: tokens.token_type,
      scope: tokens.scope
    });

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    console.log("Listing files...");
    const filesRes = await drive.files.list({
      pageSize: 10,
      q: "mimeType='application/json'",
      fields: 'files(id, name)'
    });

    const files = filesRes.data.files || [];
    console.log(`Found ${files.length} files:`);
    files.forEach(f => console.log(`- ${f.name} (${f.id})`));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

main();
