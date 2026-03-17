import "dotenv/config";
import { google } from "googleapis";
import { pool } from "../server/db";

async function main() {
  console.log("Starting Sheets indexer...");

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
    
    // 2. Create OAuth client
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

    // 3. Create Drive and Sheets clients
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });

    // 4. List Spreadsheets
    console.log("Scanning /mnt/MyDrive for Spreadsheets...");
    const filesRes = await drive.files.list({
      pageSize: 50,
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed = false",
      fields: 'files(id, name, modifiedTime)'
    });

    const files = filesRes.data.files || [];
    console.log(`Found ${files.length} spreadsheets.`);

    const index = [];

    // 5. Process each spreadsheet
    for (const file of files) {
        console.log(`Indexing: ${file.name}`);
        try {
            const spreadsheetRes = await sheets.spreadsheets.get({
                spreadsheetId: file.id,
                includeGridData: true // This gets everything. CAREFUL with large sheets.
            });
            
            const spreadsheet = spreadsheetRes.data;
            let fullText = "";

            if (spreadsheet.sheets) {
                for (const sheet of spreadsheet.sheets) {
                    if (sheet.data) {
                        for (const data of sheet.data) {
                            if (data.rowData) {
                                for (const row of data.rowData) {
                                    if (row.values) {
                                        for (const cell of row.values) {
                                            if (cell.formattedValue) {
                                                fullText += cell.formattedValue + " ";
                                            }
                                        }
                                        fullText += "\n";
                                    }
                                }
                            }
                        }
                    }
                }
            }

            index.push({
                filename: file.name,
                path: file.id, // Using ID as path for API access
                content: fullText,
                modified: file.modifiedTime
            });

        } catch (err) {
            console.error(`Failed to index ${file.name}:`, err.message);
        }
    }

    // 6. Save index
    const fs = await import('fs');
    fs.writeFileSync('sheets_index.json', JSON.stringify(index, null, 2));
    console.log(`Saved index with ${index.length} spreadsheets to sheets_index.json`);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
