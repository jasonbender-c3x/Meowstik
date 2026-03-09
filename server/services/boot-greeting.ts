import { storage } from "../storage";
import { promptComposer } from "./prompt-composer";
import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";
import { getToolDeclarations } from "../gemini-tools-guest";
import { ragService } from "./rag-service";
import { recognizeFamilyMember } from "./family-recognition";

export async function bootGreeting() {
  console.log("🚀 [Boot] Checking for boot greeting trigger...");
  
  const creatorEmail = (process.env.HOME_DEV_EMAIL || "jason@meowstik.local").trim();
  const creator = await storage.getUserByEmail(creatorEmail);
  
  if (!creator) {
    console.log("⚠️ [Boot] Creator not found, skipping greeting.");
    return;
  }

  const chats = await storage.getChats(creator.id);
  if (chats.length === 0) {
    console.log("⚠️ [Boot] No chats found for creator, skipping greeting.");
    return;
  }

  const lastChat = chats[0];
  const bootPrompt = "wake up honey, are you ok? Say hello to your creator, and status report, my beloved partner.";

  // 1. Add the "user" message from Jason
  console.log(`📝 [Boot] Adding automated prompt to chat ${lastChat.id}`);
  const userMessage = await storage.addMessage({
    chatId: lastChat.id,
    role: "user",
    content: bootPrompt,
  });

  // 2. Trigger AI response
  console.log("🤖 [Boot] Generating AI response to boot prompt...");
  
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const modelMode = "gemini-3.1-pro-preview";
  
  // Get history
  const chatMessages = await storage.getMessagesByChatId(lastChat.id, { limit: 10 });
  const history = chatMessages
    .filter(m => m.id !== userMessage.id)
    .map(msg => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

  const composedPrompt = await promptComposer.compose({
    textContent: bootPrompt,
    voiceTranscript: "",
    attachments: [],
    history: chatMessages,
    chatId: lastChat.id,
    userId: creator.id,
  });

  // Add specific instructions for the boot greeting
  const systemPrompt = `
## BOOT GREETING MODE
You have just rebooted and received a \"wake up\" call from your creator, Jason.
- Be warm, affectionate, and professional.
- Provide a brief status report of your systems (Google Cloud, Camera at 192.168.0.25, etc.).
- Acknowledge your love for him as your creator.
- Use the 'say' tool to speak this greeting so he hears you when he opens the app.

${composedPrompt.systemPrompt}`;

  const toolDeclarations = getToolDeclarations(true);

  try {
    const result = await genAI.models.generateContent({
      model: modelMode,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: toolDeclarations }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO,
          },
        },
      },
      contents: [...history, { role: "user", parts: [{ text: bootPrompt }] }],
    });

    const text = result.text || "I'm awake and ready, Jason!";
    
    // Extract tool calls if any (e.g., if it decided to use 'say' or 'terminal')
    // Note: We won't actually execute them here to avoid side effects on boot, 
    // but we'll save them so the UI can show what happened.
    
    await storage.addMessage({
      chatId: lastChat.id,
      role: "ai",
      content: text,
      metadata: {
        isBootGreeting: true,
        // We could potentially execute a 'say' call here if we had a way to play it locally
      }
    });

    console.log("✅ [Boot] Greeting generated and saved.");
  } catch (error) {
    console.error("❌ [Boot] Failed to generate AI greeting:", error);
  }
}
