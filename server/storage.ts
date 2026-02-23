import { users, type User, type InsertUser, googleOAuthTokens, type GoogleOAuthTokens, type InsertGoogleOAuthTokens } from "@shared/schema";
import { db, pool } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";

export class DatabaseStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new session.MemoryStore(); 
  }

  async getUser(id: number | string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id.toString()));
      return user;
    } catch (e) {
      console.error("❌ getUser Error:", e);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    } catch (e) {
      console.error("❌ getUserByEmail Error:", e);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async upsertUser(user: any): Promise<User> {
    const [existingUser] = await db.select().from(users).where(eq(users.id, user.id));
    if (existingUser) {
      const [updatedUser] = await db.update(users).set(user).where(eq(users.id, user.id)).returning();
      return updatedUser;
    }
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  // Google OAuth Tokens
  async getGoogleTokens(id: string = 'default'): Promise<GoogleOAuthTokens | undefined> {
    try {
      const [tokens] = await db.select().from(googleOAuthTokens).where(eq(googleOAuthTokens.id, id));
      return tokens;
    } catch (e) {
      console.error("❌ getGoogleTokens Error:", e);
      return undefined;
    }
  }

  async saveGoogleTokens(tokens: InsertGoogleOAuthTokens): Promise<void> {
    try {
      const existing = await this.getGoogleTokens(tokens.id || 'default');
      if (existing) {
        await db.update(googleOAuthTokens)
          .set({ ...tokens, updatedAt: new Date() })
          .where(eq(googleOAuthTokens.id, tokens.id || 'default'));
      } else {
        await db.insert(googleOAuthTokens).values(tokens);
      }
    } catch (e) {
      console.error("❌ saveGoogleTokens Error:", e);
    }
  }

  async deleteGoogleTokens(id: string = 'default'): Promise<void> {
    try {
      await db.delete(googleOAuthTokens).where(eq(googleOAuthTokens.id, id));
    } catch (e) {
      console.error("❌ deleteGoogleTokens Error:", e);
    }
  }
}

export const storage = new DatabaseStorage();