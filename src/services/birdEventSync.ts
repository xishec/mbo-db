import { get, orderByChild, query, ref, startAt } from "firebase/database";
import { CURRENT_ENVIRONMENT, db } from "../firebase";
import { runSync } from "../stores/actions";
import { rebuildBirdEventState } from "../stores/rebuildAppState";
import { useAppStore } from "../stores/useAppStore";
import { Band, type BirdEvent } from "../types";
import { filterBirdEventDelta, getBirdEventDeltaStart } from "./birdEventDelta";
import { birdEventsStore } from "./birdEventsStore";
import { getLastUpdated, getQueuedEvents, putBirdEvents, saveLastUpdated } from "./indexedDB";

/** Upload pending work, then apply bird events at or beyond the local cursor. */
export async function refreshBirdEventDelta(isCancelled: () => boolean): Promise<number> {
  const queueFlushed = await runSync(false);
  if (!queueFlushed || isCancelled() || !useAppStore.getState().isOnline) return 0;

  const lastEventSync = await getLastUpdated(CURRENT_ENVIRONMENT);
  if (!lastEventSync || isCancelled()) return 0;

  const snapshot = await get(
    query(
      ref(db, `${CURRENT_ENVIRONMENT}/birdEventsMap`),
      orderByChild("syncedAt"),
      // A small overlap covers equal timestamps and mixed-version clock skew;
      // already-held rows are filtered before rebuilding local state.
      startAt(getBirdEventDeltaStart(lastEventSync))
    )
  );
  if (!snapshot.exists() || isCancelled()) return 0;

  // Do not let a remote delta overwrite local work queued during the read.
  if ((await getQueuedEvents(CURRENT_ENVIRONMENT)).length > 0 || isCancelled()) return 0;

  const delta = filterBirdEventDelta(
    snapshot.val() as Record<string, BirdEvent>,
    lastEventSync,
    (eventId) => birdEventsStore.get(eventId)
  );
  const rawEvents = Object.values(delta);
  if (rawEvents.length === 0) return 0;
  const hydratedEvents = rawEvents.map((event) => ({
    ...event,
    band: new Band(event.band.bandPrefix, event.band.bandSuffix, event.band.bandSize ?? null),
  }));
  const maxSyncedAt = rawEvents.reduce(
    (max, event) => (typeof event.syncedAt === "number" ? Math.max(max, event.syncedAt) : max),
    lastEventSync
  );

  if (isCancelled()) return 0;
  birdEventsStore.setMany(hydratedEvents);
  await putBirdEvents(CURRENT_ENVIRONMENT, rawEvents);
  if (isCancelled()) return 0;

  const state = useAppStore.getState();
  useAppStore.setState({
    ...rebuildBirdEventState(birdEventsStore.getAll(), state),
    lastSyncedAt: maxSyncedAt,
  });

  // Advance the cursor last. A failed persistence/rebuild remains retryable.
  await saveLastUpdated(CURRENT_ENVIRONMENT, maxSyncedAt);
  return rawEvents.length;
}
