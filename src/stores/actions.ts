import { ref, set, update } from "firebase/database";
import { signOut as firebaseSignOut } from "firebase/auth";
import { auth, CURRENT_ENVIRONMENT, db } from "../firebase";
import {
  addToQueue,
  deleteBirdEvent,
  getQueueCount,
  getQueuedEvents,
  putBirdEvents,
  removeFromQueue,
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
  type PendingBirdEvent,
  type Program,
} from "../types";
import { type IndependentMapName } from "../types/mapNames";
import { advanceBandId } from "./derive";
import { useAppStore } from "./useAppStore";

// Mutex for serializing IndexedDB writes. Prevents concurrent
// read-modify-write cycles from overwriting each other.
let idbQueue = Promise.resolve();
function idbMutex(fn: () => Promise<void>): Promise<void> {
  idbQueue = idbQueue.then(fn, fn);
  return idbQueue;
}

// Persist only the small index maps. Bird events are written separately
// via putBirdEvent — they don't need to be re-serialized on every save.
async function saveMapsToIndexedDB(
  overrides: Partial<Omit<DatabaseData, "birdEventsMap">>,
): Promise<void> {
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
  const queued = await getQueuedEvents();
  useAppStore.setState({
    pendingCount: queued.length,
    queuedEventIds: new Set(
      queued
        .filter((p) => p.type === "bird-event")
        .map((p) => (p as PendingBirdEvent).pendingEvent.id),
    ),
  });
}

export async function syncQueue(): Promise<void> {
  if (!useAppStore.getState().isOnline) return;

  try {
    const pendingEvents = await getQueuedEvents();
    logger.sync("SyncQueue", `Syncing ${pendingEvents.length} pending events...`);
    const now = Date.now();

    // Multi-path update: new event + predecessor's modifiedEventId land atomically.
    let successCount = 0;
    const syncedBirdEvents: BirdEvent[] = [];
    for (const pending of pendingEvents) {
      try {
        if (pending.type === "bird-event") {
          const birdEvent = pending.pendingEvent as BirdEvent;
          const updates: Record<string, unknown> = {
            [`${pending.environment}/birdEventsMap/${birdEvent.id}`]: { ...birdEvent, syncedAt: now },
          };
          if (birdEvent.previousEventId) {
            updates[`${pending.environment}/birdEventsMap/${birdEvent.previousEventId}/modifiedEventId`] =
              birdEvent.id;
            updates[`${pending.environment}/birdEventsMap/${birdEvent.previousEventId}/syncedAt`] = now;
          }
          await update(ref(db), updates);
          syncedBirdEvents.push(birdEvent);
        }
        await removeFromQueue(pending.id);
        successCount++;
      } catch (err) {
        logger.error("SyncQueue", `Failed to sync event ${pending.id}`, err);
      }
    }

    // Mirror RTDB state back into the store so UI reflects syncedAt without
    // waiting for full reload. syncedAt / modifiedEventId changes don't
    // affect rebuildMapsFromEvents — no rebuild needed.
    if (syncedBirdEvents.length > 0) {
      const updates: BirdEvent[] = [];
      for (const ev of syncedBirdEvents) {
        const existing = birdEventsStore.get(ev.id) ?? ev;
        updates.push({ ...existing, syncedAt: now });
        if (ev.previousEventId) {
          const prev = birdEventsStore.get(ev.previousEventId);
          if (prev) {
            updates.push({ ...prev, modifiedEventId: ev.id, syncedAt: now });
          }
        }
      }
      birdEventsStore.setMany(updates);
      // Per-event batch write — no 700K-entry blob to re-serialize.
      putBirdEvents(CURRENT_ENVIRONMENT, updates).catch((err) =>
        logger.error("SyncQueue", "Failed to persist synced state to IndexedDB", err),
      );
    }

    await refreshQueueState();
    const remainingCount = await getQueueCount();
    logger.sync("SyncQueue", `Sync completed`, {
      succeeded: successCount,
      total: pendingEvents.length,
      remaining: remainingCount,
    });
  } catch (err) {
    logger.error("SyncQueue", "Error syncing queue", err);
  }
}

