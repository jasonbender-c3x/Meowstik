
import { db } from "../server/db";
import { users } from "@shared/schema";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Checking for users table...");
    // Check if table exists in information_schema
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users';
    `);
    
    console.log("Table check result:", result.rows);
    
    if (result.rows.length > 0) {
      console.log("✅ Users table exists!");
      
      // Try to select from it
      const userCount = await db.select({ count: sql`count(*)` }).from(users);
      console.log("User count:", userCount[0]);
    } else {
      console.error("❌ Users table DOES NOT exist!");
    }
    
    process.exit(0);
  } catch (err) {
    console.error("Error checking DB:", err);
    process.exit(1);
  }
}

main();
