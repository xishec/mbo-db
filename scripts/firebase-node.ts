import { initializeApp, cert, ServiceAccount } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { config } from "dotenv";
import { readFileSync } from "fs";

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
config({ path: envFile });

console.log(`🔧 Using environment: ${envFile}`);

// Load service account key
const serviceAccount = JSON.parse(
  readFileSync("./mbo-db-firebase-adminsdk-fbsvc-5fcd6de6b9.json", "utf-8")
) as ServiceAccount;

export const app = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
});

export const db = getDatabase(app);
export const ENVIRONMENT = (process.env.VITE_ENVIRONMENT as "alpha" | "beta" | "prod") || "alpha";
