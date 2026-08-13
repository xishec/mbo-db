import { get, ref, set, update } from "firebase/database";
import { signOut as firebaseSignOut } from "firebase/auth";
import { auth, CURRENT_ENVIRONMENT, db } from "../firebase";
import {
  addToQueue,
  deleteBirdEvent,
  getQueuedEvents,
  putBirdEvents,
  removeManyFromQueue,
  replaceInQueue,
  saveDatabaseMetadataOnly,
  saveMetadata,
  updateDETInCache,
} from "../services/indexedDB";
import { birdEventsStore } from "../services/birdEventsStore";
import { logger } from "../services/logger";
import {
  Band,
  BandSize,
  BirdEventType,
  type CaptureFormData,
  type DatabaseData,
  type DET,
  generateBirdEventId,
  getBandGroupMapKey,
  type BirdEvent,
  type ObserverClass,
  type PendingEvent,
  type PendingBirdEvent,
  type Program,
  type Species,
} from "../types";
import { type IndependentMapName } from "../types/mapNames";
import { setSpeciesMap, SPECIES_KEY_BY_CURRENT_CODE, SPECIES_MAP, resolveSpeciesKey } from "../types/species";
import { stripUndefined } from "../utils/firebaseValue";
import {
  advanceBandId,
  computeSpeciesInfoMap,
  isActiveBirdEvent,
  isBirdEventInCurrentBandGeneration,
} from "./derive";
import { useAppStore } from "./useAppStore";
import { buildSyncBatches } from "./syncPlan";
import { rebuildBirdEventState } from "./rebuildAppState";

// Mutex for serializing IndexedDB writes. Prevents concurrent
// read-modify-write cycles from overwriting each other.
let idbQueue = Promise.resolve();
function idbMutex(fn: () => Promise<void>): Promise<void> {
  idbQueue = idbQueue.then(fn, fn);
  return idbQueue;
}

// Persist independent metadata. Bird events are written separately, and
// event-derived indexes are rebuilt rather than cached.
async function saveMapsToIndexedDB(overrides: Partial<Omit<DatabaseData, "birdEventsMap">>): Promise<void> {
  await idbMutex(() => saveDatabaseMetadataOnly(CURRENT_ENVIRONMENT, overrides));
}

async function updateMapTimestamp(mapName: IndependentMapName): Promise<void> {
  const now = Date.now();
  await set(ref(db, `${CURRENT_ENVIRONMENT}/metadata/lastModified_${mapName}`), now);
  // Mirror to IndexedDB so the next load's delta check sees the local cache
  // as current. Without this, the saver's next session re-downloads the
  // whole map it just edited.
  await saveMetadata(`lastModified_${mapName}_${CURRENT_ENVIRONMENT}`, now);
}

export async function refreshQueueState(): Promise<void> {
  const queued = await getQueuedEvents(CURRENT_ENVIRONMENT);
  useAppStore.setState({
    pendingCount: queued.length,
    queuedEventIds: new Set(
      queued.filter((p) => p.type === "bird-event").map((p) => (p as PendingBirdEvent).pendingEvent.id)
    ),
  });
}

async function getFirebaseNow(): Promise<number> {
  const offsetSnapshot = await get(ref(db, ".info/serverTimeOffset"));
  const offset = Number(offsetSnapshot.val());
  return Math.round(Date.now() + (Number.isFinite(offset) ? offset : 0));
}

async function loadMissingPredecessors(pendingEvents: PendingEvent[]): Promise<Map<string, BirdEvent>> {
  const pendingIds = new Set(
    pendingEvents
      .filter((pending): pending is PendingBirdEvent => pending.type === "bird-event")
      .map((pending) => pending.pendingEvent.id)
  );
  const missingIds = new Set<string>();

  for (const pending of pendingEvents) {
    if (pending.type !== "bird-event") continue;
    const previousEventId = pending.pendingEvent.previousEventId;
    if (previousEventId && !pendingIds.has(previousEventId) && !birdEventsStore.has(previousEventId)) {
      missingIds.add(previousEventId);
    }
  }

  const fetched = new Map<string, BirdEvent>();
  await Promise.all(
    [...missingIds].map(async (eventId) => {
      try {
        const snapshot = await get(ref(db, `${CURRENT_ENVIRONMENT}/birdEventsMap/${eventId}`));
        if (!snapshot.exists()) return;
        const event = snapshot.val() as BirdEvent;
        fetched.set(eventId, {
          ...event,
          band: new Band(event.band.bandPrefix, event.band.bandSuffix, event.band.bandSize ?? null),
        });
      } catch (err) {
        // Leave only this edit chain pending. Other independent captures can
        // still sync, and the predecessor lookup will retry on the next pass.
        logger.warn("SyncQueue", `Could not load predecessor ${eventId}`, err);
      }
    })
  );
  return fetched;
}

