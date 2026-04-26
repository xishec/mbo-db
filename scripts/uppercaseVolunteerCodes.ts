import { db, ENVIRONMENT } from "./firebase-node";

/**
 * One-time migration: uppercase every bander / scribe code across RTDB.
 *
 * Historical data stored codes in mixed case because the client never
 * normalized bander/scribe entry. That created apparent duplicates like
 * "VIP" and "vip". This script:
 *
 *   1. Scans every bird event, uppercases `bander` and `scribe`.
 *   2. Re-keys `volunteersFullNameMap` so all keys are uppercase. When the
 *      same uppercase key is created from multiple casings, we merge by
 *      picking the first non-empty full name.
 *
 * Idempotent: a second run is a no-op.
 *
 * Usage:
 *   DRY_RUN=1 VITE_ENVIRONMENT=alpha NODE_ENV=production npx tsx scripts/uppercaseVolunteerCodes.ts
 *   VITE_ENVIRONMENT=alpha NODE_ENV=production npx tsx scripts/uppercaseVolunteerCodes.ts
 *   VITE_ENVIRONMENT=prod  NODE_ENV=production npx tsx scripts/uppercaseVolunteerCodes.ts
 *
 * Tip: always run with DRY_RUN=1 first, verify counts, then run without.
 */

const DRY_RUN = process.env.DRY_RUN === "1";
const BATCH_SIZE = 2000;

interface BirdEvent {
  bander?: string;
  scribe?: string;
}

function needsUppercase(s: string | undefined): boolean {
  return !!s && s !== s.toUpperCase();
}

async function migrateEvents(env: string): Promise<{ scanned: number; updated: number }> {
  console.log(`\n[events] reading ${env}/birdEventsMap ...`);
  const snap = await db.ref(`${env}/birdEventsMap`).once("value");
  if (!snap.exists()) {
    console.log("[events] no events found");
    return { scanned: 0, updated: 0 };
  }
  const events = snap.val() as Record<string, BirdEvent>;
  const ids = Object.keys(events);
  console.log(`[events] ${ids.length} events scanned`);

  const updates: Record<string, string> = {};
  let updatedCount = 0;
  for (const id of ids) {
    const ev = events[id];
    if (needsUppercase(ev.bander)) {
      updates[`${env}/birdEventsMap/${id}/bander`] = ev.bander!.toUpperCase();
      updatedCount++;
    }
    if (needsUppercase(ev.scribe)) {
      updates[`${env}/birdEventsMap/${id}/scribe`] = ev.scribe!.toUpperCase();
      updatedCount++;
    }
  }

  const affectedEventIds = new Set<string>();
  for (const path of Object.keys(updates)) {
    const match = path.match(/birdEventsMap\/([^/]+)\//);
    if (match) affectedEventIds.add(match[1]);
  }

  console.log(
    `[events] ${affectedEventIds.size} events would be touched, ${updatedCount} fields to rewrite`
  );

  if (DRY_RUN) {
    const sampleKeys = Object.keys(updates).slice(0, 10);
    for (const k of sampleKeys) console.log(`  ${k}  ->  ${updates[k]}`);
    if (Object.keys(updates).length > 10) console.log(`  ... (${Object.keys(updates).length - 10} more)`);
    return { scanned: ids.length, updated: affectedEventIds.size };
  }

  const allKeys = Object.keys(updates);
  for (let i = 0; i < allKeys.length; i += BATCH_SIZE) {
    const batch = allKeys.slice(i, i + BATCH_SIZE);
    const payload: Record<string, string> = {};
    for (const k of batch) payload[k] = updates[k];
    await db.ref().update(payload);
    console.log(`  wrote batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allKeys.length / BATCH_SIZE)} (${batch.length} fields)`);
  }

  return { scanned: ids.length, updated: affectedEventIds.size };
}

async function migrateVolunteersFullNameMap(env: string): Promise<{ scanned: number; written: number; deletedKeys: number }> {
  console.log(`\n[volunteersFullNameMap] reading ${env}/volunteersFullNameMap ...`);
  const snap = await db.ref(`${env}/volunteersFullNameMap`).once("value");
  if (!snap.exists()) {
    console.log("[volunteersFullNameMap] nothing to migrate");
    return { scanned: 0, written: 0, deletedKeys: 0 };
  }
  const nameMap = snap.val() as Record<string, string>;
  const keys = Object.keys(nameMap);
  console.log(`[volunteersFullNameMap] ${keys.length} entries scanned`);

  // Merge by uppercase key: prefer first non-empty fullName encountered.
  const merged = new Map<string, { name: string; sources: string[] }>();
  for (const rawKey of keys) {
    const key = rawKey.toUpperCase();
    const name = (nameMap[rawKey] ?? "").trim();
    const existing = merged.get(key);
    if (existing) {
      existing.sources.push(rawKey);
      if (!existing.name && name) existing.name = name;
    } else {
      merged.set(key, { name, sources: [rawKey] });
    }
  }

  const payload: Record<string, string | null> = {};
  let writes = 0;
  let deletes = 0;
  for (const [upperKey, { name, sources }] of merged) {
    const currentValueAtUpperKey = nameMap[upperKey] ?? "";
    // Write the merged (or upper-cased) value only if it differs from what's
    // already stored at the uppercase key, OR if the uppercase key doesn't
    // yet exist at all.
    if (currentValueAtUpperKey !== name || !(upperKey in nameMap)) {
      payload[`${env}/volunteersFullNameMap/${upperKey}`] = name;
      writes++;
    }
    // Remove any lower/mixed-case source keys (but not the uppercase one).
    for (const src of sources) {
      if (src !== upperKey) {
        payload[`${env}/volunteersFullNameMap/${src}`] = null;
        deletes++;
      }
    }
  }

  console.log(`[volunteersFullNameMap] ${writes} writes, ${deletes} deletions needed`);

  if (DRY_RUN) {
    const sampleKeys = Object.keys(payload).slice(0, 20);
    for (const k of sampleKeys) console.log(`  ${k}  ->  ${payload[k] === null ? "<delete>" : JSON.stringify(payload[k])}`);
    if (Object.keys(payload).length > 20) console.log(`  ... (${Object.keys(payload).length - 20} more)`);
    return { scanned: keys.length, written: writes, deletedKeys: deletes };
  }

  if (Object.keys(payload).length > 0) {
    await db.ref().update(payload);
    console.log("  volunteersFullNameMap updated");
  }

  return { scanned: keys.length, written: writes, deletedKeys: deletes };
}

async function bumpMapTimestamp(env: string) {
  if (DRY_RUN) return;
  const now = Date.now();
  await db.ref(`${env}/metadata/lastModified_volunteersFullNameMap`).set(now);
  console.log(`\n[metadata] bumped lastModified_volunteersFullNameMap to ${now}`);
}

async function main() {
  const env = ENVIRONMENT;
  console.log(`=== Uppercase volunteer codes migration ===`);
  console.log(`env       : ${env}`);
  console.log(`DRY_RUN   : ${DRY_RUN ? "yes (no writes)" : "no (will write)"}`);

  const eventResult = await migrateEvents(env);
  const mapResult = await migrateVolunteersFullNameMap(env);
  await bumpMapTimestamp(env);

  console.log(`\n=== Summary ===`);
  console.log(
    `events: ${eventResult.scanned} scanned, ${eventResult.updated} updated`
  );
  console.log(
    `volunteersFullNameMap: ${mapResult.scanned} scanned, ${mapResult.written} written, ${mapResult.deletedKeys} deleted`
  );
  console.log(DRY_RUN ? "DRY RUN — no changes applied." : "Migration complete.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
