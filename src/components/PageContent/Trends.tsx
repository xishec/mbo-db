import { useEffect, useState } from "react";
import { Spinner } from "@heroui/react";
import YearlyHeatmap from "./Secret/YearlyHeatmap";
import type { DETsMap } from "../../types";

export default function Trends() {
  const [DETsMap, setDETsMap] = useState<DETsMap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/trends-data.json.gz")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load data");
        // Browser automatically decompresses .gz files served with Content-Encoding: gzip
        return res.json();
      })
      .then((data) => {
        setDETsMap(data);
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

  if (!DETsMap) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-default-600">No data available</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-7xl mx-auto">
        <YearlyHeatmap DETsMap={DETsMap} />
      </div>
    </div>
  );
}
