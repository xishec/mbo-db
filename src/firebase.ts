// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

// Environment configuration
export type Environment = "alpha" | "prod";
const STORAGE_KEY = "mbo_environment";
const storedEnv = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
export const CURRENT_ENVIRONMENT: Environment =
  storedEnv === "alpha" || storedEnv === "prod" ? storedEnv : "prod";

export function setEnvironment(env: Environment) {
  localStorage.setItem(STORAGE_KEY, env);
  window.location.reload();
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const analytics =typeof window !== "undefined" ? getAnalytics(app) : null;
export const db = getDatabase(app);
export const auth = getAuth(app);
