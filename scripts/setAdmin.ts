import admin from "firebase-admin";
import { readFileSync } from "fs";
import { join } from "path";
import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: ".env.local" });

/**
 * Script to set a user as admin using Firebase Realtime Database
 *
 * This stores admin status in the database at users/{uid}/role
 * Run with: npx tsx scripts/setAdmin.ts
 */

// Initialize Firebase Admin SDK once
const serviceAccountPath = join(process.cwd(), "mbo-db-firebase-adminsdk-fbsvc-5fcd6de6b9.json");
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  });
}

async function setAdminRole(email: string): Promise<void> {
  try {
    console.log(`Looking up user: ${email}`);

    // Get user by email
    const user = await admin.auth().getUserByEmail(email);
    console.log(`Found user: ${user.email} (UID: ${user.uid})`);

    // Set admin role in database with email identifier
    await admin.database().ref(`users/${user.uid}`).set({
      email: user.email,
      role: "admin"
    });
    console.log(`✅ Successfully set admin role for ${email}`);
  } catch (error) {
    console.error(`❌ Error setting admin role for ${email}:`, error);
    throw error;
  }
}

// The emails to set as admin
const adminEmails = ["xiiicheen@gmail.com"];

(async () => {
  const results = { success: [] as string[], failed: [] as string[] };

  for (const email of adminEmails) {
    try {
      await setAdminRole(email);
      results.success.push(email);
    } catch (error) {
      results.failed.push(email);
      console.log(error);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Successfully set admin: ${results.success.length}`);
  results.success.forEach((email) => console.log(`   - ${email}`));

  if (results.failed.length > 0) {
    console.log(`\n❌ Failed: ${results.failed.length}`);
    results.failed.forEach((email) => console.log(`   - ${email}`));
  }
  console.log("=".repeat(50));

  process.exit(results.failed.length > 0 ? 1 : 0);
})();
