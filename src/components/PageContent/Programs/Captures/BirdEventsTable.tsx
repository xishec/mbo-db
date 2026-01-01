import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, type SortDescriptor } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import type { BirdEvent, CaptureFormData } from "../../../../types";
import { CAPTURE_COLUMNS } from "./helpers";
import CaptureHistoryModal from "../../../Modals/CaptureHistoryModal";
import { EyeIcon, PencilSquareIcon, ClockIcon } from "@heroicons/react/24/outline";
import AddBirdEventModal from "../../../Modals/AddBirdEventModal";
import ModificationHistoryModal from "../../../Modals/ModificationHistoryModal";

// Helper to convert BirdEvent to table row format
function birdEventToRow(event: BirdEvent): TableRow {
  return {
    id: event.id,
    programId: event.programId,
    bandGroup: event.band?.displayBandGroupId ?? "",
    bandLastTwoDigits: event.band?.last2digits ?? "",
    species: event.species,
    wing: String(event.wing),
    age: event.age,
    howAged: event.howAged,
    sex: event.sex,
    howSexed: event.howSexed,
    fat: String(event.fat),
    weight: String(event.weight),
    date: event.date,
    time: event.time,
    bander: event.bander,
    scribe: event.scribe,
    net: event.net,
    captureType: event.birdEventType,
    notes: event.notes,
    modifiedEventId: event.modifiedEventId,
    previousEventId: event.previousEventId,
  };
}

type TableRow = CaptureFormData & { id: string; modifiedEventId?: string | null; previousEventId?: string | null };

interface BirdEventsTableProps {
  programId?: string;
  showOtherPrograms?: boolean;
  birdEvents: BirdEvent[];
  maxTableHeight: number;
  sortDescriptors?: SortDescriptor[];
  allowInspectBandId?: boolean;
  allowInspectHistory?: boolean;
  showHistory?: boolean;
  hiddenColumns?: string[];
}

export default function BirdEventsTable({
  programId,
  birdEvents,
  maxTableHeight,
  sortDescriptors: initialSortDescriptors,
  showOtherPrograms,
  allowInspectBandId = false,
  allowInspectHistory = false,
  showHistory = false,
  hiddenColumns = [],
}: BirdEventsTableProps) {
  const [sortDescriptors, setSortDescriptors] = useState<SortDescriptor[]>(
    initialSortDescriptors ?? [{ column: "date", direction: "descending" }]
  );
  const [selectedBirdEvent, setSelectedBirdEvent] = useState<BirdEvent | null>(null);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCaptureHistoryModalOpen, setIsCaptureHistoryModalOpen] = useState(false);
  const [isModificationHistoryModalOpen, setIsModificationHistoryModalOpen] = useState(false);

  // Convert BirdEvents to table rows (exclude events that have been modified)
  const rows = useMemo(
    () =>
      birdEvents.filter((birdEvent) => (showHistory ? true : birdEvent.modifiedEventId == null)).map(birdEventToRow),
    [birdEvents, showHistory]
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

  const handleInspectBandId = useCallback(
    (eventId: string) => {
      const event = birdEvents.find((e) => e.id === eventId);
      if (event && event.band) {
        setSelectedBandId(event.band.id);
        setIsCaptureHistoryModalOpen(true);
      }
    },
    [birdEvents]
  );

  const handleInspectHistory = useCallback(
    (eventId: string) => {
      const event = birdEvents.find((e) => e.id === eventId);
      if (event) {
        setSelectedBirdEvent(event);
        setIsModificationHistoryModalOpen(true);
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
          <div className="relative flex items-center justify-center gap-2">
            <>
              {allowInspectBandId && (
                <span className="cursor-pointer" onClick={() => handleInspectBandId(item.id)}>
                  <EyeIcon className="w-4 h-4" />
                </span>
              )}
              {allowInspectHistory && item.previousEventId && (
                <span className="cursor-pointer" onClick={() => handleInspectHistory(item.id)}>
                  <ClockIcon className="w-4 h-4" />
                </span>
              )}
              {showHistory ? (
                null
              ) : (
                <span className="cursor-pointer" onClick={() => handleEdit(item.id)}>
                  <PencilSquareIcon className="w-4 h-4" />
                </span>
              )}
            </>
          </div>
        );
      }

      const cellValue = item[columnKey as keyof TableRow];
      return cellValue;
    },
    [handleInspectBandId, handleInspectHistory, handleEdit, allowInspectBandId, allowInspectHistory, showHistory]
  );

  const primarySortDescriptor = sortDescriptors[0];

  // Filter columns based on hiddenColumns prop
  const displayColumns = CAPTURE_COLUMNS.filter((column) => !hiddenColumns.includes(column.key));

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
            {(item) => {
              const isLowOpacity = (programId && item.programId !== programId) || !!item.modifiedEventId;
              return (
                <TableRow key={item.id}>
                  {(columnKey) => (
                    <TableCell
                      className={`whitespace-nowrap ${columnKey !== "actions" && isLowOpacity ? "opacity-20" : ""}`}
                    >
                      {renderCell(item, columnKey)}
                    </TableCell>
                  )}
                </TableRow>
              );
            }}
          </TableBody>
        </Table>
      </div>

      <AddBirdEventModal
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        birdEventToModify={selectedBirdEvent || undefined}
      />

      <CaptureHistoryModal
        isOpen={isCaptureHistoryModalOpen}
        onOpenChange={setIsCaptureHistoryModalOpen}
        bandId={selectedBandId}
      />
      {selectedBirdEvent && (
        <ModificationHistoryModal
          isOpen={isModificationHistoryModalOpen}
          onOpenChange={setIsModificationHistoryModalOpen}
          birdEvent={selectedBirdEvent}
        />
      )}
    </>
  );
}
