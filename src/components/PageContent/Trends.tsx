import { useEffect, useState } from "react";
import { Spinner, Card, CardBody, Divider } from "@heroui/react";
import YearlyHeatmap, { type HeatmapDET, type HeatmapDETsByDateMap } from "./Secret/YearlyHeatmap";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCompactDET(value: Record<string, unknown>): boolean {
  return ["dt", "d", "b", "rp", "rt", "o", "nh", "oh"].some((key) => key in value);
}

function normalizeHeatmapData(data: unknown): HeatmapDETsByDateMap {
  if (!isRecord(data)) return {};

  const normalized: HeatmapDETsByDateMap = {};
  for (const [storageKey, value] of Object.entries(data)) {
    if (!isRecord(value)) continue;

    // Compatibility for the currently deployed flat trends-data.json.
    if (isCompactDET(value)) {
      const det = value as HeatmapDET;
      const date = det.dt || storageKey.split("__", 1)[0];
      normalized[date] ??= {};
      normalized[date][storageKey] = { ...det, dt: date };
      continue;
    }

    normalized[storageKey] = value as Record<string, HeatmapDET>;
  }
  return normalized;
}

export default function Trends() {
  const [DETsByDateMap, setDETsByDateMap] = useState<HeatmapDETsByDateMap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/trends-data.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then((data: unknown) => {
        setDETsByDateMap(normalizeHeatmapData(data));
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error loading trends data:", err);
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

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

  if (!DETsByDateMap) {
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

        <YearlyHeatmap DETsByDateMap={DETsByDateMap} />
      </div>
    </div>
  );
}
