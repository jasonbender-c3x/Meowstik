/**
 * =============================================================================
 * HOME DEV AUTHENTICATION
 * =============================================================================
 * 
 * This module provides a simplified authentication flow for local development.
 * When HOME_DEV_MODE is enabled, it bypasses the standard Replit OAuth flow
 * and auto-logs in a default developer user.
 * 
 * WARNING: This should ONLY be used on local development machines.
 * NEVER enable HOME_DEV_MODE in production environments.
 * 
 * USAGE:
 * ------
 * Set HOME_DEV_MODE=true in your .env file to enable this mode.
 * The system will automatically create and authenticate a default developer user.
 * 
 * =============================================================================
 */

import { storage } from "./storage";
import type { User } from "@shared/schema";

/**
 * Get the developer user configuration from environment
 * Allows customization of the email address via HOME_DEV_EMAIL
 */
function getDevUserConfig() {
  const email = process.env.HOME_DEV_EMAIL || "developer@home.local";
  
  // We use the GitHub username 'jasonbender-c3x' as the ID to allow
  // easy correlation between the dev environment and external scripts/tools.
  return {
    id: "jasonbender-c3x",
    email,
    firstName: "Jason",
    lastName: "Bender",
    profileImageUrl: null,
  };
}

/**
 * Check if home dev mode is enabled
 */
export function isHomeDevMode(): boolean {
  return process.env.HOME_DEV_MODE === "true" || process.env.HOME_DEV_MODE === "1";
}

/**
 * Initialize home dev mode by ensuring the default developer user exists
 */
export async function initializeHomeDevMode(): Promise<void> {
  if (!isHomeDevMode()) {
    return;
  }

  console.log("🏠 [Home Dev Mode] Enabled - Auto-authentication active");
  console.warn("⚠️  WARNING: HOME_DEV_MODE should ONLY be used on local development machines!");

  try {
    // Ensure the default developer user exists in the database
    const devUser = getDevUserConfig();
<<<<<<< copilot/vscode-ml7dy0zi-bip0
    const user = await storage.upsertUser(devUser);
    console.log(`✅ [Home Dev Mode] Developer user ready: ${user.email} (ID: ${user.id})`);
  } catch (error: any) {
    // In dev mode, database connection issues are non-fatal
    console.error("⚠️  [Home Dev Mode] Could not initialize developer user in database:", error?.message || error);
    console.error("   The app will continue with in-memory user data.");
    console.error("   This is normal if running without database access (e.g., in a sandboxed environment).");
=======
    
    // UPSERT returns the user (either created or existing)
    // IMPORTANT: The returned user might contain a DIFFERENT ID than 'home-dev-user'
    // if we matched by email. We must clear any cached "mock" IDs.
    const actualUser = await storage.upsertUser(devUser);
    
    console.log(`✅ [Home Dev Mode] Default developer user initialized: ${actualUser.email} (ID: ${actualUser.id})`);
  } catch (error) {
    console.error("❌ [Home Dev Mode] Failed to initialize developer user:", error);
>>>>>>> main
  }
}

/**
 * Get the default developer user for home dev mode
 */
export async function getHomeDevUser(): Promise<User> {
  if (!isHomeDevMode()) {
    throw new Error("Home dev mode is not enabled");
  }

  const devUser = getDevUserConfig();
  
  // First, try to find the user by ID
  let user = await storage.getUser(devUser.id);
  
  // If not found by ID, try finding by Email
  if (!user) {
     user = await storage.getUserByEmail(devUser.email);
  }
  
  if (!user) {
    // If still not user, try upserting
    user = await storage.upsertUser(devUser);
  }
  
  if (!user) {
    throw new Error("Failed to create or retrieve home dev user");
  }

  return user;
}

/**
 * Create a mock user session object for home dev mode
 * This mimics the structure expected by the Replit auth flow
 */
export function createHomeDevSession() {
  const email = process.env.HOME_DEV_EMAIL || "developer@home.local";
  // NOTE: This session mock must be synchronous for middleware usage.
  // We use the ID returned during initialization log if accessed elsewhere,
  // but for the session CLAIMS, we use the raw expected values.
  
  // Since we can't await here easily in middleware context without refactoring everything,
  // we return a shell that satisfies the type. Ideally, middleware should fetch real user.
  // However, the claims 'sub' is what matters.
  
  // FIXME: We should fetch the real user ID, but since this is called in sync middleware contexts sometimes...
  // We will trust that initialization corrected the DB state.
  
  const devConfig = getDevUserConfig();

  return {
      sub: devConfig.id, // Correctly use the configured ID (jasonbender-c3x)
      email: email,
      first_name: devConfig.firstName,
      last_name: devConfig.lastName,
      profile_image_url: null,
      exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // Expires in 1 year
  };
}
**
 * =============================================================================
 * HOME DEV AUTHENTICATION
 * =============================================================================
 * 
 * This module provides a simplified authentication flow for local development.
 * When HOME_DEV_MODE is   , it bypasses the standard Replit OAuth flow
 * and auto-logs in a default developer user.
 * 
 * WARNING: This should ONLY be used on local development machines.
 * NEVER enable HOME_DEV_MODE in production environments.
 * 
 * USAGE:
 * ------
 * Set HOME_DEV_MODE=true in your .env file to enable this mode.
 * The system will automatically create and authenticate a default developer user.
 * 
 * =============================================================================
 */

