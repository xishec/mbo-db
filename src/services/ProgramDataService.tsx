import { useState, useCallback, useRef } from "react";
import { get, ref } from "firebase/database";
import { db } from "../firebase";
import type { Capture } from "../helper/helper";
import { CaptureType } from "../helper/helper";
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

  // Fetch captures by bandGroups using bandGroupToCaptureIdsMap, then fetch captures
  const fetchByBandGroups = useCallback(async (bandGroups: string[]): Promise<Capture[]> => {
    if (bandGroups.length === 0) return [];

    // 1. Fetch all captureIds for each bandGroup from bandGroupToCaptureIdsMap
    const bandGroupPromises = bandGroups.map((bandGroup) => get(ref(db, `bandGroupToCaptureIdsMap/${bandGroup}`)));
    const bandGroupSnapshots = await Promise.all(bandGroupPromises);

    const allCaptureIds: string[] = [];
    for (const snapshot of bandGroupSnapshots) {
      if (snapshot.exists()) {
        const captureIdsForBandGroup = snapshot.val();
        // Handle both array and object formats from Firebase
        if (Array.isArray(captureIdsForBandGroup)) {
          allCaptureIds.push(...captureIdsForBandGroup);
        } else if (typeof captureIdsForBandGroup === "object") {
          allCaptureIds.push(...Object.values(captureIdsForBandGroup as Record<string, string>));
        }
      }
    }

    // 2. Fetch all captures using fetchCaptures
    return fetchCaptures(allCaptureIds);
  }, [fetchCaptures]);


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
        const captures = await fetchCaptures(programCaptureIds);

        if (currentFetchId !== fetchIdRef.current) return; // Cancelled

        // 3. Separate new captures vs recaptures
        const newBandGroupToNewCaptures = new Map<string, Capture[]>();
        const newReCaptures: Capture[] = [];

        for (const capture of captures) {
          const bandGroupId = capture.bandGroup;
          if (!newBandGroupToNewCaptures.has(bandGroupId)) {
            newBandGroupToNewCaptures.set(bandGroupId, []);
          }
          if (capture.captureType === CaptureType.Banded) {
            newBandGroupToNewCaptures.get(bandGroupId)!.push(capture);
          } else {
            newReCaptures.push(capture);
          }
        }

        // Filter out empty band groups
        for (const [bandGroupId, captures] of newBandGroupToNewCaptures) {
          if (captures.length === 0) {
            newBandGroupToNewCaptures.delete(bandGroupId);
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
    [fetchCaptures]
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
