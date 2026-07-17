import { Button } from "@heroui/react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { useAppStore } from "../../stores/useAppStore";
import type { BirdEvent } from "../../types";
import { getSpeciesDisplayCode, resolveSpeciesKey } from "../../types/species";

interface ExportButtonProps {
  birdEvents: BirdEvent[];
  filename?: string;
  additionalComments?: Record<string, string>;
}

function formatTimestampForExport(updatedAt: string | undefined): string {
  if (!updatedAt) return "";
  const timestamp = parseInt(updatedAt, 10);
  if (isNaN(timestamp)) return updatedAt;
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function ExportButton({
  birdEvents,
  filename = "bird_events.csv",
  additionalComments = {},
}: ExportButtonProps) {
  const speciesAliasesMap = useAppStore((s) => s.speciesAliasesMap);
  const handleExport = () => {
    if (birdEvents.length === 0) {
      return;
    }

    // CSV headers
    const headers = [
      "Program ID",
      "Band Group",
      "Last 2 Digits",
      "Species",
      "Date",
      "Time",
      "Bird Event Type",
      "Wing",
      "Age",
      "How Aged",
      "Sex",
      "How Sexed",
      "Fat",
      "Weight",
      "Bander",
      "Scribe",
      "Net",
      "Bird Status",
      "Updated At",
      "Notes",
      "Additional Comments",
    ];

    // Convert bird events to CSV rows
    const rows = birdEvents.map((event) => [
      event.programId,
      event.band?.bandGroupId || "",
      event.band?.last2digits || "",
      getSpeciesDisplayCode(resolveSpeciesKey(event.species, speciesAliasesMap), speciesAliasesMap),
      event.date,
      event.time,
      event.birdEventType,
      event.wing,
      event.age,
      event.howAged,
      event.sex,
      event.howSexed,
      event.fat,
      event.weight,
      event.bander,
      event.scribe,
      event.net,
      event.birdStatus,
      formatTimestampForExport(event.updatedAt),
      event.notes,
      additionalComments[event.id] || "",
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => {
            // Escape cells that contain commas, quotes, or newlines
            const cellStr = String(cell);
            if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(",")
      ),
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <Button
      color="primary"
      variant="flat"
      startContent={<ArrowDownTrayIcon className="w-4 h-4" />}
      onPress={handleExport}
      isDisabled={birdEvents.length === 0}
    >
      Export CSV
    </Button>
  );
}
