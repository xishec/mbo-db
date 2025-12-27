import { Spinner } from "@heroui/react";
import { useMemo } from "react";
import { useData } from "../../../../services/useData";
import BirdEventsTable from "./BirdEventsTable";

export default function ReCaptures() {
  const { selectedProgram, programsMap, birdEventsMap, isLoading } = useData();

  // Get recaptures for the selected program
  const reCaptures = useMemo(() => {
    if (!selectedProgram) return [];
    const program = programsMap[selectedProgram];
    const recaptureIds = program?.recaptureIds ?? [];
    return recaptureIds.map((id) => birdEventsMap[id]).filter(Boolean);
  }, [selectedProgram, programsMap, birdEventsMap]);

  if (isLoading) {
    return (
      <div className="p-4 flex items-center gap-4">
        <Spinner size="sm" /> Loading recaptures...
      </div>
    );
  }

  return <BirdEventsTable captures={reCaptures} maxTableHeight={800} sortDescriptors={[{ column: "date", direction: "descending" }]} />;
}