import { storage } from "./storage";
import type { User } from "@shared/schema";

/**
 * Get the developer user configuration from environment
 * Allows customization of the email address via HOME_DEV_EMAIL
 */
function getDevUserConfig() {
  const email = process.env.HOME_DEV_EMAIL || "developer@home.local";
  
  // We use the GitHub username 'jasonbender-c3x' as the ID to allow
  // easy correlation between the dev environment and external scripts/tools.
  return {
    id: "jasonbender-c3x",
    email,
    firstName: "Jason",
    lastName: "Bender",
    profileImageUrl: null,
  };
}

/**
 * Check if home dev mode is enabled
 */
export function isHomeDevMode(): boolean {
  return process.env.HOME_DEV_MODE === "true" || process.env.HOME_DEV_MODE === "1";
}

/**
 * Initialize home dev mode by ensuring the default developer user exists
 */
export async function initializeHomeDevMode(): Promise<void> {
  if (!isHomeDevMode()) {
    return;
  }

  console.log("🏠 [Home Dev Mode] Enabled - Auto-authentication active");
  console.warn("⚠️  WARNING: HOME_DEV_MODE should ONLY be used on local development machines!");

  try {
    // Ensure the default developer user exists in the database
    const devUser = getDevUserConfig();
    const user = await storage.upsertUser(devUser);
    console.log(`✅ [Home Dev Mode] Developer user ready: ${user.email} (ID: ${user.id})`);
  } catch (error: any) {
    // In dev mode, database connection issues are non-fatal
    console.error("⚠️  [Home Dev Mode] Could not initialize developer user in database:", error?.message || error);
    console.error("   The app will continue with in-memory user data.");
    console.error("   This is normal if running without database access (e.g., in a sandboxed environment).");
    
    // UPSERT returns the user (either created or existing)
    // IMPORTANT: The returned user might contain a DIFFERENT ID than 'home-dev-user'
    // if we matched by email. We must clear any cached "mock" IDs.
    const actualUser = await storage.upsertUser(devUser);
    
    console.log(`✅ [Home Dev Mode] Default developer user initialized: ${actualUser.email} (ID: ${actualUser.id})`);
  } catch (error) {
    console.error("❌ [Home Dev Mode] Failed to initialize developer user:", error);
  }
}

/**
 * Get the default developer user for home dev mode
 */
export async function getHomeDevUser(): Promise<User> {
  if (!isHomeDevMode()) {
    throw new Error("Home dev mode is not enabled");
  }

  const devUser = getDevUserConfig();
  
  // First, try to find the user by ID
  let user = await storage.getUser(devUser.id);
  
  // If not found by ID, try finding by Email
  if (!user) {
     user = await storage.getUserByEmail(devUser.email);
  }
  
  if (!user) {
    // If still not user, try upserting
    user = await storage.upsertUser(devUser);
  }
  
  if (!user) {
    throw new Error("Failed to create or retrieve home dev user");
  }

  return user;
}

/**
 * Create a mock user session object for home dev mode
 * This mimics the structure expected by the Replit auth flow
 */
export function createHomeDevSession() {
  const email = process.env.HOME_DEV_EMAIL || "developer@home.local";
  // NOTE: This session mock must be synchronous for middleware usage.
  // We use the ID returned during initialization log if accessed elsewhere,
  // but for the session CLAIMS, we use the raw expected values.
  
  // Since we can't await here easily in middleware context without refactoring everything,
  // we return a shell that satisfies the type. Ideally, middleware should fetch real user.
  // However, the claims 'sub' is what matters.
  
  // FIXME: We should fetch the real user ID, but since this is called in sync middleware contexts sometimes...
  // We will trust that initialization corrected the DB state.
  
  const devConfig = getDevUserConfig();

  return {
      sub: devConfig.id, // Correctly use the configured ID (jasonbender-c3x)
      email: email,
      first_name: devConfig.firstName,
      last_name: devConfig.lastName,
      profile_image_url: null,
      exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // Expires in 1 year
  };
}
