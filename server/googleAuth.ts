/**
 * Google OAuth2 Authentication for Meowstik
 * Replaces Replit OIDC authentication with Google OAuth2
 */

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { google } from "googleapis";
import session from "express-session";
import { Router, type Express, type RequestHandler } from "express";
import FileStoreFactory from "session-file-store"; // Import FileStore
import { storage } from "./storage.js";
import { SCOPES as GOOGLE_API_SCOPES } from "./integrations/google-auth.js";
// import { pool } from "./db.js"; // Not needed for file store
import { isHomeDevMode, getHomeDevUser } from "./homeDevAuth.js";
import csurf from "csurf";
import crypto from "crypto";

// Session duration: 1 week (in milliseconds)
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const GOOGLE_OAUTH_SCOPES = ["profile", "email", ...GOOGLE_API_SCOPES];

const FileStore = FileStoreFactory(session);

export function getCsrfProtection() {
  return csurf({ cookie: false });
}

export function getSession() {
  console.log("ℹ️ [Auth] Using FileStore for sessions (No Postgres).");
  
  const sessionStore = new FileStore({
    path: "./sessions",
    ttl: SESSION_TTL_SECONDS,
    retries: 0,
  });
  
  const isProduction = process.env.NODE_ENV === "production";
  
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

const GOOGLE_STATUS_TIMEOUT_MS = 1500;

// Google API auth status — always available, no OAuth creds required
authRouter.get("/google/status", async (req, res) => {
  const timeout = Symbol("google-status-timeout");
  const reauthPath = "/api/auth/google";

  try {
    const result = await Promise.race([
      (async () => {
        const { isAuthenticated, isAuthenticatedSync, hasFullScopes } = await import("./integrations/google-auth.js");

        if (isAuthenticatedSync()) {
          return { authenticated: true, hasFullScopes: hasFullScopes(), authUrl: hasFullScopes() ? null : reauthPath };
        }

        const auth = await isAuthenticated();
        return {
          authenticated: auth,
          hasFullScopes: auth ? hasFullScopes() : false,
          authUrl: auth && !hasFullScopes() ? reauthPath : (!auth ? reauthPath : null),
        };
      })(),
      new Promise<typeof timeout>((resolve) => {
        setTimeout(() => resolve(timeout), GOOGLE_STATUS_TIMEOUT_MS);
      }),
    ]);

    if (result === timeout) {
      console.warn(`[Google Auth] Status check timed out after ${GOOGLE_STATUS_TIMEOUT_MS}ms`);
      return res.json({ authenticated: false, hasTokens: false, degraded: true });
    }

    return res.json({ authenticated: result.authenticated, hasTokens: result.authenticated, hasFullScopes: result.hasFullScopes, authUrl: result.authUrl });
  } catch (err) {
    console.error("[Google Auth] Status check error:", err);
    return res.json({ authenticated: false, hasTokens: false });
  }
});

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
            let grantedScope = GOOGLE_OAUTH_SCOPES.join(" ");

            try {
              const oauthClient = new google.auth.OAuth2(clientId, clientSecret, callbackURL);
              const tokenInfo = await oauthClient.getTokenInfo(accessToken);
              if (tokenInfo.scopes.length > 0) {
                grantedScope = tokenInfo.scopes.join(" ");
              }
            } catch (scopeError) {
              console.warn("[Google Auth] Failed to verify granted scopes from token info:", scopeError);
            }
            
            // Link tokens to the global singleton for tool access
            await storage.saveGoogleTokens({
              id: 'default',
              accessToken: accessToken || null,
              refreshToken: refreshToken || null,
              expiryDate: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
              tokenType: 'Bearer',
              scope: grantedScope,
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
      scope: GOOGLE_OAUTH_SCOPES,
      accessType: 'offline',
      prompt: 'consent'
    });

    // Mount handlers on the router
    authRouter.get("/google", (req, res, next) => {
      console.log("[Auth] Starting Google OAuth flow...");
      authHandler(req, res, next);
    });
    
    authRouter.get("/google/callback", 
      passport.authenticate("google", { failureRedirect: "/login" }),
      (req, res) => { 
        console.log("[Auth] Google OAuth callback success, redirecting to /");
        res.redirect("/"); 
      }
    );
    
    // API endpoint to get current user
    authRouter.get("/user", (req, res) => {
      if (req.isAuthenticated()) {
         return res.json(req.user);
      }
      res.status(401).json({ error: "Not authenticated" });
    });

    authRouter.get("/logout", (req, res, next) => {
      req.logout((err) => {
        if (err) { return next(err); }
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

// Export a dummy middleware for now if needed by other files, 
// or update imports to use passport.authenticate directly.
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
