
import "dotenv/config";
import { storage } from "./server/storage";
import { pool } from "./server/db";

async function main() {
  console.log("Checking DB...");
  try {
    const email = (process.env.HOME_DEV_EMAIL || "jason@oceanshorestech.com").trim();
    console.log(`Looking for user: ${email}`);
    const user = await storage.getUserByEmail(email);
    console.log("User found:", user ? user.username : "No");
    
    if (user) {
        const chats = await storage.getChats(user.id);
        console.log(`Chats found: ${chats.length}`);
        if (chats.length > 0) {
            const lastChat = chats[0];
            console.log(`Checking chat ${lastChat.id}...`);
            const messages = await storage.getMessagesByChatId(lastChat.id, { limit: 5 });
            console.log("Recent messages:");
            messages.forEach(m => console.log(`[${m.role}] ${m.content.substring(0, 50)}...`));
        }
    }
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await pool.end();
  }
}

main();
