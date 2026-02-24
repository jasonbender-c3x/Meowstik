import { storage } from '../server/storage.js';
import '../server/load-env.js';

async function checkMessages() {
  console.log("Starting check...");
  try {
    const chatId = '37785c26-3d3c-4492-b4b1-6dc9194de78a';
    console.log(`Querying messages for chat: ${chatId}`);
    const messages = await storage.getMessages(chatId);
    console.log(`Chat ID: ${chatId}`);
    console.log(`Messages count: ${messages.length}`);
    const lastFew = messages.slice(-5);
    lastFew.forEach(m => {
      console.log(`[${m.role}] ${m.content.substring(0, 50)}...`);
    });
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

checkMessages();
