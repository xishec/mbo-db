import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  type DETsMap,
  type VolunteersMap,
  BandSize,
  type PendingBirdEvent,
  type PendingDETEvent,
  type SpeciesInfoMap,
} from "../types";
import {
  Band,
  BirdEventType,
  generateBirdEventId,
  type Program,
  type Volunteer,
  getBandGroupMapKey,
  type DET,
} from "../types";
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
  updateDETInCache,
} from "./indexedDB";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { logger } from "./logger";
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { VOLUNTEER_NAMES } from "../data/volunteerNames";

type FavoriteRateResult = {
  value: string;
  rate: number;
};

type BandStats = {
  count: number;
  earliest: BirdEvent;
  latest: BirdEvent;
  earliestTime: number;
  latestTime: number;
};

const getEventTimestamp = (event: BirdEvent): number => Date.parse(`${event.date}T${event.time}`);

const computeFavoriteRate = (
  events: BirdEvent[],
  selector: (event: BirdEvent) => string | undefined
): FavoriteRateResult => {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = selector(event);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return { value: "", rate: 0 };
  }

  let totalCount = 0;
  let maxKey = "";
  let maxCount = 0;
  for (const [key, count] of counts.entries()) {
    totalCount += count;
    if (count > maxCount) {
      maxCount = count;
      maxKey = key;
    }
  }

  const averageCount = totalCount / counts.size;
  const rate = averageCount > 0 ? maxCount / averageCount : 0;

  return { value: maxKey, rate };
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [forceOffline, setForceOffline] = useState(false);
  const [modeChosen, setModeChosen] = useState(false);
  const [milestone, setMilestone] = useState<{ banderCode: string; count: number } | null>(null);
  const actualIsOnline = useOnlineStatus();
  const isOnline = forceOffline ? false : actualIsOnline;
  const forceOfflineRef = useRef(forceOffline);
  forceOfflineRef.current = forceOffline;

  const chooseOnline = useCallback(() => {
    setForceOffline(false);
    setModeChosen(true);
  }, []);

  const chooseOffline = useCallback(() => {
    setForceOffline(true);
    setModeChosen(true);
  }, []);

  // User authentication
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // All data from alpha/
  const [yearsToProgramMap, setYearsToProgramMap] = useState<YearToProgramMap>({});
  const [programsMap, setProgramsMap] = useState<ProgramsMap>({});
  const [bandIdToBirdEventIdsMap, setBandIdToBirdEventIdsMap] = useState<BandIdToBirdEventIdsMap>({});
  const [birdEventsMap, setBirdEventsMap] = useState<BirdEventsMap>({});
  const [bandGroupsMap, setBandGroupsMap] = useState<BandGroupsMap>({});
  const [magicTable, setMagicTable] = useState<MagicTable>({ pyle: {} });
  const [bandSizeToBandIdMap, setBandSizeToBandIdMap] = useState<Record<BandSize, string>>(
    {} as Record<BandSize, string>
  );
  const [dismissedConflictsMap, setDismissedConflictsMap] = useState<DismissedConflictsMap>({});
  const [DETsMap, setDETsMap] = useState<DETsMap>({});
  const [volunteersMap, setVolunteersMap] = useState<VolunteersMap>({});

  /**
   * Compute SpeciesInfoMap from birdEventsMap
   * This computes statistics for each species:
   * - biggest: bird event with largest wing
   * - fattest: highest fat (if same fat, compare weight)
   * - dummiest: band with most bird events (capture + recapture)
   * - oldest: individual with longest span between earliest and latest bird event
   * - favoriteBander: most repeated bander string
   */
  const speciesInfoMap = useMemo<SpeciesInfoMap>(() => {
    const infoMap: SpeciesInfoMap = {};

    // Filter out modified events
    const validEvents = Object.values(birdEventsMap).filter((event) => event && !event.modifiedEventId);

    if (validEvents.length === 0) return infoMap;

    // Group events by species
    const eventsBySpecies = new Map<string, BirdEvent[]>();
    for (const event of validEvents) {
      if (!event.species || event.species.length !== 4) continue;
      const species = event.species;
      const speciesEvents = eventsBySpecies.get(species);
      if (speciesEvents) {
        speciesEvents.push(event);
      } else {
        eventsBySpecies.set(species, [event]);
      }
    }

    // Compute stats for each species
    for (const [speciesCode, events] of eventsBySpecies.entries()) {
      if (events.length === 0) continue;

      // Biggest: largest wing
      const biggest = events.reduce((max, event) => (event.wing > max.wing ? event : max));

      // Fattest: highest fat, if same fat compare weight
      const fattest = events.reduce((max, event) => {
        if (event.fat > max.fat) return event;
        if (event.fat === max.fat && event.weight > max.weight) return event;
        return max;
      });

      // Group events by band ID to find dummiest and oldest
      const bandStats = new Map<string, BandStats>();
      for (const event of events) {
        const bandId = event.band.id;
        const timestamp = getEventTimestamp(event);
        const stats = bandStats.get(bandId);
        if (!stats) {
          bandStats.set(bandId, {
            count: 1,
            earliest: event,
            latest: event,
            earliestTime: timestamp,
            latestTime: timestamp,
          });
          continue;
        }

        stats.count += 1;
        if (timestamp < stats.earliestTime) {
          stats.earliest = event;
          stats.earliestTime = timestamp;
        }
        if (timestamp > stats.latestTime) {
          stats.latest = event;
          stats.latestTime = timestamp;
        }
      }

      // Dummiest: band with most events
      let maxEventCount = 0;
      let dummiestEvent: BirdEvent | null = null;
      for (const stats of bandStats.values()) {
        if (stats.count > maxEventCount) {
          maxEventCount = stats.count;
          dummiestEvent = stats.latest;
        }
      }

      // Oldest: individual with longest span between earliest and latest event
      let maxSpan = 0;
      let oldestSpanDays = 0;
      let oldestEvent: BirdEvent | null = null;
      for (const stats of bandStats.values()) {
        if (stats.count < 2) continue; // Need at least 2 events for a span
        const spanMs = stats.latestTime - stats.earliestTime;
        if (spanMs > maxSpan) {
          maxSpan = spanMs;
          oldestSpanDays = Math.floor(spanMs / (1000 * 60 * 60 * 24));
          oldestEvent = stats.latest; // Use the latest event
        }
      }

      // If no band with multiple events, use n/a
      // (oldestEvent will remain null, which will be handled in the component)

      // Favorite bander: most repeated bander string
      const { value: favoriteBander, rate: favoriteBanderRate } = computeFavoriteRate(events, (event) => event.bander);

      // Favorite net: most repeated net string
      const { value: favoriteNet, rate: favoriteNetRate } = computeFavoriteRate(events, (event) => event.net);

      // Ensure we have valid events for all required fields
      // oldestEvent can be null if no band has multiple events
      if (biggest && fattest && dummiestEvent) {
        infoMap[speciesCode] = {
          totalCaptures: events.length,
          speciesCode,
          biggest,
          fattest,
          dummiest: dummiestEvent,
          dummiestCount: maxEventCount,
          oldest: oldestEvent, // null if no band has multiple events
          oldestSpanDays: oldestEvent ? oldestSpanDays : -1, // Use -1 to indicate n/a
          favoriteBander,
          favoriteBanderRate,
          favoriteNet,
          favoriteNetRate,
        };
      }
    }

    return infoMap;
  }, [birdEventsMap]);

  // Load entire alpha/ on mount
  useEffect(() => {
    if (!modeChosen) return;
    let cancelled = false;

    const loadAlphaData = async () => {
      try {
        logger.info("DataLoad", `Checking for ${CURRENT_ENVIRONMENT}/ data updates...`);

        // Check if we have cached data
        const cachedData = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);
        const cachedTimestamp = await getLastUpdated(CURRENT_ENVIRONMENT);

        // If no network, go straight to cache
        if (!navigator.onLine) {
          if (cachedData && cachedTimestamp) {
            logger.info("DataLoad", "No network — using cached data");
            populateStateFromData(cachedData);
            setLastSyncedAt(cachedTimestamp);
            setForceOffline(true);
            setIsLoading(false);
            return;
          }
          setError("No network and no cached data. Connect to the internet and reload.");
          setIsLoading(false);
          return;
        }

        // Online — try to get the lastModified timestamp from Firebase
        let firebaseTimestamp: number | null = null;
        try {
          const lastModifiedSnapshot = await get(ref(db, `${CURRENT_ENVIRONMENT}/metadata/lastModified`));
          firebaseTimestamp = lastModifiedSnapshot.exists() ? (lastModifiedSnapshot.val() as number) : null;
        } catch (firebaseErr) {
          logger.warn("DataLoad", "Cannot reach Firebase — will use cached data if available", firebaseErr);
        }

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
          setLastSyncedAt(cachedTimestamp);
          setIsLoading(false);
          return;
        }

        // If local is newer than RTDB, we have unsynced changes — keep local
        if (cachedData && cachedTimestamp && firebaseTimestamp && cachedTimestamp > firebaseTimestamp) {
          logger.info("DataLoad", `Local data is newer than RTDB — using local cache (unsynced changes)`);
          populateStateFromData(cachedData);
          setLastSyncedAt(cachedTimestamp);
          setIsLoading(false);
          return;
        }

        // If we can't reach Firebase but have previously-synced cached data, use it
        if (firebaseTimestamp === null && cachedData && cachedTimestamp) {
          logger.info(
            "DataLoad",
            `Offline — using cached ${CURRENT_ENVIRONMENT}/ data (last synced ${new Date(cachedTimestamp).toLocaleString()})`
          );
          populateStateFromData(cachedData);
          setLastSyncedAt(cachedTimestamp);
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
          setLastSyncedAt(firebaseTimestamp ?? Date.now());

          const loadStats = {
            yearsToProgramMap: Object.keys(data.yearsToProgramMap ?? {}).length,
            programsMap: Object.keys(data.programsMap ?? {}).length,
            bandIdToBirdEventIdsMap: Object.keys(data.bandIdToBirdEventIdsMap ?? {}).length,
            birdEventsMap: Object.keys(data.birdEventsMap ?? {}).length,
            bandGroupsMap: Object.keys(data.bandGroupsMap ?? {}).length,
            DETsMap: Object.keys(data.DETsMap ?? {}).length,
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
          // Last resort: try to use previously-synced cached data on unexpected errors
          try {
            const fallbackData = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);
            const fallbackTimestamp = await getLastUpdated(CURRENT_ENVIRONMENT);
            if (fallbackData && fallbackTimestamp) {
              logger.info("DataLoad", "Using cached data as fallback after error");
              populateStateFromData(fallbackData);
              setLastSyncedAt(fallbackTimestamp);
              return;
            }
          } catch {
            // IndexedDB also failed — nothing we can do
          }
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
      setDETsMap(data.DETsMap ?? {});
      setBandSizeToBandIdMap(data.bandSizeToBandIdMap ?? ({} as Record<BandSize, string>));
      setDismissedConflictsMap(data.dismissedConflictsMap ?? {});
    };

    const CONSTANTS_CACHE_KEY = `constants_${CURRENT_ENVIRONMENT}`;

    const loadConstants = async () => {
      const pendingEvents = await getQueuedEvents();
      const hasPendingBirdEvents = pendingEvents.some((e) => e.type === "bird-event");

      // If no network, load from cache
      if (!navigator.onLine) {
        try {
          const cached = await getDataFromIndexedDB(CONSTANTS_CACHE_KEY);
          if (cached) {
            const constants = cached as unknown as { magicTable?: MagicTable; volunteersMap?: VolunteersMap };
            setMagicTable(constants.magicTable ?? { pyle: {} });
            setVolunteersMap(constants.volunteersMap ?? {});
            logger.info("DataLoad", "No network — loaded constants from cache");
          }
        } catch {
          logger.error("DataLoad", "Failed to load constants from cache");
        }
        return;
      }

      try {
        const constantsSnapshot = await get(ref(db, `constants/${CURRENT_ENVIRONMENT}`));
        if (constantsSnapshot.exists()) {
          const rtdbConstants = constantsSnapshot.val();
          setMagicTable(rtdbConstants.magicTable ?? { pyle: {} });

          if (hasPendingBirdEvents) {
            // Use cached volunteersMap (has offline count increments), but take magicTable from RTDB
            const cached = await getDataFromIndexedDB(CONSTANTS_CACHE_KEY);
            const cachedConstants = cached as unknown as { volunteersMap?: VolunteersMap } | null;
            const volunteersToUse = cachedConstants?.volunteersMap ?? rtdbConstants.volunteersMap ?? {};
            setVolunteersMap(volunteersToUse);
            // Update cache with fresh magicTable but keep local volunteersMap
            await saveDataToIndexedDB(CONSTANTS_CACHE_KEY, { ...rtdbConstants, volunteersMap: volunteersToUse });
            logger.info("DataLoad", "Loaded constants (kept cached volunteersMap due to pending events)", {
              volunteersCount: Object.keys(volunteersToUse).length,
              pendingBirdEvents: pendingEvents.filter((e) => e.type === "bird-event").length,
            });
          } else {
            // No pending events — safe to use RTDB data
            setVolunteersMap(rtdbConstants.volunteersMap ?? {});
            await saveDataToIndexedDB(CONSTANTS_CACHE_KEY, rtdbConstants);
            logger.info("DataLoad", "Loaded constants from RTDB", {
              hasMagicTable: !!rtdbConstants.magicTable,
              volunteersCount: Object.keys(rtdbConstants.volunteersMap ?? {}).length,
            });
          }
        }
      } catch (err) {
        // Offline fallback: load from IndexedDB cache
        logger.warn("DataLoad", "Cannot reach Firebase for constants — trying cache", err);
        try {
          const cached = await getDataFromIndexedDB(CONSTANTS_CACHE_KEY);
          if (cached) {
            const constants = cached as unknown as { magicTable?: MagicTable; volunteersMap?: VolunteersMap };
            setMagicTable(constants.magicTable ?? { pyle: {} });
            setVolunteersMap(constants.volunteersMap ?? {});
            logger.info("DataLoad", "Loaded constants from cache");
          }
        } catch {
          logger.error("DataLoad", "Failed to load constants from cache");
        }
      }
    };

    loadAlphaData();
    loadConstants();

    return () => {
      cancelled = true;
    };
  }, [modeChosen, forceOffline]);

  // Monitor auth state and check if user is admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        if (navigator.onLine) {
          try {
            const roleRef = ref(db, `users/${currentUser.uid}/role`);
            const snapshot = await get(roleRef);
            setIsAdmin(snapshot.val() === "admin");
          } catch {
            setIsAdmin(false);
          }
        } else {
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
      state.birdEventsMap[birdEventId] = birdEvent;

      // 2. If this event modifies a previous event, update the previous event's modifiedEventId
      if (previousEventId && state.birdEventsMap[previousEventId]) {
        const updatedPreviousEvent = {
          ...state.birdEventsMap[previousEventId],
          modifiedEventId: birdEventId,
        };
        await set(ref(db, `${environment}/birdEventsMap/${previousEventId}`), updatedPreviousEvent);
        state.birdEventsMap[previousEventId] = updatedPreviousEvent;
      }

      // 3. Update band ID index — always write (may exist locally but not in RTDB)
      const existingBirdEventIds = state.bandIdToBirdEventIdsMap[band.id] || [];
      if (!existingBirdEventIds.includes(birdEventId)) {
        existingBirdEventIds.push(birdEventId);
        state.bandIdToBirdEventIdsMap[band.id] = existingBirdEventIds;
      }
      await set(ref(db, `${environment}/bandIdToBirdEventIdsMap/${band.id}`), state.bandIdToBirdEventIdsMap[band.id]);

      // 4. Update band group map (only for new captures) — always write
      if (isNewCapture) {
        const bandGroupMapKey = getBandGroupMapKey(band);
        const existingBandGroup = state.bandGroupsMap[bandGroupMapKey];
        if (!existingBandGroup) {
          state.bandGroupsMap[bandGroupMapKey] = { id: bandGroupMapKey, newCaptureIds: [birdEventId] };
        } else if (!existingBandGroup.newCaptureIds.includes(birdEventId)) {
          existingBandGroup.newCaptureIds.push(birdEventId);
        }
        await set(ref(db, `${environment}/bandGroupsMap/${bandGroupMapKey}`), state.bandGroupsMap[bandGroupMapKey]);
      }

      // 5. Update program map — always write
      const existingProgram = state.programsMap[programId];
      if (existingProgram) {
        const bandGroupMapKey = getBandGroupMapKey(band);
        if (isNewCapture) {
          const existingBandGroupIds = existingProgram.bandGroupIds || [];
          if (!existingBandGroupIds.includes(bandGroupMapKey)) {
            existingBandGroupIds.push(bandGroupMapKey);
            existingProgram.bandGroupIds = existingBandGroupIds;
          }
        }
        if (!isNewCapture) {
          const existingRecaptureIds = existingProgram.recaptureIds || [];
          if (!existingRecaptureIds.includes(birdEventId)) {
            existingRecaptureIds.push(birdEventId);
            existingProgram.recaptureIds = existingRecaptureIds;
          }
        }
        await set(ref(db, `${environment}/programsMap/${programId}`), existingProgram);
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
    setLastSyncedAt(now);
  }, []);

  /**
   * Mutex for serializing IndexedDB writes.
   * Prevents concurrent read-modify-write cycles from overwriting each other.
   */
  const idbMutex = useMemo(() => {
    let queue = Promise.resolve();
    return (fn: () => Promise<void>) => {
      queue = queue.then(fn, fn);
      return queue;
    };
  }, []);

  /**
   * Saves data to IndexedDB cache using read-modify-write pattern.
   * Serialized via mutex to prevent concurrent writes from losing data.
   */
  const saveCompleteStateToIndexedDB = useCallback(async (overrides: Partial<DatabaseData>): Promise<void> => {
    await idbMutex(async () => {
      const current = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);
      await saveDataToIndexedDB(CURRENT_ENVIRONMENT, {
        yearsToProgramMap: current?.yearsToProgramMap ?? {},
        programsMap: current?.programsMap ?? {},
        bandIdToBirdEventIdsMap: current?.bandIdToBirdEventIdsMap ?? {},
        birdEventsMap: current?.birdEventsMap ?? {},
        bandGroupsMap: current?.bandGroupsMap ?? {},
        bandSizeToBandIdMap: current?.bandSizeToBandIdMap ?? ({} as Record<BandSize, string>),
        dismissedConflictsMap: current?.dismissedConflictsMap ?? {},
        DETsMap: current?.DETsMap ?? {},
        ...overrides,
      });
      await saveLastUpdated(CURRENT_ENVIRONMENT, Date.now());
    });
  }, [idbMutex]);

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
          if (pending.type === "bird-event") {
            // Handle BirdEvent sync
            const birdEvent = pending.pendingEvent as BirdEvent;
            await syncBirdEventToRTDB(birdEvent, pending.environment, state);

            logger.sync("SyncQueue", `Synced bird event ${successCount + 1}/${pendingEvents.length}`, {
              eventId: birdEvent.id,
            });
          } else if (pending.type === "det") {
            // Handle DET sync
            await set(ref(db, `${pending.environment}/DETsMap/${pending.det.date}`), pending.det);

            logger.sync("SyncQueue", `Synced DET ${successCount + 1}/${pendingEvents.length}`, {
              date: pending.det.date,
            });
          }

          // Remove from queue only after successful sync
          await removeFromQueue(pending.id);
          successCount++;
        } catch (err) {
          logger.error("SyncQueue", `Failed to sync event ${pending.id}`, err);
          // Leave in queue to retry later - continue with remaining events
        }
      }

      // Always update lastModified — programs/maps may have changed even without queued events
      await updateLastModifiedTimestamp();

      // Sync cached maps that may have been modified offline
      if (cachedData.bandSizeToBandIdMap) {
        try {
          await set(ref(db, `${CURRENT_ENVIRONMENT}/bandSizeToBandIdMap`), cachedData.bandSizeToBandIdMap);
          setBandSizeToBandIdMap(cachedData.bandSizeToBandIdMap);
          logger.sync("SyncQueue", "Synced bandSizeToBandIdMap to RTDB");
        } catch (err) {
          logger.error("SyncQueue", "Failed to sync bandSizeToBandIdMap", err);
        }
      }

      if (cachedData.dismissedConflictsMap) {
        try {
          await set(ref(db, `${CURRENT_ENVIRONMENT}/dismissedConflictsMap`), cachedData.dismissedConflictsMap);
          setDismissedConflictsMap(cachedData.dismissedConflictsMap);
          logger.sync("SyncQueue", "Synced dismissedConflictsMap to RTDB");
        } catch (err) {
          logger.error("SyncQueue", "Failed to sync dismissedConflictsMap", err);
        }
      }

      // Bulk-sync all maps from local state (includes mutations from syncBirdEventToRTDB above)
      try {
        await set(ref(db, `${CURRENT_ENVIRONMENT}/programsMap`), state.programsMap);
        await set(ref(db, `${CURRENT_ENVIRONMENT}/yearsToProgramMap`), state.yearsToProgramMap);
        await set(ref(db, `${CURRENT_ENVIRONMENT}/bandGroupsMap`), state.bandGroupsMap);
        // bandIdToBirdEventIdsMap is too large for single set — already written per-event above
        logger.sync("SyncQueue", "Synced all maps to RTDB");
      } catch (err) {
        logger.error("SyncQueue", "Failed to sync maps", err);
      }

      // Sync volunteer counts (stored in constants path, may have been updated offline)
      if (Object.keys(volunteersMap).length > 0) {
        try {
          await set(ref(db, `constants/${CURRENT_ENVIRONMENT}/volunteersMap`), volunteersMap);
          logger.sync("SyncQueue", "Synced volunteersMap to RTDB");
        } catch (err) {
          logger.error("SyncQueue", "Failed to sync volunteersMap", err);
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
      });
    } catch (err) {
      logger.error("SyncQueue", "Error syncing queue", err);
    }
  }, [
    isOnline,
    volunteersMap,
    reconstructBandObjects,
    updateReactStateFromCache,
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

  const persistVolunteersToCache = useCallback(async (newMap: VolunteersMap) => {
    const constantsCacheKey = `constants_${CURRENT_ENVIRONMENT}`;
    try {
      const cached = (await getDataFromIndexedDB(constantsCacheKey)) as unknown as Record<string, unknown> | null;
      await saveDataToIndexedDB(constantsCacheKey, { ...cached, volunteersMap: newMap } as unknown as DatabaseData);
    } catch {
      logger.warn("Volunteers", "Failed to update constants cache");
    }
  }, []);

  const addBirdEvent = useCallback(
    async (captureData: CaptureFormData, bandSize: BandSize, previousEventId: string | undefined) => {
      if (!user && !forceOfflineRef.current) {
        throw new Error("Must be logged in to add bird events");
      }

      try {
        // 1. Create Band and BirdEvent objects
        const birdEventType = captureData.birdEventType as BirdEventType;

        // Ensure inputs have correct padding (defensive)
        const bandGroup = captureData.bandGroup.padStart(7, "0");
        const bandLastTwoDigits = captureData.bandLastTwoDigits.padStart(2, "0");

        const bandPrefix = bandGroup.substring(0, 4);
        const bandSuffix = bandGroup.substring(4) + bandLastTwoDigits;
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
          updatedAt: previousEventId
            ? String(Date.now())
            : String(Date.parse(`${captureData.date} ${captureData.time}`)),
        };

        // 2. Queue the bird event for sync
        const pendingBirdEvent: PendingBirdEvent = {
          id: crypto.randomUUID(),
          type: "bird-event",
          pendingEvent: newBirdEvent,
          timestamp: Date.now(),
          environment: CURRENT_ENVIRONMENT,
          action: previousEventId ? "modified" : "added",
        };
        await addToQueue(pendingBirdEvent);

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

        // New bandGroupsMap (for React state — IndexedDB merge happens atomically in step 5)
        const newBandGroupsMap = { ...bandGroupsMap };
        if (isNewCapture) {
          const bandGroupMapKey = getBandGroupMapKey(band);
          newBandGroupsMap[bandGroupMapKey] = {
            id: bandGroupMapKey,
            newCaptureIds: [...(bandGroupsMap[bandGroupMapKey]?.newCaptureIds || []), newBirdEvent.id],
          };
        }

        // New bandIdToBirdEventIdsMap (for React state)
        const newBandIdToBirdEventIdsMap = {
          ...bandIdToBirdEventIdsMap,
          [band.id]: [...(bandIdToBirdEventIdsMap[band.id] || []), newBirdEvent.id],
        };

        // 4. Increment band size if applicable
        const updatedBandSizeMap =
          bandSize !== BandSize.Other && captureData.bandGroup && captureData.bandLastTwoDigits
            ? await incrementBandSize(bandSize, captureData.bandGroup, captureData.bandLastTwoDigits)
            : bandSizeToBandIdMap;

        // New programsMap
        const existingProgram = programsMap[captureData.programId];
        if (!existingProgram) {
          throw new Error(`Program "${captureData.programId}" not found`);
        }

        const bandGroupMapKey = getBandGroupMapKey(band);
        let newBandGroupIds = existingProgram.bandGroupIds || [];
        if (isNewCapture && !newBandGroupIds.includes(bandGroupMapKey)) {
          newBandGroupIds = [...newBandGroupIds, bandGroupMapKey];
        }

        let newRecaptureIds = existingProgram.recaptureIds || [];
        if (!isNewCapture) {
          newRecaptureIds = [...newRecaptureIds, newBirdEvent.id];
        }

        const eventDate = captureData.date;
        const newFirstCaptureDate =
          !existingProgram.firstCaptureDate || eventDate < existingProgram.firstCaptureDate
            ? eventDate
            : existingProgram.firstCaptureDate;
        const newLastCaptureDate =
          !existingProgram.lastCaptureDate || eventDate > existingProgram.lastCaptureDate
            ? eventDate
            : existingProgram.lastCaptureDate;

        const newProgramsMap = {
          ...programsMap,
          [captureData.programId]: {
            ...existingProgram,
            bandGroupIds: newBandGroupIds,
            recaptureIds: newRecaptureIds,
            firstCaptureDate: newFirstCaptureDate,
            lastCaptureDate: newLastCaptureDate,
          },
        };

        // New yearsToProgramMap
        const existingProgramsInYear = yearsToProgramMap[year] || [];
        const newYearsToProgramMap = {
          ...yearsToProgramMap,
          [year]: existingProgramsInYear.includes(captureData.programId)
            ? existingProgramsInYear
            : [...existingProgramsInYear, captureData.programId],
        };

        // Update volunteersMap — read from cache to avoid stale closure
        const constantsCacheKey = `constants_${CURRENT_ENVIRONMENT}`;
        const cachedConstants = await getDataFromIndexedDB(constantsCacheKey) as unknown as { volunteersMap?: VolunteersMap } | null;
        const latestVolunteersMap = cachedConstants?.volunteersMap ?? volunteersMap;
        const newVolunteersMap = { ...latestVolunteersMap };
        const banderCode = captureData.bander;
        if (banderCode && isNewCapture) {
          const existing = newVolunteersMap[banderCode] ?? {
            code: banderCode,
            fullName: VOLUNTEER_NAMES[banderCode] ?? "",
            totalBanded: 0,
            totalScribed: 0,
          };
          newVolunteersMap[banderCode] = { ...existing, totalBanded: existing.totalBanded + 1 };
        }
        const scribeCode = captureData.scribe;
        if (scribeCode) {
          const existing = newVolunteersMap[scribeCode] ?? {
            code: scribeCode,
            fullName: VOLUNTEER_NAMES[scribeCode] ?? "",
            totalBanded: 0,
            totalScribed: 0,
          };
          newVolunteersMap[scribeCode] = { ...existing, totalScribed: existing.totalScribed + 1 };
        }

        // Check for 1000-milestone on bander
        if (banderCode && isNewCapture) {
          const oldCount = latestVolunteersMap[banderCode]?.totalBanded ?? 0;
          const newCount = newVolunteersMap[banderCode].totalBanded;
          if (Math.floor(newCount / 1000) > Math.floor(oldCount / 1000)) {
            setMilestone({ banderCode, count: newCount });
          }
          // if (newCount === 7098) {
          //   setMilestone({ banderCode, count: newCount });
          // }
        }

        // Update React state
        setBirdEventsMap(newBirdEventsMap);
        setBandIdToBirdEventIdsMap(newBandIdToBirdEventIdsMap);
        setBandGroupsMap(newBandGroupsMap);
        setProgramsMap(newProgramsMap);
        setYearsToProgramMap(newYearsToProgramMap);
        setVolunteersMap(newVolunteersMap);

        // Update selectedProgram if it's the one we just modified
        setSelectedProgram((current) => {
          if (!current || current.id !== captureData.programId) return current;
          return newProgramsMap[captureData.programId];
        });

        // 5. Save to IndexedDB — atomic read-merge-write inside mutex
        await idbMutex(async () => {
          const fresh = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);

          // Merge birdEventsMap
          const mergedBirdEvents = { ...(fresh?.birdEventsMap ?? {}), ...newBirdEventsMap };

          // Merge bandIdToBirdEventIdsMap entry
          const mergedBandIdMap = { ...(fresh?.bandIdToBirdEventIdsMap ?? {}) };
          const existingIds = mergedBandIdMap[band.id] || [];
          if (!existingIds.includes(newBirdEvent.id)) {
            mergedBandIdMap[band.id] = [...existingIds, newBirdEvent.id];
          }

          // Merge bandGroupsMap entry
          const mergedBandGroups = { ...(fresh?.bandGroupsMap ?? {}) };
          if (isNewCapture) {
            const bgKey = getBandGroupMapKey(band);
            const existingGroup = mergedBandGroups[bgKey];
            const existingCaptureIds = existingGroup?.newCaptureIds || [];
            if (!existingCaptureIds.includes(newBirdEvent.id)) {
              mergedBandGroups[bgKey] = { id: bgKey, newCaptureIds: [...existingCaptureIds, newBirdEvent.id] };
            }
          }

          // Merge programsMap entry — apply our deltas to the fresh program, not the stale closure one
          const mergedPrograms = { ...(fresh?.programsMap ?? {}) };
          const freshProgram = mergedPrograms[captureData.programId] ?? existingProgram;
          const mergedBandGroupIds = [...(freshProgram.bandGroupIds || [])];
          if (isNewCapture && !mergedBandGroupIds.includes(bandGroupMapKey)) {
            mergedBandGroupIds.push(bandGroupMapKey);
          }
          const mergedRecaptureIds = [...(freshProgram.recaptureIds || [])];
          if (!isNewCapture && !mergedRecaptureIds.includes(newBirdEvent.id)) {
            mergedRecaptureIds.push(newBirdEvent.id);
          }
          mergedPrograms[captureData.programId] = {
            ...freshProgram,
            bandGroupIds: mergedBandGroupIds,
            recaptureIds: mergedRecaptureIds,
            firstCaptureDate: !freshProgram.firstCaptureDate || eventDate < freshProgram.firstCaptureDate
              ? eventDate : freshProgram.firstCaptureDate,
            lastCaptureDate: !freshProgram.lastCaptureDate || eventDate > freshProgram.lastCaptureDate
              ? eventDate : freshProgram.lastCaptureDate,
          };

          // Merge yearsToProgramMap entry
          const mergedYears = { ...(fresh?.yearsToProgramMap ?? {}) };
          if (!mergedYears[year]) mergedYears[year] = [];
          if (!mergedYears[year].includes(captureData.programId)) {
            mergedYears[year] = [...mergedYears[year], captureData.programId];
          }

          await saveDataToIndexedDB(CURRENT_ENVIRONMENT, {
            yearsToProgramMap: mergedYears,
            programsMap: mergedPrograms,
            bandIdToBirdEventIdsMap: mergedBandIdMap,
            birdEventsMap: mergedBirdEvents,
            bandGroupsMap: mergedBandGroups,
            bandSizeToBandIdMap: updatedBandSizeMap,
            dismissedConflictsMap: fresh?.dismissedConflictsMap ?? {},
            DETsMap: fresh?.DETsMap ?? {},
          });
          // Update local timestamp so we don't overwrite local changes on next load
          await saveLastUpdated(CURRENT_ENVIRONMENT, Date.now());
        });

        // 6. Persist updated volunteer counts
        await persistVolunteersToCache(newVolunteersMap);
        if (isOnline) {
          await set(ref(db, `constants/${CURRENT_ENVIRONMENT}/volunteersMap`), newVolunteersMap);
        }

        // 7. Handle online vs offline sync
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
      volunteersMap,
      isOnline,
      programsMap,
      syncQueue,
      yearsToProgramMap,
      bandSizeToBandIdMap,
      incrementBandSize,
      idbMutex,
      persistVolunteersToCache,
      updateLastModifiedTimestamp,
    ]
  );

  const addProgram = useCallback(
    async (programId: string, displayName: string, year: string) => {
      if (!user && !forceOfflineRef.current) {
        throw new Error("Must be logged in to add programs");
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

        // Save to IndexedDB (works both online and offline)
        await saveCompleteStateToIndexedDB({
          yearsToProgramMap: newYearsToProgramMap,
          programsMap: newProgramsMap,
        });

        // Sync to RTDB if online
        if (isOnline) {
          await set(ref(db, `${CURRENT_ENVIRONMENT}/programsMap/${programId}`), newProgramsMap[programId]);
          if (!yearsToProgramMap[year]) {
            await set(ref(db, `${CURRENT_ENVIRONMENT}/yearsToProgramMap/${year}`), [programId]);
          } else if (!yearsToProgramMap[year].includes(programId)) {
            await set(ref(db, `${CURRENT_ENVIRONMENT}/yearsToProgramMap/${year}`), newYearsToProgramMap[year]);
          }
          await updateLastModifiedTimestamp();
        }

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
      if (!user && !forceOfflineRef.current) {
        throw new Error("Must be logged in to update programs");
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

        // Calculate new state
        const newProgramsMap = {
          ...programsMap,
          [programId]: {
            ...currentProgram,
            displayName: trimmedDisplayName,
          },
        };

        // Update React state
        setProgramsMap(newProgramsMap);

        // Update selectedProgram if it's the one we just modified
        setSelectedProgram((current) => {
          if (!current || current.id !== programId) return current;
          return newProgramsMap[programId];
        });

        // Save to IndexedDB (works both online and offline)
        await saveCompleteStateToIndexedDB({ programsMap: newProgramsMap });

        // Sync to RTDB if online
        if (isOnline) {
          await set(ref(db, `${CURRENT_ENVIRONMENT}/programsMap/${programId}/displayName`), trimmedDisplayName);
          await updateLastModifiedTimestamp();
        }

        logger.info("UpdateProgram", "Program updated", { programId, newDisplayName: trimmedDisplayName });
      } catch (err) {
        logger.error("UpdateProgram", "Error updating program", err);
        throw err;
      }
    },
    [user, isOnline, programsMap, saveCompleteStateToIndexedDB, updateLastModifiedTimestamp]
  );

  const updateBandSizeMap = useCallback(
    async (newBandSizeMap: Record<BandSize, string>) => {
      if (!user && !forceOfflineRef.current) {
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
      if (!user && !forceOfflineRef.current) {
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

  /**
   * Save DET (Daily Effort Table)
   * Follows three-tier sync architecture:
   * 1. Update React state immediately (optimistic UI)
   * 2. Save to IndexedDB
   * 3. Online: sync to RTDB | Offline: queue for later sync
   */
  const saveDET = useCallback(
    async (det: DET) => {
      if (!user && !forceOfflineRef.current) {
        throw new Error("Must be logged in to save DET");
      }

      try {
        // Update React state immediately
        setDETsMap((prev) => ({ ...prev, [det.date]: det }));

        // Save to IndexedDB
        await updateDETInCache(CURRENT_ENVIRONMENT, det);
        logger.info("SaveDET", `DET for ${det.date} saved to IndexedDB`);

        // Handle online vs offline sync
        if (isOnline) {
          // Online: sync to RTDB immediately
          await set(ref(db, `${CURRENT_ENVIRONMENT}/DETsMap/${det.date}`), det);
          await updateLastModifiedTimestamp();
          logger.info("SaveDET", `DET for ${det.date} synced to RTDB`);
        } else {
          // Offline: add to queue for later sync
          const pendingDET: PendingDETEvent = {
            id: `det-${det.date}-${Date.now()}`,
            type: "det",
            det,
            timestamp: Date.now(),
            environment: CURRENT_ENVIRONMENT,
          };
          await addToQueue(pendingDET);
          const newCount = await getQueueCount();
          setPendingCount(newCount);
          logger.info("SaveDET", `DET for ${det.date} queued for sync (offline)`);
        }
      } catch (err) {
        logger.error("SaveDET", `Error saving DET for ${det.date}`, err);
        throw err;
      }
    },
    [user, isOnline, updateLastModifiedTimestamp]
  );

  const resetDismissedConflicts = useCallback(async () => {
    if (!user && !forceOfflineRef.current) {
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
  }, [user, isOnline, saveCompleteStateToIndexedDB, updateLastModifiedTimestamp]);

  const updateVolunteerName = useCallback(
    async (code: string, fullName: string) => {
      if (!user && !forceOfflineRef.current) {
        throw new Error("Must be logged in to update volunteer name");
      }
      if (!isOnline) {
        throw new Error("Cannot update volunteers while offline");
      }

      try {
        const trimmed = fullName.trim();
        const existing = volunteersMap[code];
        if (!existing) return;

        const updated = { ...existing, fullName: trimmed };
        const newMap = { ...volunteersMap, [code]: updated };
        setVolunteersMap(newMap);
        await persistVolunteersToCache(newMap);

        await set(ref(db, `constants/${CURRENT_ENVIRONMENT}/volunteersMap/${code}/fullName`), trimmed);
      } catch (err) {
        logger.error("UpdateVolunteerName", `Error updating volunteer ${code}`, err);
        throw err;
      }
    },
    [user, isOnline, volunteersMap, persistVolunteersToCache]
  );

  const addVolunteer = useCallback(
    async (code: string, fullName: string) => {
      if (!user && !forceOfflineRef.current) {
        throw new Error("Must be logged in to add volunteer");
      }
      if (!isOnline) {
        throw new Error("Cannot add volunteers while offline");
      }

      const trimmedCode = code.trim().toUpperCase();
      const trimmedName = fullName.trim();
      if (!trimmedCode) throw new Error("Code is required");
      if (volunteersMap[trimmedCode]) throw new Error(`Volunteer "${trimmedCode}" already exists`);

      const newVolunteer: Volunteer = { code: trimmedCode, fullName: trimmedName, totalBanded: 0, totalScribed: 0 };
      const newMap = { ...volunteersMap, [trimmedCode]: newVolunteer };
      setVolunteersMap(newMap);
      await persistVolunteersToCache(newMap);

      await set(ref(db, `constants/${CURRENT_ENVIRONMENT}/volunteersMap/${trimmedCode}`), newVolunteer);
      logger.info("AddVolunteer", `Added volunteer ${trimmedCode}`);
    },
    [user, isOnline, volunteersMap, persistVolunteersToCache]
  );

  return (
    <DataContext.Provider
      value={{
        isLoading,
        error,
        isLoggedIn: !!user || forceOffline,
        isAdmin,
        userEmail: user?.email ?? null,
        signOut: async () => {
          await firebaseSignOut(auth);
        },
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
        DETsMap,
        volunteersMap,
        speciesInfoMap,
        isOnline,
        pendingCount,
        lastSyncedAt,
        forceOffline,
        setForceOffline,
        modeChosen,
        chooseOnline,
        chooseOffline,
        addBirdEvent,
        addProgram,
        updateProgram,
        syncQueue,
        updateBandSizeMap,
        incrementBandSize,
        dismissConflict,
        resetDismissedConflicts,
        saveDET,
        updateVolunteerName,
        addVolunteer,
        milestone,
        clearMilestone: () => setMilestone(null),
        triggerTestMilestone: () => setMilestone({ banderCode: "TST", count: 3000 }),
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
