import { Spinner } from "@heroui/react";
import { useProgramData } from "../../../../services/useProgramData";
import CapturesTable from "./CapturesTable";

export default function ReCaptures() {
  const { programData, selectedProgram } = useProgramData();
  const { reCaptures, isLoadingReCaptures } = programData;

  if (isLoadingReCaptures) {
    return (
      <div className="p-4 flex items-center gap-4">
        <Spinner size="sm" /> Loading recaptures...
      </div>
    );
  }

  return (
    <CapturesTable
      program={selectedProgram ?? ""}
      captures={reCaptures}
      maxTableHeight={800}
      sortColumn="date"
      sortDirection="descending"
      showOtherPrograms={true}
    />
  );
}
