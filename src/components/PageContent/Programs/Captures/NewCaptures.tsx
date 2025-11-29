import { Spinner } from "@heroui/react";
import { onValue, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { db } from "../../../../firebase";
import {
  type BandGroup,
  type BandGroupsMap,
  type Capture,
  type CapturesMap,
} from "../../../../helper/helper";
import CapturesTable from "./CapturesTable";

interface NewCapturesProps {
  bandGroupIds: Set<string>;
}

export default function NewCaptures({ bandGroupIds }: NewCapturesProps) {
  const [bandGroupsMap, setBandGroupsMap] = useState<BandGroupsMap>(new Map());
  const [capturesMap, setCapturesMap] = useState<CapturesMap>(new Map());
  const [isLoadingBandGroups, setIsLoadingBandGroups] = useState(true);
  const [isLoadingCaptures, setIsLoadingCaptures] = useState(false);

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

  // Collect all captureIds from bandGroupIds and fetch captures
  useEffect(() => {
    if (isLoadingBandGroups || bandGroupIds.size === 0) {
      setCapturesMap(new Map());
      return;
    }

    const captureIdsToFetch = new Set<string>();
    for (const bandGroupId of bandGroupIds) {
      const bandGroup = bandGroupsMap.get(bandGroupId);
      if (bandGroup) {
        for (const captureId of bandGroup.captureIds) {
          captureIdsToFetch.add(captureId);
        }
      }
    }

    if (captureIdsToFetch.size === 0) {
      setCapturesMap(new Map());
      return;
    }

    setIsLoadingCaptures(true);
    const captureIdArray = Array.from(captureIdsToFetch);
    const newCapturesMap: CapturesMap = new Map();
    let loadedCount = 0;

    const unsubscribes = captureIdArray.map((captureId) => {
      const captureRef = ref(db, `capturesMap/${captureId}`);
      return onValue(captureRef, (snapshot) => {
        if (snapshot.exists()) {
          const rawCapture = snapshot.val() as Capture;
          newCapturesMap.set(captureId, rawCapture);
        }
        loadedCount++;
        if (loadedCount >= captureIdArray.length) {
          setCapturesMap(new Map(newCapturesMap));
          setIsLoadingCaptures(false);
        }
      });
    });

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [bandGroupIds, bandGroupsMap, isLoadingBandGroups]);

  // Filter to only show captures with status === "Banded"
  const captures = useMemo(() => {
    return Array.from(capturesMap.values()).filter((capture) => capture.status === "Banded");
  }, [capturesMap]);

  if (isLoadingBandGroups || isLoadingCaptures) {
    return (
      <div className="p-4 flex items-center gap-2">
        <Spinner size="sm" /> Loading new captures...
      </div>
    );
  }

  return <CapturesTable captures={captures} />;
}
