import { useEffect } from "react";
import { get, ref } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { auth, CURRENT_ENVIRONMENT, db } from "../firebase";
import { birdEventsStore } from "./birdEventsStore";
import { useAppStore } from "../stores/useAppStore";
import { refreshQueueState, runSync } from "../stores/actions";
import {
  computeBandSizeToBandIdMap,
  computeSpeciesInfoMap,
  overlayQueuedEvents,
  rebuildMapsFromEvents,
} from "../stores/derive";
import {
  Band,
  BandSize,
  type BirdEvent,
  type DatabaseData,
  type MagicTable,
  type PendingEvent,
  type Volunteer,
  type VolunteersMap,
} from "../types";
import { INDEPENDENT_MAP_NAMES, type IndependentMapName } from "../types/mapNames";
import { normalizeSpeciesAliasesMap } from "../types/species";
import {
  getDataFromIndexedDB,
  getLastUpdated,
  getMetadata,
  getQueuedEvents,
  saveDataToIndexedDB,
  saveLastUpdated,
  saveMetadata,
} from "./indexedDB";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { logger } from "./logger";

function normalizeObserverClass(value: unknown): Volunteer["observerClass"] {
  return value === 1 || value === 2 || value === 3 ? value : 3;
}

function getVolunteerMetadata(data: DatabaseData | null | undefined): VolunteersMap {
  const volunteersMap: VolunteersMap = {};

  for (const [code, volunteer] of Object.entries(data?.volunteersMap ?? {})) {
    volunteersMap[code] = {
      fullName: volunteer.fullName ?? "",
      observerClass: normalizeObserverClass(volunteer.observerClass),
    };
  }

  for (const [code, fullName] of Object.entries(data?.volunteersFullNameMap ?? {})) {
    volunteersMap[code] = {
      fullName,
      observerClass: volunteersMap[code]?.observerClass ?? 3,
    };
  }

  for (const [code, observerClass] of Object.entries(data?.volunteersObserverClassMap ?? {})) {
    volunteersMap[code] = {
      fullName: volunteersMap[code]?.fullName ?? "",
      observerClass: normalizeObserverClass(observerClass),
    };
  }

  return volunteersMap;
}

/**
 * Hydrate a DatabaseData record into the store. Rebuilds derived maps,
 * reconstructs Band class instances from serialized data, and replaces
 * birdEventsStore with the merged (events ∪ queued) view.
 */
