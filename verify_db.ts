import { db } from "./server/db";
import { users } from "./shared/schema";
import { count } from "drizzle-orm";

async function main() {
  try {
    const result = await db.select({ count: count() }).from(users);
    console.log("Users count:", result[0].count);
    process.exit(0);
  } catch (error) {
    console.error("Error querying users table:", error);
    process.exit(1);
  }
}

main();
