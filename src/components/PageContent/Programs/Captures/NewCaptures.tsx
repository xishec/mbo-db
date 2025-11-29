import { Autocomplete, AutocompleteItem, Spinner } from "@heroui/react";
import { onValue, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { db } from "../../../../firebase";
import { type BandGroup, type BandGroupsMap, type Capture } from "../../../../helper/helper";
import CapturesTable from "./CapturesTable";

interface NewCapturesProps {
  program: string;
  bandGroupIds: Set<string>;
}

export default function NewCaptures({ program, bandGroupIds }: NewCapturesProps) {
  const [bandGroupsMap, setBandGroupsMap] = useState<BandGroupsMap>(new Map());
  const [captures, setCaptures] = useState<Set<Capture>>(new Set());
  const [isLoadingBandGroups, setIsLoadingBandGroups] = useState(true);
  const [isLoadingCaptures, setIsLoadingCaptures] = useState(false);
  const [selectedBandGroupId, setSelectedBandGroupId] = useState<string | null>(null);

  // Convert bandGroupIds Set to sorted array for autocomplete
  const bandGroupOptions = useMemo(() => {
    return Array.from(bandGroupIds).sort();
  }, [bandGroupIds]);

  // Fetch bandGroupsMap from RTDB
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

  // Fetch captures for the selected bandGroup only
  useEffect(() => {
    if (isLoadingBandGroups || !selectedBandGroupId) {
      setCaptures(new Set());
      return;
    }

    const bandGroup = bandGroupsMap.get(selectedBandGroupId);
    if (!bandGroup || bandGroup.captureIds.size === 0) {
      setCaptures(new Set());
      return;
    }

    setIsLoadingCaptures(true);
    const captureIdArray = Array.from(bandGroup.captureIds);
    const newCaptures: Set<Capture> = new Set();
    let loadedCount = 0;

    const unsubscribes = captureIdArray.map((captureId) => {
      const captureRef = ref(db, `capturesMap/${captureId}`);
      return onValue(captureRef, (snapshot) => {
        if (snapshot.exists()) {
          const rawCapture = snapshot.val() as Capture;
          newCaptures.add(rawCapture);
        }
        loadedCount++;
        if (loadedCount >= captureIdArray.length) {
          setCaptures(new Set(newCaptures));
          setIsLoadingCaptures(false);
        }
      });
    });

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [selectedBandGroupId, bandGroupsMap, isLoadingBandGroups]);

  if (isLoadingBandGroups) {
    return (
      <div className="p-4 flex items-center gap-2">
        <Spinner size="sm" /> Loading band groups...
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl flex flex-col gap-4">
      <Autocomplete
        label="Band Group"
        placeholder="Select a band group"
        variant="bordered"
        selectedKey={selectedBandGroupId}
        onSelectionChange={(key) => setSelectedBandGroupId(key as string | null)}
        className="max-w-xs"
      >
        {bandGroupOptions.map((bandGroupId) => (
          <AutocompleteItem key={bandGroupId}>{bandGroupId}</AutocompleteItem>
        ))}
      </Autocomplete>

      {isLoadingCaptures ? (
        <div className="p-4 flex items-center gap-2">
          <Spinner size="sm" /> Loading captures...
        </div>
      ) : selectedBandGroupId ? (
        <CapturesTable program={program} captures={Array.from(captures)} />
      ) : (
        <div className="p-4 text-default-500">Select a band group to view captures</div>
      )}
    </div>
  );
}
