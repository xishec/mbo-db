import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, type SortDescriptor } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import type { BirdEvent, CaptureFormData } from "../../../../types";
import { CAPTURE_COLUMNS } from "./helpers";

// Helper to convert BirdEvent to table row format
function birdEventToRow(event: BirdEvent): CaptureFormData & { id: string } {
  return {
    id: event.id,
    programId: event.programId,
    bandGroup: event.band?.bandGroupId ?? "",
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
  captures: BirdEvent[];
  maxTableHeight: number;
  sortColumn: keyof CaptureFormData;
  sortDirection: "ascending" | "descending";
}

export default function BirdEventsTable({
  programId,
  captures,
  maxTableHeight,
  sortColumn,
  sortDirection,
  showOtherPrograms,
}: BirdEventsTableProps) {
  const [sortDescriptors, setSortDescriptors] = useState<SortDescriptor[]>([
    { column: sortColumn, direction: sortDirection },
  ]);

  // Convert BirdEvents to table rows
  const rows = useMemo(() => captures.map(birdEventToRow), [captures]);

  // Filter captures based on showOtherPrograms
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

  // Sort captures based on multiple sortDescriptors (cascading sort)
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

  const primarySortDescriptor = sortDescriptors[0];

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="text-sm">
        {filteredRows.length} of {rows.length} {rows.length === 1 ? "capture" : "captures"}
      </div>
      <Table
        isHeaderSticky
        aria-label="Captures table"
        sortDescriptor={primarySortDescriptor}
        onSortChange={handleSortChange}
        isVirtualized
        maxTableHeight={maxTableHeight}
      >
        <TableHeader columns={CAPTURE_COLUMNS}>
          {(column) => (
            <TableColumn key={column.key} allowsSorting className={`whitespace-nowrap ${column.className ?? ""}`}>
              {column.label}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody items={sortedRows} emptyContent="No captures found">
          {(item) => (
            <TableRow key={item.id} className={programId && item.programId !== programId ? "opacity-20" : ""}>
              {(columnKey) => {
                const value = item[columnKey as keyof TableRow];
                return <TableCell className="whitespace-nowrap">{value}</TableCell>;
              }}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
