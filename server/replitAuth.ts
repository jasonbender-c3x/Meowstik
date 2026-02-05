import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { isHomeDevMode, createHomeDevSession, getHomeDevUser } from "./homeDevAuth";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  // In production (Replit), always use secure cookies
  // The app is served over HTTPS via replit.dev
  const isProduction = process.env.NODE_ENV === 'production' || process.env.REPL_ID;
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction ? true : false,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  // In HOME_DEV_MODE, skip Replit OAuth setup entirely
  if (isHomeDevMode()) {
    console.log("🏠 [Auth] Skipping Replit OAuth setup in HOME_DEV_MODE");
    app.set("trust proxy", 1);
    app.use(getSession());
    app.use(passport.initialize());
    app.use(passport.session());
    return;
  }

  app.set("trust proxy", 1);
  app.use(getSession());
  
  // Register serialization functions BEFORE initializing passport middleware
  // This ensures the Authenticator instance has them ready
  console.log("[Auth Setup] Registering passport serializers...");
  passport.serializeUser((user: Express.User, cb) => {
      // console.log("[Auth] Serializing user:", user);
      cb(null, user);
  });
  passport.deserializeUser((user: Express.User, cb) => {
      // console.log("[Auth] Deserializing user:", user);
      cb(null, user);
  });

  app.use(passport.initialize());
  app.use(passport.session());

  // Check if REPL_ID is set before attempting OIDC discovery
  if (!process.env.REPL_ID) {
    console.warn("⚠️ [Replit Auth] REPL_ID not set. Skipping OIDC discovery and Replit strategy setup.");
    return;
  }

  try {
    const config = await getOidcConfig();

    const verify: VerifyFunction = async (
      tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
      verified: passport.AuthenticateCallback
    ) => {
      const user = {};
      updateUserSession(user, tokens);
      await upsertUser(tokens.claims());
      verified(null, user);
    };

    const registeredStrategies = new Set<string>();

    const ensureStrategy = (domain: string) => {
      const strategyName = `replitauth:${domain}`;
      if (!registeredStrategies.has(strategyName)) {
        const strategy = new Strategy(
          {
            name: strategyName,
            config,
            scope: "openid email profile offline_access",
            callbackURL: `https://${domain}/api/callback`,
          },
          verify,
        );
        passport.use(strategy);
        registeredStrategies.add(strategyName);
      }
    };

    app.get("/api/login", (req, res, next) => {
      ensureStrategy(req.hostname);
      passport.authenticate(`replitauth:${req.hostname}`, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    });

    app.get("/api/callback", (req, res, next) => {
      ensureStrategy(req.hostname);
      passport.authenticate(`replitauth:${req.hostname}`, {
        successReturnToOrRedirect: "/",
        failureRedirect: "/api/login",
      })(req, res, next);
    });

    app.get("/api/logout", (req, res) => {
      req.logout(() => {
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
          }).href
        );
      });
    });
  } catch (error: any) {
    console.error("⚠️  [Auth] Failed to setup Replit OAuth:", error?.message || error);
    console.error("    The app will continue but authentication via Replit will not work.");
    console.error("    This is normal in sandboxed environments without network access.");
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // In home dev mode, bypass authentication checks
  if (isHomeDevMode()) {
    if (!req.user) {
      // NOTE: We need to properly simulate the Passport.js user structure
      // which expects the session data clearly available. 
      // AND we must ensure this ID matches what's in the DB.
      // Since createHomeDevSession is a bit hacky now, we let's ensure we get the REAL user
      // for the claims 'sub' field.
      
      try {
          const user = await getHomeDevUser();
          req.user = {
              claims: {
                  sub: user.id,
                  email: user.email,
                  first_name: user.firstName,
                  last_name: user.lastName,
                  profile_image_url: user.profileImageUrl,
                  exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
              },
              access_token: "home-dev-token",
              refresh_token: "home-dev-refresh-token",
              expires_at: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
          };
      } catch (e) {
          console.error("Critical Auth Error: Could not fetch Home Dev User", e);
           // Fallback structure if DB fail
           req.user = {
              claims: createHomeDevSession(),
              access_token: "mock",
              refresh_token: "mock",
              expires_at: Date.now() + 10000
           };
      }
    }
    return next();
  }

  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

