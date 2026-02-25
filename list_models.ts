import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const models = [
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
    "gemini-3.0-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
  ];

  for (const m of models) {
    try {
      console.log(`Trying ${m}...`);
      const model = genAI.getGenerativeModel({ model: m });
      await model.generateContent("hi");
      console.log(`✅ ${m} WORKS!`);
      // No process.exit early, let's see all
    } catch (e: any) {
      console.log(`❌ ${m} failed: ${e.message}`);
    }
  }
}
run();
