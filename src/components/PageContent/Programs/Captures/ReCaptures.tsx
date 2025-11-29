import { Spinner } from "@heroui/react";
import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { db } from "../../../../firebase";
import { type Capture } from "../../../../helper/helper";
import CapturesTable from "./CapturesTable";

interface ReCapturesProps {
  program: string;
  reCaptureIds: Set<string>;
}

export default function ReCaptures({ program, reCaptureIds }: ReCapturesProps) {
  const [captures, setCaptures] = useState<Set<Capture>>(new Set());
  const [isLoadingCaptures, setIsLoadingCaptures] = useState(true);

  // Fetch captures by reCaptureIds
  useEffect(() => {
    if (reCaptureIds.size === 0) {
      setCaptures(new Set());
      setIsLoadingCaptures(false);
      return;
    }

    setIsLoadingCaptures(true);
    const captureIdArray = Array.from(reCaptureIds);
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
  }, [reCaptureIds]);

  if (isLoadingCaptures) {
    return (
      <div className="p-4 flex items-center gap-2">
        <Spinner size="sm" /> Loading recaptures...
      </div>
    );
  }

  return <CapturesTable program={program} captures={Array.from(captures)} />;
}
