import { useState, useCallback, useRef } from "react";
import { get, ref } from "firebase/database";
import { db } from "../firebase";
import type { Capture } from "../helper/helper";
import { ProgramDataContext, defaultProgramData } from "./ProgramDataContext";
import type { ProgramData } from "./ProgramDataContext";

export function ProgramDataProvider({ children }: { children: React.ReactNode }) {
  // Current program state
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [programData, setProgramData] = useState<ProgramData>(defaultProgramData);

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

  // Fetch captures by bandGroups using bandGroupToCaptureIdsMap, then fetch captures
  // Returns a Map of bandGroup -> Capture[]
  const fetchByBandGroups = useCallback(
    async (bandGroups: string[]): Promise<Map<string, Capture[]>> => {
      if (bandGroups.length === 0) return new Map();

      // 1. Fetch all captureIds for each bandGroup from bandGroupToCaptureIdsMap
      const bandGroupPromises = bandGroups.map((bandGroup) => get(ref(db, `bandGroupToCaptureIdsMap/${bandGroup}`)));
      const bandGroupSnapshots = await Promise.all(bandGroupPromises);

      // Build a map of bandGroup -> captureIds
      const bandGroupToCaptureIds = new Map<string, string[]>();
      const allCaptureIds: string[] = [];

      for (let i = 0; i < bandGroups.length; i++) {
        const bandGroup = bandGroups[i];
        const snapshot = bandGroupSnapshots[i];
        if (snapshot.exists()) {
          const captureIds = snapshot.val() as string[];
          bandGroupToCaptureIds.set(bandGroup, captureIds);
          allCaptureIds.push(...captureIds);
        }
      }

      // 2. Fetch all captures using fetchCaptures
      const captures = await fetchCaptures(allCaptureIds);

      // 3. Create a lookup map from captureId -> Capture
      const captureIdToCapture = new Map<string, Capture>();
      for (const capture of captures) {
        captureIdToCapture.set(capture.id, capture);
      }

      // 4. Build the result map of bandGroup -> Capture[]
      const result = new Map<string, Capture[]>();
      for (const [bandGroup, captureIds] of bandGroupToCaptureIds) {
        const capturesForBandGroup: Capture[] = [];
        for (const captureId of captureIds) {
          const capture = captureIdToCapture.get(captureId);
          if (capture) {
            capturesForBandGroup.push(capture);
          }
        }
        if (capturesForBandGroup.length > 0) {
          result.set(bandGroup, capturesForBandGroup);
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
        bandGroupToNewCaptures: new Map(),
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
    <ProgramDataContext.Provider
      value={{
        programData,
        selectProgram,
        selectedProgram,
        fetchCapturesByBandId,
      }}
    >
      {children}
    </ProgramDataContext.Provider>
  );
}
