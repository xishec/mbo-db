import { Progress } from "@heroui/react";
import { useState, useEffect } from "react";
import { useData } from "../../services/useData";

function statusToProgress(status: string): number {
  if (status === "Initializing...") return 5;
  if (status === "Checking for updates...") return 10;
  if (status === "Loading cached data...") return 15;
  if (status === "Cache is up to date") return 100;
  if (status === "Using local data (unsynced changes)") return 100;
  if (status === "Using cached data (Firebase unreachable)") return 100;
  if (status === "Saving to local cache...") return 92;
  if (status === "Ready") return 100;

  // "Downloading bird events... (3/9)" → map 1-9 to 15-90
  const match = status.match(/\((\d+)\/(\d+)\)/);
  if (match) {
    const done = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    return 15 + Math.round((done / total) * 75);
  }

  return 50;
}

export default function LoadingProgressBar() {
  const { loadingStatus, isLoading } = useData();
  const [visible, setVisible] = useState(true);
  const progress = statusToProgress(loadingStatus);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(timer);
    }
    setVisible(true);
  }, [isLoading]);

  if (!visible) return null;

  // Clean display text — remove the counter for cleaner look
  const displayText = loadingStatus.replace(/\s*\(\d+\/\d+\)/, "");

  return (
    <div className={`absolute top-16 left-0 right-0 z-50 transition-opacity duration-300 ${!isLoading ? "opacity-0" : ""}`}>
      <Progress
        size="sm"
        value={!isLoading ? 100 : progress}
        aria-label="Loading..."
        className="w-full"
        classNames={{
          indicator: "bg-primary transition-all duration-500",
          track: "bg-default-200",
        }}
      />
      <div className="text-center py-2">
        <span className="text-sm text-default-700">{displayText}</span>
        {progress > 15 && progress < 100 && (
          <span className="text-sm text-default-400 ml-2">{progress}%</span>
        )}
      </div>
    </div>
  );
}
