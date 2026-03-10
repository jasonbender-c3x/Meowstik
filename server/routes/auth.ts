import { Router } from "express";
import { authRouter as googleAuthRouter } from "../googleAuth.js";

/**
 * [💭 Analysis]
 * Identity Router - Revision 4.0.0
 * PATH: server/routes/auth.ts
 * 
 * This router is now a clean wrapper around the Google OAuth2 implementation
 * in server/googleAuth.ts. This prevents duplicate route definitions and
 * ensures consistent authentication behavior.
 */

export const authRouter = Router();

// Mount the Google Auth routes
// These will be available at /api/auth/google, /api/auth/google/callback, etc.
authRouter.use("/", googleAuthRouter);

export { setupAuth } from "../googleAuth.js";
export default authRouter;