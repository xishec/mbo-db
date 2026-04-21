import { Progress } from "@heroui/react";
import { useState, useEffect } from "react";
import { useData } from "../../services/useData";

function statusToProgress(status: string): number {
  if (status === "Initializing...") return 5;
  if (status === "Loading cached data...") return 15;
  if (status === "Checking for new events...") return 20;
  if (status.startsWith("Merging")) return 40;
  if (status === "Downloading all events...") return 30;
  if (status === "Downloading independent data...") return 60;
  if (status === "Rebuilding maps...") return 75;
  if (status === "Saving to cache...") return 90;
  if (status === "Ready") return 100;
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
