#!/usr/bin/env tsx
/**
 * Test script for Home Dev Mode
 * 
 * This script verifies that home dev mode authentication works correctly.
 * It checks:
 * 1. Home dev mode can be enabled
 * 2. Default developer user is created
 * 3. User can be retrieved from database
 * 4. Custom email can be configured
 */

import { config } from "dotenv";
config();

// Temporarily set HOME_DEV_MODE for testing
process.env.HOME_DEV_MODE = "true";
// Test with custom email
process.env.HOME_DEV_EMAIL = "test@example.com";

import { 
  isHomeDevMode, 
  initializeHomeDevMode, 
  getHomeDevUser,
  createHomeDevSession 
} from "../server/homeDevAuth";

async function testHomeDevMode() {
  console.log("🧪 Testing Home Dev Mode...\n");

  // Test 1: Check if home dev mode is enabled
  console.log("Test 1: Checking if home dev mode is enabled...");
  const isEnabled = isHomeDevMode();
  console.log(`✅ Home Dev Mode enabled: ${isEnabled}\n`);

  if (!isEnabled) {
    console.error("❌ HOME_DEV_MODE is not enabled. Set HOME_DEV_MODE=true in .env");
    process.exit(1);
  }

  // Test 2: Initialize home dev mode
  console.log("Test 2: Initializing home dev mode...");
  try {
    await initializeHomeDevMode();
    console.log("✅ Home dev mode initialized successfully\n");
  } catch (error) {
    console.error("❌ Failed to initialize home dev mode:", error);
    process.exit(1);
  }

  // Test 3: Get home dev user
  console.log("Test 3: Getting home dev user...");
  try {
    const user = await getHomeDevUser();
    console.log("✅ Home dev user retrieved:");
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    
    if (user.email !== "test@example.com") {
      console.error(`❌ Expected email to be 'test@example.com' but got '${user.email}'`);
      process.exit(1);
    }
    console.log("✅ Custom email configuration working correctly\n");
  } catch (error) {
    console.error("❌ Failed to get home dev user:", error);
    process.exit(1);
  }

  // Test 4: Create home dev session
  console.log("Test 4: Creating home dev session...");
  try {
    const session = createHomeDevSession();
    console.log("✅ Home dev session created:");
    console.log(`   User ID: ${session.claims.sub}`);
    console.log(`   Email: ${session.claims.email}`);
    console.log(`   Name: ${session.claims.first_name} ${session.claims.last_name}`);
    
    if (session.claims.email !== "test@example.com") {
      console.error(`❌ Expected session email to be 'test@example.com' but got '${session.claims.email}'`);
      process.exit(1);
    }
    console.log("✅ Session email matches custom configuration\n");
  } catch (error) {
    console.error("❌ Failed to create home dev session:", error);
    process.exit(1);
  }

  console.log("✅ All tests passed! Home Dev Mode is working correctly.");
  console.log("\n📝 To use Home Dev Mode:");
  console.log("   1. Set HOME_DEV_MODE=true in your .env file");
  console.log("   2. (Optional) Set HOME_DEV_EMAIL=your-email@example.com for custom email");
  console.log("   3. Start the server with: npm run dev");
  console.log("   4. Navigate to http://localhost:5000");
  console.log("   5. You will be automatically logged in!");

  process.exit(0);
}

testHomeDevMode().catch((error) => {
  console.error("❌ Test failed with error:", error);
  process.exit(1);
});
