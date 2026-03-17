
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkSchema() {
  try {
    const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chats';
    `);
    console.log("Columns in 'chats' table:", result.rows);
  } catch (error) {
    console.error("Error checking schema:", error);
  }
}

checkSchema();
