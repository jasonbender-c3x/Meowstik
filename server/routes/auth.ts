import { Router } from "express";
import passport from "passport";
import { setupAuth as setupPassport, isAuthenticated } from "../homeDevAuth.js";

/**
 * [💭 Analysis]
 * Identity Router - Revision 3.6.1
 * PATH: server/routes/auth.ts
 * * FIX: Exporting setupAuth for server/index.ts to resolve TypeError.
 */

export const authRouter = Router();

export function setupAuth(app: any) {
  setupPassport(app);
}

authRouter.get("/user", (req, res) => {
  if (req.isAuthenticated()) return res.json(req.user);
  res.status(401).json({ message: "Not authenticated" });
});

authRouter.post("/dev-login", passport.authenticate("sovereign-dev"), (req, res) => {
    res.json(req.user);
});

authRouter.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.json({ message: "Logged out" });
  });
});

export default authRouter;