import { Progress } from "@heroui/react";
import { useState, useEffect } from "react";

export default function LoadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 40000; // 40 seconds
    const intervalTime = 100; // Update every 100ms
    const maxProgress = 99; // Stop at 99%
    const increment = (maxProgress / duration) * intervalTime;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= maxProgress) {
          clearInterval(interval);
          return maxProgress;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute top-16 left-0 right-0 z-50 bg-background shadow-sm">
      <Progress
        size="sm"
        value={progress}
        aria-label="Loading database..."
        className="w-full"
        classNames={{
          indicator: "bg-primary",
          track: "bg-default-200",
        }}
      />
    </div>
  );
}