export async function syncQueue(): Promise<boolean> {
  if (!useAppStore.getState().isOnline) return false;

  try {
    while (useAppStore.getState().isOnline) {
      const pendingEvents = await getQueuedEvents(CURRENT_ENVIRONMENT);
      logger.sync("SyncQueue", `Syncing ${pendingEvents.length} pending events...`);
      if (pendingEvents.length === 0) return true;

      // syncedAt is a shared cursor, so correct the laptop clock with RTDB.
      const now = await getFirebaseNow();
      const fetchedPredecessors = await loadMissingPredecessors(pendingEvents);
      let successCount = 0;
      const batches = buildSyncBatches(
        pendingEvents,
        now,
        (environment, eventId) =>
          environment === CURRENT_ENVIRONMENT
            ? birdEventsStore.get(eventId) ?? fetchedPredecessors.get(eventId)
            : undefined,
        // RTDB updates are atomic. Isolate queue rows so one malformed event
        // cannot keep every independent capture in the pending state.
        1,
      );

      for (const batch of batches) {
        if (batch.missingPredecessorIds.length > 0) {
          logger.error(
            "SyncQueue",
            `Batch kept pending because predecessor events are missing: ${batch.missingPredecessorIds.join(", ")}`,
          );
          continue;
        }

        try {
          await update(ref(db), batch.updates);

          if (batch.birdEvents.length > 0) {
            birdEventsStore.setMany(batch.birdEvents);
            putBirdEvents(CURRENT_ENVIRONMENT, batch.birdEvents).catch((err) =>
              logger.error("SyncQueue", "Failed to persist synced state to IndexedDB", err)
            );
          }

          if (batch.dets.length > 0) {
            useAppStore.setState((state) => {
              const DETsMap = { ...state.DETsMap };
              for (const det of batch.dets) DETsMap[det.date] = det;
              return { DETsMap };
            });
            Promise.all([
              ...batch.dets.map((det) => updateDETInCache(CURRENT_ENVIRONMENT, det)),
              saveMetadata(`lastModified_DETsMap_${CURRENT_ENVIRONMENT}`, now),
            ]).catch((err) => logger.warn("SyncQueue", "Failed to cache synced DET state", err));
          }

          // Remove queue rows only after Firebase accepts the atomic batch.
          await removeManyFromQueue(batch.queueIds);
          successCount += batch.queueIds.length;
        } catch (err) {
          logger.error("SyncQueue", `Failed to sync batch of ${batch.queueIds.length} event(s)`, err);
        }
      }

      await refreshQueueState();
      const remainingCount = (await getQueuedEvents(CURRENT_ENVIRONMENT)).length;
      logger.sync("SyncQueue", "Sync completed", {
        succeeded: successCount,
        total: pendingEvents.length,
        remaining: remainingCount,
      });

      if (remainingCount === 0) return true;
      // All attempted entries succeeded, so the remainder arrived mid-sync.
      // Loop once more to drain it. Actual failures wait for reconnect/focus.
      if (successCount !== pendingEvents.length) return false;
    }
    return false;
  } catch (err) {
    logger.error("SyncQueue", "Error syncing queue", err);
    return false;
  }
}

let syncInFlight: Promise<boolean> | null = null;
let followUpSyncRequested = false;

async function getOrStartSync(): Promise<boolean> {
  followUpSyncRequested = true;
  while (true) {
    if (!syncInFlight) {
      syncInFlight = (async () => {
        let completed = false;
        do {
          followUpSyncRequested = false;
          completed = await syncQueue();
        } while (followUpSyncRequested && useAppStore.getState().isOnline);
        return completed;
      })().finally(() => {
        syncInFlight = null;
      });
    }

    const completed = await syncInFlight;
    // A request can arrive after the worker's final check but before its
    // promise settles. In that narrow window, start one last pass.
    if (!followUpSyncRequested) return completed;
  }
}

// showUi=false: silent sync used by auto-effect. showUi=true: explicit sync UI.
export async function runSync(showUi: boolean): Promise<boolean> {
  if (!useAppStore.getState().user) return false;
  if (showUi) useAppStore.setState({ isSyncing: true, syncResult: null });
  try {
    const completed = await getOrStartSync();
    if (showUi) useAppStore.setState({ syncResult: completed ? "success" : "error" });
    return completed;
  } catch {
    if (showUi) useAppStore.setState({ syncResult: "error" });
    return false;
  } finally {
    if (showUi) useAppStore.setState({ isSyncing: false });
  }
}

