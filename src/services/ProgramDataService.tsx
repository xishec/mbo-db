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

  // Fetch captures for a list of captureIds, including all related captures with same prefix (varying last 2 digits 00-99)
  const fetchAllRelatedCaptures = useCallback(async (captureIds: string[]): Promise<Capture[]> => {
    if (captureIds.length === 0) return [];

    // Get unique prefixes (captureId without last 2 digits)
    const prefixes = new Set<string>();
    for (const captureId of captureIds) {
      if (captureId.length >= 2) {
        prefixes.add(captureId.slice(0, -2));
      }
    }

    // Generate all possible captureIds by appending 00-99 to each prefix
    const allCaptureIds: string[] = [];
    for (const prefix of prefixes) {
      for (let i = 0; i < 100; i++) {
        allCaptureIds.push(`${prefix}${i.toString().padStart(2, "0")}`);
      }
    }

    const capturePromises = allCaptureIds.map((captureId) => get(ref(db, `captureIdToCaptureMap/${captureId}`)));

    const snapshots = await Promise.all(capturePromises);
    const captures: Capture[] = [];

    for (const snapshot of snapshots) {
      if (snapshot.exists()) {
        captures.push(snapshot.val() as Capture);
      }
    }

    return captures;
  }, []);

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
        // 1. Fetch all captureIds for this program
        const programCaptureIdsSnapshot = await get(ref(db, `programToCaptureIdsMap/${programName}`));

        if (currentFetchId !== fetchIdRef.current) return; // Cancelled

        if (!programCaptureIdsSnapshot.exists()) {
          setProgramData(defaultProgramData);
          return;
        }

        const programCaptureIds = programCaptureIdsSnapshot.val() as string[];

        setProgramData((prev) => ({
          ...prev,
          isLoadingProgram: false,
        }));

        // 2. Fetch all captures for this program
        const captures = await fetchAllRelatedCaptures(programCaptureIds);

        if (currentFetchId !== fetchIdRef.current) return; // Cancelled

        // 3. Separate new captures vs recaptures
        const newBandGroupToNewCaptures = new Map<string, Capture[]>();
        const newReCaptures: Capture[] = [];

        for (const capture of captures) {
          const bandGroupId = capture.bandGroupId;
          if (!newBandGroupToNewCaptures.has(bandGroupId)) {
            newBandGroupToNewCaptures.set(bandGroupId, []);
          }
          if (capture.status === "Banded") {
            newBandGroupToNewCaptures.get(bandGroupId)!.push(capture);
          } else {
            newReCaptures.push(capture);
          }
        }

        if (currentFetchId !== fetchIdRef.current) return; // Cancelled

        setProgramData({
          bandGroupToNewCaptures: newBandGroupToNewCaptures,
          reCaptures: newReCaptures,
          isLoadingProgram: false,
          isLoadingCaptures: false,
          isLoadingReCaptures: false,
        });
      } catch (error) {
        console.error("Error fetching program data:", error);
        if (currentFetchId === fetchIdRef.current) {
          setProgramData(defaultProgramData);
        }
      }
    },
    [fetchAllRelatedCaptures]
  );

  return (
    <ProgramDataContext.Provider
      value={{
        programData,
        selectProgram,
        selectedProgram,
      }}
    >
      {children}
    </ProgramDataContext.Provider>
  );
}
