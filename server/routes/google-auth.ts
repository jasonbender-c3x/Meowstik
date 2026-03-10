import { Router } from "express";
import passport from "passport";
import rateLimit from "express-rate-limit";
import {
  getAuthUrl,
  handleCallback,
  isAuthenticated,
  revokeAccess,
} from "../integrations/google-auth.js";

const router = Router();

// Rate limiter for auth endpoints (20 requests per 15 minutes per IP)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// Initiate Google OAuth flow
router.get("/", authRateLimiter, (req, res) => {
  // If passport Google strategy is configured, use it for user login
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return passport.authenticate("google", {
      scope: ["profile", "email"],
    })(req, res, () => {});
  }
  // Otherwise redirect to custom OAuth flow for API access
  const url = getAuthUrl();
  res.redirect(url);
});

// Handle Google OAuth callback
router.get(
  "/callback",
  authRateLimiter,
  (req, res, next) => {
    // If passport Google strategy is configured, use it
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      return passport.authenticate("google", {
        failureRedirect: "/login",
        successRedirect: "/",
      })(req, res, next);
    }
    // Handle custom OAuth callback
    const code = req.query.code as string;
    if (!code) {
      return res.redirect("/login?error=no_code");
    }
    return handleCallback(code)
      .then(() => res.redirect("/"))
      .catch((err) => {
        console.error("[Google Auth] Callback error:", err);
        res.redirect("/login?error=auth_failed");
      });
  }
);

// Check Google API auth status
router.get("/status", authRateLimiter, async (req, res) => {
  try {
    const authenticated = await isAuthenticated();
    res.json({ authenticated });
  } catch (err) {
    console.error("[Google Auth] Status check error:", err);
    res.json({ authenticated: false });
  }
});

// Revoke Google API access
router.post("/revoke", async (req, res) => {
  try {
    await revokeAccess();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
