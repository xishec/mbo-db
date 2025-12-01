import { useState, useCallback, useRef, useEffect } from "react";
import { get, ref } from "firebase/database";
import { db } from "../firebase";
import type { Capture, ProgramData, MagicTable } from "../types";
import { DataContext, defaultProgramData } from "./DataContext";

export function DataProvider({ children }: { children: React.ReactNode }) {
  // Current program state
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [programData, setProgramData] = useState<ProgramData>(defaultProgramData);

  // All captures cache (loaded on mount)
  const [allCaptures, setAllCaptures] = useState<Capture[]>([]);
  const [isLoadingAllCaptures, setIsLoadingAllCaptures] = useState(true);

  // Magic table cache (loaded on mount)
  const [magicTable, setMagicTable] = useState<MagicTable | null>(null);

  // Track current fetch to cancel stale requests
  const fetchIdRef = useRef(0);

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

      const snapshot = await get(ref(db, `bandIdToCaptureIdsMap/${bandId}`));
      if (!snapshot.exists()) return [];

      const captureIds = snapshot.val() as string[];
      return fetchCaptures(captureIds);
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

    const loadAllCaptures = async () => {
      try {
        const snapshot = await get(ref(db, "capturesMap"));
        if (cancelled) return;

        if (snapshot.exists()) {
          const capturesMap = snapshot.val() as Record<string, Capture>;
          setAllCaptures(Object.values(capturesMap));
        }
      } catch (error) {
        console.error("Error loading all captures:", error);
      } finally {
        if (!cancelled) {
          setIsLoadingAllCaptures(false);
        }
      }
    };

    loadAllCaptures();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load magic table on mount (background fetch)
  useEffect(() => {
    let cancelled = false;

    const loadMagicTable = async () => {
      try {
        const snapshot = await get(ref(db, "magicTable"));
        if (cancelled) return;

        if (snapshot.exists()) {
          setMagicTable(snapshot.val() as MagicTable);
        }
      } catch (error) {
        console.error("Error loading magic table:", error);
      }
    };

    loadMagicTable();

    return () => {
      cancelled = true;
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
