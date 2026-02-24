import { 
  users, 
  type User, 
  type InsertUser, 
  googleOAuthTokens, 
  type GoogleOAuthTokens, 
  type InsertGoogleOAuthTokens,
  userBranding,
  type InsertUserBranding,
  type UserBranding,
  DEFAULT_AGENT_NAME,
  DEFAULT_DISPLAY_NAME,
  DEFAULT_BRAND_COLOR
} from "@shared/schema";
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

  // User Branding
  async getUserBrandingOrDefault(userId: string): Promise<UserBranding> {
    try {
      const [branding] = await db.select().from(userBranding).where(eq(userBranding.userId, userId));
      
      if (branding) return branding;

      // Return defaults if no custom branding found
      return {
        id: "default",
        userId,
        agentName: DEFAULT_AGENT_NAME,
        displayName: DEFAULT_DISPLAY_NAME,
        avatarUrl: null,
        brandColor: DEFAULT_BRAND_COLOR,
        githubSignature: null,
        emailSignature: null,
        canonicalDomain: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (e) {
      console.error("❌ getUserBrandingOrDefault Error:", e);
      throw e;
    }
  }

  async upsertUserBranding(branding: InsertUserBranding): Promise<UserBranding> {
    try {
      const [existing] = await db.select().from(userBranding).where(eq(userBranding.userId, branding.userId));
      
      if (existing) {
        const [updated] = await db.update(userBranding)
          .set({ ...branding, updatedAt: new Date() })
          .where(eq(userBranding.userId, branding.userId))
          .returning();
        return updated;
      }
      
      const [newBranding] = await db.insert(userBranding).values(branding).returning();
      return newBranding;
    } catch (e) {
      console.error("❌ upsertUserBranding Error:", e);
      throw e;
    }
  }

  async deleteUserBranding(userId: string): Promise<boolean> {
    try {
      const result = await db.delete(userBranding).where(eq(userBranding.userId, userId)).returning();
      return result.length > 0;
    } catch (e) {
      console.error("❌ deleteUserBranding Error:", e);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();