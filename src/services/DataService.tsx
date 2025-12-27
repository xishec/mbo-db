import { useState, useEffect } from "react";
import { get, ref } from "firebase/database";
import { db, CURRENT_ENVIRONMENT } from "../firebase";
import type {
  AlphaData,
  YearToProgramMap,
  ProgramsMap,
  BandIdToBirdEventIdsMap,
  BirdEventsMap,
  BandGroupsMap,
  MagicTable,
} from "../types";
import { Band } from "../types";
import { DataContext } from "./DataContext";
import {
  saveAlphaDataToIndexedDB,
  getAlphaDataFromIndexedDB,
  saveEnvironmentLastUpdated,
  getEnvironmentLastUpdated,
} from "./indexedDB";

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);

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
        const cachedData = await getAlphaDataFromIndexedDB(CURRENT_ENVIRONMENT);
        const cachedTimestamp = await getEnvironmentLastUpdated(CURRENT_ENVIRONMENT);

        // Get the lastModified timestamp from Firebase
        const lastModifiedSnapshot = await get(ref(db, `${CURRENT_ENVIRONMENT}/lastModified`));
        const firebaseTimestamp = lastModifiedSnapshot.exists() ? lastModifiedSnapshot.val() as number : null;

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
          await saveAlphaDataToIndexedDB(CURRENT_ENVIRONMENT, data);
          if (firebaseTimestamp) {
            await saveEnvironmentLastUpdated(CURRENT_ENVIRONMENT, firebaseTimestamp);
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
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
