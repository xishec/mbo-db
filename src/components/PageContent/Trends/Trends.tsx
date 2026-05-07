import { useEffect, useMemo, useState } from "react";
import { Spinner, Card, CardBody, Divider } from "@heroui/react";
import SpeciesWeeklyHeatmap from "./SpeciesWeeklyHeatmap";
import SpeciesMeasurementBoxPlot, { type MeasurementMap } from "./SpeciesMeasurementBoxPlot";
import type { DETsMap } from "../../../types";

interface TrendsPayload {
  dets: DETsMap;
  wings: MeasurementMap;
  weights: MeasurementMap;
}

export default function Trends() {
  const [payload, setPayload] = useState<TrendsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<string>("");

  useEffect(() => {
    fetch("/data/trends-data.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then((data) => {
        // Back-compat: older trends-data.json was a flat DETsMap. Current
        // shape is { dets, wings, weights }.
        const normalized: TrendsPayload =
          data && typeof data === "object" && "dets" in data
            ? {
                dets: data.dets,
                wings: data.wings ?? {},
                weights: data.weights ?? {},
              }
            : { dets: data as DETsMap, wings: {}, weights: {} };
        setPayload(normalized);

        const counts = new Map<string, number>();
        Object.values(normalized.dets).forEach((det) => {
          const detSpeciesCount = (det as any).d || (det as any).DETSpeciesCount || {};
          for (const [species, count] of Object.entries(detSpeciesCount)) {
            counts.set(species, (counts.get(species) || 0) + (count as number));
          }
        });
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        if (top) setSelectedSpecies(top[0]);

        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error loading trends data:", err);
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  const yearRange = useMemo(() => {
    if (!payload) return { min: 2002, max: new Date().getFullYear() };
    const years = new Set<number>();
    for (const date of Object.keys(payload.dets)) {
      years.add(new Date(date).getFullYear());
    }
    const min = Math.min(...Array.from(years), 2002);
    const max = Math.max(...Array.from(years));
    return { min, max };
  }, [payload]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" label="Loading data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-danger text-lg mb-2">Error loading data</p>
          <p className="text-default-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-default-600">No data available</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 md:p-6 bg-default-50">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold mb-2 md:mb-3">MBO Species Trends</h1>
          <p className="text-base md:text-lg text-default-600">
            Explore temporal patterns in bird species observations from McGill Bird Observatory banding data
            (2002-present)
          </p>
        </div>

        <Card className="shadow-sm">
          <CardBody className="p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">How to Read the Charts</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <h3 className="mb-2 flex items-center gap-2">Structure</h3>
                <div className="space-y-2 text-sm text-default-600">
                  <div className="flex gap-2">
                    <span className="font-medium min-w-20">X-axis:</span>
                    <span>Months of the year</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-medium min-w-20">Y-axis:</span>
                    <span>Years (2002-present)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-medium min-w-20">Squares:</span>
                    <span>One week of data</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2">Color</h3>
                <div className="space-y-2 text-sm text-default-600">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4" style={{ background: "rgb(182, 0, 0)" }}></div>
                    <span>Dark red = High values</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4" style={{ background: "rgb(255, 234, 142)" }}></div>
                    <span>Light yellow = Low values</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4" style={{ background: "#f0f0f0" }}></div>
                    <span>Gray = No data</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2">Size</h3>
                <div className="space-y-2 text-sm text-default-600">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-default-400"></div>
                    <span>Small = Few hours of effort</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-default-400"></div>
                    <span>Large = More hours of effort</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2">Modes</h3>
                <div className="space-y-2 text-sm text-default-600">
                  <div>
                    <span className="font-medium">DET:</span> Daily Estimated Totals
                  </div>
                  <div>
                    <span className="font-medium">Captured:</span> Birds per net-hour
                  </div>
                  <div>
                    <span className="font-medium">Observed:</span> Birds per observer-hour
                  </div>
                </div>
              </div>
            </div>

            <Divider className="my-4" />

            <p className="text-sm text-default-500 italic">
              Daily data is grouped into weekly bins to smooth out variation and reveal seasonal patterns.
            </p>
          </CardBody>
        </Card>

        <SpeciesWeeklyHeatmap
          DETsMap={payload.dets}
          selectedSpecies={selectedSpecies}
          onSelectedSpeciesChange={setSelectedSpecies}
        />

        <SpeciesMeasurementBoxPlot
          dataMap={payload.wings}
          selectedSpecies={selectedSpecies}
          yearRange={yearRange}
          measurementLabel="Wing chord"
          unit="mm"
          filenameSuffix="wing"
          precision={1}
        />

        <SpeciesMeasurementBoxPlot
          dataMap={payload.weights}
          selectedSpecies={selectedSpecies}
          yearRange={yearRange}
          measurementLabel="Weight"
          unit="g"
          filenameSuffix="weight"
          precision={1}
        />
      </div>
    </div>
  );
}
