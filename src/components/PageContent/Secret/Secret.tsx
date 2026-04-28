import { Spinner } from "@heroui/react";
import { useData } from "../../../services/useData";
import YearlyHeatmap from "./YearlyHeatmap";

export default function Secret() {
  const { isLoading } = useData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-7xl mx-auto">
        <YearlyHeatmap />
      </div>
    </div>
  );
}
