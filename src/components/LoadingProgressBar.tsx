import { Progress } from "@heroui/react";

export default function LoadingProgressBar() {
  return (
    <div className="absolute top-16 left-0 right-0 z-50 bg-background shadow-sm">
      <Progress
        size="sm"
        isIndeterminate
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
