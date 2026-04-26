import { Spinner } from "@heroui/react";
import { useMemo } from "react";
import { useData } from "../../../../services/useData";
import BirdEventsTable from "./BirdEventsTable";

export default function ReCaptures() {
  const { selectedProgram, birdEventsMap, isLoading } = useData();

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
    <BirdEventsTable
      birdEvents={reCaptures}
      maxTableHeight={600}
      allowInspectBandId
      scrollToEnd
    />
  );
}
