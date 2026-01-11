/**
 * Bootstrap Script
 * 
 * Creates the initial account and admin user for PointWake.
 * Run with: npx tsx script/bootstrap.ts
 */

import { db } from "../server/db";
import { accounts, locations, users } from "../shared/schema";
import bcrypt from "bcrypt";

const MAIN_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || "+18445247683";

async function bootstrap() {
  console.log("🚀 Bootstrapping PointWake...\n");

  try {
    // Check if account already exists
    const existingAccounts = await db.select().from(accounts);
    
    if (existingAccounts.length > 0) {
      console.log("✅ Account already exists:", existingAccounts[0].name);
      console.log("   Account ID:", existingAccounts[0].id);
      console.log("\n💡 Set this in your environment:");
      console.log(`   DEFAULT_ACCOUNT_ID=${existingAccounts[0].id}`);
      return;
    }

    // Create default account
    console.log("Creating default account...");
    const [account] = await db.insert(accounts).values({
      name: "PointWake Demo",
      tier: "professional",
      status: "active",
      mainPhoneNumber: MAIN_PHONE_NUMBER,
      billingPlan: "standard",
      baseFeePerLocation: 99.0,
      aiRatePerMinute: 0.15,
    }).returning();

    console.log("✅ Account created:", account.name);
    console.log("   ID:", account.id);

    // Create default location
    console.log("\nCreating default location...");
    const [location] = await db.insert(locations).values({
      accountId: account.id,
      name: "Main Office",
      spokenAliases: ["main", "headquarters", "HQ"],
      routingStrategy: "simultaneous",
      businessHoursStart: "09:00",
      businessHoursEnd: "17:00",
      afterHoursPolicy: "voicemail",
      timezone: "America/Chicago",
    }).returning();

    console.log("✅ Location created:", location.name);

    // Create admin user
    console.log("\nCreating admin user...");
    const hashedPassword = await bcrypt.hash("admin123", 10);
    
    const [adminUser] = await db.insert(users).values({
      accountId: account.id,
      locationId: location.id,
      username: "admin",
      password: hashedPassword,
      name: "Admin User",
      fullName: "System Administrator",
      email: "admin@pointwake.com",
      role: "account_admin",
      availability: "available",
    }).returning();

    console.log("✅ Admin user created:", adminUser.username);

    // Create a staff user
    console.log("\nCreating staff user...");
    const staffPassword = await bcrypt.hash("staff123", 10);
    
    const [staffUser] = await db.insert(users).values({
      accountId: account.id,
      locationId: location.id,
      username: "staff",
      password: staffPassword,
      name: "Staff User",
      fullName: "Staff Member",
      email: "staff@pointwake.com",
      role: "staff",
      availability: "available",
    }).returning();

    console.log("✅ Staff user created:", staffUser.username);

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("🎉 Bootstrap Complete!");
    console.log("=".repeat(50));
    console.log("\n📋 Account Details:");
    console.log(`   Name: ${account.name}`);
    console.log(`   ID: ${account.id}`);
    console.log(`   Phone: ${account.mainPhoneNumber}`);
    console.log("\n👤 Login Credentials:");
    console.log("   Admin: admin / admin123");
    console.log("   Staff: staff / staff123");
    console.log("\n⚠️  IMPORTANT: Add this to your environment variables:");
    console.log(`   DEFAULT_ACCOUNT_ID=${account.id}`);
    console.log("\n🔧 Next Steps:");
    console.log("   1. Add DEFAULT_ACCOUNT_ID to Replit Secrets");
    console.log("   2. Configure Vapi Server URL");
    console.log("   3. Start the server: npm run dev");
    console.log("   4. Login at your app URL");
    console.log("   5. Test a call to your Vapi number");

  } catch (error) {
    console.error("❌ Bootstrap failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

bootstrap();
