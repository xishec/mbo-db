import { Spinner } from "@heroui/react";
import { useData } from "../../../../services/useData";
import CapturesTable from "./CapturesTable";

export default function ReCaptures() {
  const { programData } = useData();
  const { reCaptures, isLoadingReCaptures } = programData;

  if (isLoadingReCaptures) {
    return (
      <div className="p-4 flex items-center gap-4">
        <Spinner size="sm" /> Loading recaptures...
      </div>
    );
  }

  return <CapturesTable captures={reCaptures} maxTableHeight={800} sortColumn="date" sortDirection="descending" />;
}
