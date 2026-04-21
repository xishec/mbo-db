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
  const [loadingStatus, setLoadingStatus] = useState("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [forceOffline, setForceOffline] = useState(!navigator.onLine);
  const [modeChosen, setModeChosen] = useState(false);
  const [milestone, setMilestone] = useState<{ banderCode: string; count: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<"success" | "error" | null>(null);
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

  // Compute bandSizeToBandIdMap: for each band size, find the most recent event (by date+time), take its band ID, increment by 1
  const bandSizeToBandIdMap = useMemo(() => {
    const latestPerSize = new Map<string, { bandId: string; timestamp: number }>();

    for (const ev of Object.values(birdEventsMap)) {
      if (!ev || ev.modifiedEventId || !ev.band?.bandSize || ev.band.bandSize === BandSize.Other) continue;
      const size = ev.band.bandSize;
      const timestamp = Date.parse(`${ev.date}T${ev.time || "00:00"}`);
      const existing = latestPerSize.get(size);
      if (!existing || timestamp > existing.timestamp) {
        latestPerSize.set(size, { bandId: ev.band.id, timestamp });
      }
    }

    const map = {} as Record<BandSize, string>;
    for (const [size, { bandId }] of latestPerSize) {
      const nextBandId = (parseInt(bandId, 10) + 1).toString().padStart(9, "0");
      map[size as BandSize] = nextBandId;
    }
    return map;
  }, [birdEventsMap]);

  // Load entire alpha/ on mount
  useEffect(() => {
    if (!modeChosen) return;
    let cancelled = false;

    const loadData = async () => {
      try {
        logger.info("DataLoad", `Loading ${CURRENT_ENVIRONMENT}/ data...`);
        const cachedData = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);
        const cachedSyncedAt = await getLastUpdated(CURRENT_ENVIRONMENT);

        // Offline: use cache
        if (forceOffline) {
          if (cachedData) {
            setLoadingStatus("Loading cached data...");
            populateStateFromData(cachedData);
            setLastSyncedAt(cachedSyncedAt ?? Date.now());
            setIsLoading(false);
            return;
          }
          setError("No cached data available. Connect to the internet and reload.");
          setIsLoading(false);
          return;
        }

        // Online: incremental or full load
        const env = CURRENT_ENVIRONMENT;
        let allEvents: BirdEventsMap;

        if (cachedData?.birdEventsMap && cachedSyncedAt) {
          // Incremental: fetch only new events since last sync
          setLoadingStatus("Checking for new events...");
          try {
            const { query: fbQuery, orderByChild, startAt } = await import("firebase/database");
            const deltaSnap = await get(fbQuery(ref(db, `${env}/birdEventsMap`), orderByChild("syncedAt"), startAt(cachedSyncedAt)));
            const deltaEvents = deltaSnap.exists() ? deltaSnap.val() as BirdEventsMap : {};
            const deltaCount = Object.keys(deltaEvents).length;
            logger.info("DataLoad", `Incremental: ${deltaCount} new events`);
            setLoadingStatus(`Merging ${deltaCount} new events...`);
            allEvents = { ...cachedData.birdEventsMap, ...deltaEvents };
          } catch {
            logger.warn("DataLoad", "Incremental load failed, falling back to full load");
            setLoadingStatus("Downloading all events...");
            const fullSnap = await get(ref(db, `${env}/birdEventsMap`));
            allEvents = fullSnap.exists() ? fullSnap.val() : {};
          }
        } else {
          // Full load: first time
          setLoadingStatus("Downloading all events...");
          const fullSnap = await get(ref(db, `${env}/birdEventsMap`));
          if (!fullSnap.exists()) {
            setError(`Error: ${CURRENT_ENVIRONMENT}/ is missing from the database.`);
            return;
          }
          allEvents = fullSnap.val();
        }

        if (cancelled) return;

        // Fetch independent maps (small, always fetch)
        setLoadingStatus("Downloading independent data...");
        const [dismissedSnap, DETsSnap] = await Promise.all([
          get(ref(db, `${env}/dismissedConflictsMap`)),
          get(ref(db, `${env}/DETsMap`)),
        ]);

        if (cancelled) return;

        // Rebuild all derived maps locally
        setLoadingStatus("Rebuilding maps...");
        const { bandIdMap, bandGroups, programs, years, volCounts } = rebuildMapsFromEvents(allEvents, volunteersFullNameMap);

        const reconstructed = Object.fromEntries(
          Object.entries(allEvents).map(([id, event]) => [
            id,
            { ...event, band: new Band(event.band.bandPrefix, event.band.bandSuffix, event.band.bandSize ?? null) },
          ])
        );

        const data: DatabaseData = {
          birdEventsMap: allEvents,
          programsMap: programs,
          bandGroupsMap: bandGroups,
          bandIdToBirdEventIdsMap: bandIdMap,
          yearsToProgramMap: years,
          bandSizeToBandIdMap: {} as Record<BandSize, string>,
          dismissedConflictsMap: dismissedSnap.exists() ? dismissedSnap.val() : {},
          DETsMap: DETsSnap.exists() ? DETsSnap.val() : {},
          volunteersMap: volCounts,
        };

        setLoadingStatus("Saving to cache...");
        const now = Date.now();
        await saveDataToIndexedDB(CURRENT_ENVIRONMENT, data);
        await saveLastUpdated(CURRENT_ENVIRONMENT, now);

        setBirdEventsMap(reconstructed);
        setBandIdToBirdEventIdsMap(bandIdMap);
        setBandGroupsMap(bandGroups);
        setProgramsMap(programs);
        setYearsToProgramMap(years);
        setVolunteersMap(volCounts);
        setDismissedConflictsMap(data.dismissedConflictsMap);
        setDETsMap(data.DETsMap ?? {});
        setLastSyncedAt(now);
        setLoadingStatus("Ready");

        logger.info("DataLoad", `Load complete`, { events: Object.keys(allEvents).length });
      } catch (err) {
        logger.error("DataLoad", `Error loading data`, err);
        if (!cancelled) {
          try {
            const fallbackData = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);
            if (fallbackData) {
              populateStateFromData(fallbackData);
              setLastSyncedAt(Date.now());
              return;
            }
          } catch { /* IndexedDB also failed */ }
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const populateStateFromData = (data: DatabaseData) => {
      const { bandIdMap, bandGroups, programs, years, volCounts } = rebuildMapsFromEvents(data.birdEventsMap ?? {}, volunteersFullNameMap);
      setBirdEventsMap(
        Object.fromEntries(
          Object.entries(data.birdEventsMap ?? {}).map(([id, event]) => [
            id,
            { ...event, band: new Band(event.band.bandPrefix, event.band.bandSuffix, event.band.bandSize ?? null) },
          ])
        )
      );
      setBandIdToBirdEventIdsMap(bandIdMap);
      setBandGroupsMap(bandGroups);
      setProgramsMap(programs);
      setYearsToProgramMap(years);
      setVolunteersMap(volCounts);
      setDETsMap(data.DETsMap ?? {});
      setDismissedConflictsMap(data.dismissedConflictsMap ?? {});
    };

    const CONSTANTS_CACHE_KEY = `constants_cache`;

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
        const constantsSnapshot = await get(ref(db, `constants`));
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
        bandSizeToBandIdMap: {} as Record<BandSize, string>,
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
    (allEvents: BirdEventsMap, fullNameMap: Record<string, string>) => {
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
          programs[pid] = { id: pid, displayName: pid, bandGroupIds: [], recaptureIds: [] };
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

      return { bandIdMap, bandGroups, programs, years, volCounts };
    },
    []
  );

  const syncQueue = useCallback(async () => {
    if (!isOnline) return;

    try {
      const pendingEvents = await getQueuedEvents();
      logger.sync("SyncQueue", `Syncing ${pendingEvents.length} pending events...`);
      const now = Date.now();

      // Write each queued event to RTDB with syncedAt
      let successCount = 0;
      for (const pending of pendingEvents) {
        try {
          if (pending.type === "bird-event") {
            const birdEvent = pending.pendingEvent as BirdEvent;
            await set(ref(db, `${pending.environment}/birdEventsMap/${birdEvent.id}`), { ...birdEvent, syncedAt: now });

            if (birdEvent.previousEventId) {
              await set(ref(db, `${pending.environment}/birdEventsMap/${birdEvent.previousEventId}/modifiedEventId`), birdEvent.id);
            }
          } else if (pending.type === "det") {
            await set(ref(db, `${pending.environment}/DETsMap/${pending.det.date}`), pending.det);
          }
          await removeFromQueue(pending.id);
          successCount++;
        } catch (err) {
          logger.error("SyncQueue", `Failed to sync event ${pending.id}`, err);
        }
      }

      // Update local cache timestamp for incremental loading
      await saveLastUpdated(CURRENT_ENVIRONMENT, now);
      setLastSyncedAt(now);

      const remainingCount = await getQueueCount();
      setPendingCount(remainingCount);
      logger.sync("SyncQueue", `Sync completed`, { succeeded: successCount, total: pendingEvents.length, remaining: remainingCount });
    } catch (err) {
      logger.error("SyncQueue", "Error syncing queue", err);
    }
  }, [isOnline]);




  const addBirdEvent = useCallback(
    async (captureData: CaptureFormData, _bandSize: BandSize, previousEventId: string | undefined) => {
      if (!user && !forceOfflineRef.current) {
        throw new Error("Must be logged in to add bird events");
      }

      try {
        if (!captureData.bandGroup) throw new Error("Band group is required");
        if (!captureData.bandLastTwoDigits) throw new Error("Band digit is required");
        if (!captureData.species) throw new Error("Species is required");

        const birdEventType = captureData.birdEventType as BirdEventType;
        const bandGroup = captureData.bandGroup.padStart(7, "0");
        const bandLastTwoDigits = captureData.bandLastTwoDigits.padStart(2, "0");
        const bandPrefix = bandGroup.substring(0, 4);
        const bandSuffix = bandGroup.substring(4) + bandLastTwoDigits;
        const band = new Band(bandPrefix, bandSuffix, _bandSize !== BandSize.Other ? _bandSize : null);
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

        // 2. Queue the bird event for sync (non-blocking)
        const queuePromise = addToQueue({
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

        // 4. Persist to IndexedDB and update pending count (non-blocking)
        queuePromise.then(() =>
          Promise.all([
            saveCompleteStateToIndexedDB({
              birdEventsMap: newBirdEventsMap,
              bandIdToBirdEventIdsMap: newBandIdToBirdEventIdsMap,
              bandGroupsMap: newBandGroupsMap,
              programsMap: newProgramsMap,
              yearsToProgramMap: newYearsToProgramMap,
              volunteersMap: newVolunteersMap,
            }),
            getQueueCount().then(setPendingCount),
          ])
        ).catch((err) => logger.error("AddBirdEvent", "IndexedDB save failed", err));

        // 5. Online: fire-and-forget sync
        if (isOnline) {
          queuePromise.then(() => syncQueue()).catch((err) =>
            logger.warn("AddBirdEvent", "Online sync failed — will retry on next sync", err)
          );
        }
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
    (programId: string, year: string) => {
      const trimmedId = programId.trim();
      if (!trimmedId) throw new Error("Program ID cannot be empty");
      if (programsMap[trimmedId]) throw new Error(`Program "${trimmedId}" already exists`);

      const newProgram = { id: trimmedId, displayName: trimmedId, bandGroupIds: [] as string[], recaptureIds: [] as string[] };
      setProgramsMap((prev) => ({ ...prev, [trimmedId]: newProgram }));
      setYearsToProgramMap((prev) => ({
        ...prev,
        [year]: prev[year]?.includes(trimmedId) ? prev[year] : [...(prev[year] || []), trimmedId],
      }));
      logger.info("AddProgram", "Program added (local)", { programId: trimmedId, year });
    },
    [programsMap]
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
        await set(ref(db, `constants/volunteersFullNameMap/${code}`), trimmed);
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
        await set(ref(db, `constants/volunteersFullNameMap/${trimmedCode}`), trimmedName);
        setVolunteersFullNameMap((prev) => ({ ...prev, [trimmedCode]: trimmedName }));
      }
      await saveCompleteStateToIndexedDB({ volunteersMap: newMap });
      logger.info("AddVolunteer", `Added volunteer ${trimmedCode}`);
    },
    [user, isOnline, volunteersMap, saveCompleteStateToIndexedDB]
  );


  const triggerSync = useCallback(async () => {
    if (!isAdmin) return;
    setIsSyncing(true);
    setSyncResult(null);
    try {
      await syncQueue();
      setSyncResult("success");
    } catch {
      setSyncResult("error");
    } finally {
      setIsSyncing(false);
    }
  }, [syncQueue, isAdmin]);

  // Auto-sync when online, admin, and pending items exist
  useEffect(() => {
    if (!isLoading && isOnline && isAdmin && pendingCount > 0) {
      triggerSync();
    }
  }, [isLoading, isOnline, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DataContext.Provider
      value={{
        isLoading,
        loadingStatus,
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
        syncQueue: triggerSync,
        isSyncing,
        syncResult,
        clearSyncResult: () => setSyncResult(null),
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
