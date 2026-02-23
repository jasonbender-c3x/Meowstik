import { users, type User, type InsertUser } from "@shared/schema";
import { db, pool } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
// import connectPg from "connect-pg-simple"; // Disabled to stop 57P01 errors

// const PostgresSessionStore = connectPg(session);

export class DatabaseStorage {
  sessionStore: session.Store;

  constructor() {
    // [💭 Analysis] 
    // Switching to MemoryStore to bypass Neon connection termination errors.
    // This provides immediate stability for login/auth flow.
    this.sessionStore = new session.MemoryStore(); 
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
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
}

export const storage = new DatabaseStorage();