export const actions = {
  signOut: async (): Promise<void> => {
    await firebaseSignOut(auth);
  },

  selectProgram: (program: Program | null): void => {
    useAppStore.setState({ selectedProgram: program });
  },

  addProgram: (programId: string, year: string): void => {
    const trimmedId = programId.trim();
    if (!trimmedId) throw new Error("Program ID cannot be empty");
    const { programsMap, yearsToProgramMap } = useAppStore.getState();
    if (programsMap[trimmedId]) throw new Error(`Program "${trimmedId}" already exists`);

    const newProgram: Program = {
      id: trimmedId,
      displayName: trimmedId,
      bandGroupIds: [],
      recaptureIds: [],
    };
    useAppStore.setState({
      programsMap: { ...programsMap, [trimmedId]: newProgram },
      yearsToProgramMap: {
        ...yearsToProgramMap,
        [year]: yearsToProgramMap[year]?.includes(trimmedId)
          ? yearsToProgramMap[year]
          : [...(yearsToProgramMap[year] || []), trimmedId],
      },
    });
    logger.info("AddProgram", "Program added (local)", { programId: trimmedId, year });
  },

  addBirdEvent: async (
    captureData: CaptureFormData,
    bandSize: BandSize,
    previousEventId: string | undefined
  ): Promise<void> => {
    const state = useAppStore.getState();
    const {
      user,
      isOnline,
      programsMap,
      bandIdToBirdEventIdsMap,
      bandGroupsMap,
      yearsToProgramMap,
      volunteersMap,
      volunteerStatsMap,
      speciesAliasesMap,
      bandResetsMap,
    } = state;

    if (!user && isOnline) throw new Error("Must be logged in to add bird events");
    if (!captureData.bandGroup) throw new Error("Band group is required");
    if (!captureData.bandLastTwoDigits) throw new Error("Band digit is required");
    if (!captureData.species) throw new Error("Species is required");
    if (!programsMap[captureData.programId]) {
      throw new Error(`Program "${captureData.programId}" not found`);
    }

    try {
      const birdEventType = captureData.birdEventType as BirdEventType;
      const bandGroup = captureData.bandGroup.padStart(7, "0");
      const bandLastTwoDigits = captureData.bandLastTwoDigits.padStart(2, "0");
      const bandPrefix = bandGroup.substring(0, 4);
      const bandSuffix = bandGroup.substring(4) + bandLastTwoDigits;
      const band = new Band(bandPrefix, bandSuffix, bandSize !== BandSize.Other ? bandSize : null);
      const isNewCapture = birdEventType === BirdEventType.Banded || birdEventType === BirdEventType.None;
      const previousEvent = previousEventId ? birdEventsStore.get(previousEventId) : undefined;
      if (previousEvent && !isBirdEventInCurrentBandGeneration(previousEvent, bandResetsMap)) {
        throw new Error("This event belongs to history that was hidden by a band reset and can no longer be edited");
      }
      if (bandResetsMap[band.id]) {
        const hasCurrentGenerationBanding = (bandIdToBirdEventIdsMap[band.id] ?? []).some((id) => {
          const event = birdEventsStore.get(id);
          return (
            !!event &&
            isActiveBirdEvent(event, bandResetsMap) &&
            (event.birdEventType === BirdEventType.Banded || event.birdEventType === BirdEventType.None)
          );
        });
        if (!hasCurrentGenerationBanding && !isNewCapture) {
          throw new Error("A reset band must begin with a new banding event");
        }
      }
      // Normalize codes to uppercase so new events don't create case-variant duplicates.
      const normalizedSpeciesKey = resolveSpeciesKey(captureData.species, speciesAliasesMap);
      const normalizedBander = (captureData.bander ?? "").toUpperCase();
      const normalizedScribe = (captureData.scribe ?? "").toUpperCase();

      // If modifying a still-queued event, swap the pending entry instead of
      // creating a modification chain — the target never reached RTDB.
      let replacingPendingId: string | undefined;
      if (previousEventId) {
        const queuedEntries = await getQueuedEvents(CURRENT_ENVIRONMENT);
        const match = queuedEntries.find(
          (p) => p.type === "bird-event" && (p as PendingBirdEvent).pendingEvent.id === previousEventId
        );
        if (match) replacingPendingId = match.id;
      }

      const bandGenerationId = bandResetsMap[band.id]?.generationId;
      let newEventId = generateBirdEventId(
        band.id,
        captureData.date,
        captureData.net,
        captureData.wing,
        captureData.weight,
        previousEventId !== undefined && !replacingPendingId
      );
      // A reset band can legitimately be entered with the exact values of
      // its hidden predecessor. Never overwrite that preserved event.
      if (!previousEventId && birdEventsStore.has(newEventId)) {
        const suffix = bandGenerationId ? `Reset${bandGenerationId}` : `At${Date.now()}`;
        newEventId = `${newEventId}${suffix}`;
        while (birdEventsStore.has(newEventId)) newEventId = `${newEventId}-${crypto.randomUUID()}`;
      }

      const newBirdEvent: BirdEvent = {
        id: newEventId,
        programId: captureData.programId,
        band,
        species: normalizedSpeciesKey,
        wing: captureData.wing ? Number(captureData.wing) : 0,
        age: captureData.age,
        howAged: captureData.howAged,
        sex: captureData.sex,
        howSexed: captureData.howSexed,
        fat: captureData.fat ? Number(captureData.fat) : 0,
        weight: captureData.weight ? Number(captureData.weight) : 0,
        date: captureData.date,
        time: captureData.time,
        bander: normalizedBander,
        scribe: normalizedScribe,
        net: captureData.net,
        birdStatus: captureData.birdStatus,
        notes: captureData.notes,
        reminder: captureData.reminder,
        bandGenerationId,
        previousEventId: replacingPendingId ? null : previousEventId || null,
        modifiedEventId: null,
        birdEventType,
        // Date.now() (ms) rather than captureDate+time so rapid sequential
        // saves can be distinguished — bandSizeToBandIdMap's "latest" lookup
        // used to break on same-minute ties.
        updatedAt: String(Date.now()),
      };

      const newQueueEntry: PendingBirdEvent = {
        id: crypto.randomUUID(),
        type: "bird-event",
        pendingEvent: newBirdEvent,
        timestamp: Date.now(),
        environment: CURRENT_ENVIRONMENT,
        action: replacingPendingId ? "added" : previousEventId ? "modified" : "added",
      };
      const queuePromise = replacingPendingId
        ? replaceInQueue(replacingPendingId, newQueueEntry)
        : addToQueue(newQueueEntry);

      // The queue is the durable source of truth until Firebase syncs. Do
      // not report a successful save (or clear the entry form) until this
      // write completes, especially while offline.
      await queuePromise;

      // Snapshot the predecessor BEFORE mutating the store, so downstream
      // dedup/decrement logic can see its pre-modification state regardless
      // of whether we're doing a queued-swap or a modification chain.
      const oldEvent = previousEventId ? (birdEventsStore.get(previousEventId) ?? null) : null;

      // Mutate birdEventsStore in place (O(1) — no 700K-entry spread).
      if (replacingPendingId && previousEventId && previousEventId !== newBirdEvent.id) {
        birdEventsStore.delete(previousEventId);
      } else if (!replacingPendingId && previousEventId) {
        const existing = birdEventsStore.get(previousEventId);
        if (existing) {
          birdEventsStore.set({ ...existing, modifiedEventId: newBirdEvent.id });
        }
      }
      birdEventsStore.set(newBirdEvent);

      // Update derived maps. The predecessor needs to disappear from every
      // "live" aggregate (new-capture lists, recapture lists, volunteer
      // counts) because rebuild filters `modifiedEventId`-stamped events
      // out. Without stripping here, the incremental path would diverge
      // from the post-reload rebuild.
      //
      // Queued-swap path also strips from bandIdToBirdEventIdsMap since the
      // predecessor row gets deleted outright. Modification-chain path
      // keeps the predecessor in bandIdToBirdEventIdsMap — rebuild does too
      // (that map is used to walk modification history).
      const strippedBandIds =
        replacingPendingId && previousEventId
          ? (bandIdToBirdEventIdsMap[band.id] || []).filter((id) => id !== previousEventId)
          : bandIdToBirdEventIdsMap[band.id] || [];
      const newBandIdToBirdEventIdsMap = {
        ...bandIdToBirdEventIdsMap,
        [band.id]: [...strippedBandIds, newBirdEvent.id],
      };

      const newBandGroupsMap = { ...bandGroupsMap };
      const bgKey = getBandGroupMapKey(band);
      const oldWasNewCapture = oldEvent
        ? oldEvent.birdEventType === BirdEventType.Banded || oldEvent.birdEventType === BirdEventType.None
        : false;
      const oldBgKey =
        oldEvent?.band?.bandPrefix && oldEvent?.band?.bandSuffix
          ? getBandGroupMapKey(new Band(oldEvent.band.bandPrefix, oldEvent.band.bandSuffix))
          : null;

      // Strip the predecessor from its OLD bgKey's newCaptureIds (may
      // differ from the new bgKey if the band was edited).
      if (oldEvent && oldWasNewCapture && oldBgKey) {
        const oldGroupIds = bandGroupsMap[oldBgKey]?.newCaptureIds || [];
        const stripped = oldGroupIds.filter((id) => id !== previousEventId);
        if (stripped.length > 0) {
          newBandGroupsMap[oldBgKey] = { id: oldBgKey, newCaptureIds: stripped };
        } else if (bandGroupsMap[oldBgKey]) {
          delete newBandGroupsMap[oldBgKey];
        }
      }

      // Add the new event to its (possibly new) bgKey's newCaptureIds.
      const targetNewCaptureIds =
        (oldBgKey === bgKey ? newBandGroupsMap[bgKey]?.newCaptureIds : bandGroupsMap[bgKey]?.newCaptureIds) || [];
      if (isNewCapture) {
        newBandGroupsMap[bgKey] = {
          id: bgKey,
          newCaptureIds: [...targetNewCaptureIds, newBirdEvent.id],
        };
      } else if (targetNewCaptureIds.length > 0 && oldBgKey !== bgKey) {
        // Not a new capture and the new event's bgKey already exists —
        // preserve the existing entry untouched.
        newBandGroupsMap[bgKey] = {
          id: bgKey,
          newCaptureIds: targetNewCaptureIds,
        };
      }

      const existingProgram = programsMap[captureData.programId]!;
      const year = captureData.date.substring(0, 4);
      const eventDate = captureData.date;

      // Strip predecessor from recaptureIds whenever it was a recapture,
      // regardless of queued vs non-queued.
      const strippedRecaptureIds =
        oldEvent && !oldWasNewCapture
          ? existingProgram.recaptureIds.filter((id) => id !== previousEventId)
          : existingProgram.recaptureIds;

      // `bandGroupIds` may need `bgKey` removed if this modify drained the
      // old group's only new capture. Rebuild only includes a bgKey while a
      // non-modified new capture references it.
      let nextBandGroupIds = existingProgram.bandGroupIds;
      if (oldEvent && oldWasNewCapture && oldBgKey && !newBandGroupsMap[oldBgKey]) {
        nextBandGroupIds = nextBandGroupIds.filter((id) => id !== oldBgKey);
      }
      if (isNewCapture && !nextBandGroupIds.includes(bgKey)) {
        nextBandGroupIds = [...nextBandGroupIds, bgKey];
      }

      // first/lastCaptureDate: incremental bound-tightening only. Can't
      // shrink without a full rescan, which would defeat the incremental
      // path. Rebuild recomputes exactly on next load, so temporary
      // staleness after an edit that narrows the range is self-healing.
      const newProgramsMap = {
        ...programsMap,
        [captureData.programId]: {
          ...existingProgram,
          bandGroupIds: nextBandGroupIds,
          recaptureIds: !isNewCapture ? [...strippedRecaptureIds, newBirdEvent.id] : strippedRecaptureIds,
          firstCaptureDate:
            !existingProgram.firstCaptureDate || eventDate < existingProgram.firstCaptureDate
              ? eventDate
              : existingProgram.firstCaptureDate,
          lastCaptureDate:
            !existingProgram.lastCaptureDate || eventDate > existingProgram.lastCaptureDate
              ? eventDate
              : existingProgram.lastCaptureDate,
        },
      };

      const existingProgramsInYear = yearsToProgramMap[year] || [];
      const newYearsToProgramMap = {
        ...yearsToProgramMap,
        [year]: existingProgramsInYear.includes(captureData.programId)
          ? existingProgramsInYear
          : [...existingProgramsInYear, captureData.programId],
      };

      // Volunteer counts. Replace: decrement old before incrementing new.
      const newVolunteerStatsMap = { ...volunteerStatsMap };
      if (oldEvent) {
        if (oldEvent.bander && oldWasNewCapture) {
          const existing = newVolunteerStatsMap[oldEvent.bander];
          if (existing) {
            newVolunteerStatsMap[oldEvent.bander] = {
              ...existing,
              totalBanded: Math.max(0, existing.totalBanded - 1),
            };
          }
        }
        if (oldEvent.scribe) {
          const existing = newVolunteerStatsMap[oldEvent.scribe];
          if (existing) {
            newVolunteerStatsMap[oldEvent.scribe] = {
              ...existing,
              totalScribed: Math.max(0, existing.totalScribed - 1),
            };
          }
        }
      }
      let milestoneSet: { banderCode: string; count: number } | null = null;
      if (normalizedBander && isNewCapture) {
        const existing = newVolunteerStatsMap[normalizedBander] ?? {
          code: normalizedBander,
          fullName: volunteersMap[normalizedBander]?.fullName ?? "",
          observerClass: volunteersMap[normalizedBander]?.observerClass ?? 3,
          totalBanded: 0,
          totalScribed: 0,
        };
        const oldCount = existing.totalBanded;
        newVolunteerStatsMap[normalizedBander] = { ...existing, totalBanded: oldCount + 1 };
        // Only fire the milestone if this bander wasn't already credited for
        // the predecessor. When modifying a same-bander new capture, the
        // decrement above dropped the count from N→N−1 and we're taking it
        // back to N — no new threshold crossed, just a restore.
        const previouslyCreditedSameBander = oldEvent?.bander === normalizedBander && oldWasNewCapture;
        if (!previouslyCreditedSameBander && Math.floor((oldCount + 1) / 1000) > Math.floor(oldCount / 1000)) {
          milestoneSet = { banderCode: normalizedBander, count: oldCount + 1 };
        }
      }
      if (normalizedScribe) {
        const existing = newVolunteerStatsMap[normalizedScribe] ?? {
          code: normalizedScribe,
          fullName: volunteersMap[normalizedScribe]?.fullName ?? "",
          observerClass: volunteersMap[normalizedScribe]?.observerClass ?? 3,
          totalBanded: 0,
          totalScribed: 0,
        };
        newVolunteerStatsMap[normalizedScribe] = {
          ...existing,
          totalScribed: existing.totalScribed + 1,
        };
      }

      // Incrementally update bandSizeToBandIdMap. Naive next = advance(just-
      // banded id); if bander saved out of order (e.g. -00 of strip N after
      // -01..03 of N+1), naive would be already banded — resolve via actual
      // max in the NEXT strip.
      const newBandSizeToBandIdMap = { ...state.bandSizeToBandIdMap };
      if (isNewCapture && band.bandSize && band.bandSize !== BandSize.Other && !previousEventId) {
        const naiveNext = advanceBandId(band.id);
        let resolvedNext: string | null = naiveNext;
        if (naiveNext && naiveNext.length === 9) {
          const nextBand = new Band(naiveNext.slice(0, 4), naiveNext.slice(4, 9));
          const nextStripKey = getBandGroupMapKey(nextBand);
          const stripGroup = newBandGroupsMap[nextStripKey];
          if (stripGroup) {
            let max = 0;
            for (const eventId of stripGroup.newCaptureIds) {
              const ev = birdEventsStore.get(eventId);
              if (!ev?.band) continue;
              const last2 = parseInt(ev.band.bandSuffix.slice(-2), 10);
              if (Number.isNaN(last2)) continue;
              const encoded = last2 === 0 ? 100 : last2;
              if (encoded > max) max = encoded;
            }
            if (max > 0) {
              const prefixNum = parseInt(nextStripKey, 10);
              const latestBandId =
                max === 100
                  ? (prefixNum + 1).toString().padStart(7, "0") + "00"
                  : nextStripKey + max.toString().padStart(2, "0");
              resolvedNext = advanceBandId(latestBandId);
            }
          }
        }
        if (resolvedNext) newBandSizeToBandIdMap[band.bandSize] = resolvedNext;
      }

      // Keep queuedEventIds in sync with the queue mutation we just issued,
      // so downstream gates (Edit visibility etc.) don't see a stale set
      // while refreshQueueState() races the next render.
      const nextQueuedIds = new Set(state.queuedEventIds);
      if (previousEventId) nextQueuedIds.delete(previousEventId);
      nextQueuedIds.add(newBirdEvent.id);

      const currentSelected = state.selectedProgram;
      const nextSelectedProgram =
        currentSelected && currentSelected.id === captureData.programId
          ? newProgramsMap[captureData.programId]
          : currentSelected;

      useAppStore.setState({
        bandIdToBirdEventIdsMap: newBandIdToBirdEventIdsMap,
        bandGroupsMap: newBandGroupsMap,
        programsMap: newProgramsMap,
        yearsToProgramMap: newYearsToProgramMap,
        volunteerStatsMap: newVolunteerStatsMap,
        bandSizeToBandIdMap: newBandSizeToBandIdMap,
        queuedEventIds: nextQueuedIds,
        pendingCount: replacingPendingId ? state.pendingCount : state.pendingCount + 1,
        selectedProgram: nextSelectedProgram,
        isSaving: true,
        ...(milestoneSet ? { milestone: milestoneSet } : {}),
      });

      // Persist only the changed event rows. The derived index maps are
      // rebuilt from these rows on every load, so writing them here would
      // needlessly serialize the large bandId index after every save.
      const eventWrites: BirdEvent[] = [newBirdEvent];
      if (!replacingPendingId && previousEventId) {
        const prev = birdEventsStore.get(previousEventId);
        if (prev) eventWrites.push(prev);
      }
      const droppedEventId =
        replacingPendingId && previousEventId && previousEventId !== newBirdEvent.id ? previousEventId : null;
      const persistTail = queuePromise
        .then(() =>
          Promise.all([
            putBirdEvents(CURRENT_ENVIRONMENT, eventWrites),
            droppedEventId ? deleteBirdEvent(CURRENT_ENVIRONMENT, droppedEventId) : Promise.resolve(),
            refreshQueueState(),
          ])
        )
        .catch((err) => logger.error("AddBirdEvent", "IndexedDB save failed", err));

      const syncTail = isOnline
        ? queuePromise
            .then(() => runSync(false))
            .catch((err) => logger.warn("AddBirdEvent", "Online sync failed — will retry on next sync", err))
        : Promise.resolve();

      // Clear isSaving once both persistence and (if online) RTDB sync are
      // done, so UI gated on it (Add + button, etc) re-enables only when
      // the work is actually finished.
      Promise.all([persistTail, syncTail]).finally(() => {
        useAppStore.setState({ isSaving: false });
      });
      logger.info("AddBirdEvent", "Bird event added", {
        eventId: newBirdEvent.id,
        programId: captureData.programId,
      });
    } catch (err) {
      logger.error("AddBirdEvent", "Error adding bird event", err);
      throw err;
    }
  },

  syncQueue: () => runSync(true),

  resetBand: async (bandId: string): Promise<void> => {
    const state = useAppStore.getState();
    if (!state.user) throw new Error("Must be logged in to reset a band");
    if (!state.isAdmin) throw new Error("Only administrators can reset a band");
    if (!state.isOnline) throw new Error("Cannot reset a band while offline");
    if (!/^\d{9}$/.test(bandId)) throw new Error("Band ID must contain exactly 9 digits");

    const resetAt = Date.now();
    const nextBandResetsMap = {
      ...state.bandResetsMap,
      [bandId]: { generationId: crypto.randomUUID(), resetAt },
    };

    await update(ref(db), {
      [`${CURRENT_ENVIRONMENT}/bandResetsMap/${bandId}`]: nextBandResetsMap[bandId],
      [`${CURRENT_ENVIRONMENT}/metadata/lastModified_bandResetsMap`]: resetAt,
    });

    const rebuilt = rebuildBirdEventState(birdEventsStore.getAll(), state, nextBandResetsMap);

    useAppStore.setState({
      bandResetsMap: nextBandResetsMap,
      ...rebuilt,
    });
    await Promise.all([
      saveMetadata(`lastModified_bandResetsMap_${CURRENT_ENVIRONMENT}`, resetAt),
      saveMapsToIndexedDB({
        bandResetsMap: nextBandResetsMap,
        bandIdToBirdEventIdsMap: rebuilt.bandIdToBirdEventIdsMap,
        bandGroupsMap: rebuilt.bandGroupsMap,
        programsMap: rebuilt.programsMap,
        yearsToProgramMap: rebuilt.yearsToProgramMap,
        bandSizeToBandIdMap: rebuilt.bandSizeToBandIdMap,
      }),
    ]);
    logger.info("BandReset", "Band reset", { bandId, generationId: nextBandResetsMap[bandId].generationId });
  },

  clearSyncResult: (): void => {
    useAppStore.setState({ syncResult: null });
  },

  dismissConflict: async (conflictId: string): Promise<void> => {
    const { user, isOnline, dismissedConflictsMap } = useAppStore.getState();
    if (!user) throw new Error("Must be logged in to dismiss conflicts");
    if (!isOnline) throw new Error("Cannot dismiss conflicts while offline");

    try {
      const next = { ...dismissedConflictsMap, [conflictId]: true };
      useAppStore.setState({ dismissedConflictsMap: next });
      await saveMapsToIndexedDB({ dismissedConflictsMap: next });
      await set(ref(db, `${CURRENT_ENVIRONMENT}/dismissedConflictsMap/${conflictId}`), true);
      await updateMapTimestamp("dismissedConflictsMap");
      logger.info("DismissConflict", `Conflict ${conflictId} dismissed`);
    } catch (err) {
      logger.error("DismissConflict", `Error dismissing conflict ${conflictId}`, err);
      throw err;
    }
  },

  resetDismissedConflicts: async (): Promise<void> => {
    const { user, isOnline } = useAppStore.getState();
    if (!user) throw new Error("Must be logged in to reset dismissed conflicts");
    if (!isOnline) throw new Error("Cannot reset dismissed conflicts while offline");

    try {
      useAppStore.setState({ dismissedConflictsMap: {} });
      await saveMapsToIndexedDB({ dismissedConflictsMap: {} });
      await set(ref(db, `${CURRENT_ENVIRONMENT}/dismissedConflictsMap`), null);
      await updateMapTimestamp("dismissedConflictsMap");
      logger.info("ResetDismissedConflicts", "All dismissed conflicts reset");
    } catch (err) {
      logger.error("ResetDismissedConflicts", "Error resetting dismissed conflicts", err);
      throw err;
    }
  },

  saveDET: async (det: DET, { overwrite = false }: { overwrite?: boolean } = {}): Promise<void> => {
    const { user, isOnline, DETsMap } = useAppStore.getState();
    if (!user) throw new Error("Must be logged in to save DET");
    if (!isOnline) throw new Error("Cannot save DETs while offline");
    if (!overwrite && DETsMap[det.date]) {
      throw new Error(`A DET already exists for ${det.date}. Open it and use Edit instead.`);
    }

    try {
      const detPath = `${CURRENT_ENVIRONMENT}/DETsMap/${det.date}`;
      if (!overwrite && (await get(ref(db, detPath))).exists()) {
        throw new Error(`A DET already exists for ${det.date}. Open it and use Edit instead.`);
      }

      const savedDET = stripUndefined(det);
      const lastModified = Date.now();
      await update(ref(db), {
        [detPath]: savedDET,
        [`${CURRENT_ENVIRONMENT}/metadata/lastModified_DETsMap`]: lastModified,
      });
      logger.info("SaveDET", `DET for ${det.date} synced to RTDB`);

      useAppStore.setState((state) => ({ DETsMap: { ...state.DETsMap, [savedDET.date]: savedDET } }));
      try {
        await updateDETInCache(CURRENT_ENVIRONMENT, savedDET);
        await saveMetadata(`lastModified_DETsMap_${CURRENT_ENVIRONMENT}`, lastModified);
        logger.info("SaveDET", `DET for ${det.date} saved to IndexedDB`);
      } catch (cacheError) {
        logger.warn("SaveDET", `DET for ${det.date} was saved remotely but could not be cached`, cacheError);
      }
    } catch (err) {
      logger.error("SaveDET", `Error saving DET for ${det.date}`, err);
      throw err;
    }
  },

  updateVolunteer: async (code: string, fullName: string, observerClass: ObserverClass): Promise<void> => {
    const state = useAppStore.getState();
    if (!state.user) throw new Error("Must be logged in to update volunteer");
    if (!state.isOnline) throw new Error("Cannot update volunteers while offline");

    try {
      const trimmed = fullName.trim();
      const newVolunteersMap = {
        ...state.volunteersMap,
        [code]: { fullName: trimmed, observerClass },
      };
      const existingStats = state.volunteerStatsMap[code];
      const newVolunteerStatsMap = existingStats
        ? {
            ...state.volunteerStatsMap,
            [code]: { ...existingStats, fullName: trimmed, observerClass },
          }
        : state.volunteerStatsMap;
      useAppStore.setState({
        volunteersMap: newVolunteersMap,
        volunteerStatsMap: newVolunteerStatsMap,
      });

      await set(ref(db, `${CURRENT_ENVIRONMENT}/volunteersMap/${code}`), { fullName: trimmed, observerClass });
      await updateMapTimestamp("volunteersMap");
      await saveMapsToIndexedDB({
        volunteersMap: newVolunteersMap,
      });
    } catch (err) {
      logger.error("UpdateVolunteer", `Error updating volunteer ${code}`, err);
      throw err;
    }
  },

  updateBandGroupNote: async (bandGroupId: string, note: string): Promise<void> => {
    const { user, isOnline, bandGroupNotesMap } = useAppStore.getState();
    if (!user) throw new Error("Must be logged in to update band group notes");
    if (!isOnline) throw new Error("Cannot update band group notes while offline");

    try {
      const trimmed = note.trim();
      const newNotesMap = { ...bandGroupNotesMap, [bandGroupId]: trimmed };
      if (!trimmed) delete newNotesMap[bandGroupId];

      useAppStore.setState({ bandGroupNotesMap: newNotesMap });
      await set(ref(db, `${CURRENT_ENVIRONMENT}/bandGroupNotesMap/${bandGroupId}`), trimmed || null);
      await updateMapTimestamp("bandGroupNotesMap");
      await saveMapsToIndexedDB({ bandGroupNotesMap: newNotesMap });
    } catch (err) {
      logger.error("UpdateBandGroupNote", `Error updating note for ${bandGroupId}`, err);
      throw err;
    }
  },

  updateSpeciesAlias: async (speciesKey: string, aliasCode: string | null): Promise<void> => {
    const { user, isOnline, speciesAliasesMap } = useAppStore.getState();
    if (!user) throw new Error("Must be logged in to update species aliases");
    if (!isOnline) throw new Error("Cannot update species aliases while offline");

    if (!SPECIES_MAP[speciesKey]) throw new Error(`Species "${speciesKey}" not found`);
    const alias = aliasCode?.trim().toUpperCase() ?? "";
    if (alias && !/^[A-Z]{4}$/.test(alias)) throw new Error("Alias must be a 4-letter code");
    if (alias && SPECIES_KEY_BY_CURRENT_CODE[alias]) throw new Error(`"${alias}" is already a current species code`);

    try {
      const next = { ...speciesAliasesMap };
      if (alias) next[speciesKey] = alias;
      else delete next[speciesKey];

      useAppStore.setState({
        speciesAliasesMap: next,
        speciesInfoMap: computeSpeciesInfoMap(birdEventsStore.getAll(), next, useAppStore.getState().bandResetsMap),
      });
      await set(ref(db, `${CURRENT_ENVIRONMENT}/speciesAliasesMap/${speciesKey}`), alias || null);
      await updateMapTimestamp("speciesAliasesMap");
      await saveMapsToIndexedDB({ speciesAliasesMap: next });
    } catch (err) {
      logger.error("UpdateSpeciesAlias", `Error updating species alias ${speciesKey}`, err);
      throw err;
    }
  },

  updateSpeciesMetadata: async (
    speciesKey: string,
    aliasCode: string | null,
    names: Pick<
      Species,
      "speciesDescriptionMBO" | "speciesDescriptionCMMN" | "speciesFrench" | "speciesScientific"
    >
  ): Promise<void> => {
    const { user, isOnline, speciesAliasesMap, magicTable } = useAppStore.getState();
    if (!user) throw new Error("Must be logged in to update species metadata");
    if (!isOnline) throw new Error("Cannot update species metadata while offline");

    const key = speciesKey.trim().toUpperCase();
    const species = magicTable.species[key] ?? SPECIES_MAP[key];
    if (!species) throw new Error(`Species "${speciesKey}" not found`);

    const alias = aliasCode?.trim().toUpperCase() ?? "";
    if (alias && !/^[A-Z]{4}$/.test(alias)) throw new Error("Alias must be a 4-letter code");
    if (alias && SPECIES_KEY_BY_CURRENT_CODE[alias] && SPECIES_KEY_BY_CURRENT_CODE[alias] !== key) {
      throw new Error(`"${alias}" is already a current species code`);
    }
    const aliasOwner = Object.entries(speciesAliasesMap).find(([, value]) => value === alias)?.[0];
    if (alias && aliasOwner && aliasOwner !== key) throw new Error(`"${alias}" is already used as an alias`);

    const updatedSpecies: Species = {
      ...species,
      speciesDescriptionMBO: names.speciesDescriptionMBO.trim(),
      speciesDescriptionCMMN: names.speciesDescriptionCMMN.trim(),
      speciesFrench: names.speciesFrench.trim(),
      speciesScientific: names.speciesScientific.trim(),
    };

    try {
      const nextAliases = { ...speciesAliasesMap };
      if (alias) nextAliases[key] = alias;
      else delete nextAliases[key];

      const nextMagicTable = {
        ...magicTable,
        species: {
          ...magicTable.species,
          [key]: updatedSpecies,
        },
      };
      setSpeciesMap(nextMagicTable.species);

      useAppStore.setState({
        magicTable: nextMagicTable,
        speciesAliasesMap: nextAliases,
        speciesInfoMap: computeSpeciesInfoMap(
          birdEventsStore.getAll(),
          nextAliases,
          useAppStore.getState().bandResetsMap
        ),
      });
      await update(ref(db), {
        [`${CURRENT_ENVIRONMENT}/speciesAliasesMap/${key}`]: alias || null,
        [`${CURRENT_ENVIRONMENT}/magicTable/species/${key}`]: updatedSpecies,
      });
      await Promise.all([updateMapTimestamp("speciesAliasesMap"), updateMapTimestamp("magicTable")]);
      await saveMapsToIndexedDB({ speciesAliasesMap: nextAliases, magicTable: nextMagicTable });
    } catch (err) {
      logger.error("UpdateSpeciesMetadata", `Error updating species metadata ${key}`, err);
      throw err;
    }
  },

  clearMilestone: (): void => {
    useAppStore.setState({ milestone: null });
  },

  triggerTestMilestone: (): void => {
    useAppStore.setState({ milestone: { banderCode: "TST", count: 3000 } });
  },
};

export type Actions = typeof actions;

// Actions live at module scope and never change reference, so this hook
// is effectively a constant lookup — destructuring the result is safe.
export const useActions = (): Actions => actions;
