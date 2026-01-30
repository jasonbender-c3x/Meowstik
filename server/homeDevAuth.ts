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
  
  return {
    id: "home-dev-user",
    email,
    firstName: "Developer",
    lastName: "User",
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
    await storage.upsertUser(devUser);
    console.log(`✅ [Home Dev Mode] Default developer user initialized: ${devUser.email}`);
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
  const user = await storage.getUser(devUser.id);
  
  if (!user) {
    // If user doesn't exist, create it
    await storage.upsertUser(devUser);
    const newUser = await storage.getUser(devUser.id);
    if (!newUser) {
      throw new Error("Failed to create home dev user");
    }
    return newUser;
  }

  return user;
}

/**
 * Create a mock user session object for home dev mode
 * This mimics the structure expected by the Replit auth flow
 */
export function createHomeDevSession() {
  const devUser = getDevUserConfig();
  
  return {
    claims: {
      sub: devUser.id,
      email: devUser.email,
      first_name: devUser.firstName,
      last_name: devUser.lastName,
      profile_image_url: devUser.profileImageUrl,
      exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // Expires in 1 year
    },
    access_token: "home-dev-token",
    refresh_token: "home-dev-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // Expires in 1 year
  };
}
