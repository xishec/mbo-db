import { Spinner } from "@heroui/react";
import { useMemo, useRef } from "react";
import { useData } from "../../../../services/useData";
import BirdEventsTable from "./BirdEventsTable";
import { useRemainingHeight } from "../../../../hooks/useRemainingHeight";

export default function ReCaptures() {
  const { selectedProgram, birdEventsMap, isLoading } = useData();
  const tableRef = useRef<HTMLDivElement>(null);
  const tableHeight = useRemainingHeight(tableRef);

  // Get recaptures for the selected program
  const reCaptures = useMemo(() => {
    const recaptureIds = selectedProgram?.recaptureIds ?? [];
    return recaptureIds.map((id: string) => birdEventsMap[id]).filter(Boolean);
  }, [selectedProgram, birdEventsMap]);

  if (isLoading) {
    return (
      <div className="p-4 flex items-center gap-4">
        <Spinner size="sm" /> Loading recaptures...
      </div>
    );
  }

  return (
    <div ref={tableRef}>
      <BirdEventsTable
        birdEvents={reCaptures}
        maxTableHeight={tableHeight}
        allowInspectBandId
      />
    </div>
  );
}
