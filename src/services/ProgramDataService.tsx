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

  // Fetch captures for a list of captureIds, including all related captures with same band prefix (varying last 2 digits of bandId 00-99)
  // captureId format: "0816-34893-2024-06-05" where "0816-34893" is bandId
  const fetchAllRelatedCaptures = useCallback(async (captureIds: string[]): Promise<Capture[]> => {
    if (captureIds.length === 0) return [];

    // Get unique band prefixes (bandId without last 2 digits)
    // e.g., "0816-34893-2024-06-05" -> bandId: "0816-34893" -> bandIdPrefix: "0816-348"
    const bandIdPrefixes = new Set<string>();
    for (const captureId of captureIds) {
      // Split into parts: ["0816", "34893", "2024", "06", "05"]
      const parts = captureId.split("-");
      if (parts.length >= 2) {
        const bandIdPart1 = parts[0]; // "0816"
        const bandIdPart2 = parts[1]; // "34893"

        // Get prefix of bandIdPart2 (without last 2 digits)
        const bandIdPart2Prefix = bandIdPart2.slice(0, -2); // "348"
        const bandIdPrefix = `${bandIdPart1}-${bandIdPart2Prefix}`; // "0816-348"

        bandIdPrefixes.add(bandIdPrefix);
      }
    }

    // Generate all possible bandIds by varying last 2 digits (00-99)
    const allBandIds: string[] = [];
    for (const bandIdPrefix of bandIdPrefixes) {
      for (let i = 0; i < 100; i++) {
        const suffix = i.toString().padStart(2, "0");
        allBandIds.push(`${bandIdPrefix}${suffix}`); // e.g., "0816-34800", "0816-34801", ...
      }
    }

    // 1. Fetch all captureIds for each bandId from bandIdToCaptureIdsMap
    const bandIdPromises = allBandIds.map((bandId) => get(ref(db, `bandIdToCaptureIdsMap/${bandId}`)));
    const bandIdSnapshots = await Promise.all(bandIdPromises);

    const allCaptureIds: string[] = [];
    for (const snapshot of bandIdSnapshots) {
      if (snapshot.exists()) {
        const captureIdsForBand = snapshot.val() as string[];
        allCaptureIds.push(...captureIdsForBand);
      }
    }

    if (allCaptureIds.length === 0) return [];

    // 2. Fetch all captures from captureIdToCaptureMap
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
