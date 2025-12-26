import { useState, useEffect } from "react";
import { get, ref } from "firebase/database";
import { db } from "../firebase";
import type {
  AlphaData,
  YearToProgramMap,
  ProgramsMap,
  BandIdToBirdEventIdsMap,
  BirdEventsMap,
  BandGroupsMap,
  MagicTable,
} from "../types";
import { DataContext } from "./DataContext";

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
        console.log("Fetching entire alpha/ from Firebase RTDB...");
        const snapshot = await get(ref(db, "alpha"));

        if (cancelled) return;

        if (snapshot.exists()) {
          const data = snapshot.val() as AlphaData;

          setYearsToProgramMap(data.yearsToProgramMap ?? {});
          setProgramsMap(data.programsMap ?? {});
          setBandIdToBirdEventIdsMap(data.bandIdToBirdEventIdsMap ?? {});
          setBirdEventsMap(data.birdEventsMap ?? {});
          setBandGroupsMap(data.bandGroupsMap ?? {});
          setMagicTable(data.magicTable ?? null);

          console.log("✅ Loaded alpha/ data:", {
            years: Object.keys(data.yearsToProgramMap ?? {}).length,
            programs: Object.keys(data.programsMap ?? {}).length,
            bandIds: Object.keys(data.bandIdToBirdEventIdsMap ?? {}).length,
            birdEvents: Object.keys(data.birdEventsMap ?? {}).length,
            bandGroups: Object.keys(data.bandGroupsMap ?? {}).length,
            hasMagicTable: !!data.magicTable,
          });
        } else {
          setError("Error: alpha/ is missing from the database. Please run import scripts.");
          console.error("Error: alpha/ is missing from the database. Please run import scripts.");
        }
      } catch (err) {
        console.error("Error loading alpha/ data:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
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
