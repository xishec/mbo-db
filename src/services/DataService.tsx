import { useState, useCallback, useRef, useEffect } from "react";
import { get, ref, onValue } from "firebase/database";
import { db } from "../firebase";
import type { Capture, ProgramData, MagicTable } from "../types";
import { DataContext, defaultProgramData } from "./DataContext";
import {
  getAllCapturesFromIndexedDB,
  saveCaptureMapToIndexedDB,
  getMagicTableFromIndexedDB,
  saveMagicTableToIndexedDB,
  getLastUpdatedFromIndexedDB,
  saveLastUpdatedToIndexedDB,
} from "./indexedDB";

export function DataProvider({ children }: { children: React.ReactNode }) {
  // Current program state
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [programData, setProgramData] = useState<ProgramData>(defaultProgramData);

  // All captures cache (loaded on mount)
  const [allCaptures, setAllCaptures] = useState<Capture[]>([]);
  const [isLoadingAllCaptures, setIsLoadingAllCaptures] = useState(true);

  // Magic table cache (loaded on mount)
  const [magicTable, setMagicTable] = useState<MagicTable | null>(null);

  // Track online status for re-syncing when coming back online
  const [, setIsOnline] = useState(navigator.onLine);

  // Track current fetch to cancel stale requests
  const fetchIdRef = useRef(0);

  // Listen for online/offline changes and trigger re-sync
  useEffect(() => {
    const handleOnline = () => {
      console.log("🌐 Back online - will sync on next navigation");
      setIsOnline(true);
    };
    const handleOffline = () => {
      console.log("📴 Gone offline - using cached data");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch captures by their IDs from capturesMap
  const fetchCaptures = useCallback(async (captureIds: string[]): Promise<Capture[]> => {
    if (captureIds.length === 0) return [];

    const capturePromises = captureIds.map((captureId) => get(ref(db, `capturesMap/${captureId}`)));
    const snapshots = await Promise.all(capturePromises);
    const captures: Capture[] = [];

    for (const snapshot of snapshots) {
      if (snapshot.exists()) {
        captures.push(snapshot.val() as Capture);
      }
    }

    return captures;
  }, []);

  // Fetch captures by bandId using bandIdToCaptureIdsMap
  const fetchCapturesByBandId = useCallback(
    async (bandId: string): Promise<Capture[]> => {
      if (!bandId) return [];

      try {
        const snapshot = await get(ref(db, `bandIdToCaptureIdsMap/${bandId}`));
        if (!snapshot.exists()) return [];

        const captureIds = snapshot.val() as string[];
        return fetchCaptures(captureIds);
      } catch (error) {
        console.error(`Error fetching captures for bandId ${bandId} from bandIdToCaptureIdsMap:`, error);
        return [];
      }
    },
    [fetchCaptures]
  );

  // Check if bandId exists in bandIdToCaptureIdsMap
  const checkBandIdExists = useCallback(async (bandId: string): Promise<boolean> => {
    if (!bandId) return false;
    const snapshot = await get(ref(db, `bandIdToCaptureIdsMap/${bandId}`));
    return snapshot.exists();
  }, []);

  // Load all captures on mount (background fetch)
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let initialTimestamp: number | null = null;

    const loadAllCaptures = async () => {
      try {
        // 1. Always check IndexedDB cache first
        const [cachedCaptures, cachedTimestamp] = await Promise.all([
          getAllCapturesFromIndexedDB(),
          getLastUpdatedFromIndexedDB(),
        ]);

        // 2. If offline, use cached data immediately
        if (!navigator.onLine) {
          console.log("📴 Offline: Loading captures from IndexedDB cache");
          if (!cancelled) {
            if (cachedCaptures.length > 0) {
              setAllCaptures(cachedCaptures);
            } else {
              console.warn("⚠️ Offline with no cached data available");
            }
            setIsLoadingAllCaptures(false);
          }
          return;
        }

        // 3. Online: Get RTDB timestamp
        let rtdbTimestamp: number | null = null;
        try {
          const rtdbTimestampSnapshot = await get(ref(db, "metadata/lastUpdated"));
          rtdbTimestamp = rtdbTimestampSnapshot.exists() ? (rtdbTimestampSnapshot.val() as number) : null;
          initialTimestamp = rtdbTimestamp;
        } catch (error) {
          console.warn("⚠️ Could not reach Firebase, using cached data:", error);
          if (!cancelled) {
            if (cachedCaptures.length > 0) {
              setAllCaptures(cachedCaptures);
            }
            setIsLoadingAllCaptures(false);
          }
          return;
        }

        console.log("📊 Cache check:", {
          cachedCount: cachedCaptures.length,
          cachedTimestamp,
          rtdbTimestamp,
        });

        // 3. Decide whether to use cache or fetch from RTDB
        const shouldUseCache =
          cachedCaptures.length > 0 && cachedTimestamp !== null && rtdbTimestamp !== null && cachedTimestamp >= rtdbTimestamp;

        if (shouldUseCache) {
          console.log("✅ Loading captures from IndexedDB cache");
          if (!cancelled) {
            setAllCaptures(cachedCaptures);
            setIsLoadingAllCaptures(false);
          }
        } else {
          console.log("Fetching captures from Firebase RTDB");
          const snapshot = await get(ref(db, "capturesMap"));
          if (cancelled) return;

          if (snapshot.exists()) {
            const capturesMap = snapshot.val() as Record<string, Capture>;
            const captures = Object.values(capturesMap);
            setAllCaptures(captures);

            // Save to IndexedDB
            await saveCaptureMapToIndexedDB(capturesMap);
            if (rtdbTimestamp) {
              await saveLastUpdatedToIndexedDB(rtdbTimestamp);
              console.log("Saved captures to IndexedDB with timestamp:", rtdbTimestamp);
            } else {
              console.log("Saved captures to IndexedDB (no timestamp)");
            }
          } else {
            console.error("Error: capturesMap is missing from the database. Please run import scripts.");
          }

          if (!cancelled) {
            setIsLoadingAllCaptures(false);
          }
        }

        // 4. Set up real-time listener for future updates (only triggers on changes after initial load)
        if (!cancelled) {
          unsubscribe = onValue(ref(db, "metadata/lastUpdated"), async (snapshot) => {
            if (snapshot.exists()) {
              const newTimestamp = snapshot.val() as number;
              
              // Skip the initial callback (listener fires immediately with current value)
              if (initialTimestamp !== null && newTimestamp === initialTimestamp) {
                initialTimestamp = null; // Clear flag after first callback
                return;
              }

              const currentCachedTimestamp = await getLastUpdatedFromIndexedDB();

              // If RTDB has newer data, refetch
              if (currentCachedTimestamp === null || newTimestamp > currentCachedTimestamp) {
                console.log("🔄 Detected RTDB update, refreshing captures...");
                const capturesSnapshot = await get(ref(db, "capturesMap"));
                if (capturesSnapshot.exists()) {
                  const capturesMap = capturesSnapshot.val() as Record<string, Capture>;
                  const captures = Object.values(capturesMap);
                  setAllCaptures(captures);

                  // Update cache
                  await saveCaptureMapToIndexedDB(capturesMap);
                  await saveLastUpdatedToIndexedDB(newTimestamp);
                  console.log("Updated captures cache");
                }
              }
            }
          });
        }
      } catch (error) {
        console.error("Error loading all captures:", error);
        // Try to load from cache on any error
        if (!cancelled) {
          try {
            const cachedCaptures = await getAllCapturesFromIndexedDB();
            if (cachedCaptures.length > 0) {
              console.log("⚠️ Error occurred, falling back to cached captures");
              setAllCaptures(cachedCaptures);
            }
          } catch (cacheError) {
            console.error("Failed to load from cache:", cacheError);
          }
          setIsLoadingAllCaptures(false);
        }
      }
    };

    loadAllCaptures();

    return () => {
      cancelled = true;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Load magic table on mount (background fetch)
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let initialTimestamp: number | null = null;

    const loadMagicTable = async () => {
      try {
        // 1. Always check IndexedDB cache first
        const [cachedMagicTable, cachedTimestamp] = await Promise.all([
          getMagicTableFromIndexedDB(),
          getLastUpdatedFromIndexedDB(),
        ]);

        // 2. If offline, use cached data immediately
        if (!navigator.onLine) {
          console.log("📴 Offline: Loading magic table from IndexedDB cache");
          if (!cancelled && cachedMagicTable) {
            setMagicTable(cachedMagicTable);
          }
          return;
        }

        // 3. Online: Get RTDB timestamp
        let rtdbTimestamp: number | null = null;
        try {
          const rtdbTimestampSnapshot = await get(ref(db, "metadata/lastUpdated"));
          rtdbTimestamp = rtdbTimestampSnapshot.exists() ? (rtdbTimestampSnapshot.val() as number) : null;
          initialTimestamp = rtdbTimestamp;
        } catch (error) {
          console.warn("⚠️ Could not reach Firebase for magic table, using cached data:", error);
          if (!cancelled && cachedMagicTable) {
            setMagicTable(cachedMagicTable);
          }
          return;
        }

        console.log("📊 Magic table cache check:", {
          hasCachedTable: cachedMagicTable !== null,
          cachedTimestamp,
          rtdbTimestamp,
        });

        // 3. Decide whether to use cache or fetch from RTDB
        const shouldUseCache =
          cachedMagicTable !== null && cachedTimestamp !== null && rtdbTimestamp !== null && cachedTimestamp >= rtdbTimestamp;

        if (shouldUseCache) {
          console.log("✅ Loading magic table from IndexedDB cache");
          if (!cancelled) {
            setMagicTable(cachedMagicTable);
          }
        } else {
          console.log("Fetching magic table from Firebase RTDB");
          const snapshot = await get(ref(db, "magicTable"));
          if (cancelled) return;

          if (snapshot.exists()) {
            const magicTableData = snapshot.val() as MagicTable;

            // Validate that both pyle and mbo tables exist
            if (!magicTableData.pyle) {
              console.error("Error: magicTable/pyle is missing from the database. Please run import scripts.");
            }
            if (!magicTableData.mbo) {
              console.error("Error: magicTable/mbo is missing from the database. Please run import scripts.");
            }

            setMagicTable(magicTableData);

            // Save to IndexedDB
            await saveMagicTableToIndexedDB(magicTableData);
            if (rtdbTimestamp) {
              await saveLastUpdatedToIndexedDB(rtdbTimestamp);
              console.log("Saved magic table to IndexedDB with timestamp:", rtdbTimestamp);
            } else {
              console.log("Saved magic table to IndexedDB (no timestamp)");
            }
          } else {
            console.error("Error: magicTable is missing from the database. Please run import scripts.");
          }
        }

        // 4. Set up real-time listener for future updates (only triggers on changes after initial load)
        if (!cancelled) {
          unsubscribe = onValue(ref(db, "metadata/lastUpdated"), async (snapshot) => {
            if (snapshot.exists()) {
              const newTimestamp = snapshot.val() as number;
              
              // Skip the initial callback (listener fires immediately with current value)
              if (initialTimestamp !== null && newTimestamp === initialTimestamp) {
                initialTimestamp = null; // Clear flag after first callback
                return;
              }

              const currentCachedTimestamp = await getLastUpdatedFromIndexedDB();

              // If RTDB has newer data, refetch
              if (currentCachedTimestamp === null || newTimestamp > currentCachedTimestamp) {
                console.log("🔄 Detected RTDB update, refreshing magic table...");
                const magicTableSnapshot = await get(ref(db, "magicTable"));
                if (magicTableSnapshot.exists()) {
                  const magicTableData = magicTableSnapshot.val() as MagicTable;
                  setMagicTable(magicTableData);

                  // Update cache
                  await saveMagicTableToIndexedDB(magicTableData);
                  await saveLastUpdatedToIndexedDB(newTimestamp);
                  console.log("Updated magic table cache");
                }
              }
            }
          });
        }
      } catch (error) {
        console.error("Error loading magic table:", error);
        // Try to load from cache on any error
        if (!cancelled) {
          try {
            const cachedMagicTable = await getMagicTableFromIndexedDB();
            if (cachedMagicTable) {
              console.log("⚠️ Error occurred, falling back to cached magic table");
              setMagicTable(cachedMagicTable);
            }
          } catch (cacheError) {
            console.error("Failed to load magic table from cache:", cacheError);
          }
        }
      }
    };

    loadMagicTable();

    return () => {
      cancelled = true;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Fetch captures by bandGroups using bandGroupToCaptureIdsMap, then fetch captures
  // Returns a Record of bandGroup -> Capture[]
  const fetchByBandGroups = useCallback(
    async (bandGroups: string[]): Promise<Record<string, Capture[]>> => {
      if (bandGroups.length === 0) return {};

      // 1. Fetch all captureIds for each bandGroup from bandGroupToCaptureIdsMap
      const bandGroupPromises = bandGroups.map((bandGroup) => get(ref(db, `bandGroupToCaptureIdsMap/${bandGroup}`)));
      const bandGroupSnapshots = await Promise.all(bandGroupPromises);

      // Build a record of bandGroup -> captureIds
      const bandGroupToCaptureIds: Record<string, string[]> = {};
      const allCaptureIds: string[] = [];

      for (let i = 0; i < bandGroups.length; i++) {
        const bandGroup = bandGroups[i];
        const snapshot = bandGroupSnapshots[i];
        if (snapshot.exists()) {
          const captureIds = snapshot.val() as string[];
          bandGroupToCaptureIds[bandGroup] = captureIds;
          allCaptureIds.push(...captureIds);
        }
      }

      // 2. Fetch all captures using fetchCaptures
      const captures = await fetchCaptures(allCaptureIds);

      // 3. Create a lookup record from captureId -> Capture
      const captureIdToCapture: Record<string, Capture> = {};
      for (const capture of captures) {
        captureIdToCapture[capture.id] = capture;
      }

      // 4. Build the result record of bandGroup -> Capture[]
      const result: Record<string, Capture[]> = {};
      for (const [bandGroup, captureIds] of Object.entries(bandGroupToCaptureIds)) {
        const capturesForBandGroup: Capture[] = [];
        for (const captureId of captureIds) {
          const capture = captureIdToCapture[captureId];
          if (capture) {
            capturesForBandGroup.push(capture);
          }
        }
        if (capturesForBandGroup.length > 0) {
          result[bandGroup] = capturesForBandGroup;
        }
      }

      return result;
    },
    [fetchCaptures]
  );

  // Select a program and prefetch all its data
  const selectProgram = useCallback(
    async (programName: string | null) => {
      setSelectedProgram(programName);

      if (!programName) {
        setProgramData(defaultProgramData);
        return;
      }

      // Increment fetch ID to cancel any stale fetches
      const currentFetchId = ++fetchIdRef.current;

      setProgramData({
        bandGroupToNewCaptures: {},
        reCaptures: [],
        isLoadingProgram: true,
        isLoadingCaptures: true,
        isLoadingReCaptures: true,
      });

      try {
        // 1. Fetch program data from programsMap (contains usedBandGroupIds and reCaptureIds)
        const programSnapshot = await get(ref(db, `programsMap/${programName}`));

        if (currentFetchId !== fetchIdRef.current) return; // Cancelled

        if (!programSnapshot.exists()) {
          console.error(`Error: Program "${programName}" not found in programsMap. Please run import scripts.`);
          setProgramData(defaultProgramData);
          return;
        }

        const program = programSnapshot.val() as {
          name: string;
          usedBandGroupIds: string[];
          reCaptureIds: string[];
        };

        setProgramData((prev) => ({
          ...prev,
          isLoadingProgram: false,
        }));

        // 2. Fetch new captures using usedBandGroupIds -> fetchByBandGroups
        const bandGroupIds = program.usedBandGroupIds ?? [];
        const bandGroupToNewCaptures = await fetchByBandGroups(bandGroupIds);

        if (currentFetchId !== fetchIdRef.current) return; // Cancelled

        setProgramData((prev) => ({
          ...prev,
          bandGroupToNewCaptures,
          isLoadingCaptures: false,
        }));

        // 3. Fetch recaptures using reCaptureIds -> fetchCaptures
        const reCaptureIds = program.reCaptureIds ?? [];
        const reCaptures = await fetchCaptures(reCaptureIds);

        if (currentFetchId !== fetchIdRef.current) return; // Cancelled

        setProgramData((prev) => ({
          ...prev,
          reCaptures,
          isLoadingReCaptures: false,
        }));
      } catch (error) {
        console.error("Error fetching program data:", error);
        if (currentFetchId === fetchIdRef.current) {
          setProgramData(defaultProgramData);
        }
      }
    },
    [fetchByBandGroups, fetchCaptures]
  );

  return (
    <DataContext.Provider
      value={{
        programData,
        selectProgram,
        selectedProgram,
        fetchCapturesByBandId,
        checkBandIdExists,
        allCaptures,
        isLoadingAllCaptures,
        magicTable,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
