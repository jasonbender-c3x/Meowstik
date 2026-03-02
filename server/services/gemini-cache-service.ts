import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import { geminiCaches, type GeminiCache } from "@shared/schema";
import { db } from "../db";
import { eq, lt } from "drizzle-orm";
import crypto from "crypto";

export class GeminiCacheService {
  private genAI: any;
  private readonly modelName = "gemini-3.1-pro-preview";

  constructor() {
    this.genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }

  /**
   * Generates a hash for the context to identify reusable caches
   */
  private generateHash(systemInstruction: string, history: any[]): string {
    const context = JSON.stringify({ systemInstruction, history });
    return crypto.createHash("sha256").update(context).digest("hex");
  }

  /**
   * Get an existing cache or create a new one for the current turn
   */
  async getOrCreateCache(options: {
    chatId: string;
    messageId: string;
    systemInstruction: string;
    history: any[];
    ttlMinutes?: number;
  }): Promise<{ cacheName: string; isNew: boolean }> {
    const hash = this.generateHash(options.systemInstruction, options.history);
    const now = new Date();

    // 1. Check local DB for existing valid cache for this chat/content
    const existing = await db.query.geminiCaches.findFirst({
      where: (caches, { and, eq, gt }) => and(
        eq(caches.chatId, options.chatId),
        eq(caches.contentHash, hash),
        gt(caches.expiresAt, now)
      )
    });

    if (existing) {
      console.log(`[CacheService] Reusing existing cache: ${existing.cacheName}`);
      return { cacheName: existing.cacheName, isNew: false };
    }

    // 2. Create new cache in Gemini
    console.log(`[CacheService] Creating new Gemini context cache for Turn...`);
    const ttlSeconds = (options.ttlMinutes || 10) * 60;
    
    try {
      // Use the v1beta1 features via the SDK
      // @ts-ignore - cachedContent is in v1beta1/SDK but types might be lagging
      const cache = await this.genAI.getGenerativeModel({ model: this.modelName }).createCachedContent({
        systemInstruction: { parts: [{ text: options.systemInstruction }] },
        contents: options.history,
        ttlSeconds,
      });

      // 3. Save to local tracking table
      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
      await db.insert(geminiCaches).values({
        id: crypto.randomUUID(),
        chatId: options.chatId,
        messageId: options.messageId,
        cacheName: cache.name,
        contentHash: hash,
        expiresAt,
      });

      console.log(`[CacheService] Created cache: ${cache.name} (Expires: ${expiresAt.toISOString()})`);
      return { cacheName: cache.name, isNew: true };
    } catch (error) {
      console.error(`[CacheService] Failed to create Gemini cache:`, error);
      throw error;
    }
  }

  /**
   * Explicitly delete a cache when the agentic loop is finished
   */
  async deleteCache(cacheName: string): Promise<void> {
    try {
      console.log(`[CacheService] Deleting cache: ${cacheName}`);
      // @ts-ignore
      await this.genAI.getGenerativeModel({ model: this.modelName }).deleteCachedContent(cacheName);
      
      // Remove from tracking table
      await db.delete(geminiCaches).where(eq(geminiCaches.cacheName, cacheName));
      console.log(`[CacheService] Cache deleted successfully`);
    } catch (error) {
      console.warn(`[CacheService] Failed to delete cache ${cacheName}:`, error);
      // Still try to remove from DB even if API call fails
      await db.delete(geminiCaches).where(eq(geminiCaches.cacheName, cacheName));
    }
  }

  /**
   * Cleanup any expired or orphaned caches
   */
  async cleanup(): Promise<number> {
    const now = new Date();
    const expired = await db.select().from(geminiCaches).where(lt(geminiCaches.expiresAt, now));
    
    let count = 0;
    for (const cache of expired) {
      await this.deleteCache(cache.cacheName);
      count++;
    }
    
    return count;
  }
}

export const geminiCacheService = new GeminiCacheService();
