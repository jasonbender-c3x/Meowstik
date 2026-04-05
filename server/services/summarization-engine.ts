/**
 * SUMMARIZATION ENGINE
 *
 * Generates and stores compressed summaries of conversations and feedback.
 * This is the foundation of the Evolution Engine — summaries feed pattern
 * analysis which feeds self-improvement suggestions.
 *
 * PIPELINE:
 *   Raw conversations/feedback → Summarize (Gemini Flash) → Store in DB
 *   → Pattern analysis → Evolution suggestions (Evolution Engine)
 */

import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import { type Feedback } from "@shared/schema";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = "gemini-2.0-flash";

export interface ConversationSummary {
  chatId: string;
  summary: string;
  keyTopics: string[];
  sentiment: "positive" | "neutral" | "negative";
  createdAt: Date;
}

export interface FeedbackSummary {
  patterns: string[];
  commonIssues: string[];
  improvementAreas: string[];
  createdAt: Date;
}

/**
 * Summarizes a single chat's messages into key points, topics, and sentiment.
 * Persists the result to the conversation_summaries table.
 */
export async function summarizeConversation(chatId: string): Promise<ConversationSummary> {
  const messages = await storage.getMessagesByChatId(chatId, { limit: 100 });

  if (messages.length === 0) {
    return {
      chatId,
      summary: "Empty conversation",
      keyTopics: [],
      sentiment: "neutral",
      createdAt: new Date(),
    };
  }

  const conversationText = messages
    .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n")
    .slice(0, 8000);

  const prompt = `Summarize this conversation concisely. Return JSON with exactly this structure:
{
  "summary": "2-3 sentence summary of what was discussed and accomplished",
  "keyTopics": ["topic1", "topic2"],
  "sentiment": "positive" | "neutral" | "negative"
}

Conversation:
${conversationText}`;

  try {
    const result = await genAI.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const text = result.text || "{}";
    const parsed = JSON.parse(text) as {
      summary?: string;
      keyTopics?: string[];
      sentiment?: string;
    };

    const sentiment = (["positive", "neutral", "negative"].includes(parsed.sentiment ?? "")
      ? parsed.sentiment
      : "neutral") as "positive" | "neutral" | "negative";

    const summaryData = {
      chatId,
      summary: parsed.summary || "Summary unavailable",
      keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics : [],
      sentiment,
      modelUsed: MODEL,
    };

    await storage.createConversationSummary(summaryData);

    return { ...summaryData, createdAt: new Date() };
  } catch (error) {
    console.error("[SummarizationEngine] Failed to summarize conversation:", error);
    return {
      chatId,
      summary: "Summarization failed",
      keyTopics: [],
      sentiment: "neutral",
      createdAt: new Date(),
    };
  }
}

/**
 * Summarizes a batch of feedback items into high-level patterns.
 * Used by the Evolution Engine before pattern analysis.
 */
export async function summarizeFeedbackBatch(feedbackItems: Feedback[]): Promise<FeedbackSummary> {
  if (feedbackItems.length === 0) {
    return {
      patterns: [],
      commonIssues: [],
      improvementAreas: [],
      createdAt: new Date(),
    };
  }

  const feedbackText = feedbackItems
    .slice(0, 50)
    .map(f => {
      const parts: string[] = [];
      if (f.rating) parts.push(`Rating: ${f.rating}`);
      if (f.freeformText) parts.push(`Comment: ${f.freeformText}`);
      if (Array.isArray(f.dislikedAspects) && f.dislikedAspects.length)
        parts.push(`Dislikes: ${f.dislikedAspects.join(", ")}`);
      if (Array.isArray(f.likedAspects) && f.likedAspects.length)
        parts.push(`Likes: ${f.likedAspects.join(", ")}`);
      return parts.join(" | ");
    })
    .join("\n");

  const prompt = `Analyze these ${feedbackItems.length} user feedback entries and extract patterns. Return JSON:
{
  "patterns": ["observed pattern 1", "observed pattern 2"],
  "commonIssues": ["frequent issue 1", "frequent issue 2"],
  "improvementAreas": ["area to improve 1", "area to improve 2"]
}

Feedback entries:
${feedbackText}`;

  try {
    const result = await genAI.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const text = result.text || "{}";
    const parsed = JSON.parse(text) as {
      patterns?: string[];
      commonIssues?: string[];
      improvementAreas?: string[];
    };

    return {
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
      commonIssues: Array.isArray(parsed.commonIssues) ? parsed.commonIssues : [],
      improvementAreas: Array.isArray(parsed.improvementAreas) ? parsed.improvementAreas : [],
      createdAt: new Date(),
    };
  } catch (error) {
    console.error("[SummarizationEngine] Failed to summarize feedback batch:", error);
    return {
      patterns: [],
      commonIssues: [],
      improvementAreas: [],
      createdAt: new Date(),
    };
  }
}

/**
 * Cached version of summarizeConversation — checks the DB before generating.
 */
export async function getOrCreateSummary(chatId: string): Promise<ConversationSummary> {
  const existing = await storage.getConversationSummary(chatId);
  if (existing) {
    return {
      chatId: existing.chatId ?? chatId,
      summary: existing.summary,
      keyTopics: (existing.keyTopics as string[]) ?? [],
      sentiment: (existing.sentiment as "positive" | "neutral" | "negative") ?? "neutral",
      createdAt: existing.createdAt,
    };
  }
  return summarizeConversation(chatId);
}
