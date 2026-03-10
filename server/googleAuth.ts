/**
 * Google OAuth2 Authentication for Meowstik
 * Replaces Replit OIDC authentication with Google OAuth2
 */

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import { Router, type Express, type RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage.js";
import { pool } from "./db.js";
import { isHomeDevMode, getHomeDevUser } from "./homeDevAuth.js";
import csurf from "csurf";
import crypto from "crypto";

// Session duration: 1 week (in milliseconds)
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export function getCsrfProtection() {
  return csurf({ cookie: false });
}

export function getSession() {
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool, // Use shared pool
    createTableIfMissing: true,
    ttl: SESSION_TTL,
    tableName: "sessions",
  });
  
  const isProduction = process.env.NODE_ENV === "production";
  
  if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable must be set in production");
  }
  
  return session({
    secret: process.env.SESSION_SECRET || "meowstik-dev-secret-change-in-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: SESSION_TTL,
    },
    proxy: isProduction,
  });
}

interface GoogleUser {
  id: string;
  displayName: string;
  name?: {
    givenName?: string;
    familyName?: string;
  };
  emails?: Array<{ value: string; verified: boolean }>;
  photos?: Array<{ value: string }>;
  provider: string;
}

function parseUserName(profile: GoogleUser): { firstName: string; lastName: string } {
  if (profile.name?.givenName) {
    return {
      firstName: profile.name.givenName,
      lastName: profile.name.familyName || "",
    };
  }
  const parts = profile.displayName.split(" ");
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

async function findOrCreateUser(profile: GoogleUser) {
  const email = profile.emails?.[0]?.value || "";
  const { firstName, lastName } = parseUserName(profile);
  const profileImageUrl = profile.photos?.[0]?.value || "";
  const displayName = `${firstName} ${lastName}`.trim() || profile.displayName;
  const username = email.split("@")[0] || `user_${profile.id.substring(0, 8)}`;

  let user = await storage.getUserByEmail(email);
  
  if (!user) {
    user = await storage.createUser({
      username,
      email,
      displayName,
      googleId: profile.id,
      avatarUrl: profileImageUrl,
      password: crypto.randomBytes(32).toString('hex'), 
      role: "user",
    });
  }
  
  return user;
}

// Create a router for auth endpoints
export const authRouter = Router();

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  
  passport.serializeUser((user: any, cb) => {
    cb(null, user);
  });
  passport.deserializeUser((user: any, cb) => {
    cb(null, user);
  });

  app.use(passport.initialize());
  app.use(passport.session());

  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();

  if (!clientId || !clientSecret) {
    console.warn("⚠️ [Google Auth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set.");
    return;
  }

  try {
    let callbackURL = (process.env.GOOGLE_REDIRECT_URI || "").trim();
    
    if (!callbackURL) {
      const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
      const host = (process.env.HOST || "localhost:5000").trim();
      callbackURL = `${protocol}://${host}/api/auth/google/callback`;
    }

    passport.use(
      new GoogleStrategy(
        {
          clientID: clientId,
          clientSecret: clientSecret,
          callbackURL,
          proxy: true,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const dbUser = await findOrCreateUser(profile as GoogleUser);
            
            // Link tokens to the global singleton for tool access
            await storage.saveGoogleTokens({
              id: 'default',
              accessToken: accessToken || null,
              refreshToken: refreshToken || null,
              expiryDate: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
              tokenType: 'Bearer',
              scope: profile._json?.scope || null,
            });

            const user = {
              ...dbUser,
              claims: {
                sub: profile.id,
                email: profile.emails?.[0]?.value || "",
                first_name: profile.name?.givenName || "",
                last_name: profile.name?.familyName || "",
                profile_image_url: profile.photos?.[0]?.value || "",
                exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
              },
              access_token: accessToken,
              refresh_token: refreshToken,
              expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
            };
            
            done(null, user);
          } catch (error) {
            console.error("[Google Auth] Error during authentication:", error);
            done(error as Error);
          }
        }
      )
    );

    const authHandler = passport.authenticate("google", {
      scope: ["profile", "email", "https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/drive.file"],
      accessType: 'offline',
      prompt: 'consent'
    });

    // Mount handlers on the router
    authRouter.get("/google", authHandler);
    authRouter.get("/google/callback", 
      passport.authenticate("google", { failureRedirect: "/login" }),
      (req, res) => { res.redirect("/"); }
    );
    
    authRouter.get("/user", isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.id || req.user.claims?.sub || req.user.googleId;
        const user = await storage.getUser(userId);
        res.json(user);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch user" });
      }
    });

    authRouter.get("/logout", (req, res) => {
      req.logout((err) => {
        req.session.destroy(() => {
          res.redirect("/login");
        });
      });
    });

    console.log("✅ [Google Auth] OAuth strategy registered");
  } catch (error: any) {
    console.error("⚠️ [Auth] Failed to setup Google OAuth:", error?.message || error);
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (req.isAuthenticated() && (req.user as any)?.claims?.sub) {
     return next();
  }

  if (isHomeDevMode()) {
    if (!req.user) {
      try {
        const user = await getHomeDevUser();
        if (user) {
          req.user = {
            claims: {
              sub: user.id.toString(),
              email: user.email,
              first_name: user.displayName || "Developer",
              last_name: "",
              profile_image_url: user.avatarUrl || "",
              exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
            },
            access_token: "home-dev-token",
            refresh_token: "home-dev-refresh-token",
            expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
          };
        }
      } catch (e) {}
    }
    return next();
  }

  return res.status(401).json({ message: "Unauthorized" });
};