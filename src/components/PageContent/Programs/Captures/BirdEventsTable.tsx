import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, type SortDescriptor } from "@heroui/react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BirdEvent, CaptureFormData } from "../../../../types";
import { TABLE_COLUMNS, formatUpdatedAt } from "./helpers";
import CaptureHistoryModal from "../../../Modals/CaptureHistoryModal";
import { PencilSquareIcon, ClockIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import AddBirdEventModal from "../../../Modals/AddBirdEventModal";
import ModificationHistoryModal from "../../../Modals/ModificationHistoryModal";
import { useData } from "../../../../services/useData";
import SpeciesTooltip from "../../../Helper/Info/SpeciesTooltip";
import AgeTooltip from "../../../Helper/Info/AgeTooltip";
import VolunteerTooltip from "../../../Helper/Info/VolunteerTooltip";
import { useCascadingSort, cascadingSort } from "../../../../hooks/useCascadingSort";

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
  maxRows?: number;
  scrollToEnd?: boolean;
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
  maxRows,
  scrollToEnd = false,
}: BirdEventsTableProps) {
  const { programsMap, isLoggedIn, isOnline, queuedEventIds, bandIdToBirdEventIdsMap } = useData();
  const { sortDescriptors, handleSortChange } = useCascadingSort(
    initialSortDescriptors ?? [
      { column: "date", direction: "ascending" },
      { column: "time", direction: "ascending" },
    ]
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
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

  const numericColumns = useMemo(
    () => new Set<string>(TABLE_COLUMNS.filter((col) => col.type === "number").map((col) => col.key)),
    []
  );

  // Sort birdEvents based on multiple sortDescriptors (cascading sort)
  const sortedRows = useMemo(
    () =>
      (() => {
        const sorted = cascadingSort(rows, sortDescriptors, numericColumns, (column, a, b) => {
          if (column === "bandLastTwoDigits") {
            const firstVal = parseFloat(String(a[column])) || 100;
            const secondVal = parseFloat(String(b[column])) || 100;
            return firstVal - secondVal;
          }
          return undefined;
        });
        return maxRows ? sorted.slice(0, maxRows) : sorted;
      })(),
    [rows, sortDescriptors, numericColumns, maxRows]
  );

  // Scroll the last <tr> into view whenever the row set changes, so the
  // newest capture (ascending sort) is visible. scrollIntoView walks up the
  // tree and handles the scroll container for us — no assumptions about
  // HeroUI's nested wrappers or refs. Works in tabs and PWA alike.
  // React-Aria commits table rows across a few paints; rescroll whenever the
  // tbody's children change for a short window so the last-row target stays
  // accurate even if it arrives late.
  useLayoutEffect(() => {
    if (!scrollToEnd) return;
    const container = containerRef.current;
    if (!container) return;

    const scrollLast = () => {
      const rows = container.querySelectorAll<HTMLTableRowElement>("tbody tr");
      const lastRow = rows[rows.length - 1];
      if (!lastRow) return;

      // Find scroll container
      let scrollEl: HTMLElement | null = lastRow.parentElement;
      while (scrollEl && scrollEl.scrollHeight <= scrollEl.clientHeight) {
        scrollEl = scrollEl.parentElement;
      }
      if (!scrollEl) return;

      // Preserve horizontal scroll position
      const scrollLeft = scrollEl.scrollLeft;
      scrollEl.scrollTop = scrollEl.scrollHeight;
      scrollEl.scrollLeft = scrollLeft;
    };

    scrollLast();

    const tbody = container.querySelector("tbody");
    if (!tbody) return;
    let settled = false;
    const timeout = window.setTimeout(() => { settled = true; }, 400);
    const observer = new MutationObserver(() => {
      if (!settled) scrollLast();
    });
    observer.observe(tbody, { childList: true });

    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, [sortedRows, scrollToEnd]);

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
      if (!isOnline && !queuedEventIds.has(eventId)) return;
      const event = birdEventsMap.get(eventId);
      if (event) {
        setSelectedBirdEvent(event);
        setIsEditModalOpen(true);
      }
    },
    [birdEventsMap, isOnline, queuedEventIds]
  );

  const renderCell = useCallback(
    (item: TableRow, columnKey: React.Key) => {
      if (columnKey === "actions") {
        // Calculate band ID and count of events for this band
        const bandId = item.bandGroup + item.bandLastTwoDigits;
        const eventCount = bandIdToBirdEventIdsMap[bandId]?.length ?? 0;

        return (
          <div className="relative flex items-center justify-center gap-2">
            <>
              {allowInspectBandId && (
                <span className="cursor-pointer flex items-center gap-1" onClick={() => handleInspectBandId(item.id)}>
                  <MagnifyingGlassIcon className="w-4 h-4" />
                  <span className="text-xs">({eventCount})</span>
                </span>
              )}
              {allowInspectHistory && item.previousEventId && (
                <span className="cursor-pointer" onClick={() => handleInspectHistory(item.id)}>
                  <ClockIcon className="w-4 h-4" />
                </span>
              )}
              {allowInspectHistory && isLoggedIn && (isOnline || queuedEventIds.has(item.id)) && (
                <span className="cursor-pointer" onClick={() => handleEdit(item.id)}>
                  <PencilSquareIcon className="w-4 h-4" />
                </span>
              )}
            </>
          </div>
        );
      }

      if (columnKey === "programId") {
        return programsMap[item.programId]?.id;
      }

      if (columnKey === "updatedAt") {
        return formatUpdatedAt(item.updatedAt);
      }

      if (columnKey === "species") {
        return <SpeciesTooltip speciesCode={item.species} />;
      }

      if (columnKey === "age") {
        return <AgeTooltip ageCode={item.age} />;
      }

      if (columnKey === "bander") {
        return <VolunteerTooltip volunteerCode={item.bander} />;
      }

      if (columnKey === "scribe") {
        return <VolunteerTooltip volunteerCode={item.scribe} />;
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
      isOnline,
      queuedEventIds,
      bandIdToBirdEventIdsMap,
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
      <div className="w-full flex flex-col gap-4" ref={containerRef}>
        <div className="text-sm">
          showing {rows.length} of {birdEvents.length} {rows.length === 1 ? "entry" : "entries"}
        </div>
        <Table
          isHeaderSticky
          aria-label="birdEvents table"
          sortDescriptor={primarySortDescriptor}
          onSortChange={handleSortChange}
          isVirtualized={!scrollToEnd}
          maxTableHeight={maxTableHeight}
          classNames={{
            base: "table-fixed",
            table: "table-fixed",
            td: "data-[selected=true]:!text-black",
            wrapper: scrollToEnd ? "h-[500px] overflow-auto" : undefined,
          }}
          selectionMode="single"
          selectedKeys={birdEventIdToHighlight ? new Set([birdEventIdToHighlight]) : new Set()}
          disallowEmptySelection
          color="primary"
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
          <TableBody items={sortedRows}>
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
