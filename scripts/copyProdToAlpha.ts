import { db } from "./firebase-node";

const SMALL_KEYS = [
  "programsMap",
  "bandGroupsMap",
  "yearsToProgramMap",
  "bandSizeToBandIdMap",
  "dismissedConflictsMap",
  "DETsByDateMap",
  "magicTable",
  "volunteersMap",
  "speciesAliasesMap",
  "bandResetsMap",
  "metadata",
];

const LARGE_KEYS = ["birdEventsMap", "bandIdToBirdEventIdsMap"];
const BATCH_SIZE = 2000;

async function copyLargeKey(key: string) {
  console.log(`  Reading prod/${key}...`);
  const snap = await db.ref(`prod/${key}`).once("value");
  if (!snap.exists()) return;

  const data = snap.val() as Record<string, unknown>;
  const entries = Object.entries(data);
  console.log(`  Writing alpha/${key} (${entries.length} entries in batches)...`);

  // Delete orphan keys (in alpha but not in prod) in batches
  const alphaSnap = await db.ref(`alpha/${key}`).once("value");
  if (alphaSnap.exists()) {
    const prodKeys = new Set(Object.keys(data));
    const orphans = Object.keys(alphaSnap.val() as Record<string, unknown>).filter((k) => !prodKeys.has(k));
    if (orphans.length > 0) {
      console.log(`  Deleting ${orphans.length} orphan keys...`);
      for (let i = 0; i < orphans.length; i += BATCH_SIZE) {
        const batch: Record<string, null> = {};
        for (const k of orphans.slice(i, i + BATCH_SIZE)) batch[k] = null;
        await db.ref(`alpha/${key}`).update(batch);
      }
    }
  }

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = Object.fromEntries(entries.slice(i, i + BATCH_SIZE));
    await db.ref(`alpha/${key}`).update(batch);
    console.log(`    ${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length}`);
  }
}

async function main() {
  // Small keys: read in parallel, write in parallel
  console.log("Reading small keys from prod...");
  const snaps = await Promise.all(SMALL_KEYS.map((key) => db.ref(`prod/${key}`).once("value")));

  console.log("Writing small keys to alpha...");
  await Promise.all(
    SMALL_KEYS.map((key, i) => {
      if (!snaps[i].exists()) {
        return key === "bandResetsMap" ? db.ref(`alpha/${key}`).set(null) : Promise.resolve();
      }
      console.log(`  ${key}`);
      return db.ref(`alpha/${key}`).set(snaps[i].val());
    })
  );

  // Large keys: sequential with batching
  for (const key of LARGE_KEYS) {
    await copyLargeKey(key);
  }

  await db.ref("alpha/metadata/lastModified").set(Date.now());
  console.log("Done!");
  process.exit(0);
}

main().catch((err) => { console.error("Failed:", err); process.exit(1); });
