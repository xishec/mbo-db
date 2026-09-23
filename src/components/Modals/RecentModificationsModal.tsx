import { useMemo, useState } from "react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  type SortDescriptor,
} from "@heroui/react";
import { birdEventsStore } from "../../services/birdEventsStore";
import { useAppStore } from "../../stores/useAppStore";
import type { BirdEvent } from "../../types";
import { isBirdEventInCurrentBandGeneration } from "../../stores/derive";
import SpeciesTooltip from "../Helper/Info/SpeciesTooltip";
import CaptureHistoryModal from "./CaptureHistoryModal";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";

interface RecentModificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModificationColumn = "band" | "datetime" | "species" | "modifiedBy" | "modifiedAt";

const columns: Array<{ key: ModificationColumn; label: string; className: string }> = [
  { key: "band", label: "Band", className: "w-[120px]" },
  { key: "datetime", label: "Capture Date/Time", className: "w-[180px]" },
  { key: "species", label: "Species", className: "w-[100px]" },
  { key: "modifiedBy", label: "Modified By", className: "w-[260px]" },
  { key: "modifiedAt", label: "Modified At", className: "w-[200px]" },
];

function formatTimestamp(timestamp: string): string {
  const value = Number(timestamp);
  return Number.isFinite(value) ? new Date(value).toLocaleString() : "";
}

export function RecentModificationsModal({ isOpen, onClose }: RecentModificationsModalProps) {
  const bandResetsMap = useAppStore((s) => s.bandResetsMap);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "modifiedAt",
    direction: "descending",
  });
  const [selectedBirdEvent, setSelectedBirdEvent] = useState<BirdEvent | null>(null);
  const [isCaptureHistoryOpen, setIsCaptureHistoryOpen] = useState(false);

  const modifications = useMemo(() => {
    if (!isOpen) return [];

    const events: BirdEvent[] = [];
    for (const event of birdEventsStore.getAll().values()) {
      if (event.previousEventId && isBirdEventInCurrentBandGeneration(event, bandResetsMap)) events.push(event);
    }
    return events.sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt)).slice(0, 100);
  }, [isOpen, bandResetsMap]);

  const sortedModifications = useMemo(() => {
    const direction = sortDescriptor.direction === "descending" ? -1 : 1;
    const column = sortDescriptor.column as ModificationColumn;

    return [...modifications].sort((a, b) => {
      const values: Record<ModificationColumn, [string, string]> = {
        band: [a.band.id, b.band.id],
        datetime: [`${a.date} ${a.time}`, `${b.date} ${b.time}`],
        species: [a.species, b.species],
        modifiedBy: [a.modifiedBy ?? "", b.modifiedBy ?? ""],
        modifiedAt: [a.updatedAt, b.updatedAt],
      };
      return values[column][0].localeCompare(values[column][1], undefined, { numeric: true }) * direction;
    });
  }, [modifications, sortDescriptor]);

  return (
    <>
      <ModalShell
        modalProps={{
          isDismissable: false,
          isOpen,
          onClose,
          className: "!max-w-[calc(100%-8rem)]",
          scrollBehavior: "inside",
        }}
      >
        <ModalHeaderShell>
          <div>
            <h2 className="text-xl">Recent Modifications</h2>
            <p className="text-sm text-default-900 font-light">Last {modifications.length} edited captures</p>
          </div>
        </ModalHeaderShell>

        <ModalBodyShell>
          <div className="overflow-hidden rounded-medium border border-default-200">
            <Table
              aria-label="recent modifications table"
              isHeaderSticky
              isVirtualized
              maxTableHeight={800}
              sortDescriptor={sortDescriptor}
              onSortChange={setSortDescriptor}
              classNames={{
                base: "table-fixed",
                table: "table-fixed",
                wrapper: "shadow-none",
                th: "bg-default-100 text-xs font-semibold uppercase tracking-wide text-default-600",
                td: "text-sm select-text group-hover:bg-default-100 first:rounded-l-medium last:rounded-r-medium",
              }}
            >
              <TableHeader columns={columns}>
                {(column) => (
                  <TableColumn key={column.key} allowsSorting className={`whitespace-nowrap ${column.className}`}>
                    {column.label}
                  </TableColumn>
                )}
              </TableHeader>
              <TableBody items={sortedModifications} emptyContent="No modifications found">
                {(event) => (
                  <TableRow
                    key={event.id}
                    className="cursor-pointer group"
                    onClick={() => {
                      setSelectedBirdEvent(event);
                      setIsCaptureHistoryOpen(true);
                    }}
                  >
                    {(columnKey) => {
                      switch (columnKey as ModificationColumn) {
                        case "band":
                          return <TableCell className="font-bold">{event.band.id}</TableCell>;
                        case "datetime":
                          return <TableCell>{event.date} {event.time}</TableCell>;
                        case "species":
                          return <TableCell className="font-bold"><SpeciesTooltip speciesCode={event.species} /></TableCell>;
                        case "modifiedBy":
                          return <TableCell>{event.modifiedBy ?? "Not recorded"}</TableCell>;
                        case "modifiedAt":
                          return <TableCell>{formatTimestamp(event.updatedAt)}</TableCell>;
                      }
                    }}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </ModalBodyShell>

        <ModalFooterShell>
          <Button color="primary" variant="bordered" onPress={onClose}>
            Close
          </Button>
        </ModalFooterShell>
      </ModalShell>

      <CaptureHistoryModal
        isOpen={isCaptureHistoryOpen}
        onOpenChange={setIsCaptureHistoryOpen}
        bandId={selectedBirdEvent?.band.id ?? null}
        birdEventIdToHighlight={selectedBirdEvent?.id}
      />
    </>
  );
}
