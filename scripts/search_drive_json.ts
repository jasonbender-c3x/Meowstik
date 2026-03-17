
import "dotenv/config";

async function main() {
  console.log("Starting script...");
  try {
    const { searchDriveFiles, listDriveFiles } = await import("../server/integrations/google-drive");
    console.log("Imported google-drive module.");
    
    console.log("Searching for JSON files in Google Drive...");
    // Search specifically for JSON files
    // Use timeout to prevent hanging forever
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000));
    
    const filesPromise = listDriveFiles("mimeType='application/json'", 20);
    
    const files = await Promise.race([filesPromise, timeout]);
    
    if (!Array.isArray(files)) {
        console.error("Error result:", files);
        return;
    }
    
    if (files.length === 0) {
      console.log("No JSON files found.");
    } else {
      console.log(`Found ${files.length} JSON files:`);
      files.forEach((f: any) => {
        console.log(`- [${f.name}] (ID: ${f.id})`);
      });
    }
  } catch (error) {
    console.error("Error searching drive:", error);
  }
  process.exit(0);
}

main();
