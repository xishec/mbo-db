import type { BirdEvent, DET, PendingBirdEvent, PendingEvent } from "../types";
import { stripUndefined } from "../utils/firebaseValue";

export interface SyncBatch {
  queueIds: string[];
  updates: Record<string, unknown>;
  birdEvents: BirdEvent[];
  dets: DET[];
  missingPredecessorIds: string[];
}

const pendingOrder = (a: PendingEvent, b: PendingEvent): number =>
  a.timestamp - b.timestamp || a.id.localeCompare(b.id);

const eventKey = (environment: string, eventId: string): string => `${environment}\u0000${eventId}`;
const detKey = (environment: string, date: string): string => `${environment}\u0000${date}`;

/**
 * Build idempotent, order-independent Firebase batches from the full queue.
 *
 * Each event is written at its complete event path. This avoids Firebase's
 * ancestor/descendant update conflict when a queued event is also another
 * queued event's predecessor. Duplicate or forked legacy queue entries are
 * resolved deterministically by timestamp, then queue id.
 */
export function buildSyncBatches(
  pendingEvents: PendingEvent[],
  getExistingEvent: (environment: string, eventId: string) => BirdEvent | undefined,
  batchSize = 50,
): SyncBatch[] {
  if (batchSize < 1) throw new Error("Sync batch size must be at least 1");

  const ordered = [...pendingEvents]
    .filter((pending) => pending.type === "bird-event" || pending.type === "det")
    .sort(pendingOrder);

  // Canonicalize duplicate legacy queue entries. Because `ordered` is
  // deterministic, the newest entry always wins regardless of IDB order.
  const pendingBirdEvents = new Map<string, PendingBirdEvent>();
  const pendingDets = new Map<string, Extract<PendingEvent, { type: "det" }>>();
  for (const pending of ordered) {
    if (pending.type === "bird-event") {
      pendingBirdEvents.set(eventKey(pending.environment, pending.pendingEvent.id), pending);
    } else {
      pendingDets.set(detKey(pending.environment, pending.det.date), pending);
    }
  }

  const finalEvents = new Map<string, BirdEvent>();
  for (const [key, pending] of pendingBirdEvents) {
    finalEvents.set(key, pending.pendingEvent);
  }

  // A predecessor should have only one successor. If an old queue contains
  // a fork, deterministically choose the newest child instead of depending
  // on the arbitrary order returned by IndexedDB.
  const successorByPredecessor = new Map<string, PendingBirdEvent>();
  for (const pending of pendingBirdEvents.values()) {
    const previousEventId = pending.pendingEvent.previousEventId;
    if (!previousEventId) continue;
    successorByPredecessor.set(eventKey(pending.environment, previousEventId), pending);
  }

  const missingPredecessors = new Set<string>();
  for (const [previousKey, successor] of successorByPredecessor) {
    const previousEventId = successor.pendingEvent.previousEventId!;
    const previous =
      finalEvents.get(previousKey) ?? getExistingEvent(successor.environment, previousEventId);
    if (!previous) {
      missingPredecessors.add(previousKey);
      continue;
    }
    finalEvents.set(previousKey, {
      ...previous,
      modifiedEventId: successor.pendingEvent.id,
    });
  }

  const finalDets = new Map<string, DET>();
  for (const [key, pending] of pendingDets) finalDets.set(key, stripUndefined(pending.det));

  const blockedKeys = new Set<string>();
  const findMissingAncestor = (startKey: string): string | null => {
    const visited = new Set<string>();
    let key = startKey;
    while (!visited.has(key)) {
      visited.add(key);
      const pending = pendingBirdEvents.get(key);
      const previousEventId = pending?.pendingEvent.previousEventId;
      if (!pending || !previousEventId) return null;

      const previousKey = eventKey(pending.environment, previousEventId);
      if (missingPredecessors.has(previousKey)) return previousEventId;
      if (!pendingBirdEvents.has(previousKey)) return null;
      key = previousKey;
    }
    return null;
  };

  const blockedMissingIds = new Set<string>();
  for (const key of pendingBirdEvents.keys()) {
    const missingId = findMissingAncestor(key);
    if (missingId) {
      blockedKeys.add(key);
      blockedMissingIds.add(missingId);
    }
  }
  const syncable = ordered.filter(
    (pending) => pending.type !== "bird-event" || !blockedKeys.has(eventKey(pending.environment, pending.pendingEvent.id))
  );
  const blocked = ordered.filter(
    (pending) => pending.type === "bird-event" && blockedKeys.has(eventKey(pending.environment, pending.pendingEvent.id))
  );

  const batches: SyncBatch[] = [];
  for (let offset = 0; offset < syncable.length; offset += batchSize) {
    const entries = syncable.slice(offset, offset + batchSize);
    const updates: Record<string, unknown> = {};
    const batchBirdEvents = new Map<string, BirdEvent>();
    const batchDets = new Map<string, DET>();
    const batchMissingPredecessors = new Set<string>();

    const addEventChain = (environment: string, key: string): void => {
      if (batchBirdEvents.has(key)) return;
      const event = finalEvents.get(key);
      if (!event) return;

      updates[`${environment}/birdEventsMap/${event.id}`] = stripUndefined(event);
      batchBirdEvents.set(key, event);

      if (event.previousEventId) {
        const previousKey = eventKey(environment, event.previousEventId);
        if (finalEvents.has(previousKey)) {
          addEventChain(environment, previousKey);
        } else if (missingPredecessors.has(previousKey)) {
          batchMissingPredecessors.add(event.previousEventId);
        }
      }

      // Include queued successors too. Therefore any successful batch writes
      // a complete pending modification chain even when its queue entries
      // happen to fall in different batches.
      const successor = successorByPredecessor.get(key);
      if (successor) {
        addEventChain(environment, eventKey(environment, successor.pendingEvent.id));
      }
    };

    for (const pending of entries) {
      if (pending.type === "bird-event") {
        const key = eventKey(pending.environment, pending.pendingEvent.id);
        addEventChain(pending.environment, key);
      } else {
        const key = detKey(pending.environment, pending.det.date);
        const det = finalDets.get(key);
        if (det) {
          updates[`${pending.environment}/DETsMap/${det.date}`] = det;
          batchDets.set(key, det);
        }
      }
    }

    batches.push({
      queueIds: entries.map((pending) => pending.id),
      updates,
      birdEvents: [...batchBirdEvents.values()],
      dets: [...batchDets.values()],
      missingPredecessorIds: [...batchMissingPredecessors],
    });
  }

  if (blocked.length > 0) {
    batches.push({
      queueIds: blocked.map((pending) => pending.id),
      updates: {},
      birdEvents: [],
      dets: [],
      missingPredecessorIds: [...blockedMissingIds],
    });
  }

  return batches;
}
