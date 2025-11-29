import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  type SortDescriptor,
} from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import { type Capture, generateCaptureTableId } from "../../../../helper/helper";

const CAPTURE_COLUMNS: { key: keyof Capture; label: string }[] = [
  { key: "program", label: "Program" },
  { key: "bandGroupId", label: "Band Group" },
  { key: "bandLastTwoDigits", label: "Band" },
  { key: "species", label: "Species" },
  { key: "wing", label: "Wing" },
  { key: "age", label: "Age" },
  { key: "howAged", label: "How Aged" },
  { key: "howSexed", label: "How Sexed" },
  { key: "sex", label: "Sex" },
  { key: "fat", label: "Fat" },
  { key: "weight", label: "Weight" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "bander", label: "Bander" },
  { key: "scribe", label: "Scribe" },
  { key: "net", label: "Net" },
  { key: "notes", label: "Notes" },
];

interface CapturesTableProps {
  program: string;
  captures: Capture[];
}

export default function CapturesTable({ program, captures }: CapturesTableProps) {
  const [sortDescriptors, setSortDescriptors] = useState<SortDescriptor[]>([
    { column: "bandLastTwoDigits", direction: "ascending" },
  ]);

  // Sort captures based on multiple sortDescriptors (cascading sort)
  const sortedCaptures = useMemo(() => {
    if (sortDescriptors.length === 0) return captures;

    return [...captures].sort((a, b) => {
      for (const descriptor of sortDescriptors) {
        const column = descriptor.column as keyof Capture;
        const first = a[column];
        const second = b[column];

        const firstVal = parseInt(String(first)) || first;
        const secondVal = parseInt(String(second)) || second;

        const cmp = firstVal < secondVal ? -1 : firstVal > secondVal ? 1 : 0;

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
      >
      <TableHeader columns={CAPTURE_COLUMNS}>
        {(column) => (
          <TableColumn key={column.key} allowsSorting className="whitespace-nowrap">
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