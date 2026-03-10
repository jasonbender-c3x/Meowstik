import passport from "passport";
import { Strategy as CustomStrategy } from "passport-custom";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { storage } from "./storage.js";
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * [💭 Analysis] 
 * Sovereign Identity Layer - Revision 4.1.6
 * PATH: server/homeDevAuth.ts
 * FIX: Polymorphic Middleware Signature. `createHomeDevSession` now safely
 * acts as both a factory `app.use(createHomeDevSession())` AND a direct
 * function `createHomeDevSession(req, res, next)` preventing undefined crashes.
 */

// --- UTILITY EXPORTS ---

export function isHomeDevMode() {
  return process.env.HOME_DEV_MODE === "true";
}

export async function getHomeDevUser() {
  const devEmail = process.env.HOME_DEV_EMAIL || "jason@oceanshorestech.com";
  let user = await storage.getUserByEmail(devEmail);
  if (!user) {
    user = await storage.createUser({
      username: "jason_root",
      email: devEmail,
      password: crypto.randomBytes(32).toString('hex'), // Bypass DB constraint
      displayName: "Jason (Creator)",
      role: "admin",
      googleId: "dev_local",
      avatarUrl: "",
      googleAccessToken: "",
      googleRefreshToken: ""
    });
  }
  return user;
}

// --- BULLETPROOF MIDDLEWARE ---

export function createHomeDevSession(req?: any, res?: any, next?: any) {
  // The actual logic that runs per request
  const handler = async (reqObj: any, resObj: any, nextFn: any) => {
    if (!isHomeDevMode()) return nextFn();
    
    // Safely check auth status without throwing if passport isn't attached yet
    const isAuth = typeof reqObj.isAuthenticated === 'function' ? reqObj.isAuthenticated() : false;
    
    if (!isAuth) {
      try {
        const user = await getHomeDevUser();
        // Ensure req.login exists before calling it
        if (typeof reqObj.login === 'function') {
          reqObj.login(user, (err: any) => {
            if (err) return nextFn(err);
            return nextFn();
          });
          return;
        } else {
          // Fallback if Passport isn't fully mounted
          reqObj.user = user;
        }
      } catch (err) {
        console.error("Critical Auth Error: Could not fetch Home Dev User", err);
        return nextFn(err);
      }
    }
    return nextFn();
  };

  // Factory pattern detection (called with 0 args from middleware.ts)
  if (!req) {
    return handler;
  }

  // Direct invocation detection (called with 3 args)
  return handler(req, res, next);
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (typeof req.isAuthenticated === 'function' && req.isAuthenticated()) return next();
  
  if (req.accepts("json")) {
    res.status(401).json({ message: "Identity Required" });
  } else {
    res.redirect("/api/login");
  }
}

// --- PASSPORT CONFIGURATION ---

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

  // Sovereign Dev Strategy (Master Key)
  passport.use("sovereign-dev", new CustomStrategy(async (req, done) => {
    try {
      const user = await getHomeDevUser();
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/auth/google/callback",
        proxy: true 
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error("No email provided"));
          
          let user = await storage.getUserByEmail(email);
          const userData = {
            username: email.split('@')[0],
            email: email,
            password: crypto.randomBytes(32).toString('hex'), // <-- Database Fix
            displayName: profile.displayName,
            googleId: profile.id,
            avatarUrl: profile.photos?.[0]?.value || "",
            googleAccessToken: accessToken,
            googleRefreshToken: refreshToken,
            role: email === process.env.HOME_DEV_EMAIL ? "admin" : "user"
          };

          if (!user) {
             user = await storage.createUser(userData);
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    ));
  }
}