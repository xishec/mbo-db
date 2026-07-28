import admin from "firebase-admin";
import { readFileSync } from "fs";
import { join } from "path";
import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: ".env.local" });

/**
 * Script to set every Firebase Authentication user as an admin
 *
 * This stores admin status in the database at users/{uid}/role
 * Run with: npx tsx scripts/setAdmin.ts
 */

// Initialize Firebase Admin SDK once
const serviceAccountPath = join(process.cwd(), "mbodatabase-firebase-adminsdk-fbsvc-7647ed8475.json");
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  });
}

async function setAdminRole(user: admin.auth.UserRecord): Promise<void> {
  const identifier = user.email ?? user.uid;

  try {
    await admin.database().ref(`users/${user.uid}`).update({ role: "admin" });
    console.log(`✅ Successfully set admin role for ${identifier}`);
  } catch (error) {
    console.error(`❌ Error setting admin role for ${identifier}:`, error);
    throw error;
  }
}

(async () => {
  const results = { success: [] as string[], failed: [] as string[] };
  let pageToken: string | undefined;

  do {
    const page = await admin.auth().listUsers(1000, pageToken);

    for (const user of page.users) {
      const identifier = user.email ?? user.uid;

      try {
        await setAdminRole(user);
        results.success.push(identifier);
      } catch {
        results.failed.push(identifier);
      }
    }

    pageToken = page.pageToken;
  } while (pageToken);

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
