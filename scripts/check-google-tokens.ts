import { db } from "../server/db";
import { googleOAuthTokens } from "../shared/schema";

async function main() {
  try {
    const tokens = await db.select().from(googleOAuthTokens);
    console.log("Current Google Tokens:", tokens);
    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}

main();
