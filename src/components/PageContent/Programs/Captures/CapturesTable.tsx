import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, type SortDescriptor } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import type { Capture } from "../../../../types";
import { CAPTURE_COLUMNS } from "./helpers";

// const CAPTURE_COLUMNS: { key: keyof Capture; label: string; className: string }[] = [
//   { key: "programId", label: "Program", className: "min-w-[150px]" },
//   { key: "bandGroup", label: "Band Group", className: "" },
//   { key: "bandLastTwoDigits", label: "Band", className: "" },
//   { key: "species", label: "Species", className: "" },
//   { key: "wing", label: "Wing", className: "" },
//   { key: "age", label: "Age", className: "" },
//   { key: "sex", label: "Sex", className: "" },
//   { key: "fat", label: "Fat", className: "" },
//   { key: "weight", label: "Weight", className: "" },
//   { key: "date", label: "Date", className: "" },
//   { key: "time", label: "Time", className: "" },
//   { key: "bander", label: "Bander", className: "" },
//   { key: "scribe", label: "Scribe", className: "" },
//   { key: "net", label: "Net", className: "" },
//   { key: "captureType", label: "Capture Type", className: "" },
//   { key: "notes", label: "Notes", className: "min-w-[300px]" },
// ];

interface CapturesTableProps {
  programId?: string;
  showOtherPrograms?: boolean;
  captures: Capture[];
  maxTableHeight: number;
  sortColumn: keyof Capture;
  sortDirection: "ascending" | "descending";
}

export default function CapturesTable({
  programId,
  captures,
  maxTableHeight,
  sortColumn,
  sortDirection,
  showOtherPrograms,
}: CapturesTableProps) {
  const [sortDescriptors, setSortDescriptors] = useState<SortDescriptor[]>([
    { column: sortColumn, direction: sortDirection },
  ]);

  // Filter captures based on showOtherPrograms
  const filteredCaptures = useMemo(() => {
    if (programId === undefined || showOtherPrograms === undefined) {
      return captures;
    }
    if (showOtherPrograms) {
      return captures;
    } else {
      return captures.filter((capture) => capture.programId === programId);
    }
  }, [captures, showOtherPrograms, programId]);

  // Sort captures based on multiple sortDescriptors (cascading sort)
  const sortedCaptures = useMemo(() => {
    if (sortDescriptors.length === 0) return filteredCaptures;

    return [...filteredCaptures].sort((a, b) => {
      for (const descriptor of sortDescriptors) {
        const column = descriptor.column as keyof Capture;
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
  }, [filteredCaptures, sortDescriptors]);

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
        {filteredCaptures.length} of {captures.length} {captures.length === 1 ? "capture" : "captures"}
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
            <TableColumn key={column.key} allowsSorting className={`whitespace-nowrap ${column.className}`}>
              {column.label}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody items={sortedCaptures} emptyContent="No captures found">
          {(item) => (
            <TableRow key={item.id} className={programId && item.programId !== programId ? "opacity-20" : ""}>
              {(columnKey) => {
                let value: string | number = item[columnKey as keyof Capture];
                if (columnKey === "age" && item.howAged) {
                  value = `${item.age} | ${item.howAged}`;
                } else if (columnKey === "sex" && item.howSexed) {
                  value = `${item.sex} | ${item.howSexed}`;
                }
                return <TableCell className="whitespace-nowrap">{value}</TableCell>;
              }}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
