
import "dotenv/config";
import { google } from "googleapis";
import { pool } from "../server/db";
import fs from "fs";
import path from "path";

const EXPORT_DIR = "/home/runner/exported_docs";

async function main() {
  console.log("Starting Google Docs/Sheets Exporter...");

  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  try {
    // 1. Get tokens
    console.log("Connecting to DB...");
    const client = await pool.connect();
    const res = await client.query("SELECT * FROM google_oauth_tokens WHERE id = 'default'");
    client.release();
    
    if (res.rows.length === 0) {
      console.log("No tokens found in DB.");
      return;
    }

    const tokens = res.rows[0];
    
    // 2. Auth
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

    // 3. List Docs and Sheets
    console.log("Scanning Drive for native Google files...");
    const q = "(mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet') and trashed = false";
    
    let pageToken = null;
    do {
        const filesRes = await drive.files.list({
            pageSize: 50,
            q: q,
            fields: 'nextPageToken, files(id, name, mimeType)',
            pageToken: pageToken
        });

        const files = filesRes.data.files || [];
        pageToken = filesRes.data.nextPageToken;

        console.log(`Found ${files.length} files in this batch.`);

        for (const file of files) {
            let destMime = "";
            let ext = "";

            if (file.mimeType === 'application/vnd.google-apps.document') {
                destMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                ext = '.docx';
            } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
                destMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                ext = '.xlsx';
            } else {
                continue;
            }

            const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
            const destPath = path.join(EXPORT_DIR, `${safeName}${ext}`);

            console.log(`Exporting: ${file.name} -> ${destPath}`);

            try {
                const dest = fs.createWriteStream(destPath);
                const res = await drive.files.export({
                    fileId: file.id,
                    mimeType: destMime
                }, { responseType: 'stream' });

                await new Promise((resolve, reject) => {
                    res.data
                        .on('end', () => resolve())
                        .on('error', err => reject(err))
                        .pipe(dest);
                });
                console.log("  Success!");
            } catch (err) {
                console.error(`  Failed to export ${file.name}:`, err.message);
            }
        }

    } while (pageToken);

    console.log(`\nExport complete! Files are in ${EXPORT_DIR}`);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
