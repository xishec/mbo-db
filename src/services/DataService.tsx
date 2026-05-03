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
  type PendingEvent,
  type SpeciesInfoMap,
} from "../types";
import {
  Band,
  BirdEventType,
  generateBirdEventId,
  type Program,
  getBandGroupMapKey,
  type DET,
} from "../types";
import { INDEPENDENT_MAP_NAMES, type IndependentMapName } from "../types/mapNames";
import { DataContext } from "./DataContext";
import {
  saveDataToIndexedDB,
  getDataFromIndexedDB,
  saveLastUpdated,
  getLastUpdated,
  replaceInQueue,
  saveMetadata,
  getMetadata,
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
  const [queuedEventIds, setQueuedEventIds] = useState<Set<string>>(new Set());
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [milestone, setMilestone] = useState<{ banderCode: string; count: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<"success" | "error" | null>(null);
  const isOnline = useOnlineStatus();

  // User authentication
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);

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
  const [bandGroupNotesMap, setBandGroupNotesMap] = useState<Record<string, string>>({});

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

  // For each band size, suggest the next available band id:
  //   1. Pick the latest banding (by date+time) for that size → its logical
  //      band group is the strip the bander is currently working.
  //   2. Within that group, find the highest last2digits banded in
  //      01→99→00 order (-00 is the last band of a strip, not the first)
  //      and take the next position in that order.
  //
  // Pass 1 — one scan over birdEventsMap: lexical date+time comparison (ISO
  //   sorts correctly) and inline group-key math to avoid Date.parse + Band()
  //   allocation per event on 700K events.
  // Pass 2 — per-size lookup in bandGroupsMap.newCaptureIds: that list only
  //   contains banded (new-capture) events, which is exactly what we need —
  //   a repeat of a previously-banded digit doesn't claim a new position.
  const bandSizeToBandIdMap = useMemo(() => {
    // For each band size, find the MOST RECENTLY SAVED new banding. Ordering
    // is by updatedAt, which is Date.now() (ms precision) stamped at save
    // time — so rapid sequential saves resolve in the actual save order.
    //
    // Skip modifications (previousEventId set) and superseded events
    // (modifiedEventId set): we only want originally-banded events.
    const latestGroupPerSize = new Map<BandSize, { group: string; savedAt: number }>();
    for (const ev of Object.values(birdEventsMap)) {
      if (!ev?.band?.bandSize || ev.band.bandSize === BandSize.Other) continue;
      if (ev.previousEventId) continue;
      if (ev.modifiedEventId) continue;

      // Compute group key inline (mirrors getBandGroupMapKey) to skip Band()
      // construction on 700K events.
      const prefix = ev.band.bandPrefix;
      const suffix = ev.band.bandSuffix;
      const last2 = suffix.slice(-2);
      const bandGroupId = prefix + suffix.slice(0, 3);
      const group =
        last2 !== "00"
          ? bandGroupId
          : (parseInt(bandGroupId, 10) - 1).toString().padStart(7, "0");

      const savedAt = parseInt(ev.updatedAt, 10) || 0;
      const existing = latestGroupPerSize.get(ev.band.bandSize);
      if (!existing || savedAt > existing.savedAt) {
        latestGroupPerSize.set(ev.band.bandSize, { group, savedAt });
      }
    }

    const map = {} as Record<BandSize, string>;
    for (const [size, { group }] of latestGroupPerSize) {
      const bandGroup = bandGroupsMap[group];
      if (!bandGroup) continue;

      // Find highest last2 used in this group (encode -00 as 100 so the
      // 01→99→00 physical order compares correctly).
      let max = 0;
      for (const eventId of bandGroup.newCaptureIds) {
        const ev = birdEventsMap[eventId];
        if (!ev?.band) continue;
        const last2 = parseInt(ev.band.bandSuffix.slice(-2), 10);
        if (Number.isNaN(last2)) continue;
        const encoded = last2 === 0 ? 100 : last2;
        if (encoded > max) max = encoded;
      }
      if (max === 0) continue;

      const groupPrefix = parseInt(group, 10);
      if (Number.isNaN(groupPrefix)) continue;
      // 01..98 -> +1 (same prefix); 99 -> -00 of next prefix; 00 -> -01 of next group.
      let nextPrefix: number;
      let nextLast2: number;
      if (max < 99) {
        nextPrefix = groupPrefix;
        nextLast2 = max + 1;
      } else if (max === 99) {
        nextPrefix = groupPrefix + 1;
        nextLast2 = 0;
      } else {
        nextPrefix = groupPrefix + 1;
        nextLast2 = 1;
      }
      map[size] = nextPrefix.toString().padStart(7, "0") + nextLast2.toString().padStart(2, "0");
    }
    return map;
  }, [birdEventsMap, bandGroupsMap]);

  // Load data when logged in (online) or immediately (offline)
  const isLoggedIn = !!user || !isOnline;
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;

    const loadData = async () => {
      const downloads: { path: string; bytes: number }[] = [];
      const recordDownload = (path: string, val: unknown) => {
        const bytes = val == null ? 0 : new Blob([JSON.stringify(val)]).size;
        downloads.push({ path, bytes });
      };
      const logDownloadSummary = () => {
        const total = downloads.reduce((sum, d) => sum + d.bytes, 0);
        const formatSize = (b: number) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;
        const breakdown = downloads.map((d) => `${d.path}: ${formatSize(d.bytes)}`).join(" · ");
        logger.info("DataLoad", `Downloaded ${formatSize(total)} — ${breakdown || "nothing"}`);
      };
      try {
        logger.info("DataLoad", `Loading ${CURRENT_ENVIRONMENT}/ data...`);
        const cachedData = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);
        const lastEventSync = await getLastUpdated(CURRENT_ENVIRONMENT);

        // Offline: use cache
        if (!isOnline) {
          if (cachedData) {
            setLoadingStatus("Loading cached data...");
            const queued = await getQueuedEvents();
            populateStateFromData(cachedData, queued);
            setLastSyncedAt(lastEventSync ?? Date.now());
            setIsLoading(false);
            return;
          }
          setError("No cached data available. Connect to the internet and reload.");
          setIsLoading(false);
          return;
        }

        const env = CURRENT_ENVIRONMENT;
        setLoadingStatus("Checking for updates...");

        type RtdbMetadata = Record<string, number> | null;
        let rtdbMetadata: RtdbMetadata = null;
        let cachedTimestamps: (number | null)[] = [];
        try {
          const [snap, ...cached] = await Promise.all([
            get(ref(db, `${env}/metadata`)),
            ...INDEPENDENT_MAP_NAMES.map((m) => getMetadata(`lastModified_${m}_${env}`) as Promise<number | null>),
          ]);
          rtdbMetadata = snap.exists() ? snap.val() : null;
          recordDownload(`${env}/metadata`, rtdbMetadata);
          cachedTimestamps = cached;
        } catch {
          if (cachedData) {
            setLoadingStatus("Using cached data (Firebase unreachable)");
            const queued = await getQueuedEvents();
            populateStateFromData(cachedData, queued);
            setLastSyncedAt(lastEventSync ?? Date.now());
            setIsLoading(false);
            return;
          }
        }

        const mapsToFetch = new Set<IndependentMapName>();
        if (cachedData) {
          INDEPENDENT_MAP_NAMES.forEach((m, i) => {
            const rtdbTs = rtdbMetadata?.[`lastModified_${m}`] as number | undefined;
            const cachedTs = cachedTimestamps[i];
            if (!cachedTs || (rtdbTs != null && rtdbTs > cachedTs)) {
              mapsToFetch.add(m);
            }
          });
        } else {
          INDEPENDENT_MAP_NAMES.forEach((m) => mapsToFetch.add(m));
        }

        // Bird events: always incremental (uses syncedAt, independent of map timestamps)
        let allEvents: BirdEventsMap;
        logger.info("DataLoad", `Cache: ${cachedData ? "yes" : "no"}, lastEventSync: ${lastEventSync}, mapsToFetch: ${mapsToFetch.size}`);

        if (cachedData?.birdEventsMap && lastEventSync) {
          setLoadingStatus("Checking for new events...");
          try {
            const { query: fbQuery, orderByChild, startAt } = await import("firebase/database");
            const deltaSnap = await get(fbQuery(ref(db, `${env}/birdEventsMap`), orderByChild("syncedAt"), startAt(lastEventSync + 1)));
            const deltaEvents = deltaSnap.exists() ? deltaSnap.val() as BirdEventsMap : {};
            recordDownload(`${env}/birdEventsMap (delta)`, deltaEvents);
            const deltaCount = Object.keys(deltaEvents).length;

            if (deltaCount === 0 && mapsToFetch.size === 0) {
              setLoadingStatus("Cache is up to date");
              logger.info("DataLoad", "No new events, maps unchanged — using cache");
              const queuedForCache = await getQueuedEvents();
              populateStateFromData(cachedData, queuedForCache);
              setLastSyncedAt(lastEventSync);
              setIsLoading(false);
              return;
            }

            logger.info("DataLoad", `Incremental: ${deltaCount} new events`);
            setLoadingStatus(`Merging ${deltaCount} new events...`);
            allEvents = { ...cachedData.birdEventsMap, ...deltaEvents };
          } catch (err) {
            logger.warn("DataLoad", "Incremental load failed, falling back to full load", err);
            setLoadingStatus("Downloading all events...");
            const fullSnap = await get(ref(db, `${env}/birdEventsMap`));
            allEvents = fullSnap.exists() ? fullSnap.val() : {};
            recordDownload(`${env}/birdEventsMap (fallback full)`, allEvents);
          }
        } else {
          setLoadingStatus("Downloading all events...");
          const fullSnap = await get(ref(db, `${env}/birdEventsMap`));
          if (!fullSnap.exists()) {
            setError(`Error: ${CURRENT_ENVIRONMENT}/ is missing from the database.`);
            return;
          }
          allEvents = fullSnap.val();
          recordDownload(`${env}/birdEventsMap (full)`, allEvents);
        }

        if (cancelled) return;

        // Independent maps: only fetch the ones that changed
        let dismissedMap = cachedData?.dismissedConflictsMap ?? {};
        let detsMap = cachedData?.DETsMap ?? {};
        let magicTableData: MagicTable = cachedData?.magicTable ?? { pyle: {} };
        let fullNameMap: Record<string, string> = cachedData?.volunteersFullNameMap ?? {};
        let notesMap: Record<string, string> = cachedData?.bandGroupNotesMap ?? {};
        if (mapsToFetch.size > 0) {
          const fetching = [...mapsToFetch];
          logger.info("DataLoad", `Fetching changed maps: ${fetching.join(", ")}`);
          setLoadingStatus(`Downloading ${fetching.length} updated map${fetching.length > 1 ? "s" : ""}...`);
          const snapshots = await Promise.all(fetching.map((m) => get(ref(db, `${env}/${m}`))));
          for (let i = 0; i < fetching.length; i++) {
            const snap = snapshots[i];
            const val = snap.exists() ? snap.val() : null;
            recordDownload(`${env}/${fetching[i]}`, val);
            switch (fetching[i]) {
              case "dismissedConflictsMap": dismissedMap = val ?? {}; break;
              case "DETsMap": detsMap = val ?? {}; break;
              case "magicTable": magicTableData = val ?? { pyle: {} }; break;
              case "volunteersFullNameMap": fullNameMap = val ?? {}; break;
              case "bandGroupNotesMap": notesMap = val ?? {}; break;
            }
          }
        }

        if (cancelled) return;

        // Set constants state
        setMagicTable(magicTableData);
        setVolunteersFullNameMap(fullNameMap);
        setBandGroupNotesMap(notesMap);

        // Overlay pending (not-yet-synced) events so derived maps, prefill
        // suggestions, and capture lists include offline work.
        const queued = await getQueuedEvents();
        const mergedEvents = overlayQueuedEvents(allEvents, queued);

        // Rebuild all derived maps locally
        setLoadingStatus("Rebuilding maps...");
        const { bandIdMap, bandGroups, programs, years, volCounts } = rebuildMapsFromEvents(mergedEvents, fullNameMap);

        const reconstructed = Object.fromEntries(
          Object.entries(mergedEvents).map(([id, event]) => [
            id,
            { ...event, band: new Band(event.band.bandPrefix, event.band.bandSuffix, event.band.bandSize ?? null) },
          ])
        );

        const data: DatabaseData = {
          birdEventsMap: mergedEvents,
          programsMap: programs,
          bandGroupsMap: bandGroups,
          bandIdToBirdEventIdsMap: bandIdMap,
          yearsToProgramMap: years,
          bandSizeToBandIdMap: {} as Record<BandSize, string>,
          dismissedConflictsMap: dismissedMap,
          DETsMap: detsMap,
          volunteersMap: volCounts,
          magicTable: magicTableData,
          volunteersFullNameMap: fullNameMap,
          bandGroupNotesMap: notesMap,
        };

        setLoadingStatus("Saving to cache...");
        const cacheTimestamp = Date.now();
        await saveDataToIndexedDB(CURRENT_ENVIRONMENT, data);
        await saveLastUpdated(CURRENT_ENVIRONMENT, cacheTimestamp);
        // Save RTDB timestamps for fetched maps
        if (rtdbMetadata) {
          await Promise.all(
            [...mapsToFetch]
              .filter((m) => rtdbMetadata![`lastModified_${m}`] != null)
              .map((m) => saveMetadata(`lastModified_${m}_${env}`, rtdbMetadata![`lastModified_${m}`]))
          );
        }

        setBirdEventsMap(reconstructed);
        setBandIdToBirdEventIdsMap(bandIdMap);
        setBandGroupsMap(bandGroups);
        setProgramsMap(programs);
        setYearsToProgramMap(years);
        setVolunteersMap(volCounts);
        setDismissedConflictsMap(data.dismissedConflictsMap);
        setDETsMap(data.DETsMap ?? {});
        setLastSyncedAt(cacheTimestamp);
        setLoadingStatus("Ready");

        logger.info("DataLoad", `Load complete`, { events: Object.keys(allEvents).length });
      } catch (err) {
        logger.error("DataLoad", `Error loading data`, err);
        if (!cancelled) {
          try {
            const fallbackData = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);
            if (fallbackData) {
              const queued = await getQueuedEvents().catch(() => [] as PendingEvent[]);
              populateStateFromData(fallbackData, queued);
              setLastSyncedAt(Date.now());
              return;
            }
          } catch { /* IndexedDB also failed */ }
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (downloads.length > 0) logDownloadSummary();
        if (!cancelled) setIsLoading(false);
      }
    };

    const populateStateFromData = (data: DatabaseData, queued: PendingEvent[]) => {
      const fnMap = data.volunteersFullNameMap ?? {};
      setMagicTable(data.magicTable ?? { pyle: {} });
      setVolunteersFullNameMap(fnMap);
      const mergedEvents = overlayQueuedEvents(data.birdEventsMap ?? {}, queued);
      const { bandIdMap, bandGroups, programs, years, volCounts } = rebuildMapsFromEvents(mergedEvents, fnMap);
      setBirdEventsMap(
        Object.fromEntries(
          Object.entries(mergedEvents).map(([id, event]) => [
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
      setBandGroupNotesMap(data.bandGroupNotesMap ?? {});
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) setIsAdmin(false);
    });

    return () => unsubscribe();
  }, []);

  // Re-check admin role whenever we have a user AND are online. Firebase
  // does NOT re-fire onAuthStateChanged when connectivity changes, so an
  // offline-then-online transition would otherwise leave isAdmin=false
  // forever (and hide admin-only UI).
  useEffect(() => {
    if (!user || !isOnline) return;
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await get(ref(db, `users/${user.uid}/role`));
        if (!cancelled) setIsAdmin(snapshot.val() === "admin");
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isOnline]);

  /**
   * SYNC ARCHITECTURE
   * =================
   * Offline: only addBirdEvent allowed — queued to IndexedDB, React state updated for UI
   * Online: all actions write directly to RTDB
   * Sync: write queued events to RTDB, then rebuild ALL derived maps from birdEventsMap
   */

  /** Reconstructs Band class instances from serialized IndexedDB data. */
  const refreshQueueState = useCallback(async () => {
    const queued = await getQueuedEvents();
    setPendingCount(queued.length);
    setQueuedEventIds(new Set(queued.filter((p) => p.type === "bird-event").map((p) => (p as PendingBirdEvent).pendingEvent.id)));
  }, []);

  // Update pending count and queued ids on mount
  useEffect(() => {
    refreshQueueState().catch(console.error);
  }, [refreshQueueState]);

  const updateMapTimestamp = useCallback(async (mapName: IndependentMapName) => {
    const now = Date.now();
    await set(ref(db, `${CURRENT_ENVIRONMENT}/metadata/lastModified_${mapName}`), now);
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
        volunteersMap: current?.volunteersMap ?? {},
        magicTable: current?.magicTable ?? { pyle: {} },
        volunteersFullNameMap: current?.volunteersFullNameMap ?? {},
        bandGroupNotesMap: current?.bandGroupNotesMap ?? {},
        ...overrides,
      });
      // Don't bump timestamp here — only loadData and syncQueue should advance it
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
   * Overlay queued (not-yet-synced) bird events into the RTDB/cached snapshot
   * so derived maps, prefill suggestions, and capture lists see pending work.
   *
   * Mirrors what syncQueue would do when these events reach RTDB:
   *  - inserts each queued event into the map (overwriting any stale RTDB
   *    copy of the same id, which can occur in the rare race where RTDB
   *    acknowledged a write we still hold in the queue)
   *  - stamps modifiedEventId on the predecessor when the queued event is a
   *    modification (previousEventId set)
   *
   * Pure; safe to call on any events map (including an empty one).
   */
  const overlayQueuedEvents = useCallback(
    (events: BirdEventsMap, queued: PendingEvent[]): BirdEventsMap => {
      if (queued.length === 0) return events;
      const next: BirdEventsMap = { ...events };
      for (const pending of queued) {
        if (pending.type !== "bird-event") continue;
        const ev = (pending as PendingBirdEvent).pendingEvent;
        next[ev.id] = ev;
        if (ev.previousEventId && next[ev.previousEventId]) {
          next[ev.previousEventId] = {
            ...next[ev.previousEventId],
            modifiedEventId: ev.id,
          } as BirdEvent;
        }
      }
      return next;
    },
    []
  );

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

      // Write each queued event to RTDB with syncedAt.
      // We use a multi-path update so the new event and its back-pointer to
      // the previous event land atomically — a partial failure can't leave
      // RTDB with a new event whose predecessor is missing modifiedEventId.
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
              updates[`${pending.environment}/birdEventsMap/${birdEvent.previousEventId}/modifiedEventId`] = birdEvent.id;
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

      // Mirror RTDB state back into React + IndexedDB so the UI reflects the
      // synced events (and their syncedAt stamps) without waiting for the
      // next full reload. Derived maps don't need rebuilding — only
      // syncedAt / modifiedEventId changed, neither of which affects the
      // output of rebuildMapsFromEvents.
      if (syncedBirdEvents.length > 0) {
        let latestMap: BirdEventsMap | null = null;
        setBirdEventsMap((prev) => {
          const next = { ...prev };
          for (const ev of syncedBirdEvents) {
            const existing = next[ev.id] ?? ev;
            next[ev.id] = { ...existing, syncedAt: now } as BirdEvent;
            if (ev.previousEventId && next[ev.previousEventId]) {
              next[ev.previousEventId] = {
                ...next[ev.previousEventId],
                modifiedEventId: ev.id,
                syncedAt: now,
              } as BirdEvent;
            }
          }
          latestMap = next;
          return next;
        });
        if (latestMap) {
          saveCompleteStateToIndexedDB({ birdEventsMap: latestMap }).catch((err) =>
            logger.error("SyncQueue", "Failed to persist synced state to IndexedDB", err)
          );
        }
      }

      await refreshQueueState();
      const remainingCount = await getQueueCount();
      logger.sync("SyncQueue", `Sync completed`, { succeeded: successCount, total: pendingEvents.length, remaining: remainingCount });
    } catch (err) {
      logger.error("SyncQueue", "Error syncing queue", err);
    }
  }, [isOnline, refreshQueueState, saveCompleteStateToIndexedDB]);




  const addBirdEvent = useCallback(
    async (captureData: CaptureFormData, _bandSize: BandSize, previousEventId: string | undefined) => {
      if (!user && isOnline) {
        throw new Error("Must be logged in to add bird events");
      }

      try {
        if (!captureData.bandGroup) throw new Error("Band group is required");
        if (!captureData.bandLastTwoDigits) throw new Error("Band digit is required");
        if (!captureData.species) throw new Error("Species is required");
        // Validate the target program exists BEFORE we touch the queue so a
        // misrouted event can't land in IndexedDB and sync later.
        if (!programsMap[captureData.programId]) {
          throw new Error(`Program "${captureData.programId}" not found`);
        }

        const birdEventType = captureData.birdEventType as BirdEventType;
        const bandGroup = captureData.bandGroup.padStart(7, "0");
        const bandLastTwoDigits = captureData.bandLastTwoDigits.padStart(2, "0");
        const bandPrefix = bandGroup.substring(0, 4);
        const bandSuffix = bandGroup.substring(4) + bandLastTwoDigits;
        const band = new Band(bandPrefix, bandSuffix, _bandSize !== BandSize.Other ? _bandSize : null);
        const isNewCapture = birdEventType === BirdEventType.Banded || birdEventType === BirdEventType.None;
        // Normalize bander/scribe codes to uppercase so new events don't create
        // case-variant duplicates (historical data was migrated via script).
        const normalizedBander = (captureData.bander ?? "").toUpperCase();
        const normalizedScribe = (captureData.scribe ?? "").toUpperCase();

        // Replace-in-queue: modifying a still-queued event → swap the pending
        // entry instead of creating a modification chain. The target never
        // reached RTDB, so chain semantics are unnecessary and would leave a
        // client-only ghost. Gracefully falls back to modification-chain if
        // the target synced between modal open and save.
        let replacingPendingId: string | undefined;
        if (previousEventId) {
          const queuedEntries = await getQueuedEvents();
          const match = queuedEntries.find(
            (p) => p.type === "bird-event" && (p as PendingBirdEvent).pendingEvent.id === previousEventId
          );
          if (match) replacingPendingId = match.id;
        }

        const newBirdEvent: BirdEvent = {
          id: generateBirdEventId(band.id, captureData.date, captureData.net, captureData.wing, captureData.weight, previousEventId !== undefined && !replacingPendingId),
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
          previousEventId: replacingPendingId ? null : (previousEventId || null),
          modifiedEventId: null,
          birdEventType,
          // Always use Date.now() (ms precision) so rapid sequential saves
          // can be distinguished. Previously new captures used Date.parse(
          // captureDate+time) which is minute-precision and tied for same-
          // minute saves, breaking bandSizeToBandIdMap's "latest banding" lookup.
          updatedAt: String(Date.now()),
        };

        // 2. Queue the bird event for sync (non-blocking).
        // When replacing a queued event, swap the pending entry atomically so
        // a crash mid-swap can't leave the queue missing both entries.
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

        // 3. Update React state for immediate UI feedback
        const newBirdEventsMap = { ...birdEventsMap, [newBirdEvent.id]: newBirdEvent };
        if (replacingPendingId && previousEventId && previousEventId !== newBirdEvent.id) {
          // Fully replace: the old queued event never synced, just drop it.
          // Skip when ids collide (same band/date/net/wing/weight) — the
          // spread above already overwrote in place; deleting would wipe it.
          delete newBirdEventsMap[previousEventId];
        } else if (!replacingPendingId && previousEventId && birdEventsMap[previousEventId]) {
          newBirdEventsMap[previousEventId] = { ...birdEventsMap[previousEventId], modifiedEventId: newBirdEvent.id };
        }

        // When replacing a queued event, strip the old event id from all
        // derived maps before appending the new one, so aggregates stay
        // correct (band list, band groups, program capture/recapture lists,
        // volunteer counts).
        const oldEvent = replacingPendingId && previousEventId ? birdEventsMap[previousEventId] : null;
        const strippedBandIds = oldEvent
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
        const existingNewCaptureIds = bandGroupsMap[bgKey]?.newCaptureIds || [];
        const strippedNewCaptureIds = oldEvent && oldWasNewCapture
          ? existingNewCaptureIds.filter((id) => id !== previousEventId)
          : existingNewCaptureIds;
        if (isNewCapture || strippedNewCaptureIds.length > 0) {
          newBandGroupsMap[bgKey] = {
            id: bgKey,
            newCaptureIds: isNewCapture ? [...strippedNewCaptureIds, newBirdEvent.id] : strippedNewCaptureIds,
          };
        } else if (oldWasNewCapture && strippedNewCaptureIds.length === 0) {
          delete newBandGroupsMap[bgKey];
        }

        // Already validated at the top of this function, safe to assert.
        const existingProgram = programsMap[captureData.programId]!;
        const bandGroupMapKey = getBandGroupMapKey(band);
        const year = captureData.date.substring(0, 4);
        const eventDate = captureData.date;

        const strippedRecaptureIds = oldEvent && !oldWasNewCapture
          ? existingProgram.recaptureIds.filter((id) => id !== previousEventId)
          : existingProgram.recaptureIds;
        const newProgramsMap = {
          ...programsMap,
          [captureData.programId]: {
            ...existingProgram,
            bandGroupIds: isNewCapture && !existingProgram.bandGroupIds.includes(bandGroupMapKey)
              ? [...existingProgram.bandGroupIds, bandGroupMapKey] : existingProgram.bandGroupIds,
            recaptureIds: !isNewCapture ? [...strippedRecaptureIds, newBirdEvent.id] : strippedRecaptureIds,
            firstCaptureDate: !existingProgram.firstCaptureDate || eventDate < existingProgram.firstCaptureDate ? eventDate : existingProgram.firstCaptureDate,
            lastCaptureDate: !existingProgram.lastCaptureDate || eventDate > existingProgram.lastCaptureDate ? eventDate : existingProgram.lastCaptureDate,
          },
        };

        const existingProgramsInYear = yearsToProgramMap[year] || [];
        const newYearsToProgramMap = {
          ...yearsToProgramMap,
          [year]: existingProgramsInYear.includes(captureData.programId) ? existingProgramsInYear : [...existingProgramsInYear, captureData.programId],
        };

        // Volunteer counts (React state only — rebuilt on sync).
        // Replace path: first decrement contributions from the old event.
        const newVolunteersMap = { ...volunteersMap };
        if (oldEvent) {
          if (oldEvent.bander && oldWasNewCapture) {
            const existing = newVolunteersMap[oldEvent.bander];
            if (existing) {
              newVolunteersMap[oldEvent.bander] = { ...existing, totalBanded: Math.max(0, existing.totalBanded - 1) };
            }
          }
          if (oldEvent.scribe) {
            const existing = newVolunteersMap[oldEvent.scribe];
            if (existing) {
              newVolunteersMap[oldEvent.scribe] = { ...existing, totalScribed: Math.max(0, existing.totalScribed - 1) };
            }
          }
        }
        if (normalizedBander && isNewCapture) {
          const existing = newVolunteersMap[normalizedBander] ?? { code: normalizedBander, fullName: volunteersFullNameMap[normalizedBander] ?? "", totalBanded: 0, totalScribed: 0 };
          const oldCount = existing.totalBanded;
          newVolunteersMap[normalizedBander] = { ...existing, totalBanded: oldCount + 1 };
          if (Math.floor((oldCount + 1) / 1000) > Math.floor(oldCount / 1000)) {
            setMilestone({ banderCode: normalizedBander, count: oldCount + 1 });
          }
        }
        if (normalizedScribe) {
          const existing = newVolunteersMap[normalizedScribe] ?? { code: normalizedScribe, fullName: volunteersFullNameMap[normalizedScribe] ?? "", totalBanded: 0, totalScribed: 0 };
          newVolunteersMap[normalizedScribe] = { ...existing, totalScribed: existing.totalScribed + 1 };
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
        // Keep queuedEventIds in sync with the queue mutation we just issued,
        // so downstream gates (Edit button visibility, etc.) don't see a
        // stale set while refreshQueueState() races the next render.
        setQueuedEventIds((prev) => {
          const next = new Set(prev);
          if (previousEventId) next.delete(previousEventId);
          next.add(newBirdEvent.id);
          return next;
        });
        setPendingCount((prev) => (replacingPendingId ? prev : prev + 1));

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
            refreshQueueState(),
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
      refreshQueueState,
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

        await set(ref(db, `${CURRENT_ENVIRONMENT}/dismissedConflictsMap/${conflictId}`), true);
        await updateMapTimestamp("dismissedConflictsMap");
        logger.info("DismissConflict", `Conflict ${conflictId} dismissed`);
      } catch (err) {
        logger.error("DismissConflict", `Error dismissing conflict ${conflictId}`, err);
        throw err;
      }
    },
    [user, isOnline, dismissedConflictsMap, saveCompleteStateToIndexedDB, updateMapTimestamp]
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

        await set(ref(db, `${CURRENT_ENVIRONMENT}/DETsMap/${det.date}`), det);
        await updateMapTimestamp("DETsMap");
        logger.info("SaveDET", `DET for ${det.date} synced to RTDB`);
      } catch (err) {
        logger.error("SaveDET", `Error saving DET for ${det.date}`, err);
        throw err;
      }
    },
    [user, isOnline, updateMapTimestamp]
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

      await set(ref(db, `${CURRENT_ENVIRONMENT}/dismissedConflictsMap`), null);
      await updateMapTimestamp("dismissedConflictsMap");
      logger.info("ResetDismissedConflicts", "All dismissed conflicts reset");
    } catch (err) {
      logger.error("ResetDismissedConflicts", "Error resetting dismissed conflicts", err);
      throw err;
    }
  }, [user, isOnline, saveCompleteStateToIndexedDB, updateMapTimestamp]);

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

        await set(ref(db, `${CURRENT_ENVIRONMENT}/volunteersFullNameMap/${code}`), trimmed);
        await updateMapTimestamp("volunteersFullNameMap");
        const newFullNameMap = { ...volunteersFullNameMap, [code]: trimmed };
        setVolunteersFullNameMap(newFullNameMap);
        await saveCompleteStateToIndexedDB({ volunteersMap: newMap, volunteersFullNameMap: newFullNameMap });
      } catch (err) {
        logger.error("UpdateVolunteerName", `Error updating volunteer ${code}`, err);
        throw err;
      }
    },
    [user, isOnline, volunteersMap, volunteersFullNameMap, saveCompleteStateToIndexedDB, updateMapTimestamp]
  );

  const updateBandGroupNote = useCallback(
    async (bandGroupId: string, note: string) => {
      if (!user) throw new Error("Must be logged in to update band group notes");
      if (!isOnline) throw new Error("Cannot update band group notes while offline");

      try {
        const trimmed = note.trim();
        const newNotesMap = { ...bandGroupNotesMap, [bandGroupId]: trimmed };
        if (!trimmed) delete newNotesMap[bandGroupId];

        setBandGroupNotesMap(newNotesMap);
        await set(ref(db, `${CURRENT_ENVIRONMENT}/bandGroupNotesMap/${bandGroupId}`), trimmed || null);
        await updateMapTimestamp("bandGroupNotesMap");
        await saveCompleteStateToIndexedDB({ bandGroupNotesMap: newNotesMap });
      } catch (err) {
        logger.error("UpdateBandGroupNote", `Error updating note for ${bandGroupId}`, err);
        throw err;
      }
    },
    [user, isOnline, bandGroupNotesMap, saveCompleteStateToIndexedDB, updateMapTimestamp]
  );

  const syncInFlightRef = useRef(false);
  // `showUi=false` runs the sync silently (no Syncing…/Complete modal) —
  // used by the auto-effect below so routine online adds don't flash UI.
  // `showUi=true` is the explicit form exposed on the context for a future
  // manual-sync button.
  const runSync = useCallback(
    async (showUi: boolean) => {
      if (!user) return;
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      if (showUi) {
        setIsSyncing(true);
        setSyncResult(null);
      }
      try {
        await syncQueue();
        if (showUi) setSyncResult("success");
      } catch {
        if (showUi) setSyncResult("error");
      } finally {
        if (showUi) setIsSyncing(false);
        syncInFlightRef.current = false;
      }
    },
    [syncQueue, user]
  );
  const triggerSync = useCallback(() => runSync(true), [runSync]);

  // Auto-sync when we have pending events AND we're online AND authenticated.
  // Fires on: app load with leftover queue, returning online after offline work,
  // or queueing while already online. Runs silently — RTDB rules require
  // auth only, not admin.
  useEffect(() => {
    if (!isLoading && isOnline && user && pendingCount > 0) {
      runSync(false);
    }
  }, [isLoading, isOnline, user, pendingCount, runSync]);

  return (
    <DataContext.Provider
      value={{
        isLoading,
        loadingStatus,
        error,
        authReady,
        isLoggedIn,
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
        queuedEventIds,
        lastSyncedAt,
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
        bandGroupNotesMap,
        updateBandGroupNote,
        milestone,
        clearMilestone: () => setMilestone(null),
        triggerTestMilestone: () => setMilestone({ banderCode: "TST", count: 3000 }),
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
