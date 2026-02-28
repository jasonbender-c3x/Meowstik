/**
 * Google OAuth2 Authentication for Meowstik
 * Replaces Replit OIDC authentication with Google OAuth2
 */

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage.js";
import { isHomeDevMode, getHomeDevUser } from "./homeDevAuth.js";
import csurf from "csurf";

// Session duration: 1 week (in milliseconds)
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
// Session duration: 1 week (in seconds, for JWT exp claims)
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * CSRF protection middleware configured to work with the session above.
 *
 * Usage (in your Express app setup, after getSession()):
 *   app.use(getSession());
 *   app.use(getCsrfProtection());
 */
export function getCsrfProtection() {
  // Using session-based tokens (no separate CSRF cookie) to complement express-session.
  return csurf({ cookie: false });
}

export function getSession() {
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: SESSION_TTL,
    tableName: "sessions",
  });
  
  const isProduction = process.env.NODE_ENV === "production";
  
  // Require SESSION_SECRET in production
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

/**
 * Parse first and last name from Google profile
 */
function parseUserName(profile: GoogleUser): { firstName: string; lastName: string } {
  if (profile.name?.givenName) {
    return {
      firstName: profile.name.givenName,
      lastName: profile.name.familyName || "",
    };
  }
  
  // Fallback: parse displayName
  const parts = profile.displayName.split(" ");
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

async function upsertUser(profile: GoogleUser) {
  const email = profile.emails?.[0]?.value || "";
  const { firstName, lastName } = parseUserName(profile);
  const profileImageUrl = profile.photos?.[0]?.value || "";
  const displayName = `${firstName} ${lastName}`.trim() || profile.displayName;
  // Generate a username from email or use a fallback
  const username = email.split("@")[0] || `user_${profile.id.substring(0, 8)}`;

  await storage.upsertUser({
    id: profile.id,
    googleId: profile.id,
    email,
    username,
    displayName,
    avatarUrl: profileImageUrl,
    role: "user",
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  
  console.log("[Auth Setup] Registering passport serializers...");
  passport.serializeUser((user: Express.User, cb) => {
    cb(null, user);
  });
  passport.deserializeUser((user: Express.User, cb) => {
    cb(null, user);
  });

  app.use(passport.initialize());
  app.use(passport.session());

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    if (isHomeDevMode()) {
       console.log("🏠 [Google Auth] Skipping setup: HOME_DEV_MODE is enabled and no Google keys.");
       // Register dummy routes so links don't 404
       const devRedirect = (req: any, res: any) => res.redirect("/");
       app.get("/api/login", devRedirect);
       app.get("/api/auth/google", devRedirect);
    } else {
       console.warn("⚠️ [Google Auth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set. Skipping Google OAuth setup.");
    }
    return;
  }

  try {
    // Determine callback URL based on environment
    let callbackURL = (process.env.GOOGLE_REDIRECT_URI || "").trim();
    
    if (!callbackURL) {
      const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
      const host = (process.env.HOST || "localhost:5000").trim();
      callbackURL = `${protocol}://${host}/api/auth/google/callback`;
    }

    console.log("[Google Auth] Using callback URL:", callbackURL);

    passport.use(
      new GoogleStrategy(
        {
          clientID: (process.env.GOOGLE_CLIENT_ID || "").trim(),
          clientSecret: (process.env.GOOGLE_CLIENT_SECRET || "").trim(),
          callbackURL,
          proxy: true,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            await upsertUser(profile as GoogleUser);
            
            // Create user session object compatible with existing code
            const user = {
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

    // Login routes
    const authHandler = passport.authenticate("google", {
      scope: ["profile", "email"],
    });

    app.get("/api/login", authHandler);
    app.get("/api/auth/google", authHandler);

    // OAuth callback route
    app.get(
      "/api/auth/google/callback",
      passport.authenticate("google", {
        failureRedirect: "/login",
      }),
      (req, res) => {
        // Successful authentication, redirect home
        res.redirect("/");
      }
    );

    // Logout route
    app.get("/api/logout", (req, res) => {
      console.log("[LOGOUT] Logout request received");
      const sessionId = req.session.id;
      console.log(`[LOGOUT] Destroying session: ${sessionId}`);

      req.logout((logoutErr: any) => {
        if (logoutErr) {
          console.error("[LOGOUT] Error during req.logout():", logoutErr);
        } else {
          console.log("[LOGOUT] req.logout() completed successfully.");
        }

        console.log("[LOGOUT] Attempting to destroy session...");
        req.session.destroy((destroyErr: any) => {
          if (destroyErr) {
            console.error("[LOGOUT] FATAL: Error destroying session:", destroyErr);
            return res.status(500).json({ message: "Failed to destroy session.", error: destroyErr.message });
          }
          
          console.log("[LOGOUT] Session destroyed successfully.");
          console.log("[LOGOUT] Redirecting to login page.");
          
          // Redirect to login page after logout
          res.redirect("/login");
        });
      });
    });

    console.log("✅ [Google Auth] OAuth setup complete");
  } catch (error: any) {
    console.error("⚠️  [Auth] Failed to setup Google OAuth:", error?.message || error);
    console.error("    The app will continue but authentication via Google will not work.");
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (isHomeDevMode()) {
    if (!req.user) {
      try {
        const user = await getHomeDevUser();
        if (!user) {
          console.error("Critical Auth Error: Home Dev User not found in database.");
          return res.status(401).json({ message: "Home Dev User not found. Please seed the database." });
        }
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
      } catch (e) {
        console.error("Critical Auth Error: Could not fetch Home Dev User", e);
        return res.status(500).json({ message: "Authentication error" });
      }
    }
    return next();
  }

  const user = req.user as any;

  if (!req.isAuthenticated() || !user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check if token is expired (with some buffer time)
  const now = Math.floor(Date.now() / 1000);
  if (user.expires_at && now > user.expires_at + 60) {
    // Token expired - user needs to re-authenticate
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }

  return next();
};
