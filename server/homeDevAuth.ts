import passport from "passport";
import { Strategy as CustomStrategy } from "passport-custom";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { storage } from "./storage.js";
import { Request, Response, NextFunction } from "express";

/**
 * [💭 Analysis] 
 * Sovereign Identity Strategy - Revision 3.6.1
 * PATH: server/homeDevAuth.ts
 * * FIX: Added aggressive username fallback to prevent DB constraint errors.
 */

export function isHomeDevMode() {
  return process.env.HOME_DEV_MODE === "true" || !process.env.GOOGLE_CLIENT_ID;
}

export async function createHomeDevSession() {
  const email = process.env.HOME_DEV_EMAIL || "jason@meowstik.local";
  const user = await storage.getUserByEmail(email);
  if (!user) return null;
  
  return {
    claims: {
      sub: user.id.toString(),
      email: user.email,
      first_name: user.displayName || "Developer",
      last_name: "",
      profile_image_url: "",
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
    },
    access_token: "dev-token",
    refresh_token: "dev-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
  };
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) return next();
  
  if (req.accepts("json")) {
    res.status(401).json({ message: "Unauthorized: Meowstik Identity Required" });
  } else {
    res.redirect("/login");
  }
}

export function setupAuth(app: any) {
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Sovereign Dev Strategy
  passport.use("sovereign-dev", new CustomStrategy(async (req, done) => {
    const devEmail = process.env.HOME_DEV_EMAIL || "jason@meowstik.local";
    let user = await storage.getUserByEmail(devEmail);
    if (!user) {
      user = await storage.createUser({
        username: "jason_root", // Anchor username
        email: devEmail,
        password: "sovereign_bypass_secure",
        displayName: "Jason (Creator)",
        role: "admin"
      });
    }
    return done(null, user);
  }));

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const rawCallbackURL = process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/auth/google/callback";
    const callbackURL = rawCallbackURL.trim();
    
    console.log(`🌐 [Auth] Initializing Google Strategy with Callback: ${callbackURL}`);
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID?.trim(),
        clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim(),
        callbackURL: callbackURL,
        proxy: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error("No email provided"));
          let user = await storage.getUserByEmail(email);
          if (!user) {
            user = await storage.createUser({
              username: email.split('@')[0] || `user_${Date.now()}`,
              email: email,
              password: "", 
              displayName: profile.displayName,
              googleId: profile.id,
              avatarUrl: profile.photos?.[0]?.value,
              role: email === process.env.ADMIN_EMAIL ? "admin" : "user"
            });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    ));
  }
}