import { db } from "./firebase-node";

const ENVIRONMENTS = ["alpha", "prod"];

async function main() {
  const now = Date.now();

  for (const env of ENVIRONMENTS) {
    const snap = await db.ref(`${env}/birdEventsMap`).once("value");
    const events = snap.val() as Record<string, { previousEventId?: string; modifiedEventId?: string; syncedAt?: number }> | null;
    if (!events) {
      console.log(`${env}: no events`);
      continue;
    }

    const updates: Record<string, unknown> = {};
    let fixCount = 0;

    for (const [id, event] of Object.entries(events)) {
      if (!event.previousEventId) continue;

      const oldEvent = events[event.previousEventId];
      if (!oldEvent) continue;

      if (oldEvent.modifiedEventId !== id || !oldEvent.syncedAt || oldEvent.syncedAt < now - 1000) {
        console.log(`  ${env}: ${event.previousEventId} → ${id} (modifiedEventId was: ${oldEvent.modifiedEventId ?? "null"})`);
        updates[`${event.previousEventId}/modifiedEventId`] = id;
        updates[`${event.previousEventId}/syncedAt`] = now;
        fixCount++;
      }
    }

    if (fixCount > 0) {
      await db.ref(`${env}/birdEventsMap`).update(updates);
      console.log(`${env}: fixed ${fixCount} events`);
    } else {
      console.log(`${env}: nothing to fix`);
    }
  }

  process.exit(0);
}

main();
