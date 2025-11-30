import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, type SortDescriptor } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import { type Capture, generateCaptureTableId } from "../../../../helper/helper";

const CAPTURE_COLUMNS: { key: keyof Capture; label: string; className: string }[] = [
  { key: "program", label: "Program", className: "min-w-[150px]" },
  { key: "bandGroupId", label: "Band Group", className: "" },
  { key: "bandLastTwoDigits", label: "Band", className: "" },
  { key: "species", label: "Species", className: "" },
  { key: "wing", label: "Wing", className: "" },
  { key: "age", label: "Age", className: "" },
  { key: "howAged", label: "How Aged", className: "" },
  { key: "sex", label: "Sex", className: "w-[50px]" },
  { key: "howSexed", label: "How Sexed", className: "" },
  { key: "fat", label: "Fat", className: "" },
  { key: "weight", label: "Weight", className: "" },
  { key: "date", label: "Date", className: "" },
  { key: "time", label: "Time", className: "" },
  { key: "bander", label: "Bander", className: "" },
  { key: "scribe", label: "Scribe", className: "" },
  { key: "net", label: "Net", className: "" },
  { key: "notes", label: "Notes", className: "min-w-[300px]" },
];

interface CapturesTableProps {
  program: string;
  captures: Capture[];
  maxTableHeight: number;
  sortColumn: keyof Capture;
  sortDirection: "ascending" | "descending";
}

export default function CapturesTable({
  program,
  captures,
  maxTableHeight,
  sortColumn,
  sortDirection,
}: CapturesTableProps) {
  const [sortDescriptors, setSortDescriptors] = useState<SortDescriptor[]>([
    { column: sortColumn, direction: sortDirection },
  ]);

  // Sort captures based on multiple sortDescriptors (cascading sort)
  const sortedCaptures = useMemo(() => {
    if (sortDescriptors.length === 0) return captures;

    return [...captures].sort((a, b) => {
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
          const firstVal = parseInt(String(first)) || first;
          const secondVal = parseInt(String(second)) || second;
          cmp = firstVal < secondVal ? -1 : firstVal > secondVal ? 1 : 0;
        }

        if (cmp !== 0) {
          return descriptor.direction === "descending" ? -cmp : cmp;
        }
      }
      return 0;
    });
  }, [captures, sortDescriptors]);

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
    <div className="w-full flex flex-col gap-2">
      <div className="text-default-700 text-sm">
        {captures.length} {captures.length === 1 ? "capture" : "captures"}
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
            <TableRow key={item.id} className={item.program !== program ? "opacity-20" : ""}>
              {(columnKey) => {
                if (columnKey === "lastTwoDigits") {
                  return <TableCell className="whitespace-nowrap">{generateCaptureTableId(item)}</TableCell>;
                } else {
                  return <TableCell className="whitespace-nowrap">{item[columnKey as keyof Capture]}</TableCell>;
                }
              }}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
