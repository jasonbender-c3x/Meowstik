import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const models = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-1.0-pro",
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
