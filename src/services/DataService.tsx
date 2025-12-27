import { useState, useEffect, useCallback } from "react";
import { get, ref, set } from "firebase/database";
import { db, CURRENT_ENVIRONMENT } from "../firebase";
import type {
  AlphaData,
  YearToProgramMap,
  ProgramsMap,
  BandIdToBirdEventIdsMap,
  BirdEventsMap,
  BandGroupsMap,
  MagicTable,
  CaptureFormData,
  BirdEvent,
  PendingBirdEvent,
} from "../types";
import { Band, BirdEventType } from "../types";
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

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const isOnline = useOnlineStatus();

  // All data from alpha/
  const [yearsToProgramMap, setYearsToProgramMap] = useState<YearToProgramMap>({});
  const [programsMap, setProgramsMap] = useState<ProgramsMap>({});
  const [bandIdToBirdEventIdsMap, setBandIdToBirdEventIdsMap] = useState<BandIdToBirdEventIdsMap>({});
  const [birdEventsMap, setBirdEventsMap] = useState<BirdEventsMap>({});
  const [bandGroupsMap, setBandGroupsMap] = useState<BandGroupsMap>({});
  const [magicTable, setMagicTable] = useState<MagicTable>({ pyle: {}, mbo: {} });

  // Load entire alpha/ on mount
  useEffect(() => {
    let cancelled = false;

    const loadAlphaData = async () => {
      try {
        console.log(`Checking for ${CURRENT_ENVIRONMENT}/ data updates...`);

        // Check if we have cached data
        const cachedData = await getDataFromIndexedDB(CURRENT_ENVIRONMENT);
        const cachedTimestamp = await getLastUpdated(CURRENT_ENVIRONMENT);

        // Get the lastModified timestamp from Firebase
        const lastModifiedSnapshot = await get(ref(db, `${CURRENT_ENVIRONMENT}/lastModified`));
        const firebaseTimestamp = lastModifiedSnapshot.exists() ? (lastModifiedSnapshot.val() as number) : null;

        // Determine if we need to fetch fresh data
        const needsFetch = !cachedData || !cachedTimestamp || !firebaseTimestamp || firebaseTimestamp > cachedTimestamp;

        if (!needsFetch && cachedData) {
          console.log(`✅ Using cached ${CURRENT_ENVIRONMENT}/ data (up to date)`);
          populateStateFromData(cachedData);
          setIsLoading(false);
          return;
        }

        // Fetch fresh data from Firebase
        console.log(`Fetching fresh ${CURRENT_ENVIRONMENT}/ data from Firebase RTDB...`);
        const snapshot = await get(ref(db, CURRENT_ENVIRONMENT));

        if (cancelled) return;

        if (snapshot.exists()) {
          const data = snapshot.val() as AlphaData;

          // Save to IndexedDB
          await saveDataToIndexedDB(CURRENT_ENVIRONMENT, data);
          if (firebaseTimestamp) {
            await saveLastUpdated(CURRENT_ENVIRONMENT, firebaseTimestamp);
          }

          populateStateFromData(data);

          console.log(`✅ Loaded ${CURRENT_ENVIRONMENT}/ data:`, {
            yearsToProgramMap: Object.keys(data.yearsToProgramMap ?? {}).length,
            programsMap: Object.keys(data.programsMap ?? {}).length,
            bandIdToBirdEventIdsMap: Object.keys(data.bandIdToBirdEventIdsMap ?? {}).length,
            birdEventsMap: Object.keys(data.birdEventsMap ?? {}).length,
            bandGroupsMap: Object.keys(data.bandGroupsMap ?? {}).length,
            hasMagicTable: !!data.magicTable,
          });
        } else {
          setError(`Error: ${CURRENT_ENVIRONMENT}/ is missing from the database. Please run import scripts.`);
          console.error(`Error: ${CURRENT_ENVIRONMENT}/ is missing from the database. Please run import scripts.`);
        }
      } catch (err) {
        console.error(`Error loading ${CURRENT_ENVIRONMENT}/ data:`, err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    const populateStateFromData = (data: AlphaData) => {
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
    };

    loadAlphaData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Sync pending events to Firebase
  const syncQueue = useCallback(async () => {
    if (!isOnline) return;

    try {
      const pendingEvents = await getQueuedEvents();
      if (pendingEvents.length === 0) return;

      console.log(`🔄 Syncing ${pendingEvents.length} pending events...`);

      for (const pending of pendingEvents) {
        const { birdEvent, environment } = pending;
        const { band, id: birdEventId, birdEventType } = birdEvent;

        try {
          // Update birdEventsMap
          await set(ref(db, `${environment}/birdEventsMap/${birdEventId}`), birdEvent);

          // Update bandIdToBirdEventIdsMap
          const birdEventIds = bandIdToBirdEventIdsMap[band.id] || [];
          if (!birdEventIds.includes(birdEventId)) {
            const newBirdEventIds = [...birdEventIds, birdEventId];
            await set(ref(db, `${environment}/bandIdToBirdEventIdsMap/${band.id}`), newBirdEventIds);
          }

          // Update bandGroupsMap
          if (birdEventType === BirdEventType.Banded) {
            if (!bandGroupsMap[band.bandGroupId]) {
              await set(ref(db, `${environment}/bandGroupsMap/${band.bandGroupId}`), {
                id: band.bandGroupId,
                captureIds: [birdEventId],
              });
            }
            const updatedCaptureIds = [...bandGroupsMap[band.bandGroupId].captureIds, birdEventId];
            await set(ref(db, `${environment}/bandGroupsMap/${band.bandGroupId}/captureIds`), updatedCaptureIds);
          }

          // // Update programsMap
          // const year = date.substring(0, 4);
          // if (!programsMap[programId]) {
          //   await set(ref(db, `${environment}/programsMap/${programId}`), {
          //     id: programId,
          //     bandGroupIds: [band.bandGroupId],
          //     recaptureIds: birdEventType !== BirdEventType.Banded ? [birdEventId] : [],
          //   });
          // } else {
          //   if (!programsMap[programId].bandGroupIds.includes(band.bandGroupId)) {
          //     const updatedBandGroupIds = [...programsMap[programId].bandGroupIds, band.bandGroupId];
          //     await set(ref(db, `${environment}/programsMap/${programId}/bandGroupIds`), updatedBandGroupIds);
          //   }
          //   if (birdEventType !== BirdEventType.Banded && !programsMap[programId].recaptureIds.includes(birdEventId)) {
          //     const updatedRecaptureIds = [...programsMap[programId].recaptureIds, birdEventId];
          //     await set(ref(db, `${environment}/programsMap/${programId}/recaptureIds`), updatedRecaptureIds);
          //   }
          // }

          // // Update yearsToProgramMap
          // if (!yearsToProgramMap[year]) {
          //   await set(ref(db, `${environment}/yearsToProgramMap/${year}`), [programId]);
          // } else if (!yearsToProgramMap[year].includes(programId)) {
          //   const updatedPrograms = [...yearsToProgramMap[year], programId];
          //   await set(ref(db, `${environment}/yearsToProgramMap/${year}`), updatedPrograms);
          // }

          // Remove from queue after successful sync
          await removeFromQueue(pending.id);
          console.log(`✅ Synced event: ${birdEventId} to ${environment}`);
        } catch (err) {
          console.error(`❌ Failed to sync event ${birdEventId}:`, err);
          // Leave in queue to retry later
        }
      }

      // Update lastModified timestamp after all syncs (use CURRENT_ENVIRONMENT for this)
      await set(ref(db, `${CURRENT_ENVIRONMENT}/lastModified`), Date.now());

      // Update pending count
      const count = await getQueueCount();
      setPendingCount(count);

      console.log("✅ Queue sync completed");
    } catch (err) {
      console.error("Error syncing queue:", err);
    }
  }, [isOnline, bandIdToBirdEventIdsMap, bandGroupsMap, programsMap, yearsToProgramMap]);

  // Sync queue when coming online or when dependencies change
  useEffect(() => {
    if (isOnline && !isLoading) {
      syncQueue();
    }
  }, [isOnline, isLoading, syncQueue]);

  // Update pending count on mount
  useEffect(() => {
    getQueueCount().then(setPendingCount).catch(console.error);
  }, []);

  const addCapture = useCallback(
    async (captureData: CaptureFormData, birdEventType: BirdEventType) => {
      try {
        // Generate unique ID for the new bird event
        const birdEventId = crypto.randomUUID();

        // Build Band object
        const bandPrefix = captureData.bandGroup.substring(0, 4);
        const bandSuffix = captureData.bandGroup.substring(4) + captureData.bandLastTwoDigits;
        const band = new Band(bandPrefix, bandSuffix);

        // Create BirdEvent object
        const newBirdEvent: BirdEvent = {
          id: birdEventId,
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
          notes: captureData.notes,
          previousEventId: null,
          modifiedEventId: null,
          birdEventType,
        };

        // Create pending event for queue
        const pendingEvent: PendingBirdEvent = {
          id: birdEventId,
          birdEvent: newBirdEvent,
          timestamp: Date.now(),
          environment: CURRENT_ENVIRONMENT,
        };

        // Add to queue
        await addToQueue(pendingEvent);

        // Update local state immediately
        const year = captureData.date.substring(0, 4);
        const updatedBandEventIds = [...(bandIdToBirdEventIdsMap[band.id] || []), birdEventId];

        setBirdEventsMap((prev) => ({ ...prev, [birdEventId]: newBirdEvent }));
        setBandIdToBirdEventIdsMap((prev) => ({ ...prev, [band.id]: updatedBandEventIds }));
        setBandGroupsMap((prev) => ({
          ...prev,
          [band.bandGroupId]: {
            id: band.bandGroupId,
            captureIds: prev[band.bandGroupId] ? [...prev[band.bandGroupId].captureIds, birdEventId] : [birdEventId],
          },
        }));
        setProgramsMap((prev) => ({
          ...prev,
          [captureData.programId]: {
            id: captureData.programId,
            bandGroupIds: prev[captureData.programId]
              ? Array.from(new Set([...prev[captureData.programId].bandGroupIds, band.bandGroupId]))
              : [band.bandGroupId],
            recaptureIds: prev[captureData.programId]
              ? birdEventType !== BirdEventType.Banded
                ? [...prev[captureData.programId].recaptureIds, birdEventId]
                : prev[captureData.programId].recaptureIds
              : birdEventType !== BirdEventType.Banded
              ? [birdEventId]
              : [],
          },
        }));
        setYearsToProgramMap((prev) => ({
          ...prev,
          [year]: prev[year] ? Array.from(new Set([...prev[year], captureData.programId])) : [captureData.programId],
        }));

        // Update pending count
        const count = await getQueueCount();
        setPendingCount(count);

        // If online, sync immediately
        if (isOnline) {
          await syncQueue();
        } else {
          console.log("📴 Offline - event queued for later sync:", birdEventId);
        }

        console.log("✅ Capture added:", birdEventId);
      } catch (err) {
        console.error("Error adding capture:", err);
        throw err;
      }
    },
    [bandIdToBirdEventIdsMap, bandGroupsMap, programsMap, yearsToProgramMap, isOnline, syncQueue]
  );

  return (
    <DataContext.Provider
      value={{
        isLoading,
        error,
        selectedProgram,
        selectProgram: setSelectedProgram,
        yearsToProgramMap,
        programsMap,
        bandIdToBirdEventIdsMap,
        birdEventsMap,
        bandGroupsMap,
        magicTable,
        isOnline,
        pendingCount,
        addCapture,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
