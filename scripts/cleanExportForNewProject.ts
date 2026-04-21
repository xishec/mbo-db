import { readFileSync, writeFileSync } from "fs";

const INPUT = "/Users/xicshen/Downloads/mbo/mbo-db-default-rtdb-export.json";
const OUTPUT = "/Users/xicshen/Downloads/mbo/mbodatabase-clean-import.json";

console.log("Reading export...");
const data = JSON.parse(readFileSync(INPUT, "utf-8"));

const clean: Record<string, unknown> = {};

// Keep constants and users as-is
clean.constants = data.constants;
clean.users = data.users;

// For each environment, keep only birdEventsMap, dismissedConflictsMap, DETsMap
for (const env of ["alpha", "prod"]) {
  if (!data[env]) continue;
  const envData: Record<string, unknown> = {};

  // birdEventsMap — keep, backfill syncedAt from date+time
  if (data[env].birdEventsMap) {
    const events = data[env].birdEventsMap as Record<string, Record<string, unknown>>;
    let backfilled = 0;
    for (const ev of Object.values(events)) {
      if (!ev.syncedAt) {
        const ts = Date.parse(`${ev.date}T${ev.time || "00:00"}`);
        ev.syncedAt = isNaN(ts) ? Date.now() : ts;
        backfilled++;
      }
    }
    envData.birdEventsMap = events;
    console.log(`  ${env}/birdEventsMap: ${Object.keys(events).length} events (${backfilled} syncedAt backfilled)`);
  }

  // dismissedConflictsMap — keep
  if (data[env].dismissedConflictsMap) {
    envData.dismissedConflictsMap = data[env].dismissedConflictsMap;
    console.log(`  ${env}/dismissedConflictsMap: ${Object.keys(data[env].dismissedConflictsMap).length} entries`);
  }

  // DETsMap — keep
  if (data[env].DETsMap) {
    envData.DETsMap = data[env].DETsMap;
    console.log(`  ${env}/DETsMap: ${Object.keys(data[env].DETsMap).length} entries`);
  }

  // Remove: bandGroupsMap, bandIdToBirdEventIdsMap, bandSizeToBandIdMap,
  //         metadata, programsMap, volunteersMap, yearsToProgramMap, settings
  const removed = Object.keys(data[env]).filter(
    (k) => !["birdEventsMap", "dismissedConflictsMap", "DETsMap"].includes(k)
  );
  console.log(`  ${env} removed: ${removed.join(", ")}`);

  clean[env] = envData;
}

console.log("\nWriting clean export...");
writeFileSync(OUTPUT, JSON.stringify(clean));

// Report sizes
const originalSize = readFileSync(INPUT).length;
const cleanSize = readFileSync(OUTPUT).length;
console.log(`Original: ${(originalSize / 1024 / 1024).toFixed(1)}MB`);
console.log(`Clean: ${(cleanSize / 1024 / 1024).toFixed(1)}MB`);
console.log(`Removed: ${((originalSize - cleanSize) / 1024 / 1024).toFixed(1)}MB (${((1 - cleanSize / originalSize) * 100).toFixed(0)}%)`);
console.log(`\nOutput: ${OUTPUT}`);
console.log("Import this into the new project via Firebase Console > RTDB > Import JSON");
