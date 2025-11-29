import { Spinner } from "@heroui/react";
import { onValue, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { db } from "../../../../firebase";
import { type Capture, type CapturesMap } from "../../../../helper/helper";
import CapturesTable from "./CapturesTable";

interface ReCapturesProps {
  program: string;
  reCaptureIds: Set<string>;
}

export default function ReCaptures({ program, reCaptureIds }: ReCapturesProps) {
  const [capturesMap, setCapturesMap] = useState<CapturesMap>(new Map());
  const [isLoadingCaptures, setIsLoadingCaptures] = useState(true);

  // Fetch captures by reCaptureIds
  useEffect(() => {
    if (reCaptureIds.size === 0) {
      setCapturesMap(new Map());
      setIsLoadingCaptures(false);
      return;
    }

    setIsLoadingCaptures(true);
    const captureIdArray = Array.from(reCaptureIds);
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
  }, [reCaptureIds]);

  const captures = useMemo(() => {
    return Array.from(capturesMap.values());
  }, [capturesMap]);

  if (isLoadingCaptures) {
    return (
      <div className="p-4 flex items-center gap-2">
        <Spinner size="sm" /> Loading recaptures...
      </div>
    );
  }

  return <CapturesTable program={program} captures={captures} />;
}
