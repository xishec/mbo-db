import { useState, useEffect, useCallback } from "react";
import { get, ref, set } from "firebase/database";
import { db, CURRENT_ENVIRONMENT, auth } from "../firebase";
import {
  type DatabaseData,
  type YearToProgramMap,
  type ProgramsMap,
  type BandIdToBirdEventIdsMap,
  type BirdEventsMap,
  type BandGroupsMap,
  type MagicTable,
  type CaptureFormData,
  type BirdEvent,
  type DismissedConflictsMap,
  BandSize,
} from "../types";
import { Band, BirdEventType, generateBirdEventId, type Program, getBandGroupMapKey } from "../types";
import { DataContext } from "./DataContext";
import {
  saveDataToIndexedDB,
  getDataFromIndexedDB,
  saveLastUpdated,
  getLastUpdated,
  addToQueue,
  getQueuedEvents,
  removeFromQueue,
  getQueueCount,
} from "./indexedDB";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { logger } from "./logger";
import { onAuthStateChanged, type User } from "firebase/auth";

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [forceOffline, setForceOffline] = useState(false);
  const actualIsOnline = useOnlineStatus();
  const isOnline = forceOffline ? false : actualIsOnline;

  // User authentication
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // All data from alpha/
  const [yearsToProgramMap, setYearsToProgramMap] = useState<YearToProgramMap>({});
  const [programsMap, setProgramsMap] = useState<ProgramsMap>({});
  const [bandIdToBirdEventIdsMap, setBandIdToBirdEventIdsMap] = useState<BandIdToBirdEventIdsMap>({});
  const [birdEventsMap, setBirdEventsMap] = useState<BirdEventsMap>({});
  const [bandGroupsMap, setBandGroupsMap] = useState<BandGroupsMap>({});
  const [magicTable, setMagicTable] = useState<MagicTable>({ pyle: {}, mbo: {} });
  const [bandSizeToBandIdMap, setBandSizeToBandIdMap] = useState<Record<BandSize, string>>(
    {} as Record<BandSize, string>
  );
  const [dismissedConflictsMap, setDismissedConflictsMap] = useState<DismissedConflictsMap>({});

  // Load entire alpha/ on mount
  useEffect(() => {
    let cancelled = false;

    const loadAlphaData = async () => {
      try {
        logger.info("DataLoad", `Checking for ${CURRENT_ENVIRONMENT}/ data updates...`);

        // Check if we have cached data
        const cachedData = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);
        const cachedTimestamp = await getLastUpdated(CURRENT_ENVIRONMENT);

        // Get the lastModified timestamp from Firebase
        const lastModifiedSnapshot = await get(ref(db, `${CURRENT_ENVIRONMENT}/metadata/lastModified`));
        const firebaseTimestamp = lastModifiedSnapshot.exists() ? (lastModifiedSnapshot.val() as number) : null;

        // Log timestamps for debugging
        logger.debug("DataLoad", "Cache timestamp", {
          timestamp: cachedTimestamp,
          formatted: cachedTimestamp ? new Date(cachedTimestamp).toLocaleString() : "None",
        });
        logger.debug("DataLoad", "Firebase timestamp", {
          timestamp: firebaseTimestamp,
          formatted: firebaseTimestamp ? new Date(firebaseTimestamp).toLocaleString() : "None",
        });

        // Determine if we need to fetch fresh data
        const needsFetch = !cachedData || !cachedTimestamp || !firebaseTimestamp || firebaseTimestamp > cachedTimestamp;

        if (!needsFetch && cachedData) {
          logger.info("DataLoad", `Using cached ${CURRENT_ENVIRONMENT}/ data (up to date)`);
          populateStateFromData(cachedData);
          setIsLoading(false);
          return;
        }

        // Fetch fresh data from Firebase
        logger.info("DataLoad", `Fetching fresh ${CURRENT_ENVIRONMENT}/ data from Firebase RTDB...`);
        const snapshot = await get(ref(db, CURRENT_ENVIRONMENT));

        if (cancelled) return;

        if (snapshot.exists()) {
          const data = snapshot.val() as DatabaseData;

          // Save to IndexedDB
          await saveDataToIndexedDB(CURRENT_ENVIRONMENT, data);
          if (firebaseTimestamp) {
            await saveLastUpdated(CURRENT_ENVIRONMENT, firebaseTimestamp);
          }

          populateStateFromData(data);

          const loadStats = {
            yearsToProgramMap: Object.keys(data.yearsToProgramMap ?? {}).length,
            programsMap: Object.keys(data.programsMap ?? {}).length,
            bandIdToBirdEventIdsMap: Object.keys(data.bandIdToBirdEventIdsMap ?? {}).length,
            birdEventsMap: Object.keys(data.birdEventsMap ?? {}).length,
            bandGroupsMap: Object.keys(data.bandGroupsMap ?? {}).length,
            hasMagicTable: !!data.magicTable,
          };
          logger.info("DataLoad", `Loaded ${CURRENT_ENVIRONMENT}/ data`, loadStats);
        } else {
          const errorMsg = `Error: ${CURRENT_ENVIRONMENT}/ is missing from the database. Please run import scripts.`;
          setError(errorMsg);
          logger.error("DataLoad", errorMsg);
        }
      } catch (err) {
        logger.error("DataLoad", `Error loading ${CURRENT_ENVIRONMENT}/ data`, err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    const populateStateFromData = (data: DatabaseData) => {
      setYearsToProgramMap(data.yearsToProgramMap ?? {});
      setProgramsMap(data.programsMap ?? {});
      setBandIdToBirdEventIdsMap(data.bandIdToBirdEventIdsMap ?? {});
      setBirdEventsMap(
        Object.fromEntries(
          Object.entries(data.birdEventsMap ?? {}).map(([id, event]) => [
            id,
            { ...event, band: new Band(event.band.bandPrefix, event.band.bandSuffix) },
          ])
        )
      );
      setBandGroupsMap(data.bandGroupsMap ?? {});
      setMagicTable(data.magicTable ?? { pyle: {}, mbo: {} });
      setBandSizeToBandIdMap(data.bandSizeToBandIdMap ?? ({} as Record<BandSize, string>));
      setDismissedConflictsMap(data.dismissedConflictsMap ?? {});
    };

    loadAlphaData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Monitor auth state and check if user is admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Check if user is admin from database
        try {
          const roleRef = ref(db, `users/${currentUser.uid}/role`);
          const snapshot = await get(roleRef);
          setIsAdmin(snapshot.val() === "admin");
        } catch (error) {
          logger.error("Auth", "Error checking admin status", error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
  }, []);

  /**
   * THREE-TIER SYNC ARCHITECTURE (optimized for 50MB database)
   * ============================================================
   * React State (volatile) → IndexedDB (persistent cache) → Firebase RTDB (source of truth)
   *
   * This architecture enables:
   * - Offline-first operation with minimal sync overhead
   * - Delta sync: only changed events (~1-5KB each) instead of full 50MB upload
   * - Fast sync times (milliseconds vs seconds for full sync)
   * - Lower Firebase costs and better battery life
   *
   * Sync Flow:
   * 1. User action → Update React state + IndexedDB immediately (optimistic UI)
   * 2. Queue BirdEvent for background sync
   * 3. When online → Process queue (sync only deltas to RTDB)
   * 4. Update React state to reflect synced data
   */

  /**
   * Reconstructs Band class instances from serialized IndexedDB data.
   * Band is a class with computed properties, so we need to reconstruct instances
   * after deserialization from IndexedDB.
   */
  const reconstructBandObjects = useCallback((birdEventsMap: BirdEventsMap): BirdEventsMap => {
    return Object.fromEntries(
      Object.entries(birdEventsMap).map(([id, event]) => [
        id,
        { ...event, band: new Band(event.band.bandPrefix, event.band.bandSuffix) },
      ])
    );
  }, []);

  /**
   * Syncs a single bird event to Firebase RTDB with all its relationships.
   * This is the core delta sync operation - only writes changed data.
   *
   * Updates up to five related nodes atomically:
   * 1. birdEventsMap/{eventId} - The event itself
   * 2. birdEventsMap/{previousEventId} - Previous event's modifiedEventId (if applicable)
   * 3. bandIdToBirdEventIdsMap/{bandId} - Index by band ID
   * 4. bandGroupsMap/{bandGroupId} - New captures by band group
   * 5. programsMap/{programId} - Program's captures and recaptures
   */
  const syncBirdEventToRTDB = useCallback(
    async (
      birdEvent: BirdEvent,
      environment: string,
      state: {
        bandIdToBirdEventIdsMap: BandIdToBirdEventIdsMap;
        bandGroupsMap: BandGroupsMap;
        programsMap: ProgramsMap;
        birdEventsMap: BirdEventsMap;
      }
    ): Promise<void> => {
      const { band, id: birdEventId, birdEventType, programId, previousEventId } = birdEvent;
      const isNewCapture = birdEventType === BirdEventType.Banded || birdEventType === BirdEventType.None;

      // 1. Write the bird event itself
      await set(ref(db, `${environment}/birdEventsMap/${birdEventId}`), birdEvent);

      // 2. If this event modifies a previous event, update the previous event's modifiedEventId
      if (previousEventId && state.birdEventsMap[previousEventId]) {
        const updatedPreviousEvent = {
          ...state.birdEventsMap[previousEventId],
          modifiedEventId: birdEventId,
        };
        await set(ref(db, `${environment}/birdEventsMap/${previousEventId}`), updatedPreviousEvent);
        // Update local state to reflect the change
        state.birdEventsMap[previousEventId] = updatedPreviousEvent;
      }

      // 3. Update band ID index (only if not already indexed)
      const existingBirdEventIds = state.bandIdToBirdEventIdsMap[band.id] || [];
      if (!existingBirdEventIds.includes(birdEventId)) {
        await set(ref(db, `${environment}/bandIdToBirdEventIdsMap/${band.id}`), [...existingBirdEventIds, birdEventId]);
      }

      // 4. Update band group map (only for new captures)
      if (isNewCapture) {
        const bandGroupMapKey = getBandGroupMapKey(band);
        const existingBandGroup = state.bandGroupsMap[bandGroupMapKey];
        if (!existingBandGroup) {
          // Create new band group
          await set(ref(db, `${environment}/bandGroupsMap/${bandGroupMapKey}`), {
            id: bandGroupMapKey,
            newCaptureIds: [birdEventId],
          });
        } else if (!existingBandGroup.newCaptureIds.includes(birdEventId)) {
          // Append to existing band group
          await set(ref(db, `${environment}/bandGroupsMap/${bandGroupMapKey}/newCaptureIds`), [
            ...existingBandGroup.newCaptureIds,
            birdEventId,
          ]);
        }
      }

      // 5. Update program map
      const existingProgram = state.programsMap[programId];
      if (existingProgram) {
        const bandGroupMapKey = getBandGroupMapKey(band);
        // Update band group IDs for new captures
        if (isNewCapture) {
          const existingBandGroupIds = existingProgram.bandGroupIds || [];
          if (!existingBandGroupIds.includes(bandGroupMapKey)) {
            await set(ref(db, `${environment}/programsMap/${programId}/bandGroupIds`), [
              ...existingBandGroupIds,
              bandGroupMapKey,
            ]);
          }
        }

        // Update recapture IDs for recaptures
        if (!isNewCapture) {
          const existingRecaptureIds = existingProgram.recaptureIds || [];
          if (!existingRecaptureIds.includes(birdEventId)) {
            await set(ref(db, `${environment}/programsMap/${programId}/recaptureIds`), [
              ...existingRecaptureIds,
              birdEventId,
            ]);
          }
        }
      }
    },
    []
  );

  /**
   * Updates all React state from IndexedDB cache.
   * This ensures React state stays synchronized with IndexedDB after background syncs.
   */
  const updateReactStateFromCache = useCallback(
    (state: {
      yearsToProgramMap: YearToProgramMap;
      programsMap: ProgramsMap;
      bandIdToBirdEventIdsMap: BandIdToBirdEventIdsMap;
      birdEventsMap: BirdEventsMap;
      bandGroupsMap: BandGroupsMap;
    }) => {
      setYearsToProgramMap(state.yearsToProgramMap);
      setProgramsMap(state.programsMap);
      setBandIdToBirdEventIdsMap(state.bandIdToBirdEventIdsMap);
      setBirdEventsMap(state.birdEventsMap);
      setBandGroupsMap(state.bandGroupsMap);

      // Update selectedProgram to prevent stale object references
      setSelectedProgram((current) => {
        if (!current) return null;
        const updated = state.programsMap[current.id];
        return updated || current;
      });
    },
    []
  );

  // Update pending count on mount
  useEffect(() => {
    getQueueCount().then(setPendingCount).catch(console.error);
  }, []);

  /**
   * Updates lastModified timestamp in both RTDB and IndexedDB.
   * Called after any data mutation to track when data was last changed.
   */
  const updateLastModifiedTimestamp = useCallback(async (): Promise<void> => {
    const now = Date.now();
    await set(ref(db, `${CURRENT_ENVIRONMENT}/metadata/lastModified`), now);
    await saveLastUpdated(CURRENT_ENVIRONMENT, now);
  }, []);

  /**
   * Saves complete application state to IndexedDB cache.
   * This is the single source of truth for offline data.
   */
  const saveCompleteStateToIndexedDB = useCallback(
    async (overrides?: Partial<DatabaseData>): Promise<void> => {
      await saveDataToIndexedDB(CURRENT_ENVIRONMENT, {
        yearsToProgramMap,
        programsMap,
        bandIdToBirdEventIdsMap,
        birdEventsMap,
        bandGroupsMap,
        magicTable,
        bandSizeToBandIdMap,
        dismissedConflictsMap,
        ...overrides,
      });
    },
    [
      yearsToProgramMap,
      programsMap,
      bandIdToBirdEventIdsMap,
      birdEventsMap,
      bandGroupsMap,
      magicTable,
      bandSizeToBandIdMap,
      dismissedConflictsMap,
    ]
  );

  /**
   * Syncs pending events from queue to Firebase RTDB.
   *
   * Process:
   * 1. Check if online and if queue has items
   * 2. Read current state from IndexedDB (single source of truth)
   * 3. For each queued event, sync to RTDB (delta sync)
   * 4. Remove successfully synced events from queue
   * 5. Update timestamps and React state
   *
   * Error handling:
   * - Failed events stay in queue for automatic retry on next sync
   * - Partial success is okay - we continue with remaining events
   */
  const syncQueue = useCallback(async () => {
    if (!isOnline) return;

    try {
      const pendingEvents = await getQueuedEvents();
      if (pendingEvents.length === 0) return;

      logger.sync("SyncQueue", `Syncing ${pendingEvents.length} pending events...`);

      // Read current state from IndexedDB (single source of truth)
      const cachedData = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);
      if (!cachedData) {
        logger.error("SyncQueue", "Cannot sync: No cached data in IndexedDB");
        return;
      }

      // Reconstruct Band objects from serialized data
      const reconstructedBirdEventsMap = reconstructBandObjects(cachedData.birdEventsMap ?? {});

      // Build state object for sync operations
      const state = {
        yearsToProgramMap: cachedData.yearsToProgramMap ?? {},
        programsMap: cachedData.programsMap ?? {},
        bandIdToBirdEventIdsMap: cachedData.bandIdToBirdEventIdsMap ?? {},
        birdEventsMap: reconstructedBirdEventsMap,
        bandGroupsMap: cachedData.bandGroupsMap ?? {},
      };

      // Process each pending event
      let successCount = 0;
      for (const pending of pendingEvents) {
        try {
          const birdEvent = pending.pendingEvent as BirdEvent;
          await syncBirdEventToRTDB(birdEvent, pending.environment, state);

          // Remove from queue only after successful sync
          await removeFromQueue(pending.id);
          successCount++;

          logger.sync("SyncQueue", `Synced bird event ${successCount}/${pendingEvents.length}`, {
            eventId: birdEvent.id,
          });
        } catch (err) {
          logger.error("SyncQueue", `Failed to sync event ${pending.id}`, err);
          // Leave in queue to retry later - continue with remaining events
        }
      }

      // Update lastModified timestamp only if we synced bird events
      if (successCount > 0) {
        await updateLastModifiedTimestamp();
      }

      // Always sync bandSizeToBandIdMap
      if (cachedData.bandSizeToBandIdMap) {
        try {
          await set(ref(db, `${CURRENT_ENVIRONMENT}/bandSizeToBandIdMap`), cachedData.bandSizeToBandIdMap);
          // Update React state to match what we just synced
          setBandSizeToBandIdMap(cachedData.bandSizeToBandIdMap);
          logger.sync("SyncQueue", "Synced bandSizeToBandIdMap to RTDB");
        } catch (err) {
          logger.error("SyncQueue", "Failed to sync bandSizeToBandIdMap", err);
        }
      }

      // Update pending count
      const remainingCount = await getQueueCount();
      setPendingCount(remainingCount);

      // Sync React state with IndexedDB/RTDB
      updateReactStateFromCache(state);

      logger.sync("SyncQueue", `Queue sync completed`, {
        succeeded: successCount,
        total: pendingEvents.length,
        remaining: remainingCount,
        bandSizeToBandIdMap,
      });
    } catch (err) {
      logger.error("SyncQueue", "Error syncing queue", err);
    }
  }, [
    isOnline,
    reconstructBandObjects,
    updateReactStateFromCache,
    bandSizeToBandIdMap,
    syncBirdEventToRTDB,
    updateLastModifiedTimestamp,
  ]);

  const incrementBandSize = useCallback(
    async (bandSize: BandSize, bandGroup: string, bandLastTwoDigits: string): Promise<Record<BandSize, string>> => {
      const currentBandId = `${bandGroup}${bandLastTwoDigits}`;
      const nextBandId = (parseInt(currentBandId, 10) + 1).toString().padStart(9, "0");

      const updatedMap = {
        ...bandSizeToBandIdMap,
        [bandSize]: nextBandId,
      };

      // Update React state immediately
      setBandSizeToBandIdMap(updatedMap);

      // When online, update RTDB immediately
      // When offline, state is saved to IndexedDB via addBirdEvent and will sync when back online
      if (isOnline) {
        await set(ref(db, `${CURRENT_ENVIRONMENT}/bandSizeToBandIdMap/${bandSize}`), nextBandId);
      }

      return updatedMap;
    },
    [bandSizeToBandIdMap, isOnline]
  );

  const addBirdEvent = useCallback(
    async (captureData: CaptureFormData, bandSize: BandSize, previousEventId: string | undefined) => {
      if (!user) {
        throw new Error("Must be logged in to add bird events");
      }

      try {
        // 1. Create Band and BirdEvent objects
        const birdEventType = captureData.birdEventType as BirdEventType;
        
        const bandPrefix = captureData.bandGroup.substring(0, 4);
        const bandSuffix = captureData.bandGroup.substring(4) + captureData.bandLastTwoDigits;
        const band = new Band(bandPrefix, bandSuffix);
        const isNewCapture = birdEventType === BirdEventType.Banded || birdEventType === BirdEventType.None;

        const newBirdEvent: BirdEvent = {
          id: generateBirdEventId(
            band.id,
            captureData.date,
            captureData.net,
            captureData.wing,
            captureData.weight,
            previousEventId !== undefined
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
          bander: captureData.bander,
          scribe: captureData.scribe,
          net: captureData.net,
          birdStatus: captureData.birdStatus,
          notes: captureData.notes,
          previousEventId: previousEventId || null,
          modifiedEventId: null,
          birdEventType,
          updatedAt: previousEventId ? String(Date.now()) : String(Date.parse(`${captureData.date} ${captureData.time}`)),
        };

        // 2. Queue the bird event for sync
        await addToQueue({
          id: crypto.randomUUID(),
          pendingEvent: newBirdEvent,
          timestamp: Date.now(),
          environment: CURRENT_ENVIRONMENT,
          action: previousEventId ? "modified" : "added",
        });

        // 3. Calculate all new state values first
        const year = captureData.date.substring(0, 4);

        // New birdEventsMap - update previous event if this is a modification
        let newBirdEventsMap = { ...birdEventsMap, [newBirdEvent.id]: newBirdEvent };
        if (previousEventId && birdEventsMap[previousEventId]) {
          newBirdEventsMap = {
            ...newBirdEventsMap,
            [previousEventId]: {
              ...birdEventsMap[previousEventId],
              modifiedEventId: newBirdEvent.id,
            },
          };
        }

        // New bandIdToBirdEventIdsMap
        const newBandIdToBirdEventIdsMap = {
          ...bandIdToBirdEventIdsMap,
          [band.id]: [...(bandIdToBirdEventIdsMap[band.id] || []), newBirdEvent.id],
        };

        // New bandGroupsMap
        let newBandGroupsMap = bandGroupsMap;
        if (isNewCapture) {
          const bandGroupMapKey = getBandGroupMapKey(band);
          newBandGroupsMap = {
            ...bandGroupsMap,
            [bandGroupMapKey]: {
              id: bandGroupMapKey,
              newCaptureIds: [...(bandGroupsMap[bandGroupMapKey]?.newCaptureIds || []), newBirdEvent.id],
            },
          };
        }

        // 4. Increment band size if applicable
        const updatedBandSizeMap =
          bandSize !== BandSize.Other && captureData.bandGroup && captureData.bandLastTwoDigits
            ? await incrementBandSize(bandSize, captureData.bandGroup, captureData.bandLastTwoDigits)
            : bandSizeToBandIdMap;

        // New programsMap
        const existingProgram = programsMap[captureData.programId];
        const bandGroupMapKey = getBandGroupMapKey(band);
        let newBandGroupIds = existingProgram?.bandGroupIds || [];
        if (isNewCapture && !newBandGroupIds.includes(bandGroupMapKey)) {
          newBandGroupIds = [...newBandGroupIds, bandGroupMapKey];
        }

        let newRecaptureIds = existingProgram?.recaptureIds || [];
        if (!isNewCapture) {
          newRecaptureIds = [...newRecaptureIds, newBirdEvent.id];
        }

        const newProgramsMap = {
          ...programsMap,
          [captureData.programId]: {
            id: captureData.programId,
            displayName: existingProgram.displayName,
            bandGroupIds: newBandGroupIds,
            recaptureIds: newRecaptureIds,
          } as Program,
        };

        // New yearsToProgramMap
        const existingProgramsInYear = yearsToProgramMap[year] || [];
        const newYearsToProgramMap = {
          ...yearsToProgramMap,
          [year]: existingProgramsInYear.includes(captureData.programId)
            ? existingProgramsInYear
            : [...existingProgramsInYear, captureData.programId],
        };

        // Update React state
        setBirdEventsMap(newBirdEventsMap);
        setBandIdToBirdEventIdsMap(newBandIdToBirdEventIdsMap);
        setBandGroupsMap(newBandGroupsMap);
        setProgramsMap(newProgramsMap);
        setYearsToProgramMap(newYearsToProgramMap);

        // Update selectedProgram if it's the one we just modified
        setSelectedProgram((current) => {
          if (!current || current.id !== captureData.programId) return current;
          return newProgramsMap[captureData.programId];
        });

        // 5. Save to IndexedDB (works both online and offline)
        await saveCompleteStateToIndexedDB({
          yearsToProgramMap: newYearsToProgramMap,
          programsMap: newProgramsMap,
          bandIdToBirdEventIdsMap: newBandIdToBirdEventIdsMap,
          birdEventsMap: newBirdEventsMap,
          bandGroupsMap: newBandGroupsMap,
          bandSizeToBandIdMap: updatedBandSizeMap,
        });

        // 6. Handle online vs offline sync
        if (isOnline) {
          // Online: update timestamp and sync immediately
          await updateLastModifiedTimestamp();
          await syncQueue();
        } else {
          // Offline: just log that event is queued
          logger.info("AddBirdEvent", "Offline - event queued for sync when online", { eventId: newBirdEvent.id });
        }

        // 7. Update pending count
        const count = await getQueueCount();
        setPendingCount(count);

        logger.info("AddBirdEvent", "Bird event added", {
          eventId: newBirdEvent.id,
          programId: captureData.programId,
          bandSize,
        });
      } catch (err) {
        logger.error("AddBirdEvent", "Error adding bird event", err);
        throw err;
      }
    },
    [
      user,
      bandIdToBirdEventIdsMap,
      birdEventsMap,
      bandGroupsMap,
      isOnline,
      programsMap,
      syncQueue,
      yearsToProgramMap,
      bandSizeToBandIdMap,
      incrementBandSize,
      saveCompleteStateToIndexedDB,
      updateLastModifiedTimestamp,
    ]
  );

  const addProgram = useCallback(
    async (programId: string, displayName: string, year: string) => {
      if (!user) {
        throw new Error("Must be logged in to add programs");
      }
      if (!isOnline) {
        throw new Error("Cannot add programs while offline");
      }

      try {
        // Trim whitespace from displayName
        const trimmedDisplayName = displayName.trim();
        if (!trimmedDisplayName) {
          throw new Error("Display name cannot be empty");
        }

        // Validate unique displayName (case-insensitive)
        const existingProgram = Object.values(programsMap).find(
          (p) => p.displayName.toLowerCase() === trimmedDisplayName.toLowerCase()
        );
        if (existingProgram) {
          throw new Error(`A program with the display name "${trimmedDisplayName}" already exists`);
        }

        // Create new program directly in Firebase
        await set(ref(db, `${CURRENT_ENVIRONMENT}/programsMap/${programId}`), {
          id: programId,
          displayName: trimmedDisplayName,
          bandGroupIds: [],
          recaptureIds: [],
        });

        // Update yearsToProgramMap
        if (!yearsToProgramMap[year]) {
          await set(ref(db, `${CURRENT_ENVIRONMENT}/yearsToProgramMap/${year}`), [programId]);
        } else if (!yearsToProgramMap[year].includes(programId)) {
          const updatedPrograms = [...yearsToProgramMap[year], programId];
          await set(ref(db, `${CURRENT_ENVIRONMENT}/yearsToProgramMap/${year}`), updatedPrograms);
        }

        // Calculate new state
        const newProgramsMap = {
          ...programsMap,
          [programId]: {
            id: programId,
            displayName: trimmedDisplayName,
            bandGroupIds: [],
            recaptureIds: [],
          },
        };

        const existingProgramsInYear = yearsToProgramMap[year] || [];
        const newYearsToProgramMap = {
          ...yearsToProgramMap,
          [year]: existingProgramsInYear.includes(programId)
            ? existingProgramsInYear
            : [...existingProgramsInYear, programId],
        };

        // Update React state
        setProgramsMap(newProgramsMap);
        setYearsToProgramMap(newYearsToProgramMap);

        // Update lastModified timestamp in RTDB and IndexedDB
        await updateLastModifiedTimestamp();

        // Update IndexedDB with new state
        await saveCompleteStateToIndexedDB({
          yearsToProgramMap: newYearsToProgramMap,
          programsMap: newProgramsMap,
        });

        logger.info("AddProgram", "Program added", { programId, displayName: trimmedDisplayName, year });
      } catch (err) {
        logger.error("AddProgram", "Error adding program", err);
        throw err;
      }
    },
    [user, isOnline, yearsToProgramMap, programsMap, saveCompleteStateToIndexedDB, updateLastModifiedTimestamp]
  );

  const updateProgram = useCallback(
    async (programId: string, newDisplayName: string) => {
      if (!user) {
        throw new Error("Must be logged in to update programs");
      }
      if (!isOnline) {
        throw new Error("Cannot update programs while offline");
      }

      try {
        // Get the current program
        const currentProgram = programsMap[programId];
        if (!currentProgram) {
          throw new Error(`Program with ID "${programId}" not found`);
        }

        // Trim whitespace from displayName
        const trimmedDisplayName = newDisplayName.trim();
        if (!trimmedDisplayName) {
          throw new Error("Display name cannot be empty");
        }

        // Check if displayName actually changed
        if (currentProgram.displayName === trimmedDisplayName) {
          return;
        }

        // Validate unique displayName (case-insensitive, excluding current program)
        const existingProgram = Object.values(programsMap).find(
          (p) => p.id !== programId && p.displayName.toLowerCase() === trimmedDisplayName.toLowerCase()
        );
        if (existingProgram) {
          throw new Error(`A program with the display name "${trimmedDisplayName}" already exists`);
        }

        // Update program in Firebase (only displayName can change, ID remains the same)
        await set(ref(db, `${CURRENT_ENVIRONMENT}/programsMap/${programId}/displayName`), trimmedDisplayName);

        // Calculate new state
        const newProgramsMap = {
          ...programsMap,
          [programId]: {
            ...currentProgram,
            displayName: trimmedDisplayName,
          },
        };

        // Update IndexedDB first
        const updatedDatabaseData = {
          yearsToProgramMap,
          programsMap: newProgramsMap,
          bandIdToBirdEventIdsMap,
          birdEventsMap,
          bandGroupsMap,
          magicTable,
          bandSizeToBandIdMap,
          dismissedConflictsMap,
        };
        await saveDataToIndexedDB(CURRENT_ENVIRONMENT, updatedDatabaseData);

        // Update lastModified timestamp in RTDB and IndexedDB
        await updateLastModifiedTimestamp();

        // Update React state after successful persistence
        setProgramsMap(newProgramsMap);

        // Update selectedProgram if it's the one we just modified
        setSelectedProgram((current) => {
          if (!current || current.id !== programId) return current;
          return newProgramsMap[programId];
        });

        logger.info("UpdateProgram", "Program updated", { programId, newDisplayName: trimmedDisplayName });
      } catch (err) {
        logger.error("UpdateProgram", "Error updating program", err);
        throw err;
      }
    },
    [
      user,
      isOnline,
      programsMap,
      yearsToProgramMap,
      bandIdToBirdEventIdsMap,
      birdEventsMap,
      bandGroupsMap,
      magicTable,
      bandSizeToBandIdMap,
      dismissedConflictsMap,
      updateLastModifiedTimestamp,
    ]
  );

  const updateBandSizeMap = useCallback(
    async (newBandSizeMap: Record<BandSize, string>) => {
      if (!user) {
        throw new Error("Must be logged in to update band size map");
      }

      try {
        // Update React state immediately (works both online and offline)
        setBandSizeToBandIdMap(newBandSizeMap);

        // Save to IndexedDB (works both online and offline)
        await saveCompleteStateToIndexedDB({ bandSizeToBandIdMap: newBandSizeMap });

        // Handle online vs offline sync
        if (isOnline) {
          // Online: sync to RTDB immediately
          await set(ref(db, `${CURRENT_ENVIRONMENT}/bandSizeToBandIdMap`), newBandSizeMap);
          await updateLastModifiedTimestamp();
          logger.info("UpdateBandSizeMap", "Band size map synced to RTDB");
        } else {
          // Offline: will be synced via syncQueue when back online
          logger.info("UpdateBandSizeMap", "Band size map saved offline - will sync when online");
        }

        logger.info("UpdateBandSizeMap", "Band size map updated");
      } catch (err) {
        logger.error("UpdateBandSizeMap", "Error updating band size map", err);
        throw err;
      }
    },
    [user, isOnline, saveCompleteStateToIndexedDB, updateLastModifiedTimestamp]
  );

  const dismissConflict = useCallback(
    async (conflictId: string) => {
      if (!user) {
        throw new Error("Must be logged in to dismiss conflicts");
      }

      try {
        // Update React state immediately
        const newDismissedConflictsMap = { ...dismissedConflictsMap, [conflictId]: true };
        setDismissedConflictsMap(newDismissedConflictsMap);

        // Save to IndexedDB
        await saveCompleteStateToIndexedDB({ dismissedConflictsMap: newDismissedConflictsMap });

        // Handle online vs offline sync
        if (isOnline) {
          // Online: sync to RTDB immediately
          await set(ref(db, `${CURRENT_ENVIRONMENT}/dismissedConflictsMap/${conflictId}`), true);
          await updateLastModifiedTimestamp();
          logger.info("DismissConflict", `Conflict ${conflictId} dismissed and synced to RTDB`);
        } else {
          // Offline: will be synced when back online
          logger.info("DismissConflict", `Conflict ${conflictId} dismissed offline - will sync when online`);
        }
      } catch (err) {
        logger.error("DismissConflict", `Error dismissing conflict ${conflictId}`, err);
        throw err;
      }
    },
    [user, isOnline, dismissedConflictsMap, saveCompleteStateToIndexedDB, updateLastModifiedTimestamp]
  );

  const resetDismissedConflicts = useCallback(
    async () => {
      if (!user) {
        throw new Error("Must be logged in to reset dismissed conflicts");
      }

      try {
        // Update React state immediately
        const emptyMap = {};
        setDismissedConflictsMap(emptyMap);

        // Save to IndexedDB
        await saveCompleteStateToIndexedDB({ dismissedConflictsMap: emptyMap });

        // Handle online vs offline sync
        if (isOnline) {
          // Online: clear RTDB immediately
          await set(ref(db, `${CURRENT_ENVIRONMENT}/dismissedConflictsMap`), null);
          await updateLastModifiedTimestamp();
          logger.info("ResetDismissedConflicts", "All dismissed conflicts reset and synced to RTDB");
        } else {
          // Offline: will be synced when back online
          logger.info("ResetDismissedConflicts", "All dismissed conflicts reset offline - will sync when online");
        }
      } catch (err) {
        logger.error("ResetDismissedConflicts", "Error resetting dismissed conflicts", err);
        throw err;
      }
    },
    [user, isOnline, saveCompleteStateToIndexedDB, updateLastModifiedTimestamp]
  );

  return (
    <DataContext.Provider
      value={{
        isLoading,
        error,
        isLoggedIn: !!user,
        isAdmin,
        selectedProgram,
        selectProgram: setSelectedProgram,
        yearsToProgramMap,
        programsMap,
        bandIdToBirdEventIdsMap,
        birdEventsMap,
        bandGroupsMap,
        magicTable,
        bandSizeToBandIdMap,
        dismissedConflictsMap,
        isOnline,
        pendingCount,
        forceOffline,
        setForceOffline,
        addBirdEvent,
        addProgram,
        updateProgram,
        syncQueue,
        updateBandSizeMap,
        incrementBandSize,
        dismissConflict,
        resetDismissedConflicts,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
