
import "dotenv/config";
import { db } from "../server/db";
import { storage } from "../server/storage";

async function main() {
  console.log("Starting token debug...");
  try {
    console.log("Fetching tokens for 'default'...");
    const tokens = await storage.getGoogleTokens('default');
    console.log("Tokens found:", tokens ? "YES" : "NO");
    if (tokens) {
      console.log("Access token exists:", !!tokens.accessToken);
    }
  } catch (error) {
    console.error("Error fetching tokens:", error);
  } finally {
    process.exit(0);
  }
}

main();
