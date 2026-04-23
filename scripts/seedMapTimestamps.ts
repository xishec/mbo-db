import { db } from "./firebase-node";
import { INDEPENDENT_MAP_NAMES } from "../src/types/mapNames";

const ENVIRONMENTS = ["alpha", "prod"];

async function main() {
  const now = Date.now();
  const updates: Record<string, number> = {};
  for (const m of INDEPENDENT_MAP_NAMES) {
    updates[`lastModified_${m}`] = now;
  }
  await Promise.all(
    ENVIRONMENTS.map(async (env) => {
      await db.ref(`${env}/metadata`).update(updates);
      console.log(`Seeded ${INDEPENDENT_MAP_NAMES.length} timestamps in ${env}/metadata`);
    })
  );
  process.exit(0);
}

main();
