import type { BirdEvent } from "../types";

// Covers clock/order differences and slow queue drains while older app builds
// are still in use. Unchanged rows are filtered before any rebuild or write.
export const BIRD_EVENT_CURSOR_OVERLAP_MS = 60 * 60 * 1000;

export function getBirdEventDeltaStart(cursor: number): number {
  return Math.max(0, cursor - BIRD_EVENT_CURSOR_OVERLAP_MS);
}

function equalData(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => equalData(value, right[index]))
    );
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).filter((key) => leftRecord[key] !== undefined);
  const rightKeys = Object.keys(rightRecord).filter((key) => rightRecord[key] !== undefined);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) => Object.prototype.hasOwnProperty.call(rightRecord, key) && equalData(leftRecord[key], rightRecord[key])
    )
  );
}

function equalBirdEvents(left: BirdEvent, right: BirdEvent): boolean {
  const { band: leftBand, ...leftEvent } = left;
  const { band: rightBand, ...rightEvent } = right;
  return (
    leftBand.bandPrefix === rightBand.bandPrefix &&
    leftBand.bandSuffix === rightBand.bandSuffix &&
    (leftBand.bandSize ?? null) === (rightBand.bandSize ?? null) &&
    equalData(leftEvent, rightEvent)
  );
}

/**
 * Discard rows at or behind the cursor when the same data is already held
 * locally. New or changed rows in the overlap still pass through.
 */
export function filterBirdEventDelta(
  delta: Record<string, BirdEvent>,
  cursor: number,
  getExisting: (eventId: string) => BirdEvent | undefined
): Record<string, BirdEvent> {
  const changed: Record<string, BirdEvent> = {};
  for (const [eventId, event] of Object.entries(delta)) {
    const existing = typeof event.syncedAt === "number" && event.syncedAt <= cursor ? getExisting(eventId) : undefined;
    if (!existing || !equalBirdEvents(existing, event)) changed[eventId] = event;
  }
  return changed;
}
