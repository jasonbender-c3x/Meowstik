
console.log("0. Init");

async function main() {
  console.log("1. Start");
  await import("dotenv/config");
  console.log("2. Dotenv loaded");
  await import("../server/db");
  console.log("3. DB loaded");
  await import("../server/storage");
  console.log("4. Storage loaded");
  await import("../server/integrations/google-auth");
  console.log("5. Google Auth loaded");
  await import("../server/integrations/google-drive");
  console.log("6. Google Drive loaded");

  process.exit(0);
}

main();
