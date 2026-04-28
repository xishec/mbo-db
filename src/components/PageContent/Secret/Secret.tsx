import { useEffect, useState } from "react";
import { Spinner } from "@heroui/react";
import { useData } from "../../../services/useData";
import YearlyHeatmap from "./YearlyHeatmap";
import type { BirdEvent } from "../../../types";

export default function Secret() {
  const { birdEventsMap, isLoading } = useData();
  const [birdEvents, setBirdEvents] = useState<BirdEvent[]>([]);

  useEffect(() => {
    if (!isLoading && birdEventsMap) {
      const events = Object.values(birdEventsMap);
      setBirdEvents(events);
    }
  }, [birdEventsMap, isLoading]);

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
        <YearlyHeatmap data={birdEvents} />
      </div>
    </div>
  );
}
