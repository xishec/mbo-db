import { db } from "./firebase-node";

const MAP_NAMES = ["dismissedConflictsMap", "DETsMap", "magicTable", "volunteersFullNameMap"];
const ENVIRONMENTS = ["alpha", "prod"];

async function main() {
  const now = Date.now();
  const updates: Record<string, number> = {};
  for (const m of MAP_NAMES) {
    updates[`lastModified_${m}`] = now;
  }
  for (const env of ENVIRONMENTS) {
    await db.ref(`${env}/metadata`).update(updates);
    console.log(`Seeded ${MAP_NAMES.length} timestamps in ${env}/metadata`);
  }
  process.exit(0);
}

main();
