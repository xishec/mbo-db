import { useEffect, useState, useCallback, useRef } from "react";
import { get, onValue, ref } from "firebase/database";
import { db } from "../firebase";
import type { BandGroup, BandGroupsMap, Capture, Program } from "../helper/helper";
import { ProgramDataContext, defaultProgramData } from "./ProgramDataContext";
import type { ProgramData } from "./ProgramDataContext";

export function ProgramDataProvider({ children }: { children: React.ReactNode }) {
  // Global bandGroupsMap (shared across all programs)
  const [bandGroupsMap, setBandGroupsMap] = useState<BandGroupsMap>(new Map());
  const [isLoadingBandGroups, setIsLoadingBandGroups] = useState(true);

  // Current program state
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [programData, setProgramData] = useState<ProgramData>(defaultProgramData);

  // Track current fetch to cancel stale requests
  const fetchIdRef = useRef(0);

  // Fetch bandGroupsMap once at app level
  useEffect(() => {
    const bandGroupsRef = ref(db, "bandGroupsMap");

    const unsubscribe = onValue(bandGroupsRef, (snapshot) => {
      if (snapshot.exists()) {
        const rawBandGroupsMap = snapshot.val() as Record<string, BandGroup>;
        const newBandGroupsMap: BandGroupsMap = new Map(
          Object.entries(rawBandGroupsMap).map(([id, bandGroup]) => [
            id,
            {
              id: id,
              captureIds: new Set(bandGroup.captureIds ?? []),
            },
          ])
        );
        setBandGroupsMap(newBandGroupsMap);
      }
      setIsLoadingBandGroups(false);
    });

    return unsubscribe;
  }, []);

  // Fetch captures for a list of captureIds
  const fetchCaptures = useCallback(async (captureIds: string[]): Promise<Capture[]> => {
    if (captureIds.length === 0) return [];

    const capturePromises = captureIds.map((captureId) =>
      get(ref(db, `capturesMap/${captureId}`))
    );

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
        program: null,
        capturesByBandGroup: new Map(),
        reCaptures: [],
        isLoadingProgram: true,
        isLoadingCaptures: true,
        isLoadingReCaptures: true,
      });

      try {
        // 1. Fetch program data
        const programSnapshot = await get(ref(db, `programsMap/${programName}`));

        if (currentFetchId !== fetchIdRef.current) return; // Cancelled

        if (!programSnapshot.exists()) {
          setProgramData(defaultProgramData);
          return;
        }

        const rawProgram = programSnapshot.val();
        const program: Program = {
          name: programName,
          bandGroupIds: new Set(rawProgram.bandGroupIds ?? []),
          reCaptureIds: new Set(rawProgram.reCaptureIds ?? []),
        };

        setProgramData((prev) => ({
          ...prev,
          program,
          isLoadingProgram: false,
        }));

        // 2. Fetch reCaptures in parallel with bandGroup captures
        const reCaptureIds = Array.from(program.reCaptureIds);
        const reCapturesPromise = fetchCaptures(reCaptureIds);

        // 3. Fetch all captures for all bandGroups in parallel
        const bandGroupIds = Array.from(program.bandGroupIds);

        // Wait for bandGroupsMap to be loaded
        const waitForBandGroups = async (): Promise<BandGroupsMap> => {
          return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
              if (!isLoadingBandGroups) {
                clearInterval(checkInterval);
                resolve(bandGroupsMap);
              }
            }, 50);
          });
        };

        const currentBandGroupsMap = isLoadingBandGroups
          ? await waitForBandGroups()
          : bandGroupsMap;

        if (currentFetchId !== fetchIdRef.current) return; // Cancelled

        // Collect all captureIds for each bandGroup
        const bandGroupCapturePromises = bandGroupIds.map(async (bandGroupId) => {
          const bandGroup = currentBandGroupsMap.get(bandGroupId);
          if (!bandGroup) return { bandGroupId, captures: [] };

          const captureIds = Array.from(bandGroup.captureIds);
          const captures = await fetchCaptures(captureIds);
          return { bandGroupId, captures };
        });

        // Fetch reCaptures and bandGroup captures in parallel
        const [reCaptures, bandGroupResults] = await Promise.all([
          reCapturesPromise,
          Promise.all(bandGroupCapturePromises),
        ]);

        if (currentFetchId !== fetchIdRef.current) return; // Cancelled

        // Build the capturesByBandGroup map
        const capturesByBandGroup = new Map<string, Capture[]>();
        for (const { bandGroupId, captures } of bandGroupResults) {
          capturesByBandGroup.set(bandGroupId, captures);
        }

        setProgramData({
          program,
          capturesByBandGroup,
          reCaptures,
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
    [bandGroupsMap, isLoadingBandGroups, fetchCaptures]
  );

  return (
    <ProgramDataContext.Provider
      value={{
        bandGroupsMap,
        isLoadingBandGroups,
        programData,
        selectProgram,
        selectedProgram,
      }}
    >
      {children}
    </ProgramDataContext.Provider>
  );
}