function populateStateFromData(data: DatabaseData, queued: PendingEvent[]): void {
  const volunteersMap = getVolunteerMetadata(data);
  const speciesAliasesMap = normalizeSpeciesAliasesMap(data.speciesAliasesMap ?? {});
  const mergedEvents = overlayQueuedEvents(data.birdEventsMap ?? {}, queued);
  const { bandIdMap, bandGroups, programs, years, volunteerStats } = rebuildMapsFromEvents(mergedEvents, volunteersMap);
  const hydratedEntries: Array<[string, BirdEvent]> = Object.entries(mergedEvents).map(([id, event]) => [
    id,
    {
      ...event,
      band: new Band(event.band.bandPrefix, event.band.bandSuffix, event.band.bandSize ?? null),
    },
  ]);
  const hydratedEvents = new Map<string, BirdEvent>(hydratedEntries);
  birdEventsStore.replace(hydratedEvents);

  useAppStore.setState({
    magicTable: data.magicTable ?? { pyle: {} },
    volunteersMap,
    speciesAliasesMap,
    bandIdToBirdEventIdsMap: bandIdMap,
    bandGroupsMap: bandGroups,
    programsMap: programs,
    yearsToProgramMap: years,
    volunteerStatsMap: volunteerStats,
    bandSizeToBandIdMap: computeBandSizeToBandIdMap(hydratedEvents, bandGroups),
    speciesInfoMap: computeSpeciesInfoMap(hydratedEvents, speciesAliasesMap),
    DETsMap: data.DETsMap ?? {},
    dismissedConflictsMap: data.dismissedConflictsMap ?? {},
    bandGroupNotesMap: data.bandGroupNotesMap ?? {},
  });
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const isOnline = useOnlineStatus();

  // Mirror online status into the store so actions can read it.
  useEffect(() => {
    useAppStore.setState({ isOnline });
  }, [isOnline]);

  // Auth state
  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      useAppStore.setState({
        user: currentUser,
        authReady: true,
        ...(currentUser ? {} : { isAdmin: false }),
      });
    });
  }, []);

  // Re-check admin role whenever we have a user AND we're online. Firebase
  // doesn't re-fire onAuthStateChanged on connectivity changes, so an
  // offline→online transition would otherwise leave isAdmin=false forever.
  const user = useAppStore((s) => s.user);
  useEffect(() => {
    if (!user || !isOnline) return;
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await get(ref(db, `users/${user.uid}/role`));
        if (!cancelled) useAppStore.setState({ isAdmin: snapshot.val() === "admin" });
      } catch {
        if (!cancelled) useAppStore.setState({ isAdmin: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isOnline]);

  // Initial data load (uses cached data when offline; delta-syncs when online).
  const isLoggedIn = useAppStore((s) => !!s.user || !s.isOnline);
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;

    const setStatus = (loadingStatus: string) => useAppStore.setState({ loadingStatus });

    const loadData = async () => {
      const downloads: { path: string; bytes: number }[] = [];
      const recordDownload = (path: string, val: unknown) => {
        const bytes = val == null ? 0 : new Blob([JSON.stringify(val)]).size;
        downloads.push({ path, bytes });
      };
      const logDownloadSummary = () => {
        const total = downloads.reduce((sum, d) => sum + d.bytes, 0);
        const formatSize = (b: number) =>
          b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;
        const breakdown = downloads.map((d) => `${d.path}: ${formatSize(d.bytes)}`).join(" · ");
        logger.info("DataLoad", `Downloaded ${formatSize(total)} — ${breakdown || "nothing"}`);
      };
      try {
        logger.info("DataLoad", `Loading ${CURRENT_ENVIRONMENT}/ data...`);
        const cachedData = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);
        const lastEventSync = await getLastUpdated(CURRENT_ENVIRONMENT);

        if (!isOnline) {
          if (cachedData) {
            setStatus("Loading cached data...");
            const queued = await getQueuedEvents();
            populateStateFromData(cachedData, queued);
            useAppStore.setState({
              lastSyncedAt: lastEventSync ?? Date.now(),
              isLoading: false,
            });
            return;
          }
          useAppStore.setState({
            error: "No cached data available. Connect to the internet and reload.",
            isLoading: false,
          });
          return;
        }

        const env = CURRENT_ENVIRONMENT;
        setStatus("Checking for updates...");

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
            setStatus("Using cached data (Firebase unreachable)");
            const queued = await getQueuedEvents();
            populateStateFromData(cachedData, queued);
            useAppStore.setState({
              lastSyncedAt: lastEventSync ?? Date.now(),
              isLoading: false,
            });
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

        // Bird events use syncedAt-based delta sync independent of map metadata.
        let allEvents: Record<string, BirdEvent>;
        logger.info(
          "DataLoad",
          `Cache: ${cachedData ? "yes" : "no"}, lastEventSync: ${lastEventSync}, mapsToFetch: ${mapsToFetch.size}`
        );

        const cachedEventCount = Object.keys(cachedData?.birdEventsMap ?? {}).length;
        if (cachedData && cachedEventCount > 0 && lastEventSync) {
          setStatus("Checking for new events...");
          try {
            const { query: fbQuery, orderByChild, startAt } = await import("firebase/database");
            const deltaSnap = await get(
              fbQuery(ref(db, `${env}/birdEventsMap`), orderByChild("syncedAt"), startAt(lastEventSync + 1))
            );
            const deltaEvents: Record<string, BirdEvent> = deltaSnap.exists()
              ? (deltaSnap.val() as Record<string, BirdEvent>)
              : {};
            recordDownload(`${env}/birdEventsMap (delta)`, deltaEvents);
            const deltaCount = Object.keys(deltaEvents).length;

            if (deltaCount === 0 && mapsToFetch.size === 0) {
              setStatus("Cache is up to date");
              logger.info("DataLoad", "No new events, maps unchanged — using cache");
              const queuedForCache = await getQueuedEvents();
              populateStateFromData(cachedData, queuedForCache);
              useAppStore.setState({ lastSyncedAt: lastEventSync, isLoading: false });
              return;
            }

            logger.info("DataLoad", `Incremental: ${deltaCount} new events`);
            setStatus(`Merging ${deltaCount} new events...`);
            allEvents = { ...cachedData.birdEventsMap, ...deltaEvents };
          } catch (err) {
            logger.warn("DataLoad", "Incremental load failed, falling back to full load", err);
            setStatus("Downloading all events...");
            const fullSnap = await get(ref(db, `${env}/birdEventsMap`));
            allEvents = fullSnap.exists() ? fullSnap.val() : {};
            recordDownload(`${env}/birdEventsMap (fallback full)`, allEvents);
          }
        } else {
          setStatus("Downloading all events...");
          const fullSnap = await get(ref(db, `${env}/birdEventsMap`));
          if (!fullSnap.exists()) {
            useAppStore.setState({
              error: `Error: ${CURRENT_ENVIRONMENT}/ is missing from the database.`,
            });
            return;
          }
          allEvents = fullSnap.val();
          recordDownload(`${env}/birdEventsMap (full)`, allEvents);
        }

        if (cancelled) return;

        let dismissedMap = cachedData?.dismissedConflictsMap ?? {};
        let detsMap = cachedData?.DETsMap ?? {};
        let magicTableData: MagicTable = cachedData?.magicTable ?? { pyle: {} };
        let volunteersMap = getVolunteerMetadata(cachedData);
        let notesMap: Record<string, string> = cachedData?.bandGroupNotesMap ?? {};
        let speciesAliasesMap: Record<string, string> = normalizeSpeciesAliasesMap(cachedData?.speciesAliasesMap ?? {});
        if (mapsToFetch.size > 0) {
          const fetching = [...mapsToFetch];
          logger.info("DataLoad", `Fetching changed maps: ${fetching.join(", ")}`);
          setStatus(`Downloading ${fetching.length} updated map${fetching.length > 1 ? "s" : ""}...`);
          const snapshots = await Promise.all(fetching.map((m) => get(ref(db, `${env}/${m}`))));
          for (let i = 0; i < fetching.length; i++) {
            const snap = snapshots[i];
            const val = snap.exists() ? snap.val() : null;
            recordDownload(`${env}/${fetching[i]}`, val);
            switch (fetching[i]) {
              case "dismissedConflictsMap":
                dismissedMap = val ?? {};
                break;
              case "DETsMap":
                detsMap = val ?? {};
                break;
              case "magicTable":
                magicTableData = val ?? { pyle: {} };
                break;
              case "volunteersMap":
                volunteersMap = getVolunteerMetadata({ ...(cachedData ?? {}), volunteersMap: val ?? {} } as DatabaseData);
                break;
              case "bandGroupNotesMap":
                notesMap = val ?? {};
                break;
              case "speciesAliasesMap":
                speciesAliasesMap = normalizeSpeciesAliasesMap(val ?? {});
                break;
            }
          }
        }

        if (cancelled) return;

        // Overlay pending (not-yet-synced) events so derived maps, prefill
        // suggestions, and capture lists include offline work.
        const queued = await getQueuedEvents();
        const mergedEvents = overlayQueuedEvents(allEvents, queued);

        setStatus("Rebuilding maps...");
        const { bandIdMap, bandGroups, programs, years, volunteerStats } = rebuildMapsFromEvents(
          mergedEvents,
          volunteersMap
        );

        const reconstructedEntries: Array<[string, BirdEvent]> = Object.entries(mergedEvents).map(([id, event]) => [
          id,
          {
            ...event,
            band: new Band(event.band.bandPrefix, event.band.bandSuffix, event.band.bandSize ?? null),
          },
        ]);
        const reconstructed = new Map<string, BirdEvent>(reconstructedEntries);

        const data: DatabaseData = {
          birdEventsMap: mergedEvents,
          programsMap: programs,
          bandGroupsMap: bandGroups,
          bandIdToBirdEventIdsMap: bandIdMap,
          yearsToProgramMap: years,
          bandSizeToBandIdMap: {} as Record<BandSize, string>,
          dismissedConflictsMap: dismissedMap,
          DETsMap: detsMap,
          volunteersMap,
          magicTable: magicTableData,
          bandGroupNotesMap: notesMap,
          speciesAliasesMap,
        };

        setStatus("Saving to cache...");
        // Delta cursor for next sync = max server-stamped syncedAt we've seen.
        // Using wall-clock `Date.now()` is unsafe: if this client's clock is
        // ahead of the client that wrote the next event, `startAt(cursor + 1)`
        // would skip that event forever.
        let maxSyncedAt = lastEventSync ?? 0;
        for (const ev of Object.values(allEvents)) {
          if (typeof ev.syncedAt === "number" && ev.syncedAt > maxSyncedAt) {
            maxSyncedAt = ev.syncedAt;
          }
        }
        const cacheTimestamp = maxSyncedAt > 0 ? maxSyncedAt : Date.now();
        await saveDataToIndexedDB(CURRENT_ENVIRONMENT, data);
        await saveLastUpdated(CURRENT_ENVIRONMENT, cacheTimestamp);
        if (rtdbMetadata) {
          await Promise.all(
            [...mapsToFetch]
              .map((m) => saveMetadata(`lastModified_${m}_${env}`, rtdbMetadata![`lastModified_${m}`] ?? Date.now()))
          );
        }

        birdEventsStore.replace(reconstructed);
        useAppStore.setState({
          magicTable: magicTableData,
          volunteersMap,
          bandGroupNotesMap: notesMap,
          speciesAliasesMap,
          bandIdToBirdEventIdsMap: bandIdMap,
          bandGroupsMap: bandGroups,
          programsMap: programs,
          yearsToProgramMap: years,
          volunteerStatsMap: volunteerStats,
          bandSizeToBandIdMap: computeBandSizeToBandIdMap(reconstructed, bandGroups),
          speciesInfoMap: computeSpeciesInfoMap(reconstructed, speciesAliasesMap),
          dismissedConflictsMap: dismissedMap,
          DETsMap: detsMap,
          lastSyncedAt: cacheTimestamp,
          loadingStatus: "Ready",
        });

        logger.info("DataLoad", "Load complete", { events: Object.keys(allEvents).length });
      } catch (err) {
        logger.error("DataLoad", "Error loading data", err);
        if (!cancelled) {
          try {
            const fallbackData = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);
            if (fallbackData) {
              const queued = await getQueuedEvents().catch(() => [] as PendingEvent[]);
              populateStateFromData(fallbackData, queued);
              const fallbackLastSync = await getLastUpdated(CURRENT_ENVIRONMENT).catch(() => null);
              useAppStore.setState({ lastSyncedAt: fallbackLastSync });
              return;
            }
          } catch {
            /* IndexedDB also failed */
          }
          useAppStore.setState({
            error: err instanceof Error ? err.message : "Failed to load data",
          });
        }
      } finally {
        if (downloads.length > 0) logDownloadSummary();
        if (!cancelled) useAppStore.setState({ isLoading: false });
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
    // Intentionally omit isOnline — we only want to load once per login
    // transition. Reconnect-sync is handled by the auto-sync effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  // Initial queue state
  useEffect(() => {
    refreshQueueState().catch(console.error);
  }, []);

  // Auto-sync when we have pending events AND we're online AND authenticated.
  // RTDB rules require auth only, not admin.
  const isLoading = useAppStore((s) => s.isLoading);
  const pendingCount = useAppStore((s) => s.pendingCount);
  useEffect(() => {
    if (!isLoading && isOnline && user && pendingCount > 0) {
      runSync(false);
    }
  }, [isLoading, isOnline, user, pendingCount]);

  return <>{children}</>;
}
