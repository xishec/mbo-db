import { Progress } from "@heroui/react";
import { useEffect, useState } from "react";
import { useAppStore } from "../../stores/useAppStore";

// Percent target for each status DataService emits, in logical order.
// Unknown statuses don't advance the bar (the progress stays at its
// previous value). All known statuses are monotonically increasing.
function statusToTarget(status: string): number | null {
  if (status === "Initializing...") return 5;
  if (status === "Checking for updates...") return 15;
  if (status === "Loading cached data...") return 25;
  if (status === "Using cached data (Firebase unreachable)") return 25;
  if (status === "Checking for new events...") return 30;
  if (status === "Downloading all events...") return 45;
  if (status.startsWith("Downloading ") && status.includes("updated map")) return 55;
  if (status.startsWith("Merging")) return 65;
  if (status === "Rebuilding maps...") return 80;
  if (status === "Saving to cache...") return 90;
  if (status === "Cache is up to date") return 95;
  if (status === "Ready") return 100;
  return null;
}

export default function LoadingProgressBar() {
  const loadingStatus = useAppStore((s) => s.loadingStatus);
  const isLoading = useAppStore((s) => s.isLoading);
  const [progress, setProgress] = useState(5);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // New load cycle resets the bar.
    if (loadingStatus === "Initializing...") {
      setProgress(5);
      return;
    }
    const target = statusToTarget(loadingStatus);
    if (target != null) {
      setProgress((p) => Math.max(p, target));
    }
  }, [loadingStatus]);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      return;
    }
    // Finish the bar before fading out.
    setProgress(100);
    const t = setTimeout(() => setVisible(false), 500);
    return () => clearTimeout(t);
  }, [isLoading]);

  if (!visible) return null;

  const displayText = loadingStatus.replace(/\s*\(\d+\/\d+\)/, "");

  return (
    <div
      className={`absolute top-16 left-0 right-0 z-50 transition-opacity duration-300 ${
        !isLoading ? "opacity-0" : ""
      }`}
    >
      <Progress
        size="sm"
        value={progress}
        aria-label="Loading..."
        className="w-full"
        classNames={{
          indicator: "bg-primary transition-all duration-700 ease-out",
          track: "bg-default-200",
        }}
      />
      <div className="text-center py-2">
        <span className="text-sm text-default-700">{displayText}</span>
        {progress > 5 && progress < 100 && (
          <span className="text-sm text-default-400 ml-2">{progress}%</span>
        )}
      </div>
    </div>
  );
}
