import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, type SortDescriptor } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import type { BirdEvent, CaptureFormData } from "../../../../types";
import { CAPTURE_COLUMNS } from "./helpers";
import InspectCaptureModal from "../../../Modals/InspectCaptureModal";
import { EyeIcon, PencilSquareIcon, ClockIcon } from "@heroicons/react/24/outline";
import AddBirdEventModal from "../../../Modals/AddBirdEventModal";

// Helper to convert BirdEvent to table row format
function birdEventToRow(event: BirdEvent): CaptureFormData & { id: string } {
  return {
    id: event.id,
    programId: event.programId,
    bandGroup: event.band?.displayBandGroupId ?? "",
    bandLastTwoDigits: event.band?.last2digits ?? "",
    species: event.species,
    wing: String(event.wing || ""),
    age: event.age,
    howAged: event.howAged,
    sex: event.sex,
    howSexed: event.howSexed,
    fat: String(event.fat || ""),
    weight: String(event.weight || ""),
    date: event.date,
    time: event.time,
    bander: event.bander,
    scribe: event.scribe,
    net: event.net,
    captureType: event.birdEventType,
    notes: event.notes,
  };
}

type TableRow = CaptureFormData & { id: string };

interface BirdEventsTableProps {
  programId?: string;
  showOtherPrograms?: boolean;
  birdEvents: BirdEvent[];
  maxTableHeight: number;
  sortDescriptors?: SortDescriptor[];
  allowInspect?: boolean;
}

export default function BirdEventsTable({
  programId,
  birdEvents,
  maxTableHeight,
  sortDescriptors: initialSortDescriptors,
  showOtherPrograms,
  allowInspect = true,
}: BirdEventsTableProps) {
  const [sortDescriptors, setSortDescriptors] = useState<SortDescriptor[]>(
    initialSortDescriptors ?? [{ column: "date", direction: "descending" }]
  );
  const [selectedBirdEvent, setSelectedBirdEvent] = useState<BirdEvent | null>(null);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);

  // Convert BirdEvents to table rows (exclude events that have been modified)
  const rows = useMemo(
    () => birdEvents.filter((birdEvent) => birdEvent.modifiedEventId == null).map(birdEventToRow),
    [birdEvents]
  );

  // Filter birdEvents based on showOtherPrograms
  const filteredRows = useMemo(() => {
    if (programId === undefined || showOtherPrograms === undefined) {
      return rows;
    }
    if (showOtherPrograms) {
      return rows;
    } else {
      return rows.filter((row) => row.programId === programId);
    }
  }, [rows, showOtherPrograms, programId]);

  // Sort birdEvents based on multiple sortDescriptors (cascading sort)
  const sortedRows = useMemo(() => {
    if (sortDescriptors.length === 0) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      for (const descriptor of sortDescriptors) {
        const column = descriptor.column as keyof TableRow;
        const first = a[column];
        const second = b[column];

        let cmp: number;

        // Special handling for bandLastTwoDigits: 00 should come after 99
        if (column === "bandLastTwoDigits") {
          const firstNum = parseInt(String(first), 10);
          const secondNum = parseInt(String(second), 10);
          // Treat 00 as 100 so it sorts last
          const firstVal = firstNum || 100;
          const secondVal = secondNum || 100;
          cmp = firstVal - secondVal;
        } else {
          // String comparison works for date (YYYY-MM-DD), time, and other text columns
          cmp = String(first).localeCompare(String(second));
        }

        if (cmp !== 0) {
          return descriptor.direction === "descending" ? -cmp : cmp;
        }
      }
      return 0;
    });
  }, [filteredRows, sortDescriptors]);

  const handleSortChange = useCallback((descriptor: SortDescriptor) => {
    setSortDescriptors((prev) => {
      const existingIndex = prev.findIndex((d) => d.column === descriptor.column);

      if (existingIndex === 0) {
        const updated = [...prev];
        updated[0] = descriptor;
        return updated;
      } else if (existingIndex > 0) {
        const updated = prev.filter((d) => d.column !== descriptor.column);
        return [descriptor, ...updated];
      } else {
        return [descriptor, ...prev].slice(0, 3);
      }
    });
  }, []);

  const handleInspect = useCallback(
    (eventId: string) => {
      const event = birdEvents.find((e) => e.id === eventId);
      if (event && event.band) {
        setSelectedBandId(event.band.id);
        setIsInspectModalOpen(true);
      }
    },
    [birdEvents]
  );

  const handleEdit = useCallback(
    (eventId: string) => {
      const event = birdEvents.find((e) => e.id === eventId);
      if (event) {
        setSelectedBirdEvent(event);
        setIsEditModalOpen(true);
      }
    },
    [birdEvents]
  );

  const renderCell = useCallback(
    (item: TableRow, columnKey: React.Key) => {
      if (columnKey === "actions") {
        return (
          <div className="relative flex items-center gap-2">
            {allowInspect && (
              <>
                <span
                  className="text-lg text-default-600 cursor-pointer active:opacity-50"
                  onClick={() => handleInspect(item.id)}
                >
                  <EyeIcon className="w-5 h-5" />
                </span>
                <span
                  className="text-lg text-default-600 cursor-pointer active:opacity-50"
                  onClick={() => handleEdit(item.id)}
                >
                  <PencilSquareIcon className="w-5 h-5" />
                </span>
              </>
            )}
            {!allowInspect && (
              <span
                className="text-lg text-default-600 cursor-pointer active:opacity-50"
                onClick={() => handleInspect(item.id)}
              >
                <ClockIcon className="w-5 h-5" />
              </span>
            )}
          </div>
        );
      }

      const cellValue = item[columnKey as keyof TableRow];
      return cellValue;
    },
    [handleInspect, handleEdit, allowInspect]
  );

  const primarySortDescriptor = sortDescriptors[0];

  // Always show all columns including actions
  const displayColumns = CAPTURE_COLUMNS;

  return (
    <>
      <div className="w-full flex flex-col gap-4">
        <div className="text-sm">
          {filteredRows.length} of {rows.length} {rows.length === 1 ? "capture" : "birdEvents"}
        </div>
        <Table
          isHeaderSticky
          aria-label="birdEvents table"
          sortDescriptor={primarySortDescriptor}
          onSortChange={handleSortChange}
          isVirtualized
          maxTableHeight={maxTableHeight}
        >
          <TableHeader columns={displayColumns}>
            {(column) => (
              <TableColumn
                key={column.key}
                allowsSorting={column.key !== "actions"}
                className={`whitespace-nowrap ${column.className ?? ""}`}
              >
                {column.label}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody items={sortedRows} emptyContent="No birdEvents found">
            {(item) => (
              <TableRow key={item.id} className={programId && item.programId !== programId ? "opacity-20" : ""}>
                {(columnKey) => <TableCell className="whitespace-nowrap">{renderCell(item, columnKey)}</TableCell>}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AddBirdEventModal
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        birdEventToModify={selectedBirdEvent || undefined}
      />

      <InspectCaptureModal isOpen={isInspectModalOpen} onOpenChange={setIsInspectModalOpen} bandId={selectedBandId} />
    </>
  );
}
