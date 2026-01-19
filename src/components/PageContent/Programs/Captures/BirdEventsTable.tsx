import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, type SortDescriptor } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import type { BirdEvent, CaptureFormData } from "../../../../types";
import { TABLE_COLUMNS, formatUpdatedAt } from "./helpers";
import CaptureHistoryModal from "../../../Modals/CaptureHistoryModal";
import { PencilSquareIcon, ClockIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import AddBirdEventModal from "../../../Modals/AddBirdEventModal";
import ModificationHistoryModal from "../../../Modals/ModificationHistoryModal";
import { useData } from "../../../../services/useData";
import SpeciesTooltip from "../../../Helper/Info/SpeciesTooltip";

// Helper to convert BirdEvent to table row format
function birdEventToRow(event: BirdEvent): TableRow {
  return {
    id: event.id,
    programId: event.programId,
    bandGroup: event.band?.bandGroupId ?? "",
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
    birdEventType: event.birdEventType,
    birdStatus: event.birdStatus,
    notes: event.notes,
    modifiedEventId: event.modifiedEventId,
    previousEventId: event.previousEventId,
    updatedAt: event.updatedAt,
  };
}

type TableRow = CaptureFormData & {
  id: string;
  modifiedEventId?: string | null;
  previousEventId?: string | null;
  updatedAt?: string;
};

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
  birdEventIdToHighlight?: string;
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
  birdEventIdToHighlight,
}: BirdEventsTableProps) {
  const { programsMap, isLoggedIn } = useData();
  const [sortDescriptors, setSortDescriptors] = useState<SortDescriptor[]>(
    initialSortDescriptors ?? [
      { column: "date", direction: "descending" },
      { column: "time", direction: "descending" },
    ]
  );
  const [selectedBirdEvent, setSelectedBirdEvent] = useState<BirdEvent | null>(null);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCaptureHistoryModalOpen, setIsCaptureHistoryModalOpen] = useState(false);
  const [isModificationHistoryModalOpen, setIsModificationHistoryModalOpen] = useState(false);

  // Create a map for O(1) lookups and deduplicate/filter/map in single pass
  const { birdEventsMap, rows } = useMemo(() => {
    const eventsMap = new Map<string, BirdEvent>();
    const tableRows: TableRow[] = [];

    for (const event of birdEvents) {
      // Skip duplicates
      if (eventsMap.has(event.id)) continue;

      eventsMap.set(event.id, event);

      // Skip modified events unless showHistory is true
      if (!showHistory && event.modifiedEventId != null) continue;

      // Skip events from other programs if needed
      if (
        programId !== undefined &&
        showOtherPrograms !== undefined &&
        !showOtherPrograms &&
        event.programId !== programId
      )
        continue;

      tableRows.push(birdEventToRow(event));
    }

    return { birdEventsMap: eventsMap, rows: tableRows };
  }, [birdEvents, showHistory, programId, showOtherPrograms]);

  // Sort birdEvents based on multiple sortDescriptors (cascading sort)
  const sortedRows = useMemo(() => {
    if (sortDescriptors.length === 0) return rows;

    // Numeric columns that should be sorted numerically - determined by column type
    const numericColumns = new Set<string>(TABLE_COLUMNS.filter(col => col.type === 'number').map(col => col.key));

    return [...rows].sort((a, b) => {
      for (const descriptor of sortDescriptors) {
        const column = descriptor.column as keyof TableRow;
        const first = a[column];
        const second = b[column];

        let cmp: number;

        if (numericColumns.has(column)) {
          const firstNum = parseFloat(String(first)) || 0;
          const secondNum = parseFloat(String(second)) || 0;
          
          // Special handling for bandLastTwoDigits: 00 should come after 99
          if (column === "bandLastTwoDigits") {
            const firstVal = firstNum || 100;
            const secondVal = secondNum || 100;
            cmp = firstVal - secondVal;
          } else {
            cmp = firstNum - secondNum;
          }
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
  }, [rows, sortDescriptors]);

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
      const event = birdEventsMap.get(eventId);
      if (event?.band) {
        setSelectedBirdEvent(event);
        setSelectedBandId(event.band.id);
        setIsCaptureHistoryModalOpen(true);
      }
    },
    [birdEventsMap]
  );

  const handleInspectHistory = useCallback(
    (eventId: string) => {
      const event = birdEventsMap.get(eventId);
      if (event) {
        setSelectedBirdEvent(event);
        setIsModificationHistoryModalOpen(true);
      }
    },
    [birdEventsMap]
  );

  const handleEdit = useCallback(
    (eventId: string) => {
      const event = birdEventsMap.get(eventId);
      if (event) {
        setSelectedBirdEvent(event);
        setIsEditModalOpen(true);
      }
    },
    [birdEventsMap]
  );

  const renderCell = useCallback(
    (item: TableRow, columnKey: React.Key) => {
      if (columnKey === "actions") {
        return (
          <div className="relative flex items-center justify-center gap-2">
            <>
              {allowInspectBandId && (
                <span className="cursor-pointer" onClick={() => handleInspectBandId(item.id)}>
                  <MagnifyingGlassIcon className="w-4 h-4" />
                </span>
              )}
              {allowInspectHistory && item.previousEventId && (
                <span className="cursor-pointer" onClick={() => handleInspectHistory(item.id)}>
                  <ClockIcon className="w-4 h-4" />
                </span>
              )}
              {allowInspectHistory && isLoggedIn && (
                <span className="cursor-pointer" onClick={() => handleEdit(item.id)}>
                  <PencilSquareIcon className="w-4 h-4" />
                </span>
              )}
            </>
          </div>
        );
      }

      if (columnKey === "programId") {
        return programsMap[item.programId]?.displayName;
      }

      if (columnKey === "updatedAt") {
        return formatUpdatedAt(item.updatedAt);
      }

      if (columnKey === "species") {
        return <SpeciesTooltip speciesCode={item.species} />;
      }

      const cellValue = item[columnKey as keyof TableRow];
      return cellValue;
    },
    [
      handleInspectBandId,
      handleInspectHistory,
      handleEdit,
      allowInspectBandId,
      allowInspectHistory,
      programsMap,
      isLoggedIn,
    ]
  );

  const primarySortDescriptor = sortDescriptors[0];

  // Filter columns based on hiddenColumns prop
  const displayColumns = useMemo(
    () => TABLE_COLUMNS.filter((column) => !hiddenColumns.includes(column.key)),
    [hiddenColumns]
  );

  return (
    <>
      <div className="w-full flex flex-col gap-4">
        <div className="text-sm">
          showing {rows.length} of {birdEvents.length} {rows.length === 1 ? "entry" : "entries"}
        </div>
        <Table
          isHeaderSticky
          aria-label="birdEvents table"
          sortDescriptor={primarySortDescriptor}
          onSortChange={handleSortChange}
          isVirtualized
          maxTableHeight={maxTableHeight}
          selectionMode="single"
          selectedKeys={birdEventIdToHighlight ? new Set([birdEventIdToHighlight]) : new Set()}
          // selectedKeys={birdEventIdToHighlight ? new Set([]) : new Set()}
          disallowEmptySelection
          color="primary"
          classNames={{
            base: "table-fixed",
            table: "table-fixed",
            td: "data-[selected=true]:!text-black",
          }}
        >
          <TableHeader columns={displayColumns}>
            {(column) => (
              <TableColumn
                key={column.key}
                allowsSorting={column.key !== "actions"}
                className={`whitespace-nowrap ${column.tableClassName ?? ""}`}
              >
                {column.key === "howAged" || column.key === "howSexed" ? "" : column.label}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody items={sortedRows} emptyContent="No birdEvents found">
            {(item) => {
              const isLowOpacity = (programId && item.programId !== programId) || !!item.modifiedEventId;
              const rowKey = item.id;
              return (
                <TableRow key={rowKey}>
                  {(columnKey) => (
                    <TableCell
                      className={`whitespace-nowrap select-text ${
                        columnKey !== "actions" && isLowOpacity ? "opacity-20" : ""
                      }`}
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
        isNewCapture={false}
      />

      <CaptureHistoryModal
        isOpen={isCaptureHistoryModalOpen}
        onOpenChange={setIsCaptureHistoryModalOpen}
        bandId={selectedBandId}
        birdEventIdToHighlight={selectedBirdEvent?.id || undefined}
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
