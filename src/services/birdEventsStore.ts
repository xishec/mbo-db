import { useSyncExternalStore } from "react";
import type { BirdEvent } from "../types";

/**
 * birdEventsStore — module-level singleton holding the 700K+ bird events
 * outside of React state.
 *
 * Why: the events map is large and mutated on every save. Storing it in
 * React state meant an O(N) spread per save AND every one of ~15 consumers
 * (useData()) re-rendering whenever any event changed. That produced the
 * multi-second post-save render cascade on slow CPUs.
 *
 * Design:
 * - A single Map<string, BirdEvent> held in this module, mutated in place.
 * - A monotonic version counter that bumps on every write.
 * - A listener set for consumers that want live re-reads.
 *
 * Consumer patterns (pick the one that fits):
 *   1. Lazy / one-shot: read store.get(id) inside an event handler.
 *      No hook, no re-render.
 *   2. Snapshot on open: useBirdEventsSnapshot(selector, deps). Reads once
 *      and caches until deps change. Modal content is stable while the
 *      modal is open even if other saves happen in the background.
 *   3. Live: useBirdEventsVersion() + memo dep. Memo re-runs whenever the
 *      store changes. For active pages (Home, FunStats, BirdEvents) that
 *      legitimately need to reflect saves immediately.
 */
class BirdEventsStore {
  private map: Map<string, BirdEvent> = new Map();
  private version = 0;
  private listeners = new Set<() => void>();

  get(id: string): BirdEvent | undefined {
    return this.map.get(id);
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  getAll(): Map<string, BirdEvent> {
    return this.map;
  }

  size(): number {
    return this.map.size;
  }

  getVersion = (): number => this.version;

  /**
   * Replace the entire store (used on load/reload). Accepts either a
   * plain Record (for backward compat with IndexedDB reads) or a Map.
   */
  replace(source: Map<string, BirdEvent> | Record<string, BirdEvent>): void {
    if (source instanceof Map) {
      this.map = new Map(source);
    } else {
      this.map = new Map(Object.entries(source));
    }
    this.bumpAndNotify();
  }

  set(event: BirdEvent): void {
    this.map.set(event.id, event);
    this.bumpAndNotify();
  }

  /**
   * Set multiple events and notify once. Use for batched writes
   * (e.g. syncQueue applying syncedAt to many events at once).
   */
  setMany(events: Iterable<BirdEvent>): void {
    let changed = false;
    for (const ev of events) {
      this.map.set(ev.id, ev);
      changed = true;
    }
    if (changed) this.bumpAndNotify();
  }

  delete(id: string): void {
    if (this.map.delete(id)) this.bumpAndNotify();
  }

  /**
   * Serialize to a plain object for IndexedDB persistence.
   * Structured clone handles Map directly, but DatabaseData's type
   * alias is still Record-compatible and some IDB wrappers choke
   * on Map — safest to hand them a plain object.
   */
  toObject(): Record<string, BirdEvent> {
    return Object.fromEntries(this.map);
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private bumpAndNotify(): void {
    this.version += 1;
    for (const fn of this.listeners) fn();
  }
}

export const birdEventsStore = new BirdEventsStore();

/**
 * Subscribe to the store. Returns a version number that changes on every
 * mutation. Put it in memo/effect deps to re-run when events change.
 */
export function useBirdEventsVersion(): number {
  return useSyncExternalStore(
    birdEventsStore.subscribe,
    birdEventsStore.getVersion,
    birdEventsStore.getVersion
  );
}
