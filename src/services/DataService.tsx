import { useEffect } from "react";
import { get, onValue, ref } from "firebase/database";
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
  type BandResetsMap,
  type BirdEvent,
  type DatabaseData,
  type DETsMap,
  type MagicTable,
  type PendingEvent,
  type Volunteer,
  type VolunteersMap,
} from "../types";
import { INDEPENDENT_MAP_NAMES, type IndependentMapName } from "../types/mapNames";
import { normalizeSpeciesAliasesMap, setSpeciesMap } from "../types/species";
import {
  getDataFromIndexedDB,
  getLastUpdated,
  getMetadata,
  getQueuedEvents,
  saveDataDeltaToIndexedDB,
  saveDataToIndexedDB,
  saveDatabaseMetadataOnly,
  saveLastUpdated,
  saveMetadata,
} from "./indexedDB";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { logger } from "./logger";

function normalizeObserverClass(value: unknown): Volunteer["observerClass"] {
  const parsed = Number(value);
  return parsed === 1 || parsed === 2 || parsed === 3 ? parsed : 3;
}

function normalizeVolunteerCode(code: string): string {
  return code.trim().toUpperCase();
}

function getVolunteerMetadata(data: DatabaseData | null | undefined): VolunteersMap {
  const volunteersMap: VolunteersMap = {};

  for (const [code, volunteer] of Object.entries(data?.volunteersMap ?? {})) {
    const normalizedCode = normalizeVolunteerCode(code);
    if (!normalizedCode) continue;
    volunteersMap[normalizedCode] = {
      fullName: volunteer.fullName ?? "",
      observerClass: normalizeObserverClass(volunteer.observerClass),
    };
  }

  for (const [code, fullName] of Object.entries(data?.volunteersFullNameMap ?? {})) {
    const normalizedCode = normalizeVolunteerCode(code);
    if (!normalizedCode) continue;
    volunteersMap[normalizedCode] = {
      fullName,
      observerClass: volunteersMap[normalizedCode]?.observerClass ?? 3,
    };
  }

  for (const [code, observerClass] of Object.entries(data?.volunteersObserverClassMap ?? {})) {
    const normalizedCode = normalizeVolunteerCode(code);
    if (!normalizedCode) continue;
    volunteersMap[normalizedCode] = {
      fullName: volunteersMap[normalizedCode]?.fullName ?? "",
      observerClass: normalizeObserverClass(observerClass),
    };
  }

  return volunteersMap;
}

function calculateObserverTotal(hoursObserved: number, observerClass: number): number {
  if (observerClass === 1) return hoursObserved;
  if (observerClass === 2) return hoursObserved * 0.5;
  if (observerClass === 3) return hoursObserved * 0.33;
  return 0;
}

function normalizeDETObserverClasses(detsMap: DETsMap | undefined, volunteersMap: VolunteersMap): DETsMap {
  const normalized: DETsMap = {};

  for (const [date, det] of Object.entries(detsMap ?? {})) {
    const observers = det.observerHours?.observers?.map((observer) => {
      const initials = observer.initials?.trim().toUpperCase() ?? "";
      const volunteer = volunteersMap[initials];
      const observerClass = volunteer?.observerClass ?? normalizeObserverClass(observer.class);
      const hoursObserved = Number(observer.hoursObserved) || 0;

      return {
        ...observer,
        name: volunteer?.fullName ?? observer.name,
        initials,
        class: observerClass,
        totalHours: calculateObserverTotal(hoursObserved, observerClass),
      };
    });

    const observerHours = {
      ...(det.observerHours ?? { total: 0 }),
      observers,
      total: observers?.reduce((sum, observer) => sum + observer.totalHours, 0) ?? det.observerHours?.total ?? 0,
    };

    normalized[date] = { ...det, observerHours };
  }

  return normalized;
}

function hydrateBirdEvents(events: Record<string, BirdEvent>): Map<string, BirdEvent> {
  const hydrated = new Map<string, BirdEvent>();
  for (const id in events) {
    const event = events[id];
    hydrated.set(id, {
      ...event,
      band: new Band(event.band.bandPrefix, event.band.bandSuffix, event.band.bandSize ?? null),
    });
  }
  return hydrated;
}

