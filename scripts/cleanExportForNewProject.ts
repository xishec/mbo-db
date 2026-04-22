import { readFileSync, writeFileSync } from "fs";

const INPUT = "/Users/xicshen/Downloads/mbo/mbo-db-default-rtdb-export.json";
const OUTPUT = "/Users/xicshen/Downloads/mbo/mbodatabase-clean-import.json";

console.log("Reading export...");
const data = JSON.parse(readFileSync(INPUT, "utf-8"));

const constants = data.constants ?? {};
const clean: Record<string, unknown> = {};

// Users
clean.users = data.users;

// For each environment: birdEventsMap + independent maps + constants (moved into env)
for (const env of ["alpha", "prod"]) {
  if (!data[env]) continue;
  const envData: Record<string, unknown> = {};

  // birdEventsMap — backfill syncedAt from date+time
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

    // Fix program name
    for (const ev of Object.values(events)) {
      if (ev.programId === "SMMP2026-1776513653365") ev.programId = "SMMP2026";
    }

    envData.birdEventsMap = events;
    console.log(`  ${env}/birdEventsMap: ${Object.keys(events).length} events (${backfilled} syncedAt backfilled)`);
  }

  // dismissedConflictsMap
  if (data[env].dismissedConflictsMap) {
    envData.dismissedConflictsMap = data[env].dismissedConflictsMap;
    console.log(`  ${env}/dismissedConflictsMap: ${Object.keys(data[env].dismissedConflictsMap).length} entries`);
  }

  // DETsMap
  if (data[env].DETsMap) {
    envData.DETsMap = data[env].DETsMap;
    console.log(`  ${env}/DETsMap: ${Object.keys(data[env].DETsMap).length} entries`);
  }

  // Constants moved into env
  envData.magicTable = constants.magicTable ?? {};
  envData.volunteersFullNameMap = constants.volunteersFullNameMap ?? {};
  console.log(`  ${env}/magicTable: ${Object.keys(envData.magicTable as Record<string, unknown>).length} entries`);
  console.log(`  ${env}/volunteersFullNameMap: ${Object.keys(envData.volunteersFullNameMap as Record<string, unknown>).length} entries`);

  envData.metadata = { lastOnlineModified: Date.now() };

  const removed = Object.keys(data[env]).filter(
    (k) => !["birdEventsMap", "dismissedConflictsMap", "DETsMap"].includes(k)
  );
  console.log(`  ${env} removed from original: ${removed.join(", ")}`);

  clean[env] = envData;
}

console.log("\nWriting clean export...");
writeFileSync(OUTPUT, JSON.stringify(clean));

const originalSize = readFileSync(INPUT).length;
const cleanSize = readFileSync(OUTPUT).length;
console.log(`Original: ${(originalSize / 1024 / 1024).toFixed(1)}MB`);
console.log(`Clean: ${(cleanSize / 1024 / 1024).toFixed(1)}MB`);
console.log(`\nOutput: ${OUTPUT}`);
console.log("Import this into the new project via Firebase Console > RTDB > Import JSON");
