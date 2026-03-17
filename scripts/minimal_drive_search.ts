
import "dotenv/config";
import { google } from "googleapis";
import { pool } from "../server/db";

async function main() {
  console.log("Starting minimal drive search...");

  try {
    // 1. Get tokens directly from DB
    console.log("Connecting to DB...");
    const client = await pool.connect();
    const res = await client.query("SELECT * FROM google_oauth_tokens WHERE id = 'default'");
    client.release();
    
    if (res.rows.length === 0) {
      console.log("No tokens found in DB.");
      return;
    }

    const tokens = res.rows[0];
    console.log("Tokens found. Access token exists:", !!tokens.access_token);

    // 2. Create OAuth client manually
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

    // 3. Create Drive client
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // 4. List files
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
    await pool.end();
  }
}

main();
