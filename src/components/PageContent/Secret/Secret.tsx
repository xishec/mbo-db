import { useEffect, useState } from "react";
import { Card, CardBody, Spinner } from "@heroui/react";
import { useData } from "../../../services/useData";
import PageHeader from "../PageHeader";
import SpeciesBarChart from "./SpeciesBarChart";
import TimeSeriesChart from "./TimeSeriesChart";
import BirdEventsByNetHeatmap from "./BirdEventsByNetHeatmap";
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
    <div className="h-full overflow-auto p-4">
      <PageHeader title="Secret Data Visualizations" />

      <div className="max-w-7xl mx-auto space-y-6 mt-6">
        <Card>
          <CardBody>
            <h3 className="text-xl font-semibold mb-4">
              Yearly Capture Rate Heatmap
            </h3>
            <p className="text-sm text-default-500 mb-4">
              Heatmap visualization showing capture rates across the calendar year. Each row represents one year, allowing easy comparison of seasonal patterns across years. Filter by event type and species.
            </p>
            <YearlyHeatmap data={birdEvents} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-xl font-semibold mb-4">Top Species by Capture Count</h3>
            <SpeciesBarChart data={birdEvents} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-xl font-semibold mb-4">Captures Over Time</h3>
            <TimeSeriesChart data={birdEvents} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-xl font-semibold mb-4">Heatmap: Net Usage by Species</h3>
            <BirdEventsByNetHeatmap data={birdEvents} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