let syncInFlight = false;
// showUi=false: silent sync used by auto-effect. showUi=true: explicit sync UI.
export async function runSync(showUi: boolean): Promise<void> {
  if (!useAppStore.getState().user) return;
  if (syncInFlight) return;
  syncInFlight = true;
  if (showUi) useAppStore.setState({ isSyncing: true, syncResult: null });
  try {
    await syncQueue();
    if (showUi) useAppStore.setState({ syncResult: "success" });
  } catch {
    if (showUi) useAppStore.setState({ syncResult: "error" });
  } finally {
    if (showUi) useAppStore.setState({ isSyncing: false });
    syncInFlight = false;
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
    previousEventId: string | undefined,
  ): Promise<void> => {
    const state = useAppStore.getState();
    const { user, isOnline, programsMap, bandIdToBirdEventIdsMap, bandGroupsMap,
      yearsToProgramMap, volunteersMap, volunteersFullNameMap } = state;

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
      const isNewCapture =
        birdEventType === BirdEventType.Banded || birdEventType === BirdEventType.None;
      // Normalize codes to uppercase so new events don't create case-variant duplicates.
      const normalizedBander = (captureData.bander ?? "").toUpperCase();
      const normalizedScribe = (captureData.scribe ?? "").toUpperCase();

      // If modifying a still-queued event, swap the pending entry instead of
      // creating a modification chain — the target never reached RTDB.
      let replacingPendingId: string | undefined;
      if (previousEventId) {
        const queuedEntries = await getQueuedEvents();
        const match = queuedEntries.find(
          (p) => p.type === "bird-event" && (p as PendingBirdEvent).pendingEvent.id === previousEventId,
        );
        if (match) replacingPendingId = match.id;
      }

      const newBirdEvent: BirdEvent = {
        id: generateBirdEventId(
          band.id,
          captureData.date,
          captureData.net,
          captureData.wing,
          captureData.weight,
          previousEventId !== undefined && !replacingPendingId,
        ),
        programId: captureData.programId,
        band,
        species: captureData.species,
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

      // Snapshot the predecessor BEFORE mutating the store, so downstream
      // dedup/decrement logic can see its pre-modification state regardless
      // of whether we're doing a queued-swap or a modification chain.
      const oldEvent = previousEventId
        ? birdEventsStore.get(previousEventId) ?? null
        : null;

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
        ? oldEvent.birdEventType === BirdEventType.Banded ||
          oldEvent.birdEventType === BirdEventType.None
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
          recaptureIds: !isNewCapture
            ? [...strippedRecaptureIds, newBirdEvent.id]
            : strippedRecaptureIds,
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
      const newVolunteersMap = { ...volunteersMap };
      if (oldEvent) {
        if (oldEvent.bander && oldWasNewCapture) {
          const existing = newVolunteersMap[oldEvent.bander];
          if (existing) {
            newVolunteersMap[oldEvent.bander] = {
              ...existing,
              totalBanded: Math.max(0, existing.totalBanded - 1),
            };
          }
        }
        if (oldEvent.scribe) {
          const existing = newVolunteersMap[oldEvent.scribe];
          if (existing) {
            newVolunteersMap[oldEvent.scribe] = {
              ...existing,
              totalScribed: Math.max(0, existing.totalScribed - 1),
            };
          }
        }
      }
      let milestoneSet: { banderCode: string; count: number } | null = null;
      if (normalizedBander && isNewCapture) {
        const existing = newVolunteersMap[normalizedBander] ?? {
          code: normalizedBander,
          fullName: volunteersFullNameMap[normalizedBander] ?? "",
          totalBanded: 0,
          totalScribed: 0,
        };
        const oldCount = existing.totalBanded;
        newVolunteersMap[normalizedBander] = { ...existing, totalBanded: oldCount + 1 };
        // Only fire the milestone if this bander wasn't already credited for
        // the predecessor. When modifying a same-bander new capture, the
        // decrement above dropped the count from N→N−1 and we're taking it
        // back to N — no new threshold crossed, just a restore.
        const previouslyCreditedSameBander =
          oldEvent?.bander === normalizedBander && oldWasNewCapture;
        if (
          !previouslyCreditedSameBander &&
          Math.floor((oldCount + 1) / 1000) > Math.floor(oldCount / 1000)
        ) {
          milestoneSet = { banderCode: normalizedBander, count: oldCount + 1 };
        }
      }
      if (normalizedScribe) {
        const existing = newVolunteersMap[normalizedScribe] ?? {
          code: normalizedScribe,
          fullName: volunteersFullNameMap[normalizedScribe] ?? "",
          totalBanded: 0,
          totalScribed: 0,
        };
        newVolunteersMap[normalizedScribe] = {
          ...existing,
          totalScribed: existing.totalScribed + 1,
        };
      }

      // Incrementally update bandSizeToBandIdMap. Naive next = advance(just-
      // banded id); if bander saved out of order (e.g. -00 of strip N after
      // -01..03 of N+1), naive would be already banded — resolve via actual
      // max in the NEXT strip.
      const newBandSizeToBandIdMap = { ...state.bandSizeToBandIdMap };
      if (
        isNewCapture &&
        band.bandSize &&
        band.bandSize !== BandSize.Other &&
        !previousEventId
      ) {
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
        volunteersMap: newVolunteersMap,
        bandSizeToBandIdMap: newBandSizeToBandIdMap,
        queuedEventIds: nextQueuedIds,
        pendingCount: replacingPendingId ? state.pendingCount : state.pendingCount + 1,
        selectedProgram: nextSelectedProgram,
        isSaving: true,
        ...(milestoneSet ? { milestone: milestoneSet } : {}),
      });

      // Persist to IndexedDB (non-blocking). The hot path — one per-event
      // put instead of a 700K-entry blob rewrite. Per-event is O(1) (~2ms);
      // the old full-blob write was O(N) structured-clone serialization.
      const eventWrites: BirdEvent[] = [newBirdEvent];
      if (!replacingPendingId && previousEventId) {
        const prev = birdEventsStore.get(previousEventId);
        if (prev) eventWrites.push(prev);
      }
      const droppedEventId =
        replacingPendingId && previousEventId && previousEventId !== newBirdEvent.id
          ? previousEventId
          : null;
      const persistTail = queuePromise
        .then(() =>
          Promise.all([
            putBirdEvents(CURRENT_ENVIRONMENT, eventWrites),
            droppedEventId
              ? deleteBirdEvent(CURRENT_ENVIRONMENT, droppedEventId)
              : Promise.resolve(),
            saveMapsToIndexedDB({
              bandIdToBirdEventIdsMap: newBandIdToBirdEventIdsMap,
              bandGroupsMap: newBandGroupsMap,
              programsMap: newProgramsMap,
              yearsToProgramMap: newYearsToProgramMap,
              volunteersMap: newVolunteersMap,
            }),
            refreshQueueState(),
          ]),
        )
        .catch((err) => logger.error("AddBirdEvent", "IndexedDB save failed", err));

      const syncTail = isOnline
        ? queuePromise.then(() => syncQueue()).catch((err) =>
            logger.warn("AddBirdEvent", "Online sync failed — will retry on next sync", err),
          )
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

  saveDET: async (det: DET): Promise<void> => {
    const { user, isOnline, DETsMap } = useAppStore.getState();
    if (!user) throw new Error("Must be logged in to save DET");
    if (!isOnline) throw new Error("Cannot save DETs while offline");

    try {
      useAppStore.setState({ DETsMap: { ...DETsMap, [det.date]: det } });
      await updateDETInCache(CURRENT_ENVIRONMENT, det);
      logger.info("SaveDET", `DET for ${det.date} saved to IndexedDB`);
      await set(ref(db, `${CURRENT_ENVIRONMENT}/DETsMap/${det.date}`), det);
      await updateMapTimestamp("DETsMap");
      logger.info("SaveDET", `DET for ${det.date} synced to RTDB`);
    } catch (err) {
      logger.error("SaveDET", `Error saving DET for ${det.date}`, err);
      throw err;
    }
  },

  updateVolunteerName: async (code: string, fullName: string): Promise<void> => {
    const state = useAppStore.getState();
    if (!state.user) throw new Error("Must be logged in to update volunteer name");
    if (!state.isOnline) throw new Error("Cannot update volunteers while offline");

    try {
      const existing = state.volunteersMap[code];
      if (!existing) return;

      const trimmed = fullName.trim();
      const newVolunteersMap = { ...state.volunteersMap, [code]: { ...existing, fullName: trimmed } };
      const newFullNameMap = { ...state.volunteersFullNameMap, [code]: trimmed };
      useAppStore.setState({
        volunteersMap: newVolunteersMap,
        volunteersFullNameMap: newFullNameMap,
      });

      await set(ref(db, `${CURRENT_ENVIRONMENT}/volunteersFullNameMap/${code}`), trimmed);
      await updateMapTimestamp("volunteersFullNameMap");
      await saveMapsToIndexedDB({
        volunteersMap: newVolunteersMap,
        volunteersFullNameMap: newFullNameMap,
      });
    } catch (err) {
      logger.error("UpdateVolunteerName", `Error updating volunteer ${code}`, err);
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
