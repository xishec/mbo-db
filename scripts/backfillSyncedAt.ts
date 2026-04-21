import { db, ENVIRONMENT } from "./firebase-node";

const BATCH_SIZE = 2000;

async function main() {
  console.log(`Backfilling syncedAt on ${ENVIRONMENT}/birdEventsMap...`);

  const snap = await db.ref(`${ENVIRONMENT}/birdEventsMap`).once("value");
  if (!snap.exists()) {
    console.log("No birdEventsMap found");
    process.exit(1);
  }

  const events = snap.val() as Record<string, { syncedAt?: number; date?: string; time?: string }>;
  const entries = Object.entries(events);
  let needsUpdate = 0;

  for (const [, ev] of entries) {
    if (!ev.syncedAt) needsUpdate++;
  }

  console.log(`Total events: ${entries.length}, missing syncedAt: ${needsUpdate}`);
  if (needsUpdate === 0) {
    console.log("All events already have syncedAt. Done.");
    process.exit(0);
  }

  // Backfill using Date.parse(date + time) as approximation, or Date.now() as fallback
  const now = Date.now();
  let processed = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch: Record<string, number> = {};
    for (const [id, ev] of entries.slice(i, i + BATCH_SIZE)) {
      if (ev.syncedAt) continue;
      const timestamp = ev.date ? Date.parse(`${ev.date}T${ev.time || "00:00"}`) : now;
      batch[`${id}/syncedAt`] = isNaN(timestamp) ? now : timestamp;
    }

    if (Object.keys(batch).length > 0) {
      await db.ref(`${ENVIRONMENT}/birdEventsMap`).update(batch);
      processed += Object.keys(batch).length;
      console.log(`  ${processed}/${needsUpdate} updated`);
    }
  }

  console.log("Done!");
  process.exit(0);
}

main().catch((err) => { console.error("Failed:", err); process.exit(1); });
