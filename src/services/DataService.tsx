import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { get, ref, set, update } from "firebase/database";
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
  const [volunteersFullNameMap, setVolunteersFullNameMap] = useState<Record<string, string>>({});

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

    const loadData = async () => {
      try {
        logger.info("DataLoad", `Checking for ${CURRENT_ENVIRONMENT}/ data updates...`);

        // Check if we have cached data
        const cachedData = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);
        const cachedTimestamp = await getLastUpdated(CURRENT_ENVIRONMENT);

        // If offline (no network or user chose offline), go straight to cache
        if (forceOffline) {
          if (cachedData && cachedTimestamp) {
            logger.info("DataLoad", "Offline — using cached data");
            populateStateFromData(cachedData);
            setLastSyncedAt(cachedTimestamp);
            setIsLoading(false);
            return;
          }
          setError("No cached data available. Connect to the internet and reload.");
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
      setVolunteersMap(data.volunteersMap ?? {});
    };

    const CONSTANTS_CACHE_KEY = `constants_${CURRENT_ENVIRONMENT}`;

    const loadConstants = async () => {
      if (forceOffline) {
        try {
          const cached = await getDataFromIndexedDB(CONSTANTS_CACHE_KEY);
          if (cached) {
            const constants = cached as unknown as { magicTable?: MagicTable; volunteersFullNameMap?: Record<string, string> };
            setMagicTable(constants.magicTable ?? { pyle: {} });
            setVolunteersFullNameMap(constants.volunteersFullNameMap ?? {});
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
          setVolunteersFullNameMap(rtdbConstants.volunteersFullNameMap ?? {});
          await saveDataToIndexedDB(CONSTANTS_CACHE_KEY, rtdbConstants);
          logger.info("DataLoad", "Loaded constants", {
            hasMagicTable: !!rtdbConstants.magicTable,
            namesCount: Object.keys(rtdbConstants.volunteersFullNameMap ?? {}).length,
          });
        }
      } catch (err) {
        logger.warn("DataLoad", "Cannot reach Firebase for constants — trying cache", err);
        try {
          const cached = await getDataFromIndexedDB(CONSTANTS_CACHE_KEY);
          if (cached) {
            const constants = cached as unknown as { magicTable?: MagicTable; volunteersFullNameMap?: Record<string, string> };
            setMagicTable(constants.magicTable ?? { pyle: {} });
            setVolunteersFullNameMap(constants.volunteersFullNameMap ?? {});
            logger.info("DataLoad", "Loaded constants from cache");
          }
        } catch {
          logger.error("DataLoad", "Failed to load constants from cache");
        }
      }
    };

    loadData();
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
        if (!forceOfflineRef.current) {
          try {
            const roleRef = ref(db, `users/${currentUser.uid}/role`);
            const snapshot = await get(roleRef);
            setIsAdmin(snapshot.val() === "admin");
          } catch {
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
  }, []);

  /**
   * SYNC ARCHITECTURE
   * =================
   * Offline: only addBirdEvent allowed — queued to IndexedDB, React state updated for UI
   * Online: all actions write directly to RTDB
   * Sync: write queued events to RTDB, then rebuild ALL derived maps from birdEventsMap
   */

  /** Reconstructs Band class instances from serialized IndexedDB data. */
  const reconstructBandObjects = useCallback((birdEventsMap: BirdEventsMap): BirdEventsMap => {
    return Object.fromEntries(
      Object.entries(birdEventsMap).map(([id, event]) => [
        id,
        { ...event, band: new Band(event.band.bandPrefix, event.band.bandSuffix) },
      ])
    );
  }, []);

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
  /**
   * Rebuilds all derived maps from birdEventsMap.
   * This is the single source of truth — all index maps are computed from events.
   */
  const rebuildMapsFromEvents = useCallback(
    (allEvents: BirdEventsMap, existingPrograms: ProgramsMap, fullNameMap: Record<string, string>) => {
      const bandIdMap: BandIdToBirdEventIdsMap = {};
      const bandGroups: BandGroupsMap = {};
      const programs: ProgramsMap = {};
      const years: YearToProgramMap = {};
      const volCounts: VolunteersMap = {};

      // First pass: build bandIdToBirdEventIdsMap from ALL events (including superseded)
      for (const [id, ev] of Object.entries(allEvents)) {
        if (!ev || !ev.date) continue;
        const bandId = ev.band?.bandPrefix && ev.band?.bandSuffix
          ? new Band(ev.band.bandPrefix, ev.band.bandSuffix).id
          : "";
        if (bandId) {
          if (!bandIdMap[bandId]) bandIdMap[bandId] = [];
          if (!bandIdMap[bandId].includes(id)) bandIdMap[bandId].push(id);
        }
      }

      // Second pass: build other derived maps from active events only
      for (const [id, ev] of Object.entries(allEvents)) {
        if (!ev || !ev.date || ev.modifiedEventId) continue;

        const isNewCapture = ev.birdEventType === BirdEventType.Banded || ev.birdEventType === BirdEventType.None;
        const bgKey = ev.band?.bandPrefix && ev.band?.bandSuffix
          ? getBandGroupMapKey(new Band(ev.band.bandPrefix, ev.band.bandSuffix))
          : "";
        const pid = ev.programId || "NONE";
        const year = ev.date.slice(0, 4);

        // bandGroupsMap
        if (bgKey && isNewCapture) {
          if (!bandGroups[bgKey]) bandGroups[bgKey] = { id: bgKey, newCaptureIds: [] };
          if (!bandGroups[bgKey].newCaptureIds.includes(id)) bandGroups[bgKey].newCaptureIds.push(id);
        }

        // programsMap
        if (!programs[pid]) {
          const existing = existingPrograms[pid];
          programs[pid] = { id: pid, displayName: existing?.displayName ?? pid, bandGroupIds: [], recaptureIds: [] };
        }
        if (isNewCapture && bgKey && !programs[pid].bandGroupIds.includes(bgKey)) programs[pid].bandGroupIds.push(bgKey);
        if (!isNewCapture && !programs[pid].recaptureIds.includes(id)) programs[pid].recaptureIds.push(id);
        if (!programs[pid].firstCaptureDate || ev.date < programs[pid].firstCaptureDate) programs[pid].firstCaptureDate = ev.date;
        if (!programs[pid].lastCaptureDate || ev.date > programs[pid].lastCaptureDate) programs[pid].lastCaptureDate = ev.date;

        // yearsToProgramMap
        if (!years[year]) years[year] = [];
        if (!years[year].includes(pid)) years[year].push(pid);

        // volunteer counts
        if (ev.bander && isNewCapture) {
          if (!volCounts[ev.bander]) volCounts[ev.bander] = { code: ev.bander, fullName: fullNameMap[ev.bander] ?? "", totalBanded: 0, totalScribed: 0 };
          volCounts[ev.bander].totalBanded++;
        }
        if (ev.scribe) {
          if (!volCounts[ev.scribe]) volCounts[ev.scribe] = { code: ev.scribe, fullName: fullNameMap[ev.scribe] ?? "", totalBanded: 0, totalScribed: 0 };
          volCounts[ev.scribe].totalScribed++;
        }
      }

      // Preserve programs that exist but have no events
      for (const [pid, prog] of Object.entries(existingPrograms)) {
        if (!programs[pid]) programs[pid] = { ...prog };
      }

      return { bandIdMap, bandGroups, programs, years, volCounts };
    },
    []
  );

  const syncQueue = useCallback(async () => {
    if (!isOnline) return;

    try {
      const pendingEvents = await getQueuedEvents();
      logger.sync("SyncQueue", `Syncing ${pendingEvents.length} pending events...`);

      // 1. Write each queued bird event to RTDB
      let successCount = 0;
      for (const pending of pendingEvents) {
        try {
          if (pending.type === "bird-event") {
            const birdEvent = pending.pendingEvent as BirdEvent;
            await set(ref(db, `${pending.environment}/birdEventsMap/${birdEvent.id}`), birdEvent);

            // If this modifies a previous event, update it too
            if (birdEvent.previousEventId) {
              const prevSnap = await get(ref(db, `${pending.environment}/birdEventsMap/${birdEvent.previousEventId}`));
              if (prevSnap.exists()) {
                await set(ref(db, `${pending.environment}/birdEventsMap/${birdEvent.previousEventId}/modifiedEventId`), birdEvent.id);
              }
            }

            logger.sync("SyncQueue", `Synced bird event ${successCount + 1}/${pendingEvents.length}`, { eventId: birdEvent.id });
          } else if (pending.type === "det") {
            await set(ref(db, `${pending.environment}/DETsMap/${pending.det.date}`), pending.det);
            logger.sync("SyncQueue", `Synced DET ${successCount + 1}/${pendingEvents.length}`, { date: pending.det.date });
          }
          await removeFromQueue(pending.id);
          successCount++;
        } catch (err) {
          logger.error("SyncQueue", `Failed to sync event ${pending.id}`, err);
        }
      }

      // 2. Read the full birdEventsMap from RTDB and rebuild all derived maps
      logger.sync("SyncQueue", "Rebuilding derived maps from RTDB birdEventsMap...");
      const [eventsSnap, existingProgramsSnap] = await Promise.all([
        get(ref(db, `${CURRENT_ENVIRONMENT}/birdEventsMap`)),
        get(ref(db, `${CURRENT_ENVIRONMENT}/programsMap`)),
      ]);

      if (eventsSnap.exists()) {
        const allEvents = eventsSnap.val() as BirdEventsMap;
        const existingPrograms = existingProgramsSnap.exists() ? existingProgramsSnap.val() as ProgramsMap : {};
        // Load fullNameMap from constants cache
        const constantsCacheKey = `constants_${CURRENT_ENVIRONMENT}`;
        const cachedConstants = await getDataFromIndexedDB(constantsCacheKey) as unknown as { volunteersFullNameMap?: Record<string, string> } | null;
        const fullNameMap = cachedConstants?.volunteersFullNameMap ?? volunteersFullNameMap;

        const { bandIdMap, bandGroups, programs, years, volCounts } = rebuildMapsFromEvents(allEvents, existingPrograms, fullNameMap);

        // 3. Write rebuilt maps to RTDB
        await set(ref(db, `${CURRENT_ENVIRONMENT}/bandGroupsMap`), bandGroups);
        await set(ref(db, `${CURRENT_ENVIRONMENT}/programsMap`), programs);
        await set(ref(db, `${CURRENT_ENVIRONMENT}/yearsToProgramMap`), years);
        // bandIdToBirdEventIdsMap is too large for single set — write in batches
        const bandIdEntries = Object.entries(bandIdMap);
        for (let i = 0; i < bandIdEntries.length; i += 1000) {
          const batch: Record<string, string[]> = {};
          for (const [k, v] of bandIdEntries.slice(i, i + 1000)) batch[k] = v;
          await update(ref(db, `${CURRENT_ENVIRONMENT}/bandIdToBirdEventIdsMap`), batch);
        }

        // Write volunteersMap to env path
        await set(ref(db, `${CURRENT_ENVIRONMENT}/volunteersMap`), volCounts);

        // Sync bandSizeToBandIdMap from local cache
        const cachedData = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);
        if (cachedData?.bandSizeToBandIdMap) {
          await set(ref(db, `${CURRENT_ENVIRONMENT}/bandSizeToBandIdMap`), cachedData.bandSizeToBandIdMap);
        }

        // 4. Update timestamps
        await updateLastModifiedTimestamp();

        // 5. Save rebuilt data to IndexedDB and update React state
        const rebuiltBirdEventsMap = reconstructBandObjects(allEvents);
        await saveDataToIndexedDB(CURRENT_ENVIRONMENT, {
          birdEventsMap: allEvents,
          bandIdToBirdEventIdsMap: bandIdMap,
          bandGroupsMap: bandGroups,
          programsMap: programs,
          yearsToProgramMap: years,
          bandSizeToBandIdMap: cachedData?.bandSizeToBandIdMap ?? ({} as Record<BandSize, string>),
          dismissedConflictsMap: cachedData?.dismissedConflictsMap ?? {},
          DETsMap: cachedData?.DETsMap ?? {},
          volunteersMap: volCounts,
        });
        await saveLastUpdated(CURRENT_ENVIRONMENT, Date.now());

        setBirdEventsMap(rebuiltBirdEventsMap);
        setBandIdToBirdEventIdsMap(bandIdMap);
        setBandGroupsMap(bandGroups);
        setProgramsMap(programs);
        setYearsToProgramMap(years);
        setVolunteersMap(volCounts);
        setSelectedProgram((current) => {
          if (!current) return null;
          return programs[current.id] || current;
        });

        logger.sync("SyncQueue", "Rebuild complete", {
          bands: Object.keys(bandIdMap).length,
          groups: Object.keys(bandGroups).length,
          programs: Object.keys(programs).length,
        });
      }

      const remainingCount = await getQueueCount();
      setPendingCount(remainingCount);

      logger.sync("SyncQueue", `Queue sync completed`, { succeeded: successCount, total: pendingEvents.length, remaining: remainingCount });
    } catch (err) {
      logger.error("SyncQueue", "Error syncing queue", err);
    }
  }, [
    isOnline,
    reconstructBandObjects,
    rebuildMapsFromEvents,
    volunteersFullNameMap,
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

      setBandSizeToBandIdMap(updatedMap);
      await saveCompleteStateToIndexedDB({ bandSizeToBandIdMap: updatedMap });

      if (isOnline) {
        await set(ref(db, `${CURRENT_ENVIRONMENT}/bandSizeToBandIdMap/${bandSize}`), nextBandId);
      }

      return updatedMap;
    },
    [bandSizeToBandIdMap, isOnline, saveCompleteStateToIndexedDB]
  );



  const addBirdEvent = useCallback(
    async (captureData: CaptureFormData, bandSize: BandSize, previousEventId: string | undefined) => {
      if (!user && !forceOfflineRef.current) {
        throw new Error("Must be logged in to add bird events");
      }

      try {
        // 1. Create Band and BirdEvent objects
        const birdEventType = captureData.birdEventType as BirdEventType;
        const bandGroup = captureData.bandGroup.padStart(7, "0");
        const bandLastTwoDigits = captureData.bandLastTwoDigits.padStart(2, "0");
        const bandPrefix = bandGroup.substring(0, 4);
        const bandSuffix = bandGroup.substring(4) + bandLastTwoDigits;
        const band = new Band(bandPrefix, bandSuffix);
        const isNewCapture = birdEventType === BirdEventType.Banded || birdEventType === BirdEventType.None;

        const newBirdEvent: BirdEvent = {
          id: generateBirdEventId(band.id, captureData.date, captureData.net, captureData.wing, captureData.weight, previousEventId !== undefined),
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
          type: "bird-event",
          pendingEvent: newBirdEvent,
          timestamp: Date.now(),
          environment: CURRENT_ENVIRONMENT,
          action: previousEventId ? "modified" : "added",
        } as PendingBirdEvent);

        // 3. Update React state for immediate UI feedback
        const newBirdEventsMap = { ...birdEventsMap, [newBirdEvent.id]: newBirdEvent };
        if (previousEventId && birdEventsMap[previousEventId]) {
          newBirdEventsMap[previousEventId] = { ...birdEventsMap[previousEventId], modifiedEventId: newBirdEvent.id };
        }

        const newBandIdToBirdEventIdsMap = {
          ...bandIdToBirdEventIdsMap,
          [band.id]: [...(bandIdToBirdEventIdsMap[band.id] || []), newBirdEvent.id],
        };

        const newBandGroupsMap = { ...bandGroupsMap };
        if (isNewCapture) {
          const bgKey = getBandGroupMapKey(band);
          newBandGroupsMap[bgKey] = {
            id: bgKey,
            newCaptureIds: [...(bandGroupsMap[bgKey]?.newCaptureIds || []), newBirdEvent.id],
          };
        }

        const existingProgram = programsMap[captureData.programId];
        if (!existingProgram) throw new Error(`Program "${captureData.programId}" not found`);
        const bandGroupMapKey = getBandGroupMapKey(band);
        const year = captureData.date.substring(0, 4);
        const eventDate = captureData.date;

        const newProgramsMap = {
          ...programsMap,
          [captureData.programId]: {
            ...existingProgram,
            bandGroupIds: isNewCapture && !existingProgram.bandGroupIds.includes(bandGroupMapKey)
              ? [...existingProgram.bandGroupIds, bandGroupMapKey] : existingProgram.bandGroupIds,
            recaptureIds: !isNewCapture ? [...existingProgram.recaptureIds, newBirdEvent.id] : existingProgram.recaptureIds,
            firstCaptureDate: !existingProgram.firstCaptureDate || eventDate < existingProgram.firstCaptureDate ? eventDate : existingProgram.firstCaptureDate,
            lastCaptureDate: !existingProgram.lastCaptureDate || eventDate > existingProgram.lastCaptureDate ? eventDate : existingProgram.lastCaptureDate,
          },
        };

        const existingProgramsInYear = yearsToProgramMap[year] || [];
        const newYearsToProgramMap = {
          ...yearsToProgramMap,
          [year]: existingProgramsInYear.includes(captureData.programId) ? existingProgramsInYear : [...existingProgramsInYear, captureData.programId],
        };

        // Volunteer counts (React state only — rebuilt on sync)
        const newVolunteersMap = { ...volunteersMap };
        if (captureData.bander && isNewCapture) {
          const existing = newVolunteersMap[captureData.bander] ?? { code: captureData.bander, fullName: volunteersFullNameMap[captureData.bander] ?? "", totalBanded: 0, totalScribed: 0 };
          const oldCount = existing.totalBanded;
          newVolunteersMap[captureData.bander] = { ...existing, totalBanded: oldCount + 1 };
          if (Math.floor((oldCount + 1) / 1000) > Math.floor(oldCount / 1000)) {
            setMilestone({ banderCode: captureData.bander, count: oldCount + 1 });
          }
        }
        if (captureData.scribe) {
          const existing = newVolunteersMap[captureData.scribe] ?? { code: captureData.scribe, fullName: volunteersFullNameMap[captureData.scribe] ?? "", totalBanded: 0, totalScribed: 0 };
          newVolunteersMap[captureData.scribe] = { ...existing, totalScribed: existing.totalScribed + 1 };
        }

        setBirdEventsMap(newBirdEventsMap);
        setBandIdToBirdEventIdsMap(newBandIdToBirdEventIdsMap);
        setBandGroupsMap(newBandGroupsMap);
        setProgramsMap(newProgramsMap);
        setYearsToProgramMap(newYearsToProgramMap);
        setVolunteersMap(newVolunteersMap);
        setSelectedProgram((current) => {
          if (!current || current.id !== captureData.programId) return current;
          return newProgramsMap[captureData.programId];
        });

        // 4. Save all state to IndexedDB (so offline refresh works)
        // Derived maps are best-effort for UI — rebuilt authoritatively on sync
        await saveCompleteStateToIndexedDB({
          birdEventsMap: newBirdEventsMap,
          bandIdToBirdEventIdsMap: newBandIdToBirdEventIdsMap,
          bandGroupsMap: newBandGroupsMap,
          programsMap: newProgramsMap,
          yearsToProgramMap: newYearsToProgramMap,
        });

        // 5. Online: fire-and-forget sync
        if (isOnline) {
          (async () => {
            try {
              await syncQueue();
            } catch (err) {
              logger.warn("AddBirdEvent", "Online sync failed — will retry on next sync", err);
            }
          })();
        }

        const count = await getQueueCount();
        setPendingCount(count);
        logger.info("AddBirdEvent", "Bird event added", { eventId: newBirdEvent.id, programId: captureData.programId });
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
      volunteersFullNameMap,
      isOnline,
      programsMap,
      syncQueue,
      yearsToProgramMap,
      saveCompleteStateToIndexedDB,
    ]
  );

  const addProgram = useCallback(
    async (programId: string, displayName: string, year: string) => {
      if (!user) throw new Error("Must be logged in to add programs");
      if (!isOnline) throw new Error("Cannot add programs while offline");
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

        // Write to RTDB
        await set(ref(db, `${CURRENT_ENVIRONMENT}/programsMap/${programId}`), newProgramsMap[programId]);
        await set(ref(db, `${CURRENT_ENVIRONMENT}/yearsToProgramMap/${year}`), newYearsToProgramMap[year]);
        await updateLastModifiedTimestamp();

        // Save to IndexedDB
        await saveCompleteStateToIndexedDB({ yearsToProgramMap: newYearsToProgramMap, programsMap: newProgramsMap });

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
      if (!user) throw new Error("Must be logged in to update programs");
      if (!isOnline) throw new Error("Cannot update programs while offline");
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

        // Write to RTDB
        await set(ref(db, `${CURRENT_ENVIRONMENT}/programsMap/${programId}/displayName`), trimmedDisplayName);
        await updateLastModifiedTimestamp();

        // Save to IndexedDB
        await saveCompleteStateToIndexedDB({ programsMap: newProgramsMap });

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
      if (!user) throw new Error("Must be logged in to update band size map");
      if (!isOnline) throw new Error("Cannot update band sizes while offline");

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
      if (!user) throw new Error("Must be logged in to dismiss conflicts");
      if (!isOnline) throw new Error("Cannot dismiss conflicts while offline");

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
      if (!user) throw new Error("Must be logged in to save DET");
      if (!isOnline) throw new Error("Cannot save DETs while offline");

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
    if (!user) throw new Error("Must be logged in to reset dismissed conflicts");
    if (!isOnline) throw new Error("Cannot reset dismissed conflicts while offline");

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
      if (!user) throw new Error("Must be logged in to update volunteer name");
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

        // Update both env volunteersMap and constants fullNameMap
        await set(ref(db, `${CURRENT_ENVIRONMENT}/volunteersMap/${code}/fullName`), trimmed);
        await set(ref(db, `constants/${CURRENT_ENVIRONMENT}/volunteersFullNameMap/${code}`), trimmed);
        setVolunteersFullNameMap((prev) => ({ ...prev, [code]: trimmed }));
        await saveCompleteStateToIndexedDB({ volunteersMap: newMap });
      } catch (err) {
        logger.error("UpdateVolunteerName", `Error updating volunteer ${code}`, err);
        throw err;
      }
    },
    [user, isOnline, volunteersMap, saveCompleteStateToIndexedDB]
  );

  const addVolunteer = useCallback(
    async (code: string, fullName: string) => {
      if (!user) throw new Error("Must be logged in to add volunteer");
      if (!isOnline) throw new Error("Cannot add volunteers while offline");

      const trimmedCode = code.trim().toUpperCase();
      const trimmedName = fullName.trim();
      if (!trimmedCode) throw new Error("Code is required");
      if (volunteersMap[trimmedCode]) throw new Error(`Volunteer "${trimmedCode}" already exists`);

      const newVolunteer: Volunteer = { code: trimmedCode, fullName: trimmedName, totalBanded: 0, totalScribed: 0 };
      const newMap = { ...volunteersMap, [trimmedCode]: newVolunteer };
      setVolunteersMap(newMap);

      // Write to env path and update constants fullNameMap
      await set(ref(db, `${CURRENT_ENVIRONMENT}/volunteersMap/${trimmedCode}`), newVolunteer);
      if (trimmedName) {
        await set(ref(db, `constants/${CURRENT_ENVIRONMENT}/volunteersFullNameMap/${trimmedCode}`), trimmedName);
        setVolunteersFullNameMap((prev) => ({ ...prev, [trimmedCode]: trimmedName }));
      }
      await saveCompleteStateToIndexedDB({ volunteersMap: newMap });
      logger.info("AddVolunteer", `Added volunteer ${trimmedCode}`);
    },
    [user, isOnline, volunteersMap, saveCompleteStateToIndexedDB]
  );

  return (
    <DataContext.Provider
      value={{
        isLoading,
        error,
        isLoggedIn: !!user || forceOfflineRef.current,
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