/**
 * Hydrate a DatabaseData record into the store. Rebuilds derived maps,
 * reconstructs Band class instances from serialized data, and replaces
 * birdEventsStore with the merged (events ∪ queued) view.
 */
function populateStateFromData(data: DatabaseData, queued: PendingEvent[]): void {
  const volunteersMap = getVolunteerMetadata(data);
  const detsMap = normalizeDETObserverClasses(data.DETsMap, volunteersMap);
  setSpeciesMap(data.magicTable?.species ?? {});
  const speciesAliasesMap = normalizeSpeciesAliasesMap(data.speciesAliasesMap ?? {});
  const bandResetsMap = data.bandResetsMap ?? {};
  const mergedEvents = overlayQueuedEvents(data.birdEventsMap ?? {}, queued);
  const { bandIdMap, bandGroups, programs, years, volunteerStats } = rebuildMapsFromEvents(
    mergedEvents,
    volunteersMap,
    bandResetsMap
  );
  const hydratedEvents = hydrateBirdEvents(mergedEvents);
  birdEventsStore.replace(hydratedEvents);

  useAppStore.setState({
    magicTable: data.magicTable ?? { pyle: {}, species: {} },
    volunteersMap,
    speciesAliasesMap,
    bandResetsMap,
    bandIdToBirdEventIdsMap: bandIdMap,
    bandGroupsMap: bandGroups,
    programsMap: programs,
    yearsToProgramMap: years,
    volunteerStatsMap: volunteerStats,
    bandSizeToBandIdMap: computeBandSizeToBandIdMap(hydratedEvents, bandGroups, bandResetsMap),
    speciesInfoMap: computeSpeciesInfoMap(hydratedEvents, speciesAliasesMap, bandResetsMap),
    DETsMap: detsMap,
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
      try {
        logger.info("DataLoad", `Loading ${CURRENT_ENVIRONMENT}/ data...`);
        const cachedData = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);
        const lastEventSync = await getLastUpdated(CURRENT_ENVIRONMENT);

        if (!isOnline) {
          if (cachedData) {
            setStatus("Loading cached data...");
            const queued = await getQueuedEvents(CURRENT_ENVIRONMENT);
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
          cachedTimestamps = cached;
        } catch {
          if (cachedData) {
            setStatus("Using cached data (Firebase unreachable)");
            const queued = await getQueuedEvents(CURRENT_ENVIRONMENT);
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
        let deltaEvents: Record<string, BirdEvent> = {};
        let addedDeltaEventCount = 0;
        let isFullEventSnapshot = true;
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
            deltaEvents = deltaSnap.exists()
              ? (deltaSnap.val() as Record<string, BirdEvent>)
              : {};
            const deltaCount = Object.keys(deltaEvents).length;

            if (deltaCount === 0 && mapsToFetch.size === 0) {
              setStatus("Cache is up to date");
              logger.info("DataLoad", "No new events, maps unchanged — using cache");
              const queuedForCache = await getQueuedEvents(CURRENT_ENVIRONMENT);
              populateStateFromData(cachedData, queuedForCache);
              useAppStore.setState({ lastSyncedAt: lastEventSync, isLoading: false });
              return;
            }

            logger.info("DataLoad", `Incremental: ${deltaCount} new events`);
            setStatus(`Merging ${deltaCount} new events...`);
            // This cache object is local to this load. Updating it in place
            // avoids allocating a second 700K-entry object for a tiny delta.
            allEvents = cachedData.birdEventsMap;
            for (const id in deltaEvents) {
              if (!allEvents[id]) addedDeltaEventCount++;
              allEvents[id] = deltaEvents[id];
            }
            isFullEventSnapshot = false;
          } catch (err) {
            logger.warn("DataLoad", "Incremental load failed, falling back to full load", err);
            setStatus("Downloading all events...");
            const fullSnap = await get(ref(db, `${env}/birdEventsMap`));
            allEvents = fullSnap.exists() ? fullSnap.val() : {};
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
        }

        if (cancelled) return;

        let dismissedMap = cachedData?.dismissedConflictsMap ?? {};
        let detsMap = cachedData?.DETsMap ?? {};
        let magicTableData: MagicTable = cachedData?.magicTable ?? { pyle: {}, species: {} };
        let volunteersMap = getVolunteerMetadata(cachedData);
        let notesMap: Record<string, string> = cachedData?.bandGroupNotesMap ?? {};
        let speciesAliasesData: Record<string, string> = cachedData?.speciesAliasesMap ?? {};
        let bandResetsMap: BandResetsMap = cachedData?.bandResetsMap ?? {};
        if (mapsToFetch.size > 0) {
          const fetching = [...mapsToFetch];
          logger.info("DataLoad", `Fetching changed maps: ${fetching.join(", ")}`);
          setStatus(`Downloading ${fetching.length} updated map${fetching.length > 1 ? "s" : ""}...`);
          const snapshots = await Promise.all(fetching.map((m) => get(ref(db, `${env}/${m}`))));
          for (let i = 0; i < fetching.length; i++) {
            const snap = snapshots[i];
            const val = snap.exists() ? snap.val() : null;
            switch (fetching[i]) {
              case "dismissedConflictsMap":
                dismissedMap = val ?? {};
                break;
              case "DETsMap":
                detsMap = val ?? {};
                break;
              case "magicTable":
                magicTableData = val ?? { pyle: {}, species: {} };
                break;
              case "volunteersMap":
                volunteersMap = getVolunteerMetadata({ ...(cachedData ?? {}), volunteersMap: val ?? {} } as DatabaseData);
                break;
              case "bandGroupNotesMap":
                notesMap = val ?? {};
                break;
              case "speciesAliasesMap":
                speciesAliasesData = val ?? {};
                break;
              case "bandResetsMap":
                bandResetsMap = val ?? {};
                break;
            }
          }
        }

        if (cancelled) return;

        setSpeciesMap(magicTableData.species);
        const speciesAliasesMap = normalizeSpeciesAliasesMap(speciesAliasesData);

        // Overlay pending (not-yet-synced) events so derived maps, prefill
        // suggestions, and capture lists include offline work.
        const queued = await getQueuedEvents(CURRENT_ENVIRONMENT);
        const mergedEvents = overlayQueuedEvents(allEvents, queued);

        setStatus("Rebuilding maps...");
        const { bandIdMap, bandGroups, programs, years, volunteerStats } = rebuildMapsFromEvents(
          mergedEvents,
          volunteersMap,
          bandResetsMap
        );

        const reconstructed = hydrateBirdEvents(mergedEvents);

        const data: DatabaseData = {
          birdEventsMap: mergedEvents,
          programsMap: programs,
          bandGroupsMap: bandGroups,
          bandIdToBirdEventIdsMap: bandIdMap,
          yearsToProgramMap: years,
          bandSizeToBandIdMap: {} as Record<BandSize, string>,
          dismissedConflictsMap: dismissedMap,
          DETsMap: normalizeDETObserverClasses(detsMap, volunteersMap),
          volunteersMap,
          magicTable: magicTableData,
          bandGroupNotesMap: notesMap,
          speciesAliasesMap,
          bandResetsMap,
        };

        setStatus("Saving to cache...");
        // Delta cursor for next sync = max server-stamped syncedAt we've seen.
        // Using wall-clock `Date.now()` is unsafe: if this client's clock is
        // ahead of the client that wrote the next event, `startAt(cursor + 1)`
        // would skip that event forever.
        let maxSyncedAt = lastEventSync ?? 0;
        let allEventCount = isFullEventSnapshot ? 0 : cachedEventCount + addedDeltaEventCount;
        const cursorSource = isFullEventSnapshot ? allEvents : deltaEvents;
        for (const id in cursorSource) {
          if (isFullEventSnapshot) {
            allEventCount++;
          }
          const ev = cursorSource[id];
          if (typeof ev.syncedAt === "number" && ev.syncedAt > maxSyncedAt) {
            maxSyncedAt = ev.syncedAt;
          }
        }
        const cacheTimestamp = maxSyncedAt > 0 ? maxSyncedAt : Date.now();
        if (isFullEventSnapshot) {
          await saveDataToIndexedDB(CURRENT_ENVIRONMENT, data);
        } else {
          await saveDataDeltaToIndexedDB(CURRENT_ENVIRONMENT, data, deltaEvents);
        }
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
          bandResetsMap,
          bandIdToBirdEventIdsMap: bandIdMap,
          bandGroupsMap: bandGroups,
          programsMap: programs,
          yearsToProgramMap: years,
          volunteerStatsMap: volunteerStats,
          bandSizeToBandIdMap: computeBandSizeToBandIdMap(reconstructed, bandGroups, bandResetsMap),
          speciesInfoMap: computeSpeciesInfoMap(reconstructed, speciesAliasesMap, bandResetsMap),
          dismissedConflictsMap: dismissedMap,
          DETsMap: data.DETsMap ?? {},
          lastSyncedAt: cacheTimestamp,
          loadingStatus: "Ready",
        });

        logger.info("DataLoad", "Load complete", { events: allEventCount });
      } catch (err) {
        logger.error("DataLoad", "Error loading data", err);
        if (!cancelled) {
          try {
            const fallbackData = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);
            if (fallbackData) {
              const queued = await getQueuedEvents(CURRENT_ENVIRONMENT).catch(() => [] as PendingEvent[]);
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

  // Band resets are rare but operationally important: keep this small map
  // live so another open banding station cannot continue using stale band
  // history after an administrator resets a band.
  useEffect(() => {
    if (!isLoggedIn || !isOnline) return;
    return onValue(ref(db, `${CURRENT_ENVIRONMENT}/bandResetsMap`), (snapshot) => {
      const next = (snapshot.exists() ? snapshot.val() : {}) as BandResetsMap;
      const state = useAppStore.getState();
      const current = state.bandResetsMap;
      const keys = Object.keys(next);
      if (
        keys.length === Object.keys(current).length &&
        keys.every(
          (key) =>
            current[key]?.generationId === next[key]?.generationId && current[key]?.resetAt === next[key]?.resetAt
        )
      ) {
        return;
      }

      if (birdEventsStore.size() === 0) {
        useAppStore.setState({ bandResetsMap: next });
        return;
      }

      const { bandIdMap, bandGroups, programs, years, volunteerStats } = rebuildMapsFromEvents(
        birdEventsStore.getAll(),
        state.volunteersMap,
        next
      );
      for (const [programId, existingProgram] of Object.entries(state.programsMap)) {
        if (programs[programId]) {
          programs[programId] = { ...existingProgram, ...programs[programId] };
        } else {
          programs[programId] = {
            id: existingProgram.id,
            displayName: existingProgram.displayName,
            bandGroupIds: [],
            recaptureIds: [],
          };
        }
      }
      const selectedProgram = state.selectedProgram ? programs[state.selectedProgram.id] ?? null : null;
      useAppStore.setState({
        bandResetsMap: next,
        bandIdToBirdEventIdsMap: bandIdMap,
        bandGroupsMap: bandGroups,
        programsMap: programs,
        yearsToProgramMap: years,
        volunteerStatsMap: volunteerStats,
        bandSizeToBandIdMap: computeBandSizeToBandIdMap(birdEventsStore.getAll(), bandGroups, next),
        speciesInfoMap: computeSpeciesInfoMap(birdEventsStore.getAll(), state.speciesAliasesMap, next),
        selectedProgram,
      });
      saveDatabaseMetadataOnly(CURRENT_ENVIRONMENT, {
        bandResetsMap: next,
        bandIdToBirdEventIdsMap: bandIdMap,
        bandGroupsMap: bandGroups,
        programsMap: programs,
        yearsToProgramMap: years,
      }).catch((err) => logger.error("BandReset", "Failed to cache remote band reset", err));
    });
  }, [isLoggedIn, isOnline]);

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